import { api } from "../lib/api";
import type { PaginationMeta } from "./rooms";

export interface AppNotification {
  id:        string;
  hotelId:   string;
  userId:    string | null;
  type:      string;
  title:     string;
  body:      string;
  metadata:  Record<string, string> | null;
  isRead:    boolean;
  readAt:    string | null;
  channel:   string;
  createdAt: string;
}

export interface NotificationCount {
  count: number;
}

export function notificationHref(notification: AppNotification): string {
  const entityId   = notification.metadata?.entityId;
  const entityType = notification.metadata?.entityType;
  if (notification.type === "HOUSEKEEPING") return "/housekeeping";
  if (notification.type === "QR_ORDER") return "/qr-orders";
  if (notification.type === "MAINTENANCE" || notification.type === "MAINTENANCE_URGENT") return "/maintenance";
  if (notification.type === "SHIFT_CASH_DISCREPANCY") return "/reports/shifts";
  if (entityType === "group"       && entityId) return `/groups/${entityId}`;
  if (entityType === "reservation" && entityId) return `/reservations/${entityId}`;
  return "/notifications";
}

export const notificationsService = {
  getNotifications: async (): Promise<AppNotification[]> => {
    const res = await api.get("/api/notifications");
    return res.data.data;
  },

  getUnreadCount: async (): Promise<NotificationCount> => {
    const res = await api.get("/api/notifications/count");
    return res.data.data;
  },

  getAllNotifications: async (
    page = 1,
  ): Promise<{ data: AppNotification[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/notifications/all", { params: { page } });
    return res.data;
  },

  markAsRead: async (id: string): Promise<AppNotification> => {
    const res = await api.patch(`/api/notifications/${id}/read`);
    return res.data.data;
  },

  markAllAsRead: async (): Promise<void> => {
    await api.patch("/api/notifications/read-all");
  },
};
