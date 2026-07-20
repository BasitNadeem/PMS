import axios from "axios";

// Separate axios instance — no auth headers, but still needs the real API origin.
const publicApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "",
});

export interface PublicHotel {
  name: string;
  description: string | null;
  amenities: string[];
  city: string | null;
  address: string | null;
  phone: string | null;
  whatsappNumber: string | null;
  propertyType: string;
  logoUrl: string | null;
  themeKey: string;
}

export interface PublicRoomType {
  id: string;
  name: string;
  description: string | null;
  typeName: string;
  maxOccupancy: number;
  defaultRate: number; // PKR
  photoUrls: string[];
  amenities: string[];
  sortOrder: number;
}

export interface AvailabilityResult {
  roomTypeId: string;
  roomTypeName: string;
  availableCount: number;
}

export interface SuggestRateResult {
  suggestedRate: number; // PKR
  matchedPlan: { id: string; name: string; type: string } | null;
}

export interface BookingRequest {
  roomTypeId: string;
  checkInDate: string;
  checkOutDate: string;
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  adults: number;
  children?: number;
  specialRequests?: string;
}

export interface BookingConfirmation {
  confirmationNumber: string;
  status: string;
  message: string;
}

export interface CartItem {
  roomTypeId: string;
  roomTypeName: string;
  quantity: number;
  ratePerNight: number | null;
  defaultRate: number;
  maxOccupancy: number;
}

export interface BookMultiRequest {
  checkInDate: string;
  checkOutDate: string;
  items: { roomTypeId: string; quantity: number }[];
  guestName: string;
  guestPhone: string;
  guestEmail?: string;
  adults: number;
  children?: number;
  specialRequests?: string;
}

export interface BookMultiConfirmation {
  confirmationReference: string;
  rooms: { confirmationNumber: string; roomTypeName: string }[];
  status: string;
  message: string;
}

const base = (slug: string) => `/api/public/booking/${slug}`;

export const bookingEngineService = {
  async getHotel(slug: string): Promise<PublicHotel> {
    const res = await publicApi.get(base(slug));
    return res.data.data as PublicHotel;
  },

  async getRoomTypes(slug: string): Promise<PublicRoomType[]> {
    const res = await publicApi.get(`${base(slug)}/room-types`);
    return res.data.data as PublicRoomType[];
  },

  async getAvailability(slug: string, checkIn: string, checkOut: string): Promise<AvailabilityResult[]> {
    const res = await publicApi.get(`${base(slug)}/availability`, {
      params: { checkIn, checkOut },
    });
    return res.data.data as AvailabilityResult[];
  },

  async suggestRate(slug: string, roomTypeId: string, checkIn: string, checkOut: string): Promise<SuggestRateResult> {
    const res = await publicApi.get(`${base(slug)}/suggest-rate`, {
      params: { roomTypeId, checkIn, checkOut },
    });
    return res.data.data as SuggestRateResult;
  },

  async book(slug: string, dto: BookingRequest): Promise<BookingConfirmation> {
    const res = await publicApi.post(`${base(slug)}/book`, dto);
    return res.data.data as BookingConfirmation;
  },

  async bookMulti(slug: string, dto: BookMultiRequest): Promise<BookMultiConfirmation> {
    const res = await publicApi.post(`${base(slug)}/book-multi`, dto);
    return res.data.data as BookMultiConfirmation;
  },
};
