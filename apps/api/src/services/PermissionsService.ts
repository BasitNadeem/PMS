import { adminPrisma } from "@pms/db";
import type { UpdateRolePermissionsDto } from "../schemas/settings";
import { AppError } from "../utils/AppError";

export const PermissionsService = {
  async getRolePermissions() {
    const [roles, allPermissions] = await Promise.all([
      adminPrisma.role.findMany({
        where: { hotelId: null, name: { not: "OWNER" } },
        orderBy: { sortOrder: "asc" },
        include: { permissions: { select: { permissionId: true } } },
      }),
      adminPrisma.permission.findMany({
        orderBy: [{ module: "asc" }, { action: "asc" }],
      }),
    ]);

    return roles.map((role) => {
      const grantedIds = new Set(role.permissions.map((rp) => rp.permissionId));
      return {
        roleId: role.id,
        roleName: role.displayName,
        permissions: allPermissions.map((permission) => ({
          key: permission.key,
          module: permission.module,
          action: permission.action,
          displayName: permission.displayName,
          enabled: grantedIds.has(permission.id),
        })),
      };
    });
  },

  async updateRolePermissions(roleId: string, dto: UpdateRolePermissionsDto) {
    const role = await adminPrisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError(404, "Role not found");
    if (role.name === "OWNER") throw new AppError(403, "Cannot modify permissions for the OWNER role");

    for (const { key, enabled } of dto.permissions) {
      const permission = await adminPrisma.permission.findUnique({ where: { key } });
      if (!permission) continue;

      if (enabled) {
        await adminPrisma.rolePermission.upsert({
          where: { roleId_permissionId: { roleId, permissionId: permission.id } },
          update: {},
          create: { roleId, permissionId: permission.id },
        });
      } else {
        await adminPrisma.rolePermission.deleteMany({
          where: { roleId, permissionId: permission.id },
        });
      }
    }

    return { success: true };
  },
};
