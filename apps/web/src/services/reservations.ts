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
  | "OTA_OTHER"
  | "BOOKING_ENGINE";

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
  subtotalAmount: number;
  taxAmount: number;
  taxInclusive: boolean;
  taxBreakdown: Array<{ key: "GST" | "PST"; label: string; rate: number; amount: number }> | null;
  totalAmount: number;
  specialRequests: string | null;
  bookingContactName: string | null;
  bookingContactEmail: string | null;
  groupId: string | null;
  group: { groupRef: string; payerType: string; name: string } | null;
  createdAt: string;
  isVip: boolean;
  guest: ReservationGuest;
  rooms: ReservationRoomSummary[];
}

export interface ReservationDetail extends Omit<ReservationSummary, "guest" | "rooms"> {
  infants: number;
  guestType: string;
  balanceDue: number;
  discountAmount: number;
  appliedRatePlanName: string | null;
  promoCode: string | null;
  advancePaid: number;
  otaBookingRef: string | null;
  otaSource: string | null;
  billToCompany: boolean;
  bookingContactName: string | null;
  bookingContactEmail: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  cancellationFee: number;
  termsAcceptedAt: string | null;
  actualCheckIn: string | null;
  actualCheckOut: string | null;
  internalNotes: string | null;
  dietaryRequirements: string | null;
  purposeOfVisit: string | null;
  arrivalMode: string | null;
  estimatedArrivalTime: string | null;
  requiresPickup: boolean;
  isWalkIn: boolean;
  guest: ReservationGuestDetail;
  rooms: ReservationRoom[];
  folio: FolioSummary | null;
  company: { id: string; name: string; code: string | null; type: string } | null;
  payments: Array<{
    id: string;
    method: PaymentMethod;
    status: string;
    amount: number;
    transactionRef: string | null;
    receiptNumber: string | null;
    postedAt: string;
    isRefund: boolean;
  }>;
  upsells: Array<{
    id: string;
    name: string;
    category: string;
    quantity: number;
    unitAmount: number;
    amount: number;
    postedAt: string | null;
  }>;
  activity: Array<{
    id: string;
    action: string;
    notes: string | null;
    before: unknown;
    after: unknown;
    createdAt: string;
    user: { id: string; name: string } | null;
  }>;
  stayChanges: Array<{
    id: string;
    changeType: "ROOM_MOVE" | "UPGRADE" | "DOWNGRADE" | "REBATE" | string;
    effectiveDate: string;
    fromRoomNumber: string;
    toRoomNumber: string;
    fromRoomTypeName: string;
    toRoomTypeName: string;
    previousRate: number;
    newRate: number;
    previousCheckOut: string | null;
    newCheckOut: string | null;
    earlyDepartureTreatment: "KEEP_ORIGINAL_CHARGES" | "CREDIT_UNUSED_NIGHTS" | "CUSTOM_CREDIT" | null;
    earlyDepartureCreditAmount: number;
    rateAdjustment: number;
    rebateAmount: number;
    internalReason: string;
    customerDescription: string;
    createdBy: string;
    createdAt: string;
  }>;
}

export interface ManageCheckedInStayDto {
  newRoomId?: string;
  checkOutDate?: string;
  earlyDepartureTreatment: "KEEP_ORIGINAL_CHARGES" | "CREDIT_UNUSED_NIGHTS" | "CUSTOM_CREDIT";
  earlyDepartureCreditAmount?: number;
  pricingMode: "KEEP_RATE" | "USE_NEW_ROOM_RATE" | "CUSTOM_RATE";
  customRatePerNight?: number;
  rebateAmount: number;
  reason: string;
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
    reason?: string,
  ): Promise<ReservationSummary> => {
    const res = await api.patch(`/api/reservations/${id}/status`, { status, reason });
    return res.data.data;
  },

  updateReservation: async (
    id: string,
    dto: Partial<
      Pick<CreateReservationDto, "adults" | "children" | "source" | "specialRequests" | "isVip"> & {
        checkInDate: string;
        checkOutDate: string;
        roomId: string;
        roomTypeId: string;
        ratePerNight: number;
      }
    >,
  ): Promise<ReservationSummary> => {
    const res = await api.patch(`/api/reservations/${id}`, dto);
    return res.data.data;
  },

  manageCheckedInStay: async (
    id: string,
    dto: ManageCheckedInStayDto,
  ): Promise<ReservationDetail> => {
    const res = await api.post(`/api/reservations/${id}/manage-stay`, dto);
    return res.data.data;
  },

  reverseLifecycle: async (
    id: string,
    action: "CHECK_IN" | "CHECK_OUT",
    reason: string,
  ): Promise<ReservationDetail> => {
    const res = await api.post(`/api/reservations/${id}/reverse-lifecycle`, { action, reason });
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
