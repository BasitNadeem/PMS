import { api } from "@/lib/api";

export const ACCOUNT_TYPES = [
  "CASH_DRAWER", "BANK_ACCOUNT", "JAZZCASH", "EASYPAISA", "PETTY_CASH", "OTHER",
] as const;
export type AccountType = typeof ACCOUNT_TYPES[number];

export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  CASH_DRAWER:  "Cash Drawer",
  BANK_ACCOUNT: "Bank Account",
  JAZZCASH:     "JazzCash",
  EASYPAISA:    "Easypaisa",
  PETTY_CASH:   "Petty Cash",
  OTHER:        "Other",
};

export const ENTRY_TYPES  = ["INCOMING", "OUTGOING"] as const;
export const SOURCE_TYPES = [
  "FOLIO_PAYMENT", "EXPENSE", "BANK_DEPOSIT", "CASH_WITHDRAWAL",
  "OPENING_BALANCE", "ADJUSTMENT", "OTHER",
] as const;
export type EntryType  = typeof ENTRY_TYPES[number];
export type SourceType = typeof SOURCE_TYPES[number];

export const SOURCE_LABELS: Record<SourceType, string> = {
  FOLIO_PAYMENT:   "Folio",
  EXPENSE:         "Expense",
  BANK_DEPOSIT:    "Deposit",
  CASH_WITHDRAWAL: "Withdrawal",
  OPENING_BALANCE: "Opening",
  ADJUSTMENT:      "Adjustment",
  OTHER:           "Manual",
};

export interface LedgerEntry {
  id:             string;
  hotel_id:       string;
  account_id:     string;
  entry_type:     EntryType;
  amount:         number;
  balance_after:  number;
  source_type:    SourceType;
  source_id:      string | null;
  description:    string;
  payment_method: string | null;
  entry_date:     string;
  notes:          string | null;
  recorded_by_id: string;
  created_at:     string;
  updated_at:     string;
  account_name:   string;
  account_type:   AccountType;
  recorder_name:  string | null;
}

export interface LedgerSummary {
  totalIncoming: number;
  totalOutgoing: number;
  netFlow:       number;
}

export interface AccountBalance {
  id:          string;
  name:        string;
  accountType: string;
  balance:     number;
  totalIn:     number;
  totalOut:    number;
}

export interface PaginationMeta {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export interface LedgerResponse {
  data: LedgerEntry[];
  meta: PaginationMeta;
}

export interface CreateEntryDto {
  entryType:       EntryType;
  amount:          number;
  description:     string;
  paymentMethod?:  string;
  notes?:          string;
  entryDate?:      string;
}

export const cashbookService = {
  getBalances: async (params: { asOf?: string }): Promise<AccountBalance[]> => {
    const res = await api.get("/api/cashbook/balances", { params });
    return res.data.data;
  },

  getSummary: async (params: { startDate?: string; endDate?: string }): Promise<LedgerSummary> => {
    const res = await api.get("/api/cashbook/summary", { params });
    return res.data.data;
  },

  getLedger: async (params: {
    startDate?:  string;
    endDate?:    string;
    entryType?:  EntryType;
    page?:       number;
    limit?:      number;
  }): Promise<LedgerResponse> => {
    const res = await api.get("/api/cashbook/ledger", { params });
    return res.data;
  },

  createEntry: async (dto: CreateEntryDto): Promise<LedgerEntry> => {
    const res = await api.post("/api/cashbook/entries", dto);
    return res.data.data;
  },
};
