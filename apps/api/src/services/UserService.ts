import bcrypt from "bcryptjs";
import { adminPrisma, UserRole } from "@pms/db";
import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import type { CreateUserDto, UpdateUserDto, ResetPasswordDto } from "../schemas/users";
import { checkUserLimit } from "../lib/subscription";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

const USER_SELECT = {
  id:        true,
  name:      true,
  email:     true,
  phone:     true,
  createdAt: true,
} as const;

const ROLE_SELECT = {
  id:          true,
  name:        true,
  displayName: true,
} as const;

const HOTEL_USER_INCLUDE = {
  user:         { select: USER_SELECT },
  assignedRole: { select: ROLE_SELECT },
} as const;

export const UserService = {
  // Must use adminPrisma (not withTenant) because the `users` table has a
  // self-access-only RLS policy (id = current_user_id()). Using withTenant would
  // block fetching team members' user rows other than the logged-in user, causing
  // their `user` relation to return null and crash the card renderer.
  // Tenant isolation is enforced explicitly via the `hotelId` filter.
  async listUsers(hotelId: string) {
    return adminPrisma.hotelUser.findMany({
      where:    { hotelId },
      include:  HOTEL_USER_INCLUDE,
      orderBy:  { createdAt: "asc" },
    });
  },

  async createUser(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateUserDto) {
    // Enforce user limit from subscription plan
    const userCount = await adminPrisma.hotelUser.count({ where: { hotelId: actor.hotelId } });
    await checkUserLimit(actor.hotelId, userCount);

    // Resolve role from global roles table (system roles have hotelId = null)
    const role = await adminPrisma.role.findFirst({ where: { id: dto.roleId } });
    if (!role) throw new AppError(400, "Invalid role");

    const existingUser = await adminPrisma.user.findUnique({ where: { email: dto.email } });

    if (existingUser) {
      // Check if this user is already linked to this hotel
      const existing = await adminPrisma.hotelUser.findUnique({
        where: { hotelId_userId: { hotelId: actor.hotelId, userId: existingUser.id } },
      });
      if (existing) throw new AppError(409, "This user is already a member of this hotel");

      // Link existing user to this hotel
      const hotelUser = await adminPrisma.hotelUser.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   existingUser.id,
          role:     role.name as UserRole,
          roleId:   role.id,
          isActive: true,
        },
        include: HOTEL_USER_INCLUDE,
      });

      await withTenant((db) =>
        db.auditLog.create({
          data: {
            hotelId:  actor.hotelId,
            userId:   actor.userId,
            action:   "USER_CREATE",
            entity:   "hotelUser",
            entityId: hotelUser.id,
            after:    JSON.parse(JSON.stringify({ email: dto.email, roleId: dto.roleId, linked: true })),
          },
        }),
      );

      return hotelUser;
    }

    // Create brand-new user + hotel link in one admin transaction
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const hotelUser = await adminPrisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: dto.name, email: dto.email, passwordHash,
          ...(dto.phone ? { phone: dto.phone } : {}),
        },
      });

      return tx.hotelUser.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   user.id,
          role:     role.name as UserRole,
          roleId:   role.id,
          isActive: true,
        },
        include: HOTEL_USER_INCLUDE,
      });
    });

    await withTenant((db) =>
      db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "USER_CREATE",
          entity:   "hotelUser",
          entityId: hotelUser.id,
          after:    JSON.parse(JSON.stringify({ email: dto.email, roleId: dto.roleId })),
        },
      }),
    );

    return hotelUser;
  },

  async updateUser(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    hotelUserId: string,
    dto: UpdateUserDto,
  ) {
    return withTenant(async (db) => {
      const existing = await db.hotelUser.findUnique({
        where:   { id: hotelUserId },
        include: { user: { select: { id: true } } },
      });
      if (!existing) throw new AppError(404, "Team member not found");

      // Self-deactivation guard
      if (dto.isActive === false && existing.userId === actor.userId) {
        throw new AppError(400, "You cannot deactivate your own account");
      }

      // Resolve new role if changing
      let newRole: { id: string; name: string } | null = null;
      if (dto.roleId) {
        newRole = await adminPrisma.role.findFirst({ where: { id: dto.roleId } });
        if (!newRole) throw new AppError(400, "Invalid role");
      }

      // Update name on the User record (global)
      if (dto.name) {
        await adminPrisma.user.update({
          where: { id: existing.userId },
          data:  { name: dto.name },
        });
      }

      // Update HotelUser record
      const updated = await db.hotelUser.update({
        where: { id: hotelUserId },
        data: {
          ...(newRole && { roleId: newRole.id, role: newRole.name as UserRole }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        },
        include: HOTEL_USER_INCLUDE,
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "USER_UPDATE",
          entity:   "hotelUser",
          entityId: hotelUserId,
          before:   JSON.parse(JSON.stringify({ role: existing.role, isActive: existing.isActive })),
          after:    JSON.parse(JSON.stringify(dto)),
        },
      });

      return updated;
    });
  },

  async resetPassword(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    hotelUserId: string,
    dto: ResetPasswordDto,
  ) {
    // Look up via adminPrisma — the `users` table has a self-access-only RLS
    // policy, so withTenant cannot read or update another user's row. Tenant
    // isolation is enforced explicitly via the hotelId check below.
    const existing = await adminPrisma.hotelUser.findUnique({
      where:  { id: hotelUserId },
      select: { id: true, hotelId: true, userId: true },
    });
    if (!existing || existing.hotelId !== actor.hotelId) {
      throw new AppError(404, "Team member not found");
    }
    if (existing.userId === actor.userId) {
      throw new AppError(400, "Use the change password option in your account settings");
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);
    await adminPrisma.user.update({
      where: { id: existing.userId },
      data:  { passwordHash, isFirstLogin: true },
    });

    await withTenant((db) =>
      db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "USER_PASSWORD_RESET",
          entity:   "hotelUser",
          entityId: hotelUserId,
        },
      }),
    );
  },

  async listRoles() {
    return adminPrisma.role.findMany({
      where:   { isSystem: true, hotelId: null },
      select:  { id: true, name: true, displayName: true, description: true, color: true, sortOrder: true },
      orderBy: { sortOrder: "asc" },
    });
  },
};
