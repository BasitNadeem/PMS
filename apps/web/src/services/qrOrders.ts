import { api } from "../lib/api";

export interface QrOrderItem {
  id:           string;
  order_id:     string;
  menu_item_id: string | null;
  item_name:    string;
  item_price:   number;
  quantity:     number;
  special_note: string | null;
  subtotal:     number;
  created_at:   string;
}

export interface QrOrder {
  id:                   string;
  hotel_id:             string;
  order_number:         string;
  guest_name:           string;
  guest_phone:          string;
  room_number:          string | null;
  room_verified:        boolean;
  reservation_id:       string | null;
  delivery_type:        "room_delivery" | "pickup" | "dine_in";
  special_instructions: string | null;
  status:               "pending" | "confirmed" | "preparing" | "ready" | "delivered" | "cancelled";
  total_amount:         number;
  folio_id:               string | null;
  requires_folio_review:  boolean;
  payment_preference:     "charge_to_room" | "pay_now";
  payment_method:         string | null;
  created_at:             string;
  updated_at:             string;
  items:                  QrOrderItem[];
}

export interface ListQrOrdersParams {
  status?:    string;
  startDate?: string;
  endDate?:   string;
  page?:      number;
  limit?:     number;
}

export const qrOrdersService = {
  list: async (params: ListQrOrdersParams = {}): Promise<{ data: QrOrder[]; meta: { total: number; page: number; limit: number; totalPages: number } }> => {
    const res = await api.get("/api/qr-orders", { params });
    return res.data;
  },

  // Kitchen display — no pagination, excludes delivered + cancelled
  getKitchenOrders: async (): Promise<QrOrder[]> => {
    const res = await api.get("/api/kitchen/orders");
    return res.data.data;
  },

  updateStatus: async (id: string, status: string, paymentMethod?: string): Promise<QrOrder> => {
    const res = await api.patch(`/api/qr-orders/${id}/status`, { status, ...(paymentMethod ? { paymentMethod } : {}) });
    return res.data.data;
  },

  postToFolio: async (id: string): Promise<QrOrder> => {
    const res = await api.patch(`/api/qr-orders/${id}/post-to-folio`);
    return res.data.data;
  },

  cancel: async (id: string): Promise<QrOrder> => {
    const res = await api.delete(`/api/qr-orders/${id}`);
    return res.data.data;
  },

  editOrder: async (
    id: string,
    payload: {
      deliveryType?:        "room_delivery" | "pickup" | "dine_in";
      specialInstructions?: string | null;
      items?: { menuItemId: string; quantity: number; specialNote?: string }[];
    },
  ): Promise<QrOrder> => {
    const res = await api.patch(`/api/qr-orders/${id}/edit`, payload);
    return res.data.data;
  },
};
