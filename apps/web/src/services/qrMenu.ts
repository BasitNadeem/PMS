import { api } from "../lib/api";

// Public guest-facing menu — same underlying data as POS "Menu Setup"
// (managed there; this service only covers the guest-side read/order flow).

export interface MenuItem {
  id:           string;
  name:         string;
  description:  string | null;
  price:        number; // paisas
  imageUrl:     string | null;
  isFeatured:   boolean;
  displayOrder: number;
}

export interface MenuCategory {
  id:             string;
  name:           string;
  description:    string | null;
  displayOrder:   number;
  availableFrom:  string | null;
  availableUntil: string | null;
  items:          MenuItem[];
}

export interface PublicMenuResponse {
  data:  MenuCategory[];
  hotel: { name: string };
}

export interface PlaceOrderDto {
  guestName:           string;
  guestPhone:          string;
  roomNumber:          string;
  deliveryType:        "room_delivery" | "pickup" | "dine_in";
  paymentPreference:   "charge_to_room" | "pay_now";
  specialInstructions?: string;
  items: { menuItemId: string; quantity: number; specialNote?: string }[];
}

export const qrMenuService = {
  getPublicMenu: async (hotelSlug: string): Promise<PublicMenuResponse> => {
    const res = await api.get(`/api/qr-public/${hotelSlug}/menu`);
    return res.data;
  },
  verifyRoom: async (hotelSlug: string, roomNumber: string): Promise<{
    found:      boolean;
    roomNumber: string;
    guestName:  string | null;
    guestPhone: string | null;
  }> => {
    const res = await api.get(`/api/qr-public/${hotelSlug}/verify-room`, { params: { q: roomNumber } });
    return res.data.data;
  },
  placeOrder: async (hotelSlug: string, dto: PlaceOrderDto): Promise<{ orderNumber: string; estimatedMinutes: number }> => {
    const res = await api.post(`/api/qr-public/${hotelSlug}/order`, dto);
    return res.data.data;
  },
  trackOrder: async (hotelSlug: string, orderNumber: string): Promise<{
    orderNumber:         string;
    status:              string;
    deliveryType:        string;
    specialInstructions: string | null;
    createdAt:           string;
    totalAmount:         number;
    paymentPreference:   string;
    roomNumber:          string;
    items:               { name: string; quantity: number; price: number; lineTotal: number }[];
  }> => {
    const res = await api.get(`/api/qr-public/${hotelSlug}/track`, { params: { orderNumber } });
    return res.data.data;
  },
};
