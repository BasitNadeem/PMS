import { api } from "../lib/api";
import type { PaginationMeta } from "./rooms";

export type OrderStatus = "OPEN" | "POSTED_TO_FOLIO" | "PAID" | "CANCELLED";

export interface PosItem {
  id: string;
  name: string;
  description: string | null;
  price: number;
  taxRate: number;
  isAvailable: boolean;
  categoryId: string;
  sortOrder: number;
  inventoryItemId:  string | null;
  inventoryQtyUsed: number | null;
  inventoryItemName: string | null;
  inventoryUnit: string | null;
  inventoryCurrentStock: number | null;
  inventoryIsActive: boolean | null;
  photoUrl: string | null;
  // QR guest-menu visibility — independent of isAvailable (POS terminal).
  isQrVisible: boolean;
  isFeatured: boolean;
}

export interface PosCategory {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
  items: PosItem[];
  // QR guest-menu visibility — independent of isActive (POS terminal).
  isQrVisible: boolean;
  availableFrom: string | null;
  availableUntil: string | null;
}

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface PosOrder {
  id: string;
  orderNumber: string;
  reservationId: string | null;
  roomNumber: string | null;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  notes: string | null;
  status: OrderStatus;
  paymentMethod: string | null;
  isPostedToFolio: boolean;
  createdAt: string;
  items: OrderItem[];
}

export interface CartItem {
  posItemId: string;
  name: string;
  price: number;
  quantity: number;
}

export interface CreateOrderDto {
  items: { posItemId: string; quantity: number }[];
  settlementType: "FOLIO" | "DIRECT";
  reservationId?: string;
  paymentMethod?: string;
  notes?: string;
}

export interface CreateCategoryDto {
  name: string;
  sortOrder?: number;
  isQrVisible?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
}

export interface UpdateCategoryDto {
  name?: string;
  sortOrder?: number;
  isActive?: boolean;
  isQrVisible?: boolean;
  availableFrom?: string | null;
  availableUntil?: string | null;
}

export interface CreateItemDto {
  name: string;
  description?: string;
  price: number;
  taxRate?: number;
  categoryId: string;
  isAvailable?: boolean;
  sortOrder?: number;
  inventoryItemId?: string | null;
  inventoryQtyUsed?: number | null;
  photoUrl?: string | null;
  isQrVisible?: boolean;
  isFeatured?: boolean;
}

export interface UpdateItemDto {
  name?: string;
  description?: string | null;
  price?: number;
  taxRate?: number;
  isAvailable?: boolean;
  sortOrder?: number;
  inventoryItemId?: string | null;
  inventoryQtyUsed?: number | null;
  photoUrl?: string | null;
  isQrVisible?: boolean;
  isFeatured?: boolean;
}

export const posService = {
  getCategories: async (): Promise<PosCategory[]> => {
    const res = await api.get("/api/pos/categories");
    return res.data.data;
  },

  getCategoriesAdmin: async (): Promise<PosCategory[]> => {
    const res = await api.get("/api/pos/categories/admin");
    return res.data.data;
  },

  createCategory: async (dto: CreateCategoryDto): Promise<PosCategory> => {
    const res = await api.post("/api/pos/categories", dto);
    return res.data.data;
  },

  updateCategory: async (id: string, dto: UpdateCategoryDto): Promise<PosCategory> => {
    const res = await api.patch(`/api/pos/categories/${id}`, dto);
    return res.data.data;
  },

  createItem: async (categoryId: string, dto: CreateItemDto): Promise<PosItem> => {
    const res = await api.post(`/api/pos/categories/${categoryId}/items`, dto);
    return res.data.data;
  },

  updateItem: async (id: string, dto: UpdateItemDto): Promise<PosItem> => {
    const res = await api.patch(`/api/pos/items/${id}`, dto);
    return res.data.data;
  },

  toggleItemAvailability: async (id: string): Promise<PosItem> => {
    const res = await api.patch(`/api/pos/items/${id}/toggle`);
    return res.data.data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/api/pos/categories/${id}`);
  },

  deleteItem: async (id: string): Promise<void> => {
    await api.delete(`/api/pos/items/${id}`);
  },

  getOrders: async (params?: {
    status?: OrderStatus;
    page?: number;
    limit?: number;
  }): Promise<{ data: PosOrder[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/pos/orders", { params });
    return res.data;
  },

  createOrder: async (dto: CreateOrderDto): Promise<PosOrder> => {
    const res = await api.post("/api/pos/orders", dto);
    return res.data.data;
  },

  updateOrderStatus: async (id: string): Promise<PosOrder> => {
    const res = await api.patch(`/api/pos/orders/${id}/status`, { status: "CANCELLED" });
    return res.data.data;
  },
};
