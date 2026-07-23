import { api } from "@/lib/api";

export type ThemeKey = "WARM_CLAY" | "PINE_TEAL" | "AZURE_SLATE" | "INDIGO_NIGHT";

export interface HotelSettings {
  id: string;
  name: string;
  slug: string;
  propertyType: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string;
  isActive: boolean;
  description: string | null;
  amenities: string[];
  cancellationPolicy: string | null;
  bookingPaymentTerms: string | null;
  settings: Record<string, unknown>;
}

export interface UpdateSettingsDto {
  name?: string;
  propertyType?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  starRating?: number | null;
  description?: string;
  timezone?: string;
  checkInTime?: string;
  checkOutTime?: string;
  lateCheckoutFee?: number;
  earlyCheckinFee?: number;
  defaultSource?: string;
  autoConfirm?: boolean;
  maxAdvanceDays?: number;
  gstEnabled?: boolean;
  gstRate?: number;
  pstEnabled?: boolean;
  pstRate?: number;
  taxInclusive?: boolean;
  fbrEnabled?: boolean;
  invoicePrefix?: string;
  posTaxRate?: number;
  ownerWhatsappNumber?: string | null;
  themeKey?: ThemeKey;
  logoUrl?: string | null;
  onboardingStep?: number;
  amenities?: string[];
  cancellationPolicy?: string | null;
  bookingPaymentTerms?: string | null;
}

export interface TestBriefingResult {
  success:   boolean;
  stubMode:  boolean;
  messageId: string;
  sentTo:    string;
}

export interface RolePermission {
  key:         string;
  module:      string;
  action:      string;
  displayName: string;
  enabled:     boolean;
}

export interface RolePermissions {
  roleId:      string;
  roleName:    string;
  permissions: RolePermission[];
}

export interface PlanInfo {
  planName:       string;
  planSlug:       string | null;
  priceMonthly:   number;
  isTrialAccount: boolean;
  trialEndsAt:    string | null;
  maxRooms:       number;
  maxUsers:       number;
  currentRooms:   number;
  currentUsers:   number;
  features:       Record<string, boolean>;
}

export interface ExportAllData {
  hotelName: string;
  exportedAt: string;
  guests: Array<{
    fullName: string;
    phone: string | null;
    email: string | null;
    documentNumber: string | null;
    nationality: string | null;
    totalStays: number;
    isBlacklisted: boolean;
    createdAt: string;
  }>;
  reservations: Array<{
    confirmationNumber: string;
    status: string;
    checkInDate: string;
    checkOutDate: string;
    adults: number;
    children: number;
    source: string;
    createdAt: string;
    guest: { fullName: string; phone: string | null };
    rooms: Array<{
      ratePerNight: number;
      room: { number: string };
      roomType: { name: string };
    }>;
  }>;
  rooms: Array<{
    number: string;
    floor: number | null;
    status: string;
    isActive: boolean;
    roomType: { name: string; defaultRate: number };
  }>;
  expenses: Array<{
    date: string;
    category: string;
    description: string;
    amount: number;
    payment_method: string | null;
    paid_to: string | null;
    receipt_ref: string | null;
    notes: string | null;
  }>;
  ledger: Array<{
    entry_type: string;
    amount: number;
    account_name: string | null;
    source_type: string | null;
    description: string | null;
    payment_method: string | null;
    created_at: string;
  }>;
}

export const settingsService = {
  getSettings: async (): Promise<HotelSettings> => {
    const res = await api.get("/api/settings");
    return res.data.data;
  },
  getPlan: async (): Promise<PlanInfo> => {
    const res = await api.get("/api/settings/plan");
    return res.data.data;
  },
  updateSettings: async (dto: UpdateSettingsDto): Promise<HotelSettings> => {
    const res = await api.patch("/api/settings", dto);
    return res.data.data;
  },
  scheduleBriefing: async (): Promise<void> => {
    await api.post("/api/settings/schedule-briefing");
  },
  testBriefing: async (): Promise<TestBriefingResult> => {
    const res = await api.post("/api/settings/test-briefing");
    return res.data.data;
  },
  getPermissions: async (): Promise<RolePermissions[]> => {
    const res = await api.get("/api/settings/permissions");
    return res.data.data;
  },
  updateRolePermission: async (roleId: string, permissions: { key: string; enabled: boolean }[]): Promise<void> => {
    await api.patch(`/api/settings/permissions/${roleId}`, { permissions });
  },
  exportData: async (): Promise<ExportAllData> => {
    const res = await api.get("/api/settings/export");
    return res.data.data;
  },
  deactivateHotel: async (): Promise<void> => {
    await api.post("/api/settings/deactivate");
  },
};
