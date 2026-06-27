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
