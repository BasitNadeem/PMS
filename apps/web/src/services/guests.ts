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
  tags: string[];
  createdAt: string;
}

/** Recognition tiers earned from completed stays. Level 0 is an ordinary guest. */
export const VIP_LEVEL_LABEL: Record<number, string> = {
  1: "Silver",
  2: "Gold",
  3: "Platinum",
};

export function vipLabel(level: number): string | null {
  return VIP_LEVEL_LABEL[level] ?? null;
}

export interface ReservationSummary {
  id: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
  status: string;
  rooms: Array<{
    room: { number: string };
    roomType?: { name: string } | null;
  }>;
}

/** Derived on each request from reservations and payments — never stored. */
export interface GuestStats {
  totalNights: number;
  avgNightsPerStay: number;
  /** Minor units (paisa), same convention as totalSpend. */
  avgSpendPerStay: number;
  cancelledCount: number;
  noShowCount: number;
  upcomingCount: number;
  favouriteRoomType: string | null;
  lastStayAt: string | null;
  daysSinceLastStay: number | null;
}

export interface GuestTag {
  tag: string;
  count: number;
}

export type SpecialDateKind = "BIRTHDAY" | "ANNIVERSARY" | "CUSTOM";

export interface GuestSpecialDate {
  id?: string;
  kind: SpecialDateKind;
  label?: string | null;
  month: number;
  day: number;
  /** Null when the guest shared the day and month but not the year. */
  year?: number | null;
  source?: string | null;
}

export type PromoIssueReason = "BIRTHDAY" | "ANNIVERSARY" | "VIP_REWARD" | "WIN_BACK" | "MANUAL";

export interface GuestPromoCode {
  id: string;
  code: string;
  label: string | null;
  issueReason: PromoIssueReason | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  maxUses: number | null;
  usedCount: number;
  lastUsedAt: string | null;
  discountPercent: number | null;
  emailStatus: "NOT_REQUESTED" | "QUEUED" | "SENT" | "FAILED";
  emailSentAt: string | null;
  emailError: string | null;
  ratePlan: { name: string } | null;
}

export interface IssuePromoCodeDto {
  discountPercent: number;
  reason?: PromoIssueReason;
  validForDays?: number;
  label?: string;
  sendEmail?: boolean;
  overrideMarketingConsent?: boolean;
}

export interface UpcomingOccasion {
  id: string;
  kind: SpecialDateKind;
  label: string | null;
  date: string;
  month: number;
  day: number;
  inDays: number;
  occurrence: number | null;
  observedOnLeapFallback: boolean;
  guest: {
    id: string;
    fullName: string;
    email: string | null;
    phone: string | null;
    vipLevel: number;
    marketingOptIn: boolean;
    totalStays: number;
  };
}

export interface OccasionsMeta {
  withinDays: number;
  guestsTotal: number;
  guestsWithDates: number;
  /** Share of guests with any date on file — read the counts against this. */
  coveragePercent: number;
}

export const SPECIAL_DATE_LABEL: Record<SpecialDateKind, string> = {
  BIRTHDAY:    "Birthday",
  ANNIVERSARY: "Anniversary",
  CUSTOM:      "Occasion",
};

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
  reservationCount: number;
  blacklistSeverity: BlacklistSeverity | null;
  stats: GuestStats;
  specialDates: GuestSpecialDate[];
  marketingOptIn: boolean;
  marketingOptInAt: string | null;
  /** Set once the guest was asked for dates and declined — stop re-asking. */
  specialDatesDeclinedAt: string | null;
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
  documentExpiry?: string;
  address?: string;
  city?: string;
  country?: string;
  language?: string;
  internalNotes?: string;
  vipLevel?: number;
  tags?: string[];
  marketingOptIn?: boolean;
  specialDatesDeclined?: boolean;
  specialDates?: GuestSpecialDate[];
  allowDuplicate?: boolean;
}

export interface UpdateGuestDto extends Partial<CreateGuestDto> {}

export interface ListGuestsParams {
  search?: string;
  page?: number;
  limit?: number;
  blacklisted?: boolean;
  /** Matches guests carrying any of these tags. Sent comma-separated. */
  tags?: string[];
  minVipLevel?: number;
}

export const guestsService = {
  getGuests: async (params: ListGuestsParams): Promise<{ data: GuestSummary[]; meta: PaginationMeta }> => {
    const { tags, ...rest } = params;
    const res = await api.get("/api/guests", {
      params: { ...rest, ...(tags?.length ? { tags: tags.join(",") } : {}) },
    });
    return res.data;
  },

  getTags: async (): Promise<GuestTag[]> => {
    const res = await api.get("/api/guests/tags");
    return res.data.data;
  },

  getUpcomingOccasions: async (withinDays = 7): Promise<{ data: UpcomingOccasion[]; meta: OccasionsMeta }> => {
    const res = await api.get("/api/guests/occasions", { params: { withinDays } });
    return res.data;
  },

  getPromoCodes: async (guestId: string): Promise<GuestPromoCode[]> => {
    const res = await api.get(`/api/guests/${guestId}/promo-codes`);
    return res.data.data;
  },

  issuePromoCode: async (guestId: string, dto: IssuePromoCodeDto): Promise<GuestPromoCode> => {
    const res = await api.post(`/api/guests/${guestId}/promo-codes`, dto);
    return res.data.data;
  },

  retryPromoEmail: async (guestId: string, codeId: string): Promise<GuestPromoCode> => {
    const res = await api.post(`/api/guests/${guestId}/promo-codes/${codeId}/retry-email`);
    return res.data.data;
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
