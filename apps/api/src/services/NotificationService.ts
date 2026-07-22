import { adminPrisma, Prisma, UserRole } from "@pms/db";
import type { TenantTx } from "@pms/db";
import { paginationMeta } from "../utils/pagination";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

interface CreateNotificationData {
  title:       string;
  body:        string;
  type:        string;
  entityId?:   string;
  entityType?: string;
  userId?:     string | null;
}

function notificationMetadata(data: CreateNotificationData): Prisma.InputJsonValue | undefined {
  return data.entityId
    ? { entityId: data.entityId, entityType: data.entityType ?? "" }
    : undefined;
}

function userWhere(userId: string) {
  return {
    OR: [
      { userId },
      { userId: null as string | null },
    ],
  };
}

export const NotificationService = {
  // Called inside existing withTenant callbacks — accepts db directly so it
  // participates in the same transaction and doesn't need its own RLS setup.
  async createNotification(
    db: TenantTx,
    hotelId: string,
    data: CreateNotificationData,
  ): Promise<void> {
    await db.notification.create({
      data: {
        hotelId,
        userId:   data.userId ?? null,
        type:     data.type,
        title:    data.title,
        body:     data.body,
        metadata: notificationMetadata(data),
        channel: "IN_APP",
      },
    });
  },

  // Some producers (notably the raw-SQL QR order service) have no TenantTx.
  // Both the recipient lookup and inserted records are therefore explicitly
  // constrained to hotelId before using adminPrisma.
  async createNotificationsForRoles(
    hotelId: string,
    roles: UserRole[],
    data: CreateNotificationData,
    additionalUserIds: string[] = [],
  ): Promise<number> {
    const recipients = await adminPrisma.hotelUser.findMany({
      where: {
        hotelId,
        isActive: true,
        OR: [
          { role: { in: roles } },
          ...(additionalUserIds.length > 0 ? [{ userId: { in: additionalUserIds } }] : []),
        ],
      },
      select: { userId: true },
    });
    const userIds = [...new Set(recipients.map((recipient) => recipient.userId))];
    if (userIds.length === 0) return 0;

    await adminPrisma.notification.createMany({
      data: userIds.map((userId) => ({
        hotelId,
        userId,
        type:     data.type,
        title:    data.title,
        body:     data.body,
        metadata: notificationMetadata(data),
        channel:  "IN_APP",
      })),
    });
    return userIds.length;
  },

  async resolveEntityNotifications(
    hotelId: string,
    type: string,
    entityId: string,
  ): Promise<void> {
    await adminPrisma.notification.updateMany({
      where: {
        hotelId,
        type,
        isRead: false,
        metadata: { path: ["entityId"], equals: entityId },
      },
      data: { isRead: true, readAt: new Date() },
    });
  },

  async listNotifications(withTenant: WithTenantFn, userId: string) {
    return withTenant((db) =>
      db.notification.findMany({
        where:   { ...userWhere(userId), isRead: false },
        orderBy: { createdAt: "desc" },
        take:    20,
      }),
    );
  },

  async listAllNotifications(
    withTenant: WithTenantFn,
    userId: string,
    page: number,
    limit: number,
  ) {
    const skip  = (page - 1) * limit;
    const where = userWhere(userId);

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.notification.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        db.notification.count({ where }),
      ]),
    );

    return { data: items, meta: paginationMeta(total, page, limit) };
  },

  async getUnreadCount(withTenant: WithTenantFn, userId: string) {
    return withTenant((db) =>
      db.notification.count({
        where: { ...userWhere(userId), isRead: false },
      }),
    );
  },

  async markAsRead(withTenant: WithTenantFn, notificationId: string) {
    return withTenant((db) =>
      db.notification.update({
        where: { id: notificationId },
        data:  { isRead: true, readAt: new Date() },
      }),
    );
  },

  async markAllAsRead(withTenant: WithTenantFn, userId: string) {
    return withTenant((db) =>
      db.notification.updateMany({
        where: { ...userWhere(userId), isRead: false },
        data:  { isRead: true, readAt: new Date() },
      }),
    );
  },
};
