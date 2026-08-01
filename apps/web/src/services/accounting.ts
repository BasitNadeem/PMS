import { api } from "@/lib/api";

export type AccountScope =
  | "FOLIO_ITEM_TYPE" | "TAX_TYPE" | "PAYMENT_METHOD" | "EXPENSE_CATEGORY" | "SYSTEM";

export type ExportFormat = "GENERIC_CSV" | "TALLY_XML";
export type Granularity = "DAILY_SUMMARY" | "TRANSACTION";

export interface AccountMapping {
  id: string;
  scope: AccountScope;
  key: string;
  accountCode: string;
  accountName: string;
}

export interface PreviewRow {
  accountCode: string;
  accountName: string;
  /** Minor units (paisa). */
  debit: number;
  credit: number;
}

export interface PriorExport {
  id: string;
  format: string;
  createdAt: string;
  periodStart: string;
  periodEnd: string;
  lineCount: number;
}

export interface PreviewMeta {
  periodStart: string;
  periodEnd: string;
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  basis: string;
  granularity: Granularity;
  /** Non-empty when this period was already exported — the UI warns. */
  priorExports: PriorExport[];
}

export interface ExportRecord {
  id: string;
  periodStart: string;
  periodEnd: string;
  format: string;
  basis: string;
  granularity: string;
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  createdAt: string;
}

export interface ExportParams {
  from: string;
  to: string;
  format: ExportFormat;
  granularity: Granularity;
}

export const SCOPE_LABEL: Record<AccountScope, string> = {
  SYSTEM:           "Core accounts",
  FOLIO_ITEM_TYPE:  "Revenue by charge type",
  TAX_TYPE:         "Tax liabilities",
  PAYMENT_METHOD:   "Cash & bank",
  EXPENSE_CATEGORY: "Expenses",
};

export const FORMAT_LABEL: Record<ExportFormat, string> = {
  GENERIC_CSV: "Journal CSV (Excel, Zoho, Odoo, most packages)",
  TALLY_XML:   "Tally XML (import via Gateway → Import Data)",
};

export const accountingService = {
  getMappings: async (): Promise<AccountMapping[]> => {
    const res = await api.get("/api/accounting/mappings");
    return res.data.data;
  },

  updateMappings: async (mappings: Omit<AccountMapping, "id">[]): Promise<AccountMapping[]> => {
    const res = await api.put("/api/accounting/mappings", { mappings });
    return res.data.data;
  },

  resetMappings: async (): Promise<AccountMapping[]> => {
    const res = await api.post("/api/accounting/mappings/reset");
    return res.data.data;
  },

  preview: async (params: ExportParams): Promise<{ data: PreviewRow[]; meta: PreviewMeta }> => {
    const res = await api.get("/api/accounting/preview", { params });
    return res.data;
  },

  listExports: async (): Promise<ExportRecord[]> => {
    const res = await api.get("/api/accounting/exports");
    return res.data.data;
  },

  /**
   * Downloads the file. Goes through axios rather than a plain link so the
   * Authorization header is attached — the endpoint is authenticated.
   */
  download: async (params: ExportParams): Promise<void> => {
    const res = await api.get("/api/accounting/export", { params, responseType: "blob" });

    const disposition = String(res.headers["content-disposition"] ?? "");
    const fileName = /filename="([^"]+)"/.exec(disposition)?.[1]
      ?? `journal-${params.from}-to-${params.to}.${params.format === "TALLY_XML" ? "xml" : "csv"}`;

    const url = URL.createObjectURL(res.data as Blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
