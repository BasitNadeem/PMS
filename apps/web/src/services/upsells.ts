import { api } from "../lib/api";
import type { PaginationMeta } from "./rooms";

export type UpsellPriceType = "FLAT" | "PER_NIGHT" | "PER_GUEST";

export type UpsellCategory =
  | "FOOD_BEVERAGE"
  | "LAUNDRY"
  | "TRANSPORT"
  | "SPA"
  | "ACTIVITY"
  | "MINIBAR"
  | "INTERNET"
  | "MISCELLANEOUS";

export interface UpsellItem {
  id: string;
  hotelId: string;
  name: string;
  description: string | null;
  category: UpsellCategory;
  priceType: UpsellPriceType;
  amount: number;
  imageUrl: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUpsellItemDto {
  name: string;
  description?: string;
  category: UpsellCategory;
  priceType: UpsellPriceType;
  amount: number;
  imageUrl?: string;
}

export const upsellsService = {
  list: async (params?: { isActive?: boolean; page?: number; limit?: number }): Promise<{
    data: UpsellItem[];
    meta: PaginationMeta;
  }> => {
    const res = await api.get("/api/upsells", { params });
    return res.data;
  },

  create: async (dto: CreateUpsellItemDto): Promise<UpsellItem> => {
    const res = await api.post("/api/upsells", dto);
    return res.data.data;
  },

  update: async (
    id: string,
    dto: Partial<CreateUpsellItemDto & { isActive: boolean }>,
  ): Promise<UpsellItem> => {
    const res = await api.patch(`/api/upsells/${id}`, dto);
    return res.data.data;
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`/api/upsells/${id}`);
  },
};
