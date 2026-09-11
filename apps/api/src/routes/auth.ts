import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { adminPrisma, UserRole, withTenant } from "@pms/db";
import { env } from "../lib/env";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { AppError } from "../utils/AppError";
import { dateOnlyUTC, getCurrentPKTDate, getPKTDayRange } from "../lib/timezone";

// @types/jsonwebtoken 9.x uses ms.StringValue (a branded type) for expiresIn.
// Casting through SignOptions["expiresIn"] keeps the call type-safe without `any`.
const jwtOpts = (expiresIn: string): SignOptions => ({ expiresIn: expiresIn as SignOptions["expiresIn"] });

/**
 * Auth routes use adminPrisma (superuser / DIRECT_URL) because:
 *   - Login has no hotel context yet (RLS would block the query)
 *   - Looking up user by email / hotel by slug requires cross-tenant visibility
 */

const router: Router = Router();

type PortfolioRole = Extract<UserRole, "OWNER" | "MANAGER">;
const PORTFOLIO_ROLES: readonly PortfolioRole[] = ["OWNER", "MANAGER"];

function isPortfolioRole(role: string): role is PortfolioRole {
  return PORTFOLIO_ROLES.includes(role as PortfolioRole);
}

async function requireActivePortfolioActor(user: { userId: string; hotelId: string; role: string; portfolioAccessId?: string }) {
  if (!isPortfolioRole(user.role) || !user.portfolioAccessId) {
    throw new AppError(403, "Multi-property access is available to owners and managers only");
  }

  const access = await getPortfolioAccess(user.portfolioAccessId, user.userId);
  if (!access || !authorizedHotelIds(access).has(user.hotelId)) {
    throw new AppError(403, "Multi-property access is no longer available for this account");
  }
  return access;
}

type PortfolioAccessRecord = NonNullable<Awaited<ReturnType<typeof getPortfolioAccess>>>;

function authorizedHotelIds(access: {
  allProperties: boolean;
  portfolio: { properties: Array<{ hotelId: string }> };
  propertyGrants: Array<{ hotelId: string }>;
}) {
  return new Set((access.allProperties ? access.portfolio.properties : access.propertyGrants).map((row) => row.hotelId));
}

function switchPolicyAllows(access: PortfolioAccessRecord) {
  if (!access.canSwitchProperties) return false;
  if (access.portfolio.switchPolicy === "OWNERS_ONLY") return access.accessRole === "OWNER";
  return true;
}

async function getPortfolioAccess(accessId: string, userId: string) {
  const access = await adminPrisma.propertyPortfolioAccess.findFirst({
    where: {
      id: accessId,
      userId,
      isActive: true,
      portfolio: { isActive: true },
    },
    include: {
      homeHotel: { select: { id: true, isActive: true, deletedAt: true } },
      propertyGrants: { select: { hotelId: true } },
      portfolio: {
        include: {
          properties: {
            select: {
              hotelId: true,
              hotel: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  propertyType: true,
                  city: true,
                  settings: true,
                  onboardingCompleted: true,
                  isActive: true,
                  deletedAt: true,
                },
              },
            },
          },
        },
      },
    },
  });
  if (!access || !access.homeHotel.isActive || access.homeHotel.deletedAt) return null;

  // The account's direct home membership is the source of truth for whether
  // support may continue granting this person owner/manager portfolio access.
  const homeMembership = await adminPrisma.hotelUser.findUnique({
    where: { hotelId_userId: { hotelId: access.homeHotelId, userId } },
    select: { isActive: true, role: true },
  });
  if (!homeMembership?.isActive || homeMembership.role !== access.accessRole) return null;
  return access;
}

function getPermissions(hotelUser: {
  assignedRole: { permissions: Array<{ permission: { key: string } }> };
}): string[] {
  return hotelUser.assignedRole.permissions.map((rp) => rp.permission.key);
}

async function issueHotelSession(
  user: { id: string; name: string; email: string; isFirstLogin: boolean },
  hotel: { id: string; name: string; slug: string; onboardingCompleted: boolean },
  hotelUser: {
    role: UserRole;
    assignedRole: { permissions: Array<{ permission: { key: string } }> };
  },
  portfolioAccessId?: string,
) {
  const permissions = getPermissions(hotelUser);
  const accessToken = jwt.sign(
    { userId: user.id, hotelId: hotel.id, role: hotelUser.role, permissions, isFirstLogin: user.isFirstLogin, portfolioAccessId },
    env.JWT_SECRET,
    jwtOpts(env.JWT_EXPIRES_IN),
  );
  const refreshToken = jwt.sign(
    { userId: user.id, hotelId: hotel.id, portfolioAccessId },
    env.JWT_SECRET,
    jwtOpts(env.JWT_REFRESH_EXPIRES_IN),
  );

  await adminPrisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      refreshTokenHash: await bcrypt.hash(refreshToken, 10),
    },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: hotelUser.role,
      permissions,
      isFirstLogin: user.isFirstLogin,
    },
    hotel: {
      id: hotel.id,
      name: hotel.name,
      slug: hotel.slug,
      onboardingCompleted: hotel.onboardingCompleted,
    },
  };
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  hotelSlug: z.string().trim().min(1).optional(),
  surface: z.enum(["BACKOFFICE"]).optional(),
});

router.post("/login", async (req, res) => {
  const { email, password, hotelSlug, surface } = loginSchema.parse(req.body);

  const user = await adminPrisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const portfolioAccess = await adminPrisma.propertyPortfolioAccess.findFirst({
    where: { userId: user.id, isActive: true, portfolio: { isActive: true } },
    select: { id: true, homeHotelId: true },
  });
  let hotel = hotelSlug
    ? await adminPrisma.hotel.findUnique({ where: { slug: hotelSlug } })
    : portfolioAccess
      ? await adminPrisma.hotel.findUnique({ where: { id: portfolioAccess.homeHotelId } })
      : null;

  if (!hotel && !hotelSlug) {
    const memberships = await adminPrisma.hotelUser.findMany({
      where: { userId: user.id, isActive: true, hotel: { isActive: true, deletedAt: null } },
      select: { hotel: true },
      take: 2,
    });
    if (memberships.length === 1) hotel = memberships[0].hotel;
    if (memberships.length > 1) {
      throw new AppError(400, "Property ID is required for this account");
    }
  }
  if (!hotel || !hotel.isActive || hotel.deletedAt) {
    throw new AppError(404, "Hotel not found");
  }

  if (user.deletedAt) {
    res.status(403).json({ error: "Account suspended" });
    return;
  }

  const hotelUser = await adminPrisma.hotelUser.findUnique({
    where: { hotelId_userId: { hotelId: hotel.id, userId: user.id } },
    include: { assignedRole: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!hotelUser?.isActive) {
    res.status(403).json({ error: "Access denied for this property" });
    return;
  }

  // Back Office is a restricted management surface. The hostname only picks
  // the UI; this server-side check is what prevents an operational staff
  // account from obtaining a Back Office session.
  if (surface === "BACKOFFICE" && !["OWNER", "MANAGER"].includes(hotelUser.role)) {
    res.status(403).json({ error: "Back Office access is available to hotel owners and managers only" });
    return;
  }

  const session = await issueHotelSession(
    user,
    hotel,
    hotelUser,
    portfolioAccess?.homeHotelId === hotel.id ? portfolioAccess.id : undefined,
  );

  await adminPrisma.auditLog.create({
    data: {
      hotelId: hotel.id,
      userId: user.id,
      action: "LOGIN",
      entity: "user",
      entityId: user.id,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] as string | undefined,
    },
  });

  // A successful daily-app login is the automatic attendance signal. The
  // record is unique per hotel, staff member and Pakistan calendar date, so
  // repeated logins update activity instead of creating duplicate rows. A
  // manager opening the restricted Back Office does not count as a PMS sign-in.
  if (surface !== "BACKOFFICE" && hotelUser.role !== "OWNER") {
    const attendanceDate = dateOnlyUTC(getCurrentPKTDate());
    await withTenant(hotel.id, user.id, (db) => db.$executeRaw`
      INSERT INTO attendance_records
        (hotel_id, user_id, attendance_date, first_login_at, last_login_at,
         login_count, source, status, role, created_at, updated_at)
      VALUES
        (${hotel.id}::uuid, ${user.id}::uuid, ${attendanceDate}::date, now(), now(),
         1, 'APP_LOGIN', 'PRESENT', ${hotelUser.role}, now(), now())
      ON CONFLICT (hotel_id, user_id, attendance_date)
      DO UPDATE SET
        first_login_at = COALESCE(attendance_records.first_login_at, EXCLUDED.first_login_at),
        last_login_at = EXCLUDED.last_login_at,
        login_count = attendance_records.login_count + 1,
        source = 'APP_LOGIN',
        status = 'PRESENT',
        role = EXCLUDED.role,
        updated_at = now()
    `);
  }

  res.json(session);
});

/**
 * Cross-property access is support-managed. The account must remain an active
 * OWNER/MANAGER at its home property, and every returned/switched hotel is
 * derived from its explicit active portfolio scope. Client-supplied hotel ids
 * are never accepted as authorization.
 */
router.get("/properties", authenticate, async (req, res) => {
  if (!isPortfolioRole(req.user!.role)) {
    throw new AppError(403, "Multi-property access is available to owners and managers only");
  }

  const access = req.user!.portfolioAccessId
    ? await getPortfolioAccess(req.user!.portfolioAccessId, req.user!.userId)
    : null;
  const fallbackHotel = !access
    ? await adminPrisma.hotel.findFirst({
        where: { id: req.user!.hotelId, isActive: true, deletedAt: null },
        select: {
          id: true, name: true, slug: true, propertyType: true, city: true,
          settings: true, onboardingCompleted: true,
        },
      })
    : null;
  const allowedIds = access ? authorizedHotelIds(access) : new Set<string>();
  const properties = access
    ? access.portfolio.properties
        .map((row) => row.hotel)
        .filter((hotel) => allowedIds.has(hotel.id) && hotel.isActive && !hotel.deletedAt)
        .sort((a, b) => a.name.localeCompare(b.name))
    : fallbackHotel ? [fallbackHotel] : [];

  res.json({
    data: properties.map((hotel) => {
      const settings = hotel.settings && typeof hotel.settings === "object" && !Array.isArray(hotel.settings)
        ? hotel.settings as Record<string, unknown>
        : {};
      return {
        id: hotel.id,
        name: hotel.name,
        slug: hotel.slug,
        propertyType: hotel.propertyType,
        city: hotel.city,
        logoUrl: typeof settings.logoUrl === "string" ? settings.logoUrl : null,
        onboardingCompleted: hotel.onboardingCompleted,
        role: access?.accessRole ?? req.user!.role,
        isCurrent: hotel.id === req.user!.hotelId,
        isHome: access?.homeHotelId === hotel.id || (!access && hotel.id === req.user!.hotelId),
        canSwitch: access ? switchPolicyAllows(access) : false,
        canViewPortfolio: access?.canViewPortfolio ?? false,
      };
    }),
  });
});

router.get("/portfolio", authenticate, async (req, res) => {
  const access = await requireActivePortfolioActor(req.user!);
  if (!access.canViewPortfolio) throw new AppError(403, "Portfolio overview is not enabled for this account");
  const allowedIds = authorizedHotelIds(access);
  const propertiesInScope = access.portfolio.properties
    .map((row) => row.hotel)
    .filter((hotel) => allowedIds.has(hotel.id) && hotel.isActive && !hotel.deletedAt)
    .sort((a, b) => a.name.localeCompare(b.name));

  const todayString = getCurrentPKTDate();
  const todayDate = dateOnlyUTC(todayString);
  const { start, end } = getPKTDayRange(todayString);

  const properties = await Promise.all(propertiesInScope.map(async (hotel) => {
    const [rooms, arrivals, departures, paymentTotals, dirtyRooms, openMaintenance] = await Promise.all([
      adminPrisma.room.findMany({
        where: { hotelId: hotel.id, isActive: true },
        select: { status: true },
      }),
      adminPrisma.reservation.count({
        where: {
          hotelId: hotel.id,
          checkInDate: todayDate,
          status: { notIn: ["CANCELLED", "NO_SHOW", "CHECKED_OUT"] },
        },
      }),
      adminPrisma.reservation.count({
        where: {
          hotelId: hotel.id,
          checkOutDate: todayDate,
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
      }),
      access.canViewFinancials ? adminPrisma.payment.groupBy({
        by: ["isRefund"],
        where: { hotelId: hotel.id, status: "COMPLETED", postedAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }) : Promise.resolve([]),
      adminPrisma.room.count({ where: { hotelId: hotel.id, isActive: true, status: "VACANT_DIRTY" } }),
      adminPrisma.maintenanceTicket.count({
        where: { hotelId: hotel.id, status: { in: ["OPEN", "IN_PROGRESS", "AWAITING_PARTS"] } },
      }),
    ]);

    const sellable = rooms.filter((room) => !["OUT_OF_ORDER", "UNDER_MAINTENANCE", "BLOCKED"].includes(room.status)).length;
    const occupied = rooms.filter((room) => room.status === "OCCUPIED").length;
    const collected = paymentTotals.reduce((sum, row) => {
      const amount = row._sum.amount ?? 0;
      return sum + (row.isRefund ? -amount : amount);
    }, 0);

    return {
      id: hotel.id,
      name: hotel.name,
      slug: hotel.slug,
      propertyType: hotel.propertyType,
      city: hotel.city,
      role: access.accessRole,
      isCurrent: hotel.id === req.user!.hotelId,
      canSwitch: switchPolicyAllows(access),
      rooms: { physical: rooms.length, sellable, occupied, dirty: dirtyRooms },
      occupancyPercent: sellable > 0 ? Math.round((occupied / sellable) * 1000) / 10 : 0,
      arrivals,
      departures,
      collected,
      openMaintenance,
    };
  }));

  const totals = properties.reduce((summary, property) => ({
    physicalRooms: summary.physicalRooms + property.rooms.physical,
    sellableRooms: summary.sellableRooms + property.rooms.sellable,
    occupiedRooms: summary.occupiedRooms + property.rooms.occupied,
    dirtyRooms: summary.dirtyRooms + property.rooms.dirty,
    arrivals: summary.arrivals + property.arrivals,
    departures: summary.departures + property.departures,
    collected: summary.collected + property.collected,
    openMaintenance: summary.openMaintenance + property.openMaintenance,
  }), {
    physicalRooms: 0,
    sellableRooms: 0,
    occupiedRooms: 0,
    dirtyRooms: 0,
    arrivals: 0,
    departures: 0,
    collected: 0,
    openMaintenance: 0,
  });

  res.json({
    data: {
      date: todayString,
      name: access.portfolio.name,
      financialsVisible: access.canViewFinancials,
      propertyCount: properties.length,
      occupancyPercent: totals.sellableRooms > 0
        ? Math.round((totals.occupiedRooms / totals.sellableRooms) * 1000) / 10
        : 0,
      totals,
      properties,
    },
  });
});

router.post("/switch-property", authenticate, async (req, res) => {
  const access = await requireActivePortfolioActor(req.user!);
  if (!switchPolicyAllows(access)) {
    throw new AppError(403, "Property switching is not enabled for this account");
  }

  const { hotelId } = z.object({ hotelId: z.string().uuid() }).parse(req.body);
  const user = await adminPrisma.user.findFirst({
    where: { id: req.user!.userId, deletedAt: null },
    select: { id: true, name: true, email: true, isFirstLogin: true },
  });
  if (!user) throw new AppError(401, "Account is no longer active");

  if (!authorizedHotelIds(access).has(hotelId)) {
    throw new AppError(403, "This property is outside your assigned portfolio scope");
  }
  const targetHotel = await adminPrisma.hotel.findFirst({
    where: { id: hotelId, isActive: true, deletedAt: null },
  });
  if (!targetHotel) throw new AppError(404, "Property is no longer active");
  const assignedRole = await adminPrisma.role.findFirst({
    where: { name: access.accessRole, hotelId: null },
    include: { permissions: { include: { permission: true } } },
  });
  if (!assignedRole) throw new AppError(500, `${access.accessRole} role is not configured`);

  const session = await issueHotelSession(
    user,
    targetHotel,
    { role: access.accessRole, assignedRole },
    access.id,
  );
  await adminPrisma.auditLog.create({
    data: {
      hotelId,
      userId: user.id,
      action: "PROPERTY_SWITCH",
      entity: "hotel",
      entityId: hotelId,
      before: { hotelId: req.user!.hotelId },
      after: { hotelId },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"] as string | undefined,
    },
  });

  res.json(session);
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);

  let payload: { userId: string; hotelId: string; portfolioAccessId?: string };
  try {
    payload = jwt.verify(refreshToken, env.JWT_SECRET) as typeof payload;
  } catch {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const user = await adminPrisma.user.findUnique({ where: { id: payload.userId } });
  if (!user?.refreshTokenHash) {
    res.status(401).json({ error: "Session expired" });
    return;
  }

  const valid = await bcrypt.compare(refreshToken, user.refreshTokenHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid refresh token" });
    return;
  }

  const hotel = await adminPrisma.hotel.findUnique({
    where: { id: payload.hotelId },
    select: { isActive: true },
  });
  if (!hotel?.isActive) {
    res.status(403).json({ error: "Hotel account has been deactivated" });
    return;
  }

  let role: UserRole;
  let permissions: string[];
  if (payload.portfolioAccessId) {
    const access = await getPortfolioAccess(payload.portfolioAccessId, payload.userId);
    if (!access || !authorizedHotelIds(access).has(payload.hotelId)) {
      res.status(403).json({ error: "Portfolio access revoked" });
      return;
    }
    const assignedRole = await adminPrisma.role.findFirst({
      where: { name: access.accessRole, hotelId: null },
      include: { permissions: { include: { permission: true } } },
    });
    if (!assignedRole) throw new AppError(500, `${access.accessRole} role is not configured`);
    role = access.accessRole;
    permissions = assignedRole.permissions.map((rp) => rp.permission.key);
  } else {
    const hotelUser = await adminPrisma.hotelUser.findUnique({
      where: { hotelId_userId: { hotelId: payload.hotelId, userId: payload.userId } },
      include: { assignedRole: { include: { permissions: { include: { permission: true } } } } },
    });
    if (!hotelUser?.isActive) {
      res.status(403).json({ error: "Access revoked" });
      return;
    }
    role = hotelUser.role;
    permissions = hotelUser.assignedRole.permissions.map((rp) => rp.permission.key);
  }

  const accessToken = jwt.sign(
    {
      userId: user.id,
      hotelId: payload.hotelId,
      role,
      permissions,
      isFirstLogin: user.isFirstLogin,
      portfolioAccessId: payload.portfolioAccessId,
    },
    env.JWT_SECRET,
    jwtOpts(env.JWT_EXPIRES_IN)
  );

  res.json({ accessToken });
});

router.post("/complete-onboarding", authenticate, tenantMiddleware, async (req, res) => {
  await adminPrisma.user.update({
    where: { id: req.user!.userId },
    data: { isFirstLogin: false },
  });

  await req.withTenant((db) =>
    db.hotel.update({
      where: { id: req.user!.hotelId },
      data: { onboardingCompleted: true, onboardingStep: 4 },
    })
  );

  res.json({ success: true });
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

router.post("/change-password", authenticate, async (req, res) => {
  const { currentPassword, newPassword } = changePasswordSchema.parse(req.body);

  const user = await adminPrisma.user.findUnique({ where: { id: req.user!.userId } });
  if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
    throw new AppError(400, "Current password is incorrect");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);

  await adminPrisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      tempPassword: null,
      isFirstLogin: false,
    },
  });

  res.json({ success: true, message: "Password changed successfully" });
});

router.post("/logout", async (req, res) => {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const { userId } = jwt.verify(header.slice(7), env.JWT_SECRET) as { userId: string };
      await adminPrisma.user.update({
        where: { id: userId },
        data: { refreshTokenHash: null },
      });
    } catch {
      // token already invalid — still return 200
    }
  }
  res.json({ ok: true });
});

export default router;
