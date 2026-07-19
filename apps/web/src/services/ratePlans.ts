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

export interface RatePlan {
  id: string;
  name: string;
  type: RatePlanType;
  description: string | null;
  validFrom: string | null;
  validTo: string | null;
  daysOfWeek: number[];
  minLos: number;
  priority: number;
  isActive: boolean;
  createdAt: string;
  items: RatePlanItem[];
}

export interface CreateRatePlanDto {
  name: string;
  type: RatePlanType;
  description?: string;
  validFrom?: string;
  validTo?: string;
  daysOfWeek: number[];
  minLos: number;
  priority: number;
  items: { roomTypeId: string; rate: number }[];
}

export type UpdateRatePlanDto = Partial<CreateRatePlanDto>;

export interface SuggestRateResult {
  suggestedRate: number;
  matchedPlan: { id: string; name: string; type: string } | null;
  allMatchingPlans: { id: string; name: string; rate: number }[];
}

export const ratePlansService = {
  async list(params?: { isActive?: boolean; page?: number; limit?: number }) {
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

  async suggest(params: { roomTypeId: string; checkIn: string; checkOut: string }): Promise<SuggestRateResult> {
    const res = await api.get("/api/rate-plans/suggest", { params });
    return res.data.data as SuggestRateResult;
  },
};
