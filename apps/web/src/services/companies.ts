import { api } from "../lib/api";

export type CompanyType = "TOUR_AGENCY" | "CORPORATE" | "GOVERNMENT" | "NGO" | "OTHER";
export type CompanyPaymentTerms =
  | "IMMEDIATE" | "NET_7" | "NET_15" | "NET_30" | "NET_45" | "NET_60" | "NET_90";
export type CompanyLedgerEntryType = "CHARGE" | "PAYMENT" | "ADJUSTMENT" | "WRITE_OFF" | "CREDIT_REFUND";
export type CompanyInvoiceStatus = "DRAFT" | "ISSUED" | "PARTIALLY_PAID" | "PAID" | "VOID";

export const COMPANY_TYPE_LABEL: Record<CompanyType, string> = {
  TOUR_AGENCY: "Tour Agency",
  CORPORATE:   "Corporate",
  GOVERNMENT:  "Government",
  NGO:         "NGO",
  OTHER:       "Other",
};

export const PAYMENT_TERMS_LABEL: Record<CompanyPaymentTerms, string> = {
  IMMEDIATE: "Due immediately",
  NET_7:     "7 days",
  NET_15:    "15 days",
  NET_30:    "30 days",
  NET_45:    "45 days",
  NET_60:    "60 days",
  NET_90:    "90 days",
};

export interface Company {
  id: string;
  name: string;
  type: CompanyType;
  code: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  address: string | null;
  city: string | null;
  ntn: string | null;
  strn: string | null;
  /** Minor units (paisa), like every other amount in the app. */
  creditLimit: number;
  paymentTerms: CompanyPaymentTerms;
  balance: number;
  ratePlanId: string | null;
  discountPercent: number | null;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CompanySummary extends Company {
  overdueAmount: number;
  availableCredit: number;
}

export interface AgingSummary {
  current: number;
  d1_30: number;
  d31_60: number;
  d61_90: number;
  d90_plus: number;
  total: number;
  overdue: number;
  oldestOverdueDays: number | null;
}

export interface CompanyDetail extends Company {
  /** Money received beyond what was owed — the hotel owes this back. */
  unappliedCredit: number;
  ratePlan: { id: string; name: string } | null;
  aging: AgingSummary;
  availableCredit: number;
  stats: { totalReservations: number; lastActivityAt: string | null };
}

export interface CompanyPickerOption {
  id: string;
  name: string;
  type: CompanyType;
  creditLimit: number;
  balance: number;
  paymentTerms: CompanyPaymentTerms;
  ratePlanId: string | null;
  discountPercent: number | null;
}

export interface LedgerEntry {
  id: string;
  type: CompanyLedgerEntryType;
  amount: number;
  description: string;
  entryDate: string;
  dueDate: string | null;
  settledAmount: number;
  outstanding: number;
  folioId: string | null;
  reservationId: string | null;
  guestName: string | null;
  roomNumber: string | null;
  stayFrom: string | null;
  stayTo: string | null;
  paymentMethod: string | null;
  reference: string | null;
  invoiceId: string | null;
  createdAt: string;
  reversedAt: string | null;
  reversalReason: string | null;
}

export interface CompanyInvoice {
  id: string;
  invoiceNumber: string;
  status: CompanyInvoiceStatus;
  periodStart: string;
  periodEnd: string;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  issuedAt: string | null;
  dueDate: string | null;
  createdAt: string;
  /** Only returned by the detail endpoint — the list view selects without it. */
  notes?: string | null;
  _count?: { lines: number };
}

export interface CompanyReservation {
  id: string;
  confirmationNumber: string;
  status: string;
  checkInDate: string;
  checkOutDate: string;
  totalAmount: number;
  balanceDue: number;
  billToCompany: boolean;
  guest: { id: string; fullName: string };
  rooms: Array<{ room: { number: string } }>;
}

export interface AgingReportRow {
  company: {
    id: string; name: string; type: CompanyType;
    balance: number; creditLimit: number;
    paymentTerms: CompanyPaymentTerms; contactPhone: string | null;
  };
  availableCredit: number;
  aging: AgingSummary;
}

export interface ListCompaniesParams {
  search?: string;
  type?: CompanyType;
  isActive?: boolean;
  withBalance?: boolean;
  overdue?: boolean;
  sort?: "name" | "balance" | "createdAt";
  page?: number;
  limit?: number;
}

export interface CreateCompanyDto {
  name: string;
  type: CompanyType;
  code?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  address?: string;
  city?: string;
  ntn?: string;
  strn?: string;
  paymentTerms: CompanyPaymentTerms;
  ratePlanId?: string | null;
  discountPercent?: number | null;
  notes?: string;
}

export type UpdateCompanyDto = Partial<CreateCompanyDto> & { isActive?: boolean };

/** Rupees — the API converts to paisa. */
export interface RecordPaymentDto {
  amount: number;
  method?: string;
  reference?: string;
  paidAt?: string;
  notes?: string;
  idempotencyKey: string;
}

export interface AdjustLedgerDto {
  type: "ADJUSTMENT" | "WRITE_OFF";
  amount: number;
  description: string;
  entryDate?: string;
}

export const companiesService = {
  list: async (params: ListCompaniesParams = {}) => {
    const res = await api.get("/api/companies", { params });
    return res.data as { data: CompanySummary[]; meta: { total: number; page: number; limit: number; totalPages: number } };
  },

  picker: async (search?: string): Promise<CompanyPickerOption[]> => {
    const res = await api.get("/api/companies/picker", { params: search ? { search } : {} });
    return res.data.data;
  },

  aging: async (params: { asOf?: string; onlyOutstanding?: boolean } = {}) => {
    const res = await api.get("/api/companies/aging", { params });
    return res.data as { data: AgingReportRow[]; totals: AgingSummary; asOf?: string };
  },

  get: async (id: string): Promise<CompanyDetail> => {
    const res = await api.get(`/api/companies/${id}`);
    return res.data.data;
  },

  create: async (dto: CreateCompanyDto): Promise<Company> => {
    const res = await api.post("/api/companies", dto);
    return res.data.data;
  },

  update: async (id: string, dto: UpdateCompanyDto): Promise<Company> => {
    const res = await api.patch(`/api/companies/${id}`, dto);
    return res.data.data;
  },

  remove: async (id: string): Promise<{ id: string }> => {
    const res = await api.delete(`/api/companies/${id}`);
    return res.data.data;
  },

  /** Amount in rupees. Gated behind COMPANY_CREDIT_LIMIT on the server. */
  setCreditLimit: async (id: string, creditLimit: number, reason?: string) => {
    const res = await api.put(`/api/companies/${id}/credit-limit`, { creditLimit, reason });
    return res.data.data as CompanyDetail;
  },

  ledger: async (id: string, params: { status?: "all" | "open" | "settled"; from?: string; to?: string; page?: number; limit?: number } = {}) => {
    const res = await api.get(`/api/companies/${id}/ledger`, { params });
    return res.data as { data: LedgerEntry[]; meta: { total: number; page: number; limit: number; totalPages: number } };
  },

  statement: async (id: string) => {
    const res = await api.get(`/api/companies/${id}/statement`);
    return res.data.data as { company: Company; aging: AgingSummary; lines: Array<LedgerEntry & { runningBalance: number }> };
  },

  reservations: async (id: string): Promise<CompanyReservation[]> => {
    const res = await api.get(`/api/companies/${id}/reservations`);
    return res.data.data;
  },

  recordPayment: async (id: string, dto: RecordPaymentDto) => {
    const res = await api.post(`/api/companies/${id}/payments`, dto);
    return res.data.data as {
      payment: { id: string; amount: number; entryDate: string };
      settledCharges: number;
      unapplied: number;
      companyBalance: number;
    };
  },

  reversePayment: async (id: string, paymentId: string, reason: string) => {
    const res = await api.post(`/api/companies/${id}/payments/${paymentId}/reverse`, { reason });
    return res.data.data as { balance: number; unappliedCredit: number };
  },

  refundCredit: async (id: string, dto: {
    amount: number; method: string; reference?: string; reason: string;
    paidAt?: string; idempotencyKey: string;
  }) => {
    const res = await api.post(`/api/companies/${id}/credit-refunds`, dto);
    return res.data.data as { balance: number; unappliedCredit: number };
  },

  adjust: async (id: string, dto: AdjustLedgerDto) => {
    const res = await api.post(`/api/companies/${id}/adjustments`, dto);
    return res.data.data as { entry: LedgerEntry; companyBalance: number };
  },

  invoices: async (id: string): Promise<CompanyInvoice[]> => {
    const res = await api.get(`/api/companies/${id}/invoices`);
    return res.data.data;
  },

  createInvoice: async (id: string, dto: { periodStart: string; periodEnd: string; notes?: string; issue?: boolean }) => {
    const res = await api.post(`/api/companies/${id}/invoices`, dto);
    return res.data.data as CompanyInvoice & { lineCount: number };
  },

  getInvoice: async (id: string, invoiceId: string) => {
    const res = await api.get(`/api/companies/${id}/invoices/${invoiceId}`);
    return res.data.data as CompanyInvoice & { lines: LedgerEntry[]; company: Company };
  },

  issueInvoice: async (id: string, invoiceId: string) => {
    const res = await api.post(`/api/companies/${id}/invoices/${invoiceId}/issue`);
    return res.data.data as CompanyInvoice;
  },

  voidInvoice: async (id: string, invoiceId: string, reason: string) => {
    const res = await api.post(`/api/companies/${id}/invoices/${invoiceId}/void`, { reason });
    return res.data.data as CompanyInvoice;
  },

  emailInvoice: async (id: string, invoiceId: string) => {
    const res = await api.post(`/api/companies/${id}/invoices/${invoiceId}/email`);
    return res.data.data as { sent: true; recipient: string };
  },

  /** Move a reservation's unpaid folio balance onto a company's account. */
  transferFolio: async (reservationId: string, dto: { companyId: string; amount?: number; note?: string; idempotencyKey: string }) => {
    const res = await api.post(`/api/reservations/${reservationId}/folio/transfer-to-company`, dto);
    return res.data.data as { entry: { id: string; amount: number; dueDate: string | null }; companyBalance: number };
  },
};

/** Paisa → "Rs 12,345". Matches the convention used across the app. */
export function pkr(paisa: number): string {
  return new Intl.NumberFormat("en-PK", {
    style: "currency", currency: "PKR", maximumFractionDigits: 0,
  }).format(paisa / 100);
}
