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
  region: string | null;
  zipCode: string | null;
  latitude: string | null;
  longitude: string | null;
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
  region?: string;
  zipCode?: string;
  latitude?: number | null;
  longitude?: number | null;
  starRating?: number | null;
  description?: string;
  timezone?: string;
  checkInTime?: string;
  checkOutTime?: string;
  shiftMorningStart?: string;
  shiftEveningStart?: string;
  shiftNightStart?: string;
  requireIndependentShiftSignoff?: boolean;
  shiftHandoverRemindersEnabled?: boolean;
  nightAuditRemindersEnabled?: boolean;
  shiftReminderLeadMinutes?: 15 | 30 | 60;
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
  birthdayOffersEnabled?: boolean;
  anniversaryOffersEnabled?: boolean;
  occasionOfferDiscountPercent?: number;
  occasionOfferLeadDays?: number;
  occasionOfferValidityDays?: number;
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
  trialExpired:   boolean;
  limits: Record<"maxRooms" | "maxUsers" | "maxActiveRatePlans" | "maxActivePromoCodes", number | null>;
  usage: Record<"maxRooms" | "maxUsers" | "maxActiveRatePlans" | "maxActivePromoCodes", number>;
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

// ── Channel Manager ──────────────────────────────────────────────────────────

export interface ChannexRatePlanPair {
  id: string;
  roomTypeId: string;
  roomTypeName: string | null;
  synced: boolean;
}

export interface ChannexRatePlanStatus {
  id: string;
  name: string;
  type: string;
  synced: boolean;
  partiallySynced: boolean;
  eligible: boolean;
  exclusionReason: string | null;
  exclusionLabel: string | null;
  pairs: ChannexRatePlanPair[];
}

export interface ChannexIngestionAlert {
  id: string;
  kind: "OVERBOOKING" | "GENERIC";
  sourceKey: string;
  eventType: string;
  origin: string;
  message: string;
  attempts: number;
  receivedAt: string;
}

export interface ChannelManagerStatus {
  provisioned: boolean;
  propertyId: string | null;
  isActive: boolean;
  syncInventory: boolean;
  syncRates: boolean;
  lastSyncAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  validation: { valid: boolean; missing: string[] };
  fieldLocations: Record<string, string>;
  ingestionAlerts: {
    overbookings: ChannexIngestionAlert[];
    failures: ChannexIngestionAlert[];
    overbookingCount: number;
    failureCount: number;
  };
  roomTypes: { id: string; name: string; synced: boolean }[];
  ratePlans: ChannexRatePlanStatus[];
  summary: {
    roomTypesSynced: number;
    roomTypesTotal: number;
    ratePlansSynced: number;
    ratePlansEligible: number;
    ratePlansExcluded: number;
    ratePlanPairsSynced: number;
    ratePlanPairsTotal: number;
  };
}

export interface ProvisionOutcome {
  id: string;
  ratePlanId?: string;
  name: string;
  status: "CREATED" | "UPDATED" | "SKIPPED" | "FAILED";
  channexId?: string;
  reason?: string;
  error?: string;
}

export interface ProvisionResult {
  success: boolean;
  error?: string;
  missingFields?: string[];
  propertyId?: string;
  propertyStatus?: string;
  roomTypes: ProvisionOutcome[];
  ratePlans: ProvisionOutcome[];
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
  runOccasionSweep: async (): Promise<void> => {
    await api.post("/api/settings/run-occasion-sweep");
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

  // ── Channel Manager ────────────────────────────────────────────────────────
  getChannelManager: async (): Promise<ChannelManagerStatus> => {
    const res = await api.get("/api/settings/channel-manager");
    return res.data.data;
  },
  provisionChannelManager: async (ratePlanIds?: string[]): Promise<ProvisionResult> => {
    // 422 carries the missing-field list, so it is a real result, not an error.
    const res = await api.post(
      "/api/settings/channel-manager/provision",
      { ratePlanIds },
      { validateStatus: (status) => status === 200 || status === 422 },
    );
    return res.data.data;
  },
  updateChannelManager: async (
    dto: { isActive?: boolean; syncInventory?: boolean; syncRates?: boolean },
  ): Promise<{ isActive: boolean; syncInventory: boolean; syncRates: boolean }> => {
    const res = await api.patch("/api/settings/channel-manager", dto);
    return res.data.data;
  },
  syncChannelManagerNow: async (): Promise<void> => {
    await api.post("/api/settings/channel-manager/sync");
  },
  acknowledgeChannelAlert: async (alertId: string): Promise<void> => {
    await api.post(`/api/settings/channel-manager/alerts/${alertId}/acknowledge`);
  },
};
