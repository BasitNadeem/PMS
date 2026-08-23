import { api } from "@/lib/api";

export interface ChangePasswordResult {
  success: boolean;
  message: string;
}

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
    permissions: string[];
    isFirstLogin: boolean;
  };
  hotel: {
    id: string;
    name: string;
    slug: string;
    onboardingCompleted: boolean;
  };
}

export interface LinkedProperty {
  id: string;
  name: string;
  slug: string;
  propertyType: string;
  city: string | null;
  logoUrl: string | null;
  onboardingCompleted: boolean;
  role: "OWNER" | "MANAGER";
  isCurrent: boolean;
  isHome: boolean;
  canSwitch: boolean;
  canViewPortfolio: boolean;
}

export interface PortfolioSummary {
  name: string;
  date: string;
  financialsVisible: boolean;
  propertyCount: number;
  occupancyPercent: number;
  totals: {
    physicalRooms: number;
    sellableRooms: number;
    occupiedRooms: number;
    dirtyRooms: number;
    arrivals: number;
    departures: number;
    collected: number;
    openMaintenance: number;
  };
  properties: Array<{
    id: string;
    name: string;
    slug: string;
    propertyType: string;
    city: string | null;
    role: "OWNER" | "MANAGER";
    isCurrent: boolean;
    canSwitch: boolean;
    rooms: { physical: number; sellable: number; occupied: number; dirty: number };
    occupancyPercent: number;
    arrivals: number;
    departures: number;
    collected: number;
    openMaintenance: number;
  }>;
}

export function persistAuthSession(session: AuthSession): void {
  localStorage.setItem("accessToken", session.accessToken);
  localStorage.setItem("refreshToken", session.refreshToken);
  localStorage.setItem("userName", session.user.name);
  localStorage.setItem("userRole", session.user.role);
  localStorage.setItem("isFirstLogin", String(session.user.isFirstLogin));
  localStorage.setItem("onboardingCompleted", String(session.hotel.onboardingCompleted));
  localStorage.removeItem("pms-query-cache");
}

export const authService = {
  completeOnboarding: async (): Promise<void> => {
    await api.post("/api/auth/complete-onboarding");
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<ChangePasswordResult> => {
    const res = await api.post<ChangePasswordResult>("/api/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return res.data;
  },
  getProperties: async (): Promise<LinkedProperty[]> => {
    const res = await api.get<{ data: LinkedProperty[] }>("/api/auth/properties");
    return res.data.data;
  },
  getPortfolio: async (): Promise<PortfolioSummary> => {
    const res = await api.get<{ data: PortfolioSummary }>("/api/auth/portfolio");
    return res.data.data;
  },
  switchProperty: async (hotelId: string): Promise<AuthSession> => {
    const res = await api.post<AuthSession>("/api/auth/switch-property", { hotelId });
    return res.data;
  },
  switchAccount: async (email: string, password: string, hotelSlug?: string): Promise<AuthSession> => {
    const res = await api.post<AuthSession>("/api/auth/login", { email, password, ...(hotelSlug ? { hotelSlug } : {}) });
    return res.data;
  },
};
