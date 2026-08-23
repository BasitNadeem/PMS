import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import {
  adminPrisma,
  FEATURE_DEFINITIONS,
  LIMIT_DEFINITIONS,
  normalizeFeatureFlags,
  normalizeSubscriptionLimits,
  Prisma,
} from "@pms/db";
import { env } from "../lib/env";
import { AppError } from "../utils/AppError";
import type {
  AdminLoginDto,
  CreateHotelDto,
  UpdateHotelDto,
  CreatePlanDto,
  UpdatePlanDto,
  SavePortfolioDto,
} from "../schemas/admin";

const jwtOpts = (expiresIn: string): SignOptions => ({ expiresIn: expiresIn as SignOptions["expiresIn"] });

const ADJECTIVES = ["Swift", "Brave", "Royal", "Grand", "Elite", "Peak", "Bold"];
const SYMBOLS = ["@", "#", "!", "$"];

function generateTempPassword(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
  return `${adj}${sym}2026`;
}

type AdminRequestContext = { email: string; ipAddress?: string; userAgent?: string };

async function validatePortfolioConfiguration(dto: SavePortfolioDto, excludedPortfolioId?: string) {
  const hotelIds = [...new Set(dto.hotelIds)];
  if (hotelIds.length !== dto.hotelIds.length) throw new AppError(400, "A property can only appear once");
  const hotels = await adminPrisma.hotel.findMany({
    where: { id: { in: hotelIds }, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (hotels.length !== hotelIds.length) throw new AppError(400, "One or more selected properties are inactive or missing");
  const conflicts = await adminPrisma.propertyPortfolioHotel.findMany({
    where: {
      hotelId: { in: hotelIds },
      ...(excludedPortfolioId ? { portfolioId: { not: excludedPortfolioId } } : {}),
    },
    select: { hotelId: true },
  });
  if (conflicts.length) throw new AppError(409, "A selected property already belongs to another portfolio");
  const userConflicts = await adminPrisma.propertyPortfolioAccess.findMany({
    where: {
      userId: { in: dto.accesses.map((access) => access.userId) },
      ...(excludedPortfolioId ? { portfolioId: { not: excludedPortfolioId } } : {}),
    },
    select: { userId: true },
  });
  if (userConflicts.length) throw new AppError(409, "A selected account already belongs to another portfolio");

  const seenUsers = new Set<string>();
  const normalizedAccesses = [];
  for (const access of dto.accesses) {
    if (seenUsers.has(access.userId)) throw new AppError(400, "An account can only be granted once per portfolio");
    seenUsers.add(access.userId);
    if (!hotelIds.includes(access.homeHotelId)) throw new AppError(400, "Every account's home property must be linked to the portfolio");
    const membership = await adminPrisma.hotelUser.findUnique({
      where: { hotelId_userId: { hotelId: access.homeHotelId, userId: access.userId } },
      select: { isActive: true, role: true },
    });
    if (!membership?.isActive || !["OWNER", "MANAGER"].includes(membership.role)) {
      throw new AppError(400, "Portfolio accounts must be active owners or managers of their home property");
    }
    const scopedHotelIds = access.allProperties ? [] : [...new Set(access.hotelIds)];
    if (!access.allProperties) {
      if (!scopedHotelIds.includes(access.homeHotelId)) scopedHotelIds.push(access.homeHotelId);
      if (scopedHotelIds.some((hotelId) => !hotelIds.includes(hotelId))) {
        throw new AppError(400, "An account's property scope must stay inside the portfolio");
      }
    }
    normalizedAccesses.push({ ...access, accessRole: membership.role as "OWNER" | "MANAGER", hotelIds: scopedHotelIds });
  }
  return { hotelIds, accesses: normalizedAccesses };
}

async function writePortfolioAudit(
  tx: Prisma.TransactionClient,
  hotelIds: string[],
  portfolioId: string,
  action: string,
  before: Prisma.InputJsonValue | undefined,
  after: Prisma.InputJsonValue | undefined,
  context: AdminRequestContext,
) {
  await Promise.all(hotelIds.map((hotelId) => tx.auditLog.create({
    data: {
      hotelId,
      action,
      entity: "property_portfolio",
      entityId: portfolioId,
      ...(before !== undefined ? { before } : {}),
      ...(after !== undefined ? { after } : {}),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      notes: `Super-admin ${context.email}`,
    },
  })));
}

export const AdminService = {
  login(dto: AdminLoginDto) {
    if (dto.email !== env.ADMIN_EMAIL || dto.password !== env.ADMIN_PASSWORD) {
      throw new AppError(401, "Invalid admin credentials");
    }

    const token = jwt.sign(
      { isSuperAdmin: true, email: dto.email },
      env.ADMIN_JWT_SECRET,
      jwtOpts("24h")
    );

    return { token, admin: { email: dto.email } };
  },

  async listHotels() {
    return adminPrisma.hotel.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        slug: true,
        subdomain: true,
        city: true,
        isActive: true,
        onboardingCompleted: true,
        createdAt: true,
        subscriptionPlan: { select: { id: true, name: true, slug: true } },
        _count: {
          select: { rooms: true, reservations: true, users: true },
        },
      },
    });
  },

  async getHotel(id: string) {
    const hotel = await adminPrisma.hotel.findUnique({
      where: { id },
      include: {
        _count: {
          select: { rooms: true, reservations: true, users: true },
        },
        users: {
          select: {
            role: true,
            user: { select: { id: true, name: true, email: true, isFirstLogin: true } },
          },
        },
        subscriptionPlan: {
          select: { id: true, name: true, slug: true, priceMonthly: true, limits: true, features: true, isActive: true },
        },
      },
    });
    if (!hotel) throw new AppError(404, "Hotel not found");
    return hotel;
  },

  async createHotel(dto: CreateHotelDto) {
    const existing = await adminPrisma.hotel.findFirst({ where: { subdomain: dto.subdomain } });
    if (existing) throw new AppError(409, "Subdomain already taken");

    const existingOwner = await adminPrisma.user.findUnique({ where: { email: dto.ownerEmail } });
    if (existingOwner?.deletedAt) {
      throw new AppError(409, "This owner email belongs to a suspended account");
    }
    if (existingOwner) {
      throw new AppError(409, "Owner email already belongs to another account. Create this property with its own owner email, then link both accounts through a portfolio.");
    }
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const ownerRole = await adminPrisma.role.findFirst({ where: { name: "OWNER", hotelId: null } });
    if (!ownerRole) throw new AppError(500, "OWNER role not found — run the seed script");

    // If no plan is specified, assign the active Trial plan.
    let resolvedPlanId = dto.subscriptionPlanId;
    if (!resolvedPlanId) {
      const trialPlan = await adminPrisma.subscriptionPlan.findUnique({ where: { slug: "trial" } });
      if (!trialPlan?.isActive) throw new AppError(409, "No active Trial plan is configured");
      resolvedPlanId = trialPlan?.id;
    }
    const selectedPlan = resolvedPlanId
      ? await adminPrisma.subscriptionPlan.findUnique({ where: { id: resolvedPlanId } })
      : null;
    if (!selectedPlan?.isActive) throw new AppError(400, "Selected subscription plan is inactive or missing");
    const isTrial = selectedPlan.slug === "trial";

    const result = await adminPrisma.$transaction(async (tx) => {
      const hotel = await tx.hotel.create({
        data: {
          name: dto.hotelName,
          slug: dto.subdomain,
          subdomain: dto.subdomain,
          city: dto.city,
          propertyType: dto.propertyType,
          isActive: true,
          onboardingCompleted: false,
          subscriptionPlanId: selectedPlan.id,
          isTrialAccount: isTrial,
          trialEndsAt: isTrial ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        },
      });

      const user = await tx.user.create({
          data: {
            name: dto.ownerName,
            email: dto.ownerEmail,
            passwordHash,
            tempPassword,
            isFirstLogin: true,
            isSuperAdmin: false,
          },
        });

      await tx.hotelUser.create({
        data: {
          hotelId: hotel.id,
          userId: user.id,
          role: "OWNER",
          roleId: ownerRole.id,
          isActive: true,
          acceptedAt: new Date(),
        },
      });

      return { hotel, user };
    });

    return {
      hotel: { id: result.hotel.id, name: result.hotel.name, subdomain: result.hotel.subdomain, slug: result.hotel.slug },
      owner: {
        name: result.user.name,
        email: result.user.email,
        tempPassword,
      },
    };
  },

  async listPortfolioCandidates() {
    return adminPrisma.hotel.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        city: true,
        portfolioProperty: { select: { portfolioId: true, portfolio: { select: { name: true } } } },
        users: {
          where: { isActive: true, role: { in: ["OWNER", "MANAGER"] } },
          select: { role: true, user: { select: { id: true, name: true, email: true } } },
          orderBy: { role: "asc" },
        },
      },
    });
  },

  async listPortfolios() {
    return adminPrisma.propertyPortfolio.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        properties: { select: { hotel: { select: { id: true, name: true, slug: true } } } },
        accesses: {
          select: {
            id: true,
            accessRole: true,
            isActive: true,
            user: { select: { id: true, name: true, email: true } },
            homeHotel: { select: { id: true, name: true } },
          },
        },
      },
    });
  },

  async getPortfolio(id: string) {
    const portfolio = await adminPrisma.propertyPortfolio.findUnique({
      where: { id },
      include: {
        properties: { orderBy: { hotel: { name: "asc" } }, include: { hotel: true } },
        accesses: {
          orderBy: { user: { name: "asc" } },
          include: {
            user: { select: { id: true, name: true, email: true } },
            homeHotel: { select: { id: true, name: true, slug: true } },
            propertyGrants: { select: { hotelId: true } },
          },
        },
      },
    });
    if (!portfolio) throw new AppError(404, "Portfolio not found");
    return portfolio;
  },

  async createPortfolio(dto: SavePortfolioDto, context: AdminRequestContext) {
    const normalized = await validatePortfolioConfiguration(dto);
    return adminPrisma.$transaction(async (tx) => {
      const portfolio = await tx.propertyPortfolio.create({
        data: {
          name: dto.name,
          switchPolicy: dto.switchPolicy,
          isActive: dto.isActive,
          createdByAdminEmail: context.email,
          updatedByAdminEmail: context.email,
          properties: { create: normalized.hotelIds.map((hotelId) => ({ hotelId })) },
          accesses: {
            create: normalized.accesses.map((access) => ({
              userId: access.userId,
              homeHotelId: access.homeHotelId,
              accessRole: access.accessRole,
              canViewPortfolio: access.canViewPortfolio,
              canSwitchProperties: access.canSwitchProperties,
              canViewFinancials: access.canViewFinancials,
              allProperties: access.allProperties,
              isActive: access.isActive,
              createdByAdminEmail: context.email,
              updatedByAdminEmail: context.email,
              propertyGrants: access.allProperties ? undefined : {
                create: access.hotelIds.map((hotelId) => ({ hotelId })),
              },
            })),
          },
        },
      });
      await writePortfolioAudit(tx, normalized.hotelIds, portfolio.id, "PORTFOLIO_CREATED", undefined, {
        name: dto.name,
        switchPolicy: dto.switchPolicy,
        hotelIds: normalized.hotelIds,
        accountIds: normalized.accesses.map((access) => access.userId),
      }, context);
      return portfolio;
    });
  },

  async updatePortfolio(id: string, dto: SavePortfolioDto, context: AdminRequestContext) {
    const existing = await this.getPortfolio(id);
    const normalized = await validatePortfolioConfiguration(dto, id);
    const oldHotelIds = existing.properties.map((row) => row.hotelId);
    const auditHotelIds = [...new Set([...oldHotelIds, ...normalized.hotelIds])];
    return adminPrisma.$transaction(async (tx) => {
      await tx.propertyPortfolioAccess.deleteMany({ where: { portfolioId: id } });
      await tx.propertyPortfolioHotel.deleteMany({ where: { portfolioId: id } });
      const portfolio = await tx.propertyPortfolio.update({
        where: { id },
        data: {
          name: dto.name,
          switchPolicy: dto.switchPolicy,
          isActive: dto.isActive,
          updatedByAdminEmail: context.email,
          properties: { create: normalized.hotelIds.map((hotelId) => ({ hotelId })) },
          accesses: {
            create: normalized.accesses.map((access) => ({
              userId: access.userId,
              homeHotelId: access.homeHotelId,
              accessRole: access.accessRole,
              canViewPortfolio: access.canViewPortfolio,
              canSwitchProperties: access.canSwitchProperties,
              canViewFinancials: access.canViewFinancials,
              allProperties: access.allProperties,
              isActive: access.isActive,
              createdByAdminEmail: context.email,
              updatedByAdminEmail: context.email,
              propertyGrants: access.allProperties ? undefined : {
                create: access.hotelIds.map((hotelId) => ({ hotelId })),
              },
            })),
          },
        },
      });
      await writePortfolioAudit(tx, auditHotelIds, id, "PORTFOLIO_UPDATED", {
        name: existing.name,
        switchPolicy: existing.switchPolicy,
        hotelIds: oldHotelIds,
        accountIds: existing.accesses.map((access) => access.userId),
      }, {
        name: dto.name,
        switchPolicy: dto.switchPolicy,
        hotelIds: normalized.hotelIds,
        accountIds: normalized.accesses.map((access) => access.userId),
      }, context);
      return portfolio;
    });
  },

  async updateHotel(id: string, dto: UpdateHotelDto) {
    const hotel = await adminPrisma.hotel.findUnique({ where: { id } });
    if (!hotel) throw new AppError(404, "Hotel not found");

    let planLifecycle: { isTrialAccount: boolean; trialEndsAt: Date | null } | undefined;
    if (dto.subscriptionPlanId !== undefined && dto.subscriptionPlanId !== hotel.subscriptionPlanId) {
      if (dto.subscriptionPlanId === null) {
        planLifecycle = { isTrialAccount: false, trialEndsAt: null };
      } else {
        const selectedPlan = await adminPrisma.subscriptionPlan.findUnique({ where: { id: dto.subscriptionPlanId } });
        if (!selectedPlan?.isActive) throw new AppError(400, "Selected subscription plan is inactive or missing");
        const isTrial = selectedPlan.slug === "trial";
        planLifecycle = {
          isTrialAccount: isTrial,
          trialEndsAt: isTrial ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : null,
        };
      }
    }

    return adminPrisma.hotel.update({
      where: { id },
      data: {
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.subscriptionPlanId !== undefined && {
          subscriptionPlan: dto.subscriptionPlanId
            ? { connect: { id: dto.subscriptionPlanId } }
            : { disconnect: true },
        }),
        ...(planLifecycle ?? {}),
        ...(dto.limitOverrides !== undefined && {
          limitOverrides: dto.limitOverrides === null ? Prisma.JsonNull : dto.limitOverrides,
        }),
        ...(dto.featureOverrides !== undefined && {
          featureOverrides: dto.featureOverrides === null ? Prisma.JsonNull : dto.featureOverrides,
        }),
      },
    });
  },

  async resetOwnerPassword(hotelId: string) {
    const hotel = await adminPrisma.hotel.findUnique({ where: { id: hotelId } });
    if (!hotel) throw new AppError(404, "Hotel not found");

    const ownerHotelUser = await adminPrisma.hotelUser.findFirst({
      where: { hotelId, role: "OWNER" },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    if (!ownerHotelUser) throw new AppError(404, "Owner account not found for this hotel");

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    await adminPrisma.user.update({
      where: { id: ownerHotelUser.user.id },
      data: { passwordHash, tempPassword },
    });

    return {
      owner: { name: ownerHotelUser.user.name, email: ownerHotelUser.user.email, tempPassword },
    };
  },

  // ── Subscription Plan CRUD ───────────────────────────────────────────────────

  async listPlans() {
    return adminPrisma.subscriptionPlan.findMany({
      orderBy: { displayOrder: "asc" },
      include: { _count: { select: { hotels: true } } },
    });
  },

  getPlanMetadata() {
    return { features: FEATURE_DEFINITIONS, limits: LIMIT_DEFINITIONS };
  },

  async createPlan(dto: CreatePlanDto) {
    const existing = await adminPrisma.subscriptionPlan.findUnique({ where: { slug: dto.slug } });
    if (existing) throw new AppError(409, "Plan slug already taken");
    return adminPrisma.subscriptionPlan.create({
      data: {
        ...dto,
        features: normalizeFeatureFlags(dto.features),
        limits: normalizeSubscriptionLimits(dto.limits),
      },
    });
  },

  async updatePlan(id: string, dto: UpdatePlanDto) {
    const plan = await adminPrisma.subscriptionPlan.findUnique({ where: { id } });
    if (!plan) throw new AppError(404, "Plan not found");
    const currentFeatures = normalizeFeatureFlags(plan.features);
    const currentLimits = normalizeSubscriptionLimits(plan.limits);
    return adminPrisma.subscriptionPlan.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.features && { features: normalizeFeatureFlags({ ...currentFeatures, ...dto.features }) }),
        ...(dto.limits && { limits: normalizeSubscriptionLimits(dto.limits, currentLimits) }),
      },
    });
  },

  async deletePlan(id: string) {
    const plan = await adminPrisma.subscriptionPlan.findUnique({
      where: { id },
      include: { _count: { select: { hotels: true } } },
    });
    if (!plan) throw new AppError(404, "Plan not found");
    if (plan._count.hotels > 0) throw new AppError(409, `Cannot delete plan: ${plan._count.hotels} hotel(s) currently assigned`);
    return adminPrisma.subscriptionPlan.update({ where: { id }, data: { isActive: false } });
  },
};
