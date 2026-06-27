import { api } from "../lib/api";
import type { PaginationMeta } from "./rooms";
import type { PaymentMethod } from "./folio";

export type ReservationStatus =
  | "ENQUIRY"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "CHECKED_OUT"
  | "NO_SHOW"
  | "CANCELLED"
  | "WAITLISTED";

export type BookingSource =
  | "WALK_IN"
  | "PHONE"
  | "WHATSAPP"
  | "DIRECT_WEBSITE"
  | "BOOKING_COM"
  | "AGODA"
  | "EXPEDIA"
  | "AIRBNB"
  | "BOOKME_PK"
  | "SASTATICKET_PK"
  | "TRAVEL_AGENT"
  | "OTA_OTHER";

export interface ReservationGuest {
  id: string;
  fullName: string;
  phone: string | null;
}

export interface ReservationGuestDetail extends ReservationGuest {
  firstName: string;
  lastName: string;
  email: string | null;
  documentType: string;
  documentNumber: string | null;
  nationality: string | null;
}

export interface ReservationRoomInfo {
  id: string;
  number: string;
  floor: number | null;
  status: string;
}

export interface ReservationRoomTypeInfo {
  id: string;
  name: string;
  typeName: string;
  maxOccupancy: number;
}

export interface ReservationRoom {
  id: string;
  reservationId: string;
  roomId: string;
  roomTypeId: string;
  ratePerNight: number;
  checkInDate: string;
  checkOutDate: string;
  room: ReservationRoomInfo;
  roomType: ReservationRoomTypeInfo;
}

export interface ReservationRoomSummary {
  id: string;
  reservationId: string;
  roomId: string;
  roomTypeId: string;
  ratePerNight: number;
  checkInDate: string;
  checkOutDate: string;
  room: { number: string; floor: number | null };
  roomType: { name: string; typeName: string };
}

export interface FolioSummary {
  id: string;
  folioNumber: string;
  chargesTotal: number;
  paymentsTotal: number;
  balanceDue: number;
  isOpen: boolean;
}

export interface ReservationSummary {
  id: string;
  confirmationNumber: string;
  status: ReservationStatus;
  source: BookingSource;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  children: number;
  quotedRate: number;
  totalAmount: number;
  specialRequests: string | null;
  groupId: string | null;
  createdAt: string;
  isVip: boolean;
  guest: ReservationGuest;
  rooms: ReservationRoomSummary[];
}

export interface ReservationDetail extends Omit<ReservationSummary, "guest" | "rooms"> {
  balanceDue: number;
  cancelledAt: string | null;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  internalNotes: string | null;
  guest: ReservationGuestDetail;
  rooms: ReservationRoom[];
  folio: FolioSummary | null;
}

export interface CreateReservationDto {
  guestId: string;
  checkInDate: string;
  checkOutDate: string;
  roomId: string;
  roomTypeId: string;
  ratePerNight: number;
  adults: number;
  children: number;
  source: BookingSource;
  specialRequests?: string;
  advancePayment?: number;
  advancePaymentMethod?: PaymentMethod;
  isVip?: boolean;
}

export interface ReservationFilters {
  status?: ReservationStatus;
  statuses?: string;
  search?: string;
  checkInDate?: string;
  checkOutDate?: string;
  page?: number;
  limit?: number;
  sortBy?: "checkIn" | "checkOut" | "created" | "status";
  sortDir?: "asc" | "desc";
}

export interface CalendarReservationRoom {
  roomId: string;
  room: {
    id: string;
    number: string;
    floor: number | null;
    roomType: { name: string };
  };
}

export interface CalendarReservation {
  id: string;
  confirmationNumber: string;
  status: ReservationStatus;
  checkIn: string;
  checkOut: string;
  totalAmount: number;
  groupId: string | null;
  isVip: boolean;
  guest: { fullName: string };
  rooms: CalendarReservationRoom[];
}

export const reservationsService = {
  getReservations: async (
    params: ReservationFilters,
  ): Promise<{ data: ReservationSummary[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/reservations", { params });
    return res.data;
  },

  getCounts: async (): Promise<Partial<Record<ReservationStatus, number>>> => {
    const res = await api.get("/api/reservations/counts");
    return res.data.data;
  },

  getReservation: async (id: string): Promise<ReservationDetail> => {
    const res = await api.get(`/api/reservations/${id}`);
    return res.data.data;
  },

  createReservation: async (dto: CreateReservationDto): Promise<ReservationSummary> => {
    const res = await api.post("/api/reservations", dto);
    return res.data.data;
  },

  updateReservationStatus: async (
    id: string,
    status: ReservationStatus,
  ): Promise<ReservationSummary> => {
    const res = await api.patch(`/api/reservations/${id}/status`, { status });
    return res.data.data;
  },

  updateReservation: async (
    id: string,
    dto: Partial<Pick<CreateReservationDto, "adults" | "children" | "source" | "specialRequests" | "isVip">>,
  ): Promise<ReservationSummary> => {
    const res = await api.patch(`/api/reservations/${id}`, dto);
    return res.data.data;
  },

  getCalendarReservations: async (
    year: number,
    month: number,
  ): Promise<CalendarReservation[]> => {
    const res = await api.get("/api/reservations/calendar", { params: { year, month } });
    return res.data.data;
  },
};
