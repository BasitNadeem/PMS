import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import type {
  ListRatePlansQuery,
  CreateRatePlanDto,
  UpdateRatePlanDto,
  SuggestRateQuery,
  CreateRatePlanCodeDto,
  UpdateRatePlanCodeDto,
} from "../schemas/ratePlans";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import {
  acquireSubscriptionQuotaLock,
  checkSubscriptionLimit,
  getEffectiveLimits,
} from "../lib/subscription";
import { publicWithTenant } from "../lib/publicTenant";
import { notifyHotelDataChanged } from "../lib/realtime";
import { getCurrentPKTDate } from "../lib/timezone";
import { ratePlanAppliesToStay, resolveCompanyRate } from "../lib/companyRates";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

type BookingContext = "SINGLE" | "TOUR_AGENCY" | "CORPORATE" | "OTHER";

const ELIGIBLE_TYPES: Record<BookingContext, string[]> = {
  TOUR_AGENCY: ["TRAVEL_AGENT", "STANDARD", "SEASONAL", "PROMOTIONAL"],
  CORPORATE:   ["CORPORATE",    "STANDARD", "SEASONAL", "PROMOTIONAL"],
  SINGLE:      ["STANDARD",     "SEASONAL", "PROMOTIONAL"],
  OTHER:       ["STANDARD",     "SEASONAL", "PROMOTIONAL"],
};

function getEligibleTypes(ctx: BookingContext | undefined): string[] {
  return ELIGIBLE_TYPES[ctx ?? "SINGLE"];
}

function codeIsAvailableToday(code: { validFrom: Date | null; validTo: Date | null }): boolean {
  const today = new Date(`${getCurrentPKTDate()}T00:00:00.000Z`);
  return (!code.validFrom || code.validFrom <= today) && (!code.validTo || code.validTo >= today);
}

/**
 * Personal codes issued to one guest carry `maxUses`; the shared corporate and
 * promo codes this table has always held leave it null and stay unlimited.
 */
function codeHasUsesLeft(code: { maxUses: number | null; usedCount: number }): boolean {
  return code.maxUses === null || code.usedCount < code.maxUses;
}

// Extracted core — callable with any WithTenantFn (authenticated or public).
async function suggestRateCore(wt: WithTenantFn, query: SuggestRateQuery, hotelId: string) {
  const { features } = await getEffectiveLimits(hotelId);
  if (!features.ratePlans) {
    const roomType = await wt((db) =>
      db.roomType.findUnique({ where: { id: query.roomTypeId }, select: { defaultRate: true } })
    );
    if (!roomType) throw new AppError(404, "Room type not found");
    if (query.promoCode) {
      const personalOffer = await wt((db) => db.ratePlanCode.findFirst({
        where: { hotelId, code: query.promoCode, isActive: true, discountPercent: { not: null } },
      }));
      if (!personalOffer || personalOffer.discountPercent === null || !codeIsAvailableToday(personalOffer) || !codeHasUsesLeft(personalOffer)) {
        throw new AppError(400, "Promo or corporate code is invalid or unavailable");
      }
      return {
        suggestedRate: Math.round(roomType.defaultRate * (100 - personalOffer.discountPercent) / 100),
        baseRate: roomType.defaultRate,
        discountPercent: personalOffer.discountPercent,
        matchedPlan: null,
        allMatchingPlans: [] as { id: string; name: string; rate: number }[],
        appliedCode: personalOffer.code,
        noDedicatedRateHint: null,
        rateSource: "ACCESS_CODE" as const,
        company: null,
      };
    }
    return {
      suggestedRate: roomType.defaultRate,
      baseRate: roomType.defaultRate,
      discountPercent: null,
      matchedPlan: null,
      allMatchingPlans: [] as { id: string; name: string; rate: number }[],
      appliedCode: null,
      noDedicatedRateHint: null,
      rateSource: "ROOM_DEFAULT" as const,
      company: null,
    };
  }

  const checkIn  = new Date(query.checkIn);
  const checkOut = new Date(query.checkOut);
  const nights   = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);

  if (nights < 1) throw new AppError(400, "Check-out must be after check-in");

  const [plans, company] = await wt((db) =>
    Promise.all([
      db.ratePlan.findMany({
      where: {
        isActive: true,
        minLos:   { lte: nights },
        OR: [
          { validFrom: null, validTo: null },
          { validFrom: { lte: checkOut }, validTo: null },
          { validFrom: null, validTo: { gte: checkIn } },
          { validFrom: { lte: checkOut }, validTo: { gte: checkIn } },
        ],
        items: { some: { roomTypeId: query.roomTypeId } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
      include: {
        items: {
          where: { roomTypeId: query.roomTypeId },
          select: { rate: true },
        },
      },
      }),
      query.companyId
        ? db.company.findFirst({
            where: { id: query.companyId, hotelId, deletedAt: null, isActive: true },
            select: { id: true, name: true, ratePlanId: true, discountPercent: true },
          })
        : Promise.resolve(null),
    ])
  );

  if (query.companyId && !company) throw new AppError(404, "Company not found");

  // Three-level sort: priority DESC → date-bounded before open-ended → createdAt DESC.
  // Prisma orderBy handles priority+createdAt but cannot express the nullability
  // specificity level, so JS sort is the final authority.
  const sorted = [...plans].sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aSpec = a.validFrom !== null ? 1 : 0;
    const bSpec = b.validFrom !== null ? 1 : 0;
    if (bSpec !== aSpec) return bSpec - aSpec;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const datePlans = sorted.filter((plan) => ratePlanAppliesToStay(plan, checkIn, checkOut, nights));

  // Public, no-code bookings must never pick a rate that was configured as
  // restricted. A valid access code below can select its linked plan instead.
  const eligible = datePlans.filter((p) =>
    p.companyId === null && getEligibleTypes(query.bookingContext).includes(p.type) && !p.codeRequired
  );
  const publicEligible = datePlans.filter((p) =>
    p.companyId === null && getEligibleTypes("SINGLE").includes(p.type) && !p.codeRequired
  );

  // Company-owned plans are private contracts. They only enter consideration
  // when that exact company was selected, and can never leak into generic
  // Travel Agent, Corporate or public Booking Engine suggestions.
  const companyPlans = company
    ? datePlans.filter((p) => p.companyId === company.id && !p.codeRequired)
    : [];
  const roomType = await wt((db) =>
    db.roomType.findUnique({ where: { id: query.roomTypeId }, select: { defaultRate: true } })
  );
  if (!roomType) throw new AppError(404, "Room type not found");

  const bestPlan = eligible[0];
  const baseRate = bestPlan ? bestPlan.items[0].rate : roomType.defaultRate;
  const publicBestPlan = publicEligible[0];
  const publicBaseRate = publicBestPlan ? publicBestPlan.items[0].rate : roomType.defaultRate;
  const companyResolution = resolveCompanyRate(
    company,
    datePlans
      .filter((plan) => !plan.codeRequired)
      .map((plan) => ({ id: plan.id, companyId: plan.companyId, rate: plan.items[0].rate })),
    publicBaseRate,
  );

  if (companyResolution?.source === "COMPANY_CONTRACT") {
    const companyPlan = datePlans.find((plan) => plan.id === companyResolution.plan.id)!;
    return {
      suggestedRate: companyResolution.rate,
      baseRate: publicBaseRate,
      discountPercent: null,
      matchedPlan: { id: companyPlan.id, name: companyPlan.name, type: companyPlan.type },
      allMatchingPlans: companyPlans.map((p) => ({ id: p.id, name: p.name, rate: p.items[0].rate })),
      noDedicatedRateHint: null,
      appliedCode: null,
      rateSource: "COMPANY_CONTRACT" as const,
      company: { id: company!.id, name: company!.name },
    };
  }

  if (companyResolution?.source === "COMPANY_DISCOUNT") {
    return {
      suggestedRate: companyResolution.rate,
      baseRate: publicBaseRate,
      discountPercent: companyResolution.discountPercent,
      matchedPlan: publicBestPlan ? { id: publicBestPlan.id, name: publicBestPlan.name, type: publicBestPlan.type } : null,
      allMatchingPlans: publicEligible.map((p) => ({ id: p.id, name: p.name, rate: p.items[0].rate })),
      noDedicatedRateHint: null,
      appliedCode: null,
      rateSource: "COMPANY_DISCOUNT" as const,
      company: { id: company!.id, name: company!.name },
    };
  }

  let noDedicatedRateHint: string | null = null;
  if (query.bookingContext === "TOUR_AGENCY" || query.bookingContext === "CORPORATE") {
    const dedicatedType = query.bookingContext === "TOUR_AGENCY" ? "TRAVEL_AGENT" : "CORPORATE";
    if (!eligible.some((p) => p.type === dedicatedType)) {
      const label = query.bookingContext === "TOUR_AGENCY" ? "Travel Agent" : "Corporate";
      noDedicatedRateHint = `No ${label} rate configured — using standard rate`;
    }
  }

  if (query.promoCode) {
    const accessCode = await wt((db) =>
      db.ratePlanCode.findFirst({
        where: {
          hotelId,
          code: query.promoCode,
          isActive: true,
        },
        include: {
          ratePlan: {
            include: {
              items: {
                where: { roomTypeId: query.roomTypeId },
                select: { rate: true },
              },
            },
          },
        },
      })
    );

    if (!accessCode || !codeIsAvailableToday(accessCode) || !codeHasUsesLeft(accessCode)) {
      throw new AppError(400, "Promo or corporate code is invalid or unavailable");
    }

    if (accessCode.discountPercent !== null) {
      const suggestedRate = Math.round(baseRate * (100 - accessCode.discountPercent) / 100);
      return {
        suggestedRate,
        baseRate,
        discountPercent: accessCode.discountPercent,
        matchedPlan: bestPlan ? { id: bestPlan.id, name: bestPlan.name, type: bestPlan.type } : null,
        allMatchingPlans: eligible.map((p) => ({ id: p.id, name: p.name, rate: p.items[0].rate })),
        noDedicatedRateHint,
        appliedCode: accessCode.code,
        rateSource: "ACCESS_CODE" as const,
        company: null,
      };
    }

    if (
      !accessCode.ratePlan ||
      !accessCode.ratePlan.codeRequired ||
      !ratePlanAppliesToStay(accessCode.ratePlan, checkIn, checkOut, nights)
    ) {
      throw new AppError(400, "Promo or corporate code is invalid or unavailable");
    }

    const codeRate = accessCode.ratePlan.items[0]?.rate;
    if (codeRate !== undefined) {
      return {
        suggestedRate: codeRate,
        baseRate,
        discountPercent: null,
        matchedPlan: { id: accessCode.ratePlan.id, name: accessCode.ratePlan.name, type: accessCode.ratePlan.type },
        allMatchingPlans: [{ id: accessCode.ratePlan.id, name: accessCode.ratePlan.name, rate: codeRate }],
        noDedicatedRateHint: null,
        appliedCode: accessCode.code,
        rateSource: "ACCESS_CODE" as const,
        company: null,
      };
    }
  }

  return {
    suggestedRate:      baseRate,
    baseRate,
    discountPercent:    null,
    matchedPlan:        bestPlan ? { id: bestPlan.id, name: bestPlan.name, type: bestPlan.type } : null,
    allMatchingPlans:   eligible.map((p) => ({ id: p.id, name: p.name, rate: p.items[0].rate })),
    noDedicatedRateHint,
    appliedCode:        null,
    rateSource:         bestPlan ? "RATE_PLAN" as const : "ROOM_DEFAULT" as const,
    company:            company ? { id: company.id, name: company.name } : null,
  };
}

export const RatePlanService = {
  async listRatePlans(withTenant: WithTenantFn, query: ListRatePlansQuery) {
    const skip = (query.page - 1) * query.limit;
    const where = {
      ...(query.isActive !== undefined && { isActive: query.isActive }),
      ...(query.companyId !== undefined && { companyId: query.companyId }),
    };

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.ratePlan.findMany({
          where,
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          skip,
          take: query.limit,
          include: {
            items: {
              include: { roomType: { select: { id: true, name: true } } },
            },
            codes: {
              orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
            },
            company: { select: { id: true, name: true, type: true } },
          },
        }),
        db.ratePlan.count({ where }),
      ])
    );

    return { data: items, meta: paginationMeta(total, query.page, query.limit) };
  },

  async getRatePlan(withTenant: WithTenantFn, id: string) {
    const plan = await withTenant((db) =>
      db.ratePlan.findUnique({
        where: { id },
        include: {
          items: {
            include: { roomType: { select: { id: true, name: true } } },
          },
          codes: {
            orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
          },
          company: { select: { id: true, name: true, type: true } },
        },
      })
    );
    if (!plan) throw new AppError(404, "Rate plan not found");
    return plan;
  },

  async createRatePlan(
    withTenant: WithTenantFn,
    hotelId: string,
    data: CreateRatePlanDto,
    actor: JwtPayload
  ) {
    return withTenant(async (db) => {
      if (data.companyId) await assertCompanyBelongsToHotel(db, hotelId, data.companyId);
      await assertRoomTypesBelongToHotel(db, hotelId, data.items.map((item) => item.roomTypeId));
      await acquireSubscriptionQuotaLock(db, hotelId, "maxActiveRatePlans");
      const activeCount = await db.ratePlan.count({ where: { isActive: true } });
      await checkSubscriptionLimit(hotelId, "maxActiveRatePlans", activeCount);

      const plan = await db.ratePlan.create({
        data: {
          hotelId,
          companyId:   data.companyId ?? null,
          name:        data.name,
          type:        data.type,
          description: data.description,
          validFrom:   data.validFrom ? new Date(data.validFrom) : null,
          validTo:     data.validTo   ? new Date(data.validTo)   : null,
          daysOfWeek:  data.daysOfWeek,
          minLos:      data.minLos,
          priority:    data.priority,
          // A company contract is selected through an authenticated company,
          // never through a public Booking Engine access code.
          codeRequired:data.companyId ? false : data.codeRequired,
          items: {
            create: data.items.map((item) => ({
              roomTypeId: item.roomTypeId,
              rate:       item.rate,
            })),
          },
        },
        include: {
          items: {
            include: { roomType: { select: { id: true, name: true } } },
          },
          company: { select: { id: true, name: true, type: true } },
        },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actor.userId,
          action:   "RATE_PLAN_CREATE",
          entity:   "ratePlan",
          entityId: plan.id,
          after:    JSON.parse(JSON.stringify({ name: plan.name, type: plan.type, companyId: plan.companyId })),
        },
      });

      return plan;
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async updateRatePlan(
    withTenant: WithTenantFn,
    hotelId: string,
    id: string,
    data: UpdateRatePlanDto,
    actor: JwtPayload
  ) {
    return withTenant(async (db) => {
      const existing = await db.ratePlan.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Rate plan not found");
      if (data.companyId) await assertCompanyBelongsToHotel(db, hotelId, data.companyId);
      if (data.items) await assertRoomTypesBelongToHotel(db, hotelId, data.items.map((item) => item.roomTypeId));
      const resultingCompanyId = data.companyId !== undefined ? data.companyId : existing.companyId;
      const resultingValidFrom = data.validFrom !== undefined
        ? (data.validFrom ? new Date(data.validFrom) : null)
        : existing.validFrom;
      const resultingValidTo = data.validTo !== undefined
        ? (data.validTo ? new Date(data.validTo) : null)
        : existing.validTo;
      if (resultingValidFrom && resultingValidTo && resultingValidTo < resultingValidFrom) {
        throw new AppError(400, "End date must be on or after the start date");
      }

      // Delete-then-recreate items when provided.
      // Existing ReservationRoom.ratePerNight values are NEVER touched — rates are
      // snapshot at booking time and only future suggest calls see the new rates.
      if (data.items) {
        await db.ratePlanItem.deleteMany({ where: { ratePlanId: id } });
      }

      const plan = await db.ratePlan.update({
        where: { id },
        data: {
          ...(data.name        !== undefined && { name:        data.name }),
          ...(data.companyId   !== undefined && { companyId:   data.companyId }),
          ...(data.type        !== undefined && { type:        data.type }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.validFrom   !== undefined && { validFrom:   data.validFrom ? new Date(data.validFrom) : null }),
          ...(data.validTo     !== undefined && { validTo:     data.validTo   ? new Date(data.validTo)   : null }),
          ...(data.daysOfWeek  !== undefined && { daysOfWeek:  data.daysOfWeek }),
          ...(data.minLos      !== undefined && { minLos:      data.minLos }),
          ...(data.codeRequired !== undefined && { codeRequired: resultingCompanyId ? false : data.codeRequired }),
          // Attaching a plan to a company also makes an existing public/code
          // plan private, even when codeRequired was not part of this patch.
          ...(resultingCompanyId && { codeRequired: false }),
          ...(data.priority    !== undefined && { priority:    data.priority }),
          ...(data.items && {
            items: {
              create: data.items.map((item) => ({
                roomTypeId: item.roomTypeId,
                rate:       item.rate,
              })),
            },
          }),
        },
        include: {
          items: {
            include: { roomType: { select: { id: true, name: true } } },
          },
          company: { select: { id: true, name: true, type: true } },
        },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actor.userId,
          action:   "RATE_PLAN_UPDATE",
          entity:   "ratePlan",
          entityId: plan.id,
          after:    JSON.parse(JSON.stringify({ name: plan.name })),
        },
      });

      return plan;
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async activateRatePlan(
    withTenant: WithTenantFn,
    hotelId: string,
    id: string,
    actor: JwtPayload
  ) {
    return withTenant(async (db) => {
      const existing = await db.ratePlan.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Rate plan not found");

      if (!existing.isActive) {
        await acquireSubscriptionQuotaLock(db, hotelId, "maxActiveRatePlans");
        const activeCount = await db.ratePlan.count({ where: { isActive: true } });
        await checkSubscriptionLimit(hotelId, "maxActiveRatePlans", activeCount);
      }

      await db.ratePlan.update({ where: { id }, data: { isActive: true } });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actor.userId,
          action:   "RATE_PLAN_ACTIVATE",
          entity:   "ratePlan",
          entityId: id,
          after:    JSON.parse(JSON.stringify({ name: existing.name, isActive: true })),
        },
      });
    }).then(() => {
      notifyHotelDataChanged(hotelId);
    });
  },

  async deactivateRatePlan(
    withTenant: WithTenantFn,
    hotelId: string,
    id: string,
    actor: JwtPayload
  ) {
    return withTenant(async (db) => {
      const existing = await db.ratePlan.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Rate plan not found");

      await db.ratePlan.update({ where: { id }, data: { isActive: false } });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actor.userId,
          action:   "RATE_PLAN_DEACTIVATE",
          entity:   "ratePlan",
          entityId: id,
          after:    JSON.parse(JSON.stringify({ name: existing.name, isActive: false })),
        },
      });
    }).then(() => {
      notifyHotelDataChanged(hotelId);
    });
  },

  async suggestRate(withTenantFn: WithTenantFn, query: SuggestRateQuery, hotelId: string) {
    return suggestRateCore(withTenantFn, query, hotelId);
  },

  async suggestRatePublic(hotelId: string, query: SuggestRateQuery) {
    return suggestRateCore(publicWithTenant(hotelId), query, hotelId);
  },

  async validateAccessCodePublic(hotelId: string, code: string, checkIn: string, checkOut: string) {
    const { features } = await getEffectiveLimits(hotelId);
    const accessCode = await publicWithTenant(hotelId)((db) =>
      db.ratePlanCode.findFirst({
        where: {
          hotelId,
          code,
          isActive: true,
        },
        include: { ratePlan: true },
      })
    );
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const nights = Math.round((end.getTime() - start.getTime()) / 86_400_000);

    if (!accessCode || !codeIsAvailableToday(accessCode) || !codeHasUsesLeft(accessCode)) {
      throw new AppError(400, "Promo or corporate code is invalid or unavailable");
    }


    if (accessCode.discountPercent !== null) {
      return {
        code: accessCode.code,
        label: accessCode.label,
        ratePlanName: null,
        ratePlanType: null,
        discountPercent: accessCode.discountPercent,
        personalOffer: accessCode.guestId !== null,
      };
    }

    if (!features.ratePlans) throw new AppError(400, "Promo or corporate code is invalid or unavailable");

    if (!accessCode.ratePlan || !accessCode.ratePlan.codeRequired || !ratePlanAppliesToStay(accessCode.ratePlan, start, end, nights)) {
      throw new AppError(400, "Promo or corporate code is invalid or unavailable");
    }

    return {
      code: accessCode.code,
      label: accessCode.label,
      ratePlanName: accessCode.ratePlan.name,
      ratePlanType: accessCode.ratePlan.type,
      discountPercent: null,
      personalOffer: false,
    };
  },

  async createRatePlanCode(
    withTenant: WithTenantFn,
    hotelId: string,
    ratePlanId: string,
    data: CreateRatePlanCodeDto,
    actor: JwtPayload,
  ) {
    return withTenant(async (db) => {
      const plan = await db.ratePlan.findFirst({ where: { id: ratePlanId, hotelId } });
      if (!plan) throw new AppError(404, "Rate plan not found");
      if (!plan.codeRequired) throw new AppError(400, "Enable code-required access on this rate plan before adding codes");

      await acquireSubscriptionQuotaLock(db, hotelId, "maxActivePromoCodes");
      const today = new Date(`${getCurrentPKTDate()}T00:00:00.000Z`);
      const activeCount = await db.ratePlanCode.count({ where: {
        isActive: true,
        AND: [
          { OR: [{ validTo: null }, { validTo: { gte: today } }] },
          { OR: [{ maxUses: null }, { usedCount: 0 }] },
        ],
      } });
      await checkSubscriptionLimit(hotelId, "maxActivePromoCodes", activeCount);

      try {
        const accessCode = await db.ratePlanCode.create({
          data: {
            hotelId,
            ratePlanId,
            code: data.code,
            label: data.label || null,
            validFrom: data.validFrom ? new Date(data.validFrom) : null,
            validTo: data.validTo ? new Date(data.validTo) : null,
          },
        });
        await db.auditLog.create({
          data: {
            hotelId,
            userId: actor.userId,
            action: "RATE_PLAN_CODE_CREATE",
            entity: "ratePlanCode",
            entityId: accessCode.id,
            after: JSON.parse(JSON.stringify({ ratePlanId, code: accessCode.code })),
          },
        });
        return accessCode;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          throw new AppError(409, "That access code is already in use at this hotel");
        }
        throw error;
      }
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async updateRatePlanCode(
    withTenant: WithTenantFn,
    hotelId: string,
    ratePlanId: string,
    codeId: string,
    data: UpdateRatePlanCodeDto,
    actor: JwtPayload,
  ) {
    return withTenant(async (db) => {
      const existing = await db.ratePlanCode.findFirst({ where: { id: codeId, ratePlanId, hotelId } });
      if (!existing) throw new AppError(404, "Access code not found");

      if (data.isActive === true && !existing.isActive) {
        await acquireSubscriptionQuotaLock(db, hotelId, "maxActivePromoCodes");
        const today = new Date(`${getCurrentPKTDate()}T00:00:00.000Z`);
        const activeCount = await db.ratePlanCode.count({ where: {
          isActive: true,
          AND: [
            { OR: [{ validTo: null }, { validTo: { gte: today } }] },
            { OR: [{ maxUses: null }, { usedCount: 0 }] },
          ],
        } });
        await checkSubscriptionLimit(hotelId, "maxActivePromoCodes", activeCount);
      }

      try {
        const accessCode = await db.ratePlanCode.update({
          where: { id: codeId },
          data: {
            ...(data.code !== undefined && { code: data.code }),
            ...(data.label !== undefined && { label: data.label || null }),
            ...(data.validFrom !== undefined && { validFrom: data.validFrom ? new Date(data.validFrom) : null }),
            ...(data.validTo !== undefined && { validTo: data.validTo ? new Date(data.validTo) : null }),
            ...(data.isActive !== undefined && { isActive: data.isActive }),
          },
        });
        await db.auditLog.create({
          data: {
            hotelId,
            userId: actor.userId,
            action: "RATE_PLAN_CODE_UPDATE",
            entity: "ratePlanCode",
            entityId: codeId,
            after: JSON.parse(JSON.stringify({ code: accessCode.code, isActive: accessCode.isActive })),
          },
        });
        return accessCode;
      } catch (error) {
        if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
          throw new AppError(409, "That access code is already in use at this hotel");
        }
        throw error;
      }
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async deactivateRatePlanCode(
    withTenant: WithTenantFn,
    hotelId: string,
    ratePlanId: string,
    codeId: string,
    actor: JwtPayload,
  ) {
    await this.updateRatePlanCode(withTenant, hotelId, ratePlanId, codeId, { isActive: false }, actor);
  },
};

async function assertCompanyBelongsToHotel(db: TenantTx, hotelId: string, companyId: string): Promise<void> {
  const company = await db.company.findFirst({
    where: { id: companyId, hotelId, deletedAt: null, isActive: true },
    select: { id: true },
  });
  if (!company) throw new AppError(404, "Company not found");
}

async function assertRoomTypesBelongToHotel(db: TenantTx, hotelId: string, roomTypeIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(roomTypeIds)];
  const count = await db.roomType.count({ where: { id: { in: uniqueIds }, hotelId } });
  if (count !== uniqueIds.length) throw new AppError(400, "One or more room types do not belong to this hotel");
}
