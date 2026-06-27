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
        metadata: data.entityId
          ? { entityId: data.entityId, entityType: data.entityType ?? "" }
          : undefined,
        channel: "IN_APP",
      },
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
