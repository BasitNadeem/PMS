import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import type {
  ListRatePlansQuery,
  CreateRatePlanDto,
  UpdateRatePlanDto,
  SuggestRateQuery,
} from "../schemas/ratePlans";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { getEffectiveLimits } from "../lib/subscription";
import { publicWithTenant } from "../lib/publicTenant";
import { notifyHotelDataChanged } from "../lib/realtime";

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

// Extracted core — callable with any WithTenantFn (authenticated or public).
async function suggestRateCore(wt: WithTenantFn, query: SuggestRateQuery, hotelId: string) {
  const { features } = await getEffectiveLimits(hotelId);
  if (!features.ratePlans) {
    const roomType = await wt((db) =>
      db.roomType.findUnique({ where: { id: query.roomTypeId }, select: { defaultRate: true } })
    );
    if (!roomType) throw new AppError(404, "Room type not found");
    return { suggestedRate: roomType.defaultRate, matchedPlan: null, allMatchingPlans: [] as { id: string; name: string; rate: number }[] };
  }

  const checkIn  = new Date(query.checkIn);
  const checkOut = new Date(query.checkOut);
  const nights   = Math.round((checkOut.getTime() - checkIn.getTime()) / 86_400_000);

  if (nights < 1) throw new AppError(400, "Check-out must be after check-in");

  const plans = await wt((db) =>
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
    })
  );

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

  const datePlans = sorted.filter((plan) => {
    if (plan.daysOfWeek.length === 0) return true;
    for (let i = 0; i < nights; i++) {
      const night = new Date(checkIn);
      night.setDate(night.getDate() + i);
      if (!plan.daysOfWeek.includes(night.getDay())) return false;
    }
    return true;
  });

  // Type-eligibility gate: only surface plans appropriate for this booking context.
  const eligible = datePlans.filter((p) => getEligibleTypes(query.bookingContext).includes(p.type));

  const roomType = await wt((db) =>
    db.roomType.findUnique({ where: { id: query.roomTypeId }, select: { defaultRate: true } })
  );
  if (!roomType) throw new AppError(404, "Room type not found");

  let noDedicatedRateHint: string | null = null;
  if (query.bookingContext === "TOUR_AGENCY" || query.bookingContext === "CORPORATE") {
    const dedicatedType = query.bookingContext === "TOUR_AGENCY" ? "TRAVEL_AGENT" : "CORPORATE";
    if (!eligible.some((p) => p.type === dedicatedType)) {
      const label = query.bookingContext === "TOUR_AGENCY" ? "Travel Agent" : "Corporate";
      noDedicatedRateHint = `No ${label} rate configured — using standard rate`;
    }
  }

  const bestPlan      = eligible[0];
  const suggestedRate = bestPlan ? bestPlan.items[0].rate : roomType.defaultRate;

  return {
    suggestedRate,
    matchedPlan:        bestPlan ? { id: bestPlan.id, name: bestPlan.name, type: bestPlan.type } : null,
    allMatchingPlans:   eligible.map((p) => ({ id: p.id, name: p.name, rate: p.items[0].rate })),
    noDedicatedRateHint,
  };
}

export const RatePlanService = {
  async listRatePlans(withTenant: WithTenantFn, query: ListRatePlansQuery) {
    const skip = (query.page - 1) * query.limit;
    const where = query.isActive !== undefined ? { isActive: query.isActive } : {};

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
      const plan = await db.ratePlan.create({
        data: {
          hotelId,
          name:        data.name,
          type:        data.type,
          description: data.description,
          validFrom:   data.validFrom ? new Date(data.validFrom) : null,
          validTo:     data.validTo   ? new Date(data.validTo)   : null,
          daysOfWeek:  data.daysOfWeek,
          minLos:      data.minLos,
          priority:    data.priority,
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
        },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actor.userId,
          action:   "RATE_PLAN_CREATE",
          entity:   "ratePlan",
          entityId: plan.id,
          after:    JSON.parse(JSON.stringify({ name: plan.name, type: plan.type })),
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
          ...(data.type        !== undefined && { type:        data.type }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.validFrom   !== undefined && { validFrom:   data.validFrom ? new Date(data.validFrom) : null }),
          ...(data.validTo     !== undefined && { validTo:     data.validTo   ? new Date(data.validTo)   : null }),
          ...(data.daysOfWeek  !== undefined && { daysOfWeek:  data.daysOfWeek }),
          ...(data.minLos      !== undefined && { minLos:      data.minLos }),
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
};
