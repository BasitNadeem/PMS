import { api } from "@/lib/api";

export type RatePlanType =
  | "STANDARD"
  | "SEASONAL"
  | "PROMOTIONAL"
  | "CORPORATE"
  | "TRAVEL_AGENT"
  | "OTA_NET"
  | "COMPLEMENTARY";

export interface RatePlanItem {
  id: string;
  roomTypeId: string;
  rate: number; // paisas
  roomType: { id: string; name: string };
}

export interface RatePlanCode {
  id: string;
  code: string;
  label: string | null;
  validFrom: string | null;
  validTo: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface RatePlan {
  id: string;
  companyId: string | null;
  company: { id: string; name: string; type: string } | null;
  name: string;
  type: RatePlanType;
  description: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysOfWeek: number[];
  minLos: number;
  codeRequired: boolean;
  priority: number;
  isActive: boolean;
  createdAt: string;
  items: RatePlanItem[];
  codes: RatePlanCode[];
}

export interface CreateRatePlanDto {
  companyId?: string | null;
  name: string;
  type: RatePlanType;
  description?: string;
  validFrom?: string;
  validTo?: string;
  daysOfWeek: number[];
  minLos: number;
  codeRequired: boolean;
  priority: number;
  items: { roomTypeId: string; rate: number }[];
}

export type UpdateRatePlanDto = Partial<CreateRatePlanDto>;

export interface SuggestRateResult {
  suggestedRate: number;
  baseRate: number;
  discountPercent: number | null;
  matchedPlan: { id: string; name: string; type: string } | null;
  allMatchingPlans: { id: string; name: string; rate: number }[];
  noDedicatedRateHint?: string | null;
  rateSource?: "COMPANY_CONTRACT" | "COMPANY_DISCOUNT" | "ACCESS_CODE" | "RATE_PLAN" | "ROOM_DEFAULT";
  company?: { id: string; name: string } | null;
}

export const ratePlansService = {
  async list(params?: { isActive?: boolean; companyId?: string; page?: number; limit?: number }) {
    const res = await api.get("/api/rate-plans", { params });
    return res.data as { data: RatePlan[]; meta: { total: number; page: number; limit: number; totalPages: number } };
  },

  async get(id: string): Promise<RatePlan> {
    const res = await api.get(`/api/rate-plans/${id}`);
    return res.data.data as RatePlan;
  },

  async create(dto: CreateRatePlanDto): Promise<RatePlan> {
    const res = await api.post("/api/rate-plans", dto);
    return res.data.data as RatePlan;
  },

  async update(id: string, dto: UpdateRatePlanDto): Promise<RatePlan> {
    const res = await api.patch(`/api/rate-plans/${id}`, dto);
    return res.data.data as RatePlan;
  },

  async activate(id: string): Promise<void> {
    await api.patch(`/api/rate-plans/${id}/activate`);
  },

  async deactivate(id: string): Promise<void> {
    await api.delete(`/api/rate-plans/${id}`);
  },

  async createCode(ratePlanId: string, dto: { code: string; label?: string; validFrom?: string; validTo?: string }): Promise<RatePlanCode> {
    const res = await api.post(`/api/rate-plans/${ratePlanId}/codes`, dto);
    return res.data.data as RatePlanCode;
  },

  async updateCode(ratePlanId: string, codeId: string, dto: Partial<{ code: string; label: string | null; validFrom: string | null; validTo: string | null; isActive: boolean }>): Promise<RatePlanCode> {
    const res = await api.patch(`/api/rate-plans/${ratePlanId}/codes/${codeId}`, dto);
    return res.data.data as RatePlanCode;
  },

  async deactivateCode(ratePlanId: string, codeId: string): Promise<void> {
    await api.delete(`/api/rate-plans/${ratePlanId}/codes/${codeId}`);
  },

  async suggest(params: { roomTypeId: string; checkIn: string; checkOut: string; bookingContext?: "SINGLE" | "TOUR_AGENCY" | "CORPORATE" | "OTHER"; companyId?: string }): Promise<SuggestRateResult> {
    const res = await api.get("/api/rate-plans/suggest", { params });
    return res.data.data as SuggestRateResult;
  },
};
