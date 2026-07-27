import { adminPrisma, UserRole } from "@pms/db";
import type { UpdateRolePermissionsDto } from "../schemas/settings";
import { AppError } from "../utils/AppError";

const VISIBLE_PERMISSION_KEYS = new Set([
  "dashboard:read",
  "rooms:read", "rooms:create", "rooms:update", "rooms:delete",
  "guests:read", "guests:create", "guests:update", "guests:delete",
  "reservations:read", "reservations:create", "reservations:update",
  "groups:read", "groups:create", "groups:update",
  "billing:read", "billing:create", "billing:update", "billing:delete",
  "expenses:read", "expenses:create", "expenses:update", "expenses:delete",
  "cashbook:read", "cashbook:create",
  "housekeeping:read", "housekeeping:create", "housekeeping:update",
  "maintenance:read", "maintenance:create", "maintenance:update",
  "pos:read", "pos:create", "pos:update", "pos:manage",
  "rates:read", "rates:create", "rates:update", "rates:delete",
  "bookingEngine:read", "bookingEngine:manage",
  "team:read", "team:create", "team:update", "team:delete",
  "reports:read",
  "settings:read", "settings:update",
]);

// One visible control can govern both a frontend capability key and the
// resource-level API keys that enforce the same operation. This keeps the
// permissions screen honest: switching off "Reservations / Update" also
// removes check-in, checkout and cancellation API authority.
const PAIRED_PERMISSION_KEYS: Record<string, string[]> = {
  "rooms:read":          ["ROOM_READ", "ROOM_TYPE_READ"],
  "rooms:create":        ["ROOM_CREATE", "ROOM_TYPE_CREATE"],
  "rooms:update":        ["ROOM_UPDATE", "ROOM_TYPE_UPDATE"],
  "rooms:delete":        ["ROOM_DELETE", "ROOM_TYPE_DELETE"],
  "guests:read":         ["GUEST_READ"],
  "guests:create":       ["GUEST_CREATE"],
  "guests:update":       ["GUEST_UPDATE"],
  "guests:delete":       ["GUEST_DELETE"],
  "reservations:read":   ["RESERVATION_READ"],
  "reservations:create": ["RESERVATION_CREATE"],
  "reservations:update": [
    "RESERVATION_UPDATE", "RESERVATION_CANCEL",
    "RESERVATION_CHECKIN", "RESERVATION_CHECKOUT",
  ],
  "billing:read":        ["FOLIO_READ", "PAYMENT_READ", "INVOICE_READ"],
  "billing:create":      ["PAYMENT_CREATE", "INVOICE_CREATE"],
  "billing:update":      ["FOLIO_UPDATE", "INVOICE_UPDATE"],
  "billing:delete":      ["PAYMENT_REFUND"],
  "housekeeping:read":   ["HOUSEKEEPING_READ"],
  "housekeeping:create": ["HOUSEKEEPING_CREATE"],
  "housekeeping:update": ["HOUSEKEEPING_UPDATE"],
  "maintenance:read":    ["MAINTENANCE_READ"],
  "maintenance:create":  ["MAINTENANCE_CREATE"],
  "maintenance:update":  ["MAINTENANCE_UPDATE"],
  "pos:read":            ["POS_READ", "INVENTORY_READ"],
  "pos:create":          ["POS_CREATE"],
  "pos:update":          ["POS_UPDATE"],
  "pos:manage":          ["INVENTORY_UPDATE"],
  "rates:read":          ["RATE_READ"],
  "rates:create":        ["RATE_CREATE"],
  "rates:update":        ["RATE_UPDATE"],
  "rates:delete":        ["RATE_DELETE"],
  "bookingEngine:read":  ["BOOKING_ENGINE_READ"],
  "team:read":           ["USER_READ", "STAFF_READ"],
  "team:create":         ["USER_CREATE", "STAFF_CREATE"],
  "team:update":         ["USER_UPDATE", "STAFF_UPDATE"],
  "team:delete":         ["USER_DELETE", "STAFF_DELETE"],
  "reports:read":        ["REPORT_READ"],
  "settings:read":       ["HOTEL_READ"],
  "settings:update":     ["HOTEL_UPDATE", "HOTEL_SETTINGS"],
};

function governedKeys(key: string): string[] {
  return [key, ...(PAIRED_PERMISSION_KEYS[key] ?? [])];
}

export const PermissionsService = {
  async getRolePermissions(hotelId: string) {
    const [roles, allPermissions] = await Promise.all([
      adminPrisma.role.findMany({
        where: {
          name: { not: "OWNER" },
          OR: [{ hotelId: null }, { hotelId }],
        },
        orderBy: [{ sortOrder: "asc" }, { hotelId: "desc" }],
        include: { permissions: { select: { permissionId: true } } },
      }),
      adminPrisma.permission.findMany({
        orderBy: [{ module: "asc" }, { action: "asc" }],
      }),
    ]);

    const effectiveRoles = new Map<string, (typeof roles)[number]>();
    for (const role of roles) {
      const existing = effectiveRoles.get(role.name);
      if (!existing || role.hotelId === hotelId) effectiveRoles.set(role.name, role);
    }

    return [...effectiveRoles.values()]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((role) => {
      const grantedIds = new Set(role.permissions.map((rp) => rp.permissionId));
      const permissionByKey = new Map(allPermissions.map((permission) => [permission.key, permission]));
      return {
        roleId: role.id,
        roleName: role.displayName,
        permissions: allPermissions
          .filter((permission) => VISIBLE_PERMISSION_KEYS.has(permission.key))
          .map((permission) => {
            const [module, action] = permission.key.split(":");
            const keys = governedKeys(permission.key);
            return {
              key: permission.key,
              module,
              action,
              displayName: permission.displayName,
              enabled: keys.every((key) => {
                const governed = permissionByKey.get(key);
                return governed ? grantedIds.has(governed.id) : true;
              }),
            };
          }),
      };
      });
  },

  async updateRolePermissions(hotelId: string, roleId: string, dto: UpdateRolePermissionsDto) {
    const role = await adminPrisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new AppError(404, "Role not found");
    if (role.name === "OWNER") throw new AppError(403, "Cannot modify permissions for the OWNER role");
    if (role.hotelId !== null && role.hotelId !== hotelId) {
      throw new AppError(404, "Role not found");
    }

    return adminPrisma.$transaction(async (tx) => {
      let effectiveRole = role;
      if (role.hotelId === null) {
        const existingOverride = await tx.role.findUnique({
          where: { hotelId_name: { hotelId, name: role.name } },
        });
        if (existingOverride) {
          effectiveRole = existingOverride;
        } else {
          effectiveRole = await tx.role.create({
            data: {
              hotelId,
              name: role.name,
              displayName: role.displayName,
              description: role.description,
              color: role.color,
              isSystem: false,
              isCustom: true,
              sortOrder: role.sortOrder,
              permissions: {
                create: (await tx.rolePermission.findMany({
                  where: { roleId: role.id },
                  select: { permissionId: true },
                })).map(({ permissionId }) => ({ permissionId })),
              },
            },
          });
        }
        await tx.hotelUser.updateMany({
          where: { hotelId, role: role.name as UserRole },
          data: { roleId: effectiveRole.id },
        });
      }

      for (const { key, enabled } of dto.permissions) {
        if (!VISIBLE_PERMISSION_KEYS.has(key)) continue;
        const permissions = await tx.permission.findMany({
          where: { key: { in: governedKeys(key) } },
          select: { id: true },
        });

        for (const permission of permissions) {
          if (enabled) {
            await tx.rolePermission.upsert({
              where: {
                roleId_permissionId: {
                  roleId: effectiveRole.id,
                  permissionId: permission.id,
                },
              },
              update: {},
              create: { roleId: effectiveRole.id, permissionId: permission.id },
            });
          } else {
            await tx.rolePermission.deleteMany({
              where: { roleId: effectiveRole.id, permissionId: permission.id },
            });
          }
        }
      }

      return { success: true, roleId: effectiveRole.id };
    });
  },
};
