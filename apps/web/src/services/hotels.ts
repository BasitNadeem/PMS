import { api } from "@/lib/api";

export interface HotelMe {
  id: string;
  name: string;
  slug: string;
  propertyType: string;
  city: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  isActive: boolean;
  isTrialAccount: boolean;
  trialEndsAt: string | null;
  settings: Record<string, unknown>;
}

export const hotelsService = {
  getMe: async (): Promise<HotelMe> => {
    const res = await api.get("/api/hotels/me");
    return res.data.data;
  },
};
