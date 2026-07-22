import { api } from "../lib/api";
import type { PaginationMeta } from "./rooms";

export type FolioItemType =
  | "ROOM_CHARGE"
  | "FOOD_BEVERAGE"
  | "LAUNDRY"
  | "TRANSPORT"
  | "SPA"
  | "ACTIVITY"
  | "MINIBAR"
  | "TELEPHONE"
  | "INTERNET"
  | "TAX"
  | "DISCOUNT"
  | "ADJUSTMENT"
  | "DAMAGE_CHARGE"
  | "MISCELLANEOUS";

export type PaymentMethod =
  | "CASH"
  | "JAZZCASH"
  | "EASYPAISA"
  | "BANK_TRANSFER"
  | "CREDIT_CARD"
  | "DEBIT_CARD"
  | "CHEQUE"
  | "ADVANCE_DEPOSIT"
  | "OTA_COLLECT"
  | "COMPLIMENTARY";

export interface FolioLineItem {
  id: string;
  type: FolioItemType;
  description: string;
  quantity: number;
  unitAmount: number;
  amount: number;
  chargeDate: string;
  isVoided: boolean;
  notes: string | null;
}

export interface FolioPayment {
  id: string;
  method: PaymentMethod;
  status: string;
  amount: number;
  transactionRef: string | null;
  notes: string | null;
  postedAt: string;
}

export interface FolioDetail {
  id: string;
  folioNumber: string;
  chargesTotal: number;
  discountsTotal: number;
  taxTotal: number;
  paymentsTotal: number;
  balanceDue: number;
  isOpen: boolean;
  closedAt: string | null;
  items: FolioLineItem[];
  payments: FolioPayment[];
  reservation: {
    id: string;
    confirmationNumber: string;
    checkInDate: string;
    checkOutDate: string;
    status: string;
    groupId: string | null;
    guest: { fullName: string };
    rooms: Array<{ room: { number: string }; roomType: { name: string } }>;
  };
}

export interface BillingFolio {
  id: string;
  folioNumber: string;
  chargesTotal: number;
  taxTotal: number;
  discountsTotal: number;
  paymentsTotal: number;
  balanceDue: number;
  isOpen: boolean;
  reservation: {
    id: string;
    confirmationNumber: string;
    checkInDate: string;
    checkOutDate: string;
    status: string;
    groupId: string | null;
    guest: { id: string; fullName: string };
    rooms: Array<{ room: { number: string } }>;
  };
}

export interface BillingSummary {
  billedToday: number;
  collectedToday: number;
  outstandingBalance: number;
  checkedOutUnpaid: number;
}

export interface AddFolioItemDto {
  description: string;
  type: FolioItemType;
  unitAmount: number;
  quantity: number;
  notes?: string;
}

export interface AddPaymentDto {
  amount: number;
  method: PaymentMethod;
  transactionRef?: string;
  notes?: string;
}

export const folioService = {
  getFolio: async (reservationId: string): Promise<FolioDetail> => {
    const res = await api.get(`/api/reservations/${reservationId}/folio`);
    return res.data.data;
  },

  addFolioItem: async (reservationId: string, dto: AddFolioItemDto): Promise<FolioLineItem> => {
    const res = await api.post(`/api/reservations/${reservationId}/folio/items`, dto);
    return res.data.data;
  },

  deleteFolioItem: async (reservationId: string, itemId: string): Promise<void> => {
    await api.delete(`/api/reservations/${reservationId}/folio/items/${itemId}`);
  },

  addPayment: async (reservationId: string, dto: AddPaymentDto): Promise<FolioPayment> => {
    const res = await api.post(`/api/reservations/${reservationId}/folio/payments`, dto);
    return res.data.data;
  },

  listFolios: async (params: {
    page?: number;
    limit?: number;
    statusFilter?: "open" | "settled" | "all";
    sortBy?: "checkOut" | "balance" | "guestName";
    sortDir?: "asc" | "desc";
  }): Promise<{ data: BillingFolio[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/billing/folios", { params });
    return res.data;
  },

  getSummary: async (): Promise<BillingSummary> => {
    const res = await api.get("/api/billing/summary");
    return res.data.data;
  },
};
