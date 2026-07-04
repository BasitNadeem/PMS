import { api } from "../lib/api";

export interface InventoryItem {
  id:           string;
  hotelId:      string;
  name:         string;
  sku:          string | null;
  category:     string;
  unit:         string;
  currentStock: number;
  parLevel:     number;
  reorderLevel: number;
  costPerUnit:  number; // paisas
  supplier:     string | null;
  isActive:     boolean;
  createdAt:    string;
  updatedAt:    string;
}

export interface InventoryTransaction {
  id:              string;
  type:            "PURCHASE" | "CONSUMPTION" | "WASTE" | "ADJUSTMENT" | "TRANSFER" | "OPENING_STOCK";
  quantity:        number;
  unitCost:        number | null;
  totalCost:       number | null;
  referenceId:     string | null;
  referenceType:   string | null;
  notes:           string | null;
  performedBy:     string | null;
  performedByName: string | null;
  createdAt:       string;
}

export interface InventoryItemDetail extends InventoryItem {
  transactions: InventoryTransaction[];
}

export interface InventoryCategoryCount {
  category: string;
  count:    number;
}

export interface InventorySummary {
  totalItems:          number;
  lowStockCount:       number;
  outOfStockCount:     number;
  categories:          InventoryCategoryCount[];
  totalInventoryValue: number; // paisas
}

export interface PaginationMeta {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface InventoryListParams {
  category?:    string;
  search?:      string;
  lowStockOnly?: boolean;
  page?:        number;
  limit?:       number;
}

export interface CreateInventoryItemDto {
  name:         string;
  category:     string;
  unit:         string;
  parLevel?:    number;
  reorderLevel?: number;
  costPerUnit?: number;
  supplier?:    string;
  openingStock?: number;
  sku?:         string;
}

export interface UpdateInventoryItemDto {
  name?:        string;
  category?:    string;
  unit?:        string;
  parLevel?:    number;
  reorderLevel?: number;
  costPerUnit?: number;
  supplier?:    string;
  sku?:         string;
}

export interface CreateTransactionDto {
  type:          "PURCHASE" | "CONSUMPTION" | "WASTE" | "ADJUSTMENT";
  quantity:      number;
  unitCost?:     number;
  notes?:        string;
  referenceId?:  string;
  referenceType?: string;
}

export const inventoryService = {
  getItems: async (
    params?: InventoryListParams,
  ): Promise<{ data: InventoryItem[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/inventory", { params });
    return res.data;
  },

  getItem: async (id: string): Promise<InventoryItemDetail> => {
    const res = await api.get(`/api/inventory/${id}`);
    return res.data.data;
  },

  getSummary: async (): Promise<InventorySummary> => {
    const res = await api.get("/api/inventory/summary");
    return res.data.data;
  },

  getLowStock: async (): Promise<InventoryItem[]> => {
    const res = await api.get("/api/inventory/low-stock");
    return res.data.data;
  },

  createItem: async (data: CreateInventoryItemDto): Promise<InventoryItem> => {
    const res = await api.post("/api/inventory", data);
    return res.data.data;
  },

  updateItem: async (id: string, data: UpdateInventoryItemDto): Promise<InventoryItem> => {
    const res = await api.patch(`/api/inventory/${id}`, data);
    return res.data.data;
  },

  deactivateItem: async (id: string): Promise<void> => {
    await api.delete(`/api/inventory/${id}`);
  },

  recordTransaction: async (itemId: string, data: CreateTransactionDto): Promise<InventoryItem> => {
    const res = await api.post(`/api/inventory/${itemId}/transactions`, data);
    return res.data.data;
  },

  scan: async (imageBase64: string, mimeType: string): Promise<ScanResult> => {
    const res = await api.post("/api/inventory/scan", { imageBase64, mimeType });
    return res.data.data;
  },

  createScanSession: async (): Promise<{ token: string }> => {
    const res = await api.post("/api/inventory/scan-sessions");
    return res.data.data;
  },
};

export interface ScanMatch {
  item: {
    id:           string;
    name:         string;
    category:     string;
    unit:         string;
    currentStock: number;
    sku:          string | null;
  };
  matchedText:  string;
  confidence:   number;
  suggestedQty: number | null;
}

export interface ScanResult {
  imageUrl:      string;
  detectedTexts: string[];
  matches:       ScanMatch[];
}
