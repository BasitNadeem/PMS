import { api } from "../lib/api";

export type DocumentType = "CNIC" | "PASSPORT" | "DRIVING_LICENSE" | "NRIC" | "OTHER";

export interface GuestSummary {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  city: string | null;
  country: string | null;
  documentType: DocumentType;
  documentNumber: string | null;
  totalStays: number;
  totalSpend: number;
  isBlacklisted: boolean;
  vipLevel: number;
  createdAt: string;
}

export interface ReservationSummary {
  id: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  rooms: Array<{
    room: { number: string };
  }>;
}

export interface GuestDetail extends GuestSummary {
  alternatePhone: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  documentExpiry: string | null;
  address: string | null;
  isForeigner: boolean;
  language: string | null;
  vipLevel: number;
  blacklistReason: string | null;
  internalNotes: string | null;
  updatedAt: string;
  reservations: ReservationSummary[];
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}


export type BlacklistSeverity = "LOW" | "MEDIUM" | "HIGH";

export interface BlacklistGuestDto {
  reason: string;
  severity: BlacklistSeverity;
  documentNumber?: string;
}

export interface CheckBlacklistParams {
  documentNumber?: string;
  phone?: string;
  email?: string;
}

export interface BlacklistMatch {
  guestId: string;
  guestName: string;
  documentNumber: string | null;
  reason: string;
  severity: BlacklistSeverity;
  blacklistedAt: string | null;
}

export interface CheckBlacklistResult {
  matched: boolean;
  matches: BlacklistMatch[];
}

export interface CreateGuestDto {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  alternatePhone?: string;
  nationality?: string;
  gender?: string;
  dateOfBirth?: string;
  documentType: DocumentType;
  documentNumber: string;
  address?: string;
  city?: string;
  country?: string;
  internalNotes?: string;
  vipLevel?: number;
  allowDuplicate?: boolean;
}

export interface UpdateGuestDto extends Partial<CreateGuestDto> {}

export interface ListGuestsParams {
  search?: string;
  page?: number;
  limit?: number;
  blacklisted?: boolean;
}

export const guestsService = {
  getGuests: async (params: ListGuestsParams): Promise<{ data: GuestSummary[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/guests", { params });
    return res.data;
  },

  getGuest: async (id: string): Promise<GuestDetail> => {
    const res = await api.get(`/api/guests/${id}`);
    return res.data.data;
  },

  createGuest: async (dto: CreateGuestDto): Promise<GuestDetail> => {
    const res = await api.post("/api/guests", dto);
    return res.data.data;
  },

  updateGuest: async (id: string, dto: UpdateGuestDto): Promise<GuestDetail> => {
    const res = await api.patch(`/api/guests/${id}`, dto);
    return res.data.data;
  },

  checkBlacklist: async (params: CheckBlacklistParams): Promise<CheckBlacklistResult> => {
    const res = await api.post("/api/guests/check-blacklist", params);
    return res.data.data;
  },

  blacklistGuest: async (id: string, dto: BlacklistGuestDto): Promise<GuestDetail> => {
    const res = await api.post(`/api/guests/${id}/blacklist`, dto);
    return res.data.data;
  },

  removeFromBlacklist: async (id: string): Promise<GuestDetail> => {
    const res = await api.delete(`/api/guests/${id}/blacklist`);
    return res.data.data;
  },
};
