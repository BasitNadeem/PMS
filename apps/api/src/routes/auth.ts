import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { z } from "zod";
import { adminPrisma } from "@pms/db";
import { env } from "../lib/env";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { AppError } from "../utils/AppError";

// @types/jsonwebtoken 9.x uses ms.StringValue (a branded type) for expiresIn.
// Casting through SignOptions["expiresIn"] keeps the call type-safe without `any`.
const jwtOpts = (expiresIn: string): SignOptions => ({ expiresIn: expiresIn as SignOptions["expiresIn"] });

/**
 * Auth routes use adminPrisma (superuser / DIRECT_URL) because:
 *   - Login has no hotel context yet (RLS would block the query)
 *   - Looking up user by email / hotel by slug requires cross-tenant visibility
 */

const router: Router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  hotelSlug: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const { email, password, hotelSlug } = loginSchema.parse(req.body);

  const hotel = await adminPrisma.hotel.findUnique({ where: { slug: hotelSlug } });
  if (!hotel || !hotel.isActive) {
    res.status(404).json({ error: "Hotel not found" });
    return;
  }

  const user = await adminPrisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
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

  const permissions = hotelUser.assignedRole.permissions.map((rp) => rp.permission.key);

  const accessToken = jwt.sign(
    { userId: user.id, hotelId: hotel.id, role: hotelUser.role, permissions, isFirstLogin: user.isFirstLogin },
    env.JWT_SECRET,
    jwtOpts(env.JWT_EXPIRES_IN)
  );
  const refreshToken = jwt.sign(
    { userId: user.id, hotelId: hotel.id },
    env.JWT_SECRET,
    jwtOpts(env.JWT_REFRESH_EXPIRES_IN)
  );

  await adminPrisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      refreshTokenHash: await bcrypt.hash(refreshToken, 10),
    },
  });

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

  res.json({
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
    hotel: { id: hotel.id, name: hotel.name, slug: hotel.slug, onboardingCompleted: hotel.onboardingCompleted },
  });
});

router.post("/refresh", async (req, res) => {
  const { refreshToken } = z.object({ refreshToken: z.string() }).parse(req.body);

  let payload: { userId: string; hotelId: string };
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

  const hotelUser = await adminPrisma.hotelUser.findUnique({
    where:   { hotelId_userId: { hotelId: payload.hotelId, userId: payload.userId } },
    include: { assignedRole: { include: { permissions: { include: { permission: true } } } } },
  });
  if (!hotelUser?.isActive) {
    res.status(403).json({ error: "Access revoked" });
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

  const permissions = hotelUser.assignedRole.permissions.map((rp) => rp.permission.key);

  const accessToken = jwt.sign(
    { userId: user.id, hotelId: payload.hotelId, role: hotelUser.role, permissions, isFirstLogin: user.isFirstLogin },
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
