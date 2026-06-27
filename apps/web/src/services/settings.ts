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
  ownerWhatsappNumber?: string | null;
  themeKey?: ThemeKey;
  onboardingStep?: number;
}

export interface TestBriefingResult {
  success:   boolean;
  stubMode:  boolean;
  messageId: string;
  sentTo:    string;
}

export interface RolePermission {
  key:     string;
  module:  string;
  action:  string;
  enabled: boolean;
}

export interface RolePermissions {
  roleId:      string;
  roleName:    string;
  permissions: RolePermission[];
}

export const settingsService = {
  getSettings: async (): Promise<HotelSettings> => {
    const res = await api.get("/api/settings");
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
};
