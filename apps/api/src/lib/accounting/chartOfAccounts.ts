/**
 * Default chart of accounts for a small hotel.
 *
 * Seeded on first use so the export produces something sensible before anyone
 * configures anything. Every code and name is editable — hotels already running
 * Tally have their own numbering and will overwrite these.
 *
 * Numbering follows the usual convention: 1xxx assets, 2xxx liabilities,
 * 4xxx revenue, 5xxx expenses.
 */

export type AccountScope =
  | "FOLIO_ITEM_TYPE"
  | "TAX_TYPE"
  | "PAYMENT_METHOD"
  | "EXPENSE_CATEGORY"
  | "SYSTEM";

export interface AccountDefault {
  scope: AccountScope;
  key: string;
  accountCode: string;
  accountName: string;
}

/**
 * Fixed accounts the journal always needs, regardless of a hotel's own chart.
 * `SYSTEM` keys are referenced by name in the journal builder, so renaming one
 * here without updating the builder would silently drop lines.
 */
export const SYSTEM_KEYS = {
  ACCOUNTS_RECEIVABLE: "ACCOUNTS_RECEIVABLE",
  GUEST_ADVANCES:      "GUEST_ADVANCES",
  DISCOUNTS_ALLOWED:   "DISCOUNTS_ALLOWED",
  ROUNDING:            "ROUNDING",
} as const;

export const DEFAULT_ACCOUNTS: AccountDefault[] = [
  // ── System ────────────────────────────────────────────────────────────────
  { scope: "SYSTEM", key: SYSTEM_KEYS.ACCOUNTS_RECEIVABLE, accountCode: "1200", accountName: "Accounts Receivable" },
  // Money taken before the guest arrives is a liability, not revenue — it is
  // owed back until they actually stay.
  { scope: "SYSTEM", key: SYSTEM_KEYS.GUEST_ADVANCES,      accountCode: "2100", accountName: "Guest Advances" },
  // Contra-revenue, so gross revenue stays visible instead of being netted down.
  { scope: "SYSTEM", key: SYSTEM_KEYS.DISCOUNTS_ALLOWED,   accountCode: "4950", accountName: "Discounts Allowed" },
  { scope: "SYSTEM", key: SYSTEM_KEYS.ROUNDING,            accountCode: "5900", accountName: "Rounding Difference" },

  // ── Revenue, one per folio item type ──────────────────────────────────────
  { scope: "FOLIO_ITEM_TYPE", key: "ROOM_CHARGE",     accountCode: "4100", accountName: "Room Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "FOOD_BEVERAGE",   accountCode: "4200", accountName: "Food & Beverage Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "LAUNDRY",         accountCode: "4300", accountName: "Laundry Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "TRANSPORT",       accountCode: "4400", accountName: "Transport Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "SPA",             accountCode: "4500", accountName: "Spa Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "ACTIVITY",        accountCode: "4600", accountName: "Activity Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "MINIBAR",         accountCode: "4700", accountName: "Minibar Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "TELEPHONE",       accountCode: "4810", accountName: "Telephone Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "INTERNET",        accountCode: "4820", accountName: "Internet Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "DAMAGE_CHARGE",   accountCode: "4910", accountName: "Damage Recovery" },
  { scope: "FOLIO_ITEM_TYPE", key: "MISCELLANEOUS",   accountCode: "4900", accountName: "Other Revenue" },
  { scope: "FOLIO_ITEM_TYPE", key: "ADJUSTMENT",      accountCode: "4920", accountName: "Revenue Adjustments" },
  // TAX and DISCOUNT folio items are routed to their own accounts by the
  // journal builder and never use these mappings, but they are seeded so the
  // mapping screen shows a complete list rather than mysterious gaps.
  { scope: "FOLIO_ITEM_TYPE", key: "TAX",             accountCode: "2300", accountName: "Tax Payable" },
  { scope: "FOLIO_ITEM_TYPE", key: "DISCOUNT",        accountCode: "4950", accountName: "Discounts Allowed" },

  // ── Tax liabilities, one per configured tax ───────────────────────────────
  { scope: "TAX_TYPE", key: "GST",               accountCode: "2310", accountName: "GST Payable" },
  { scope: "TAX_TYPE", key: "PST_PRA",           accountCode: "2320", accountName: "Punjab Sales Tax Payable" },
  { scope: "TAX_TYPE", key: "SST_SRB",           accountCode: "2330", accountName: "Sindh Sales Tax Payable" },
  { scope: "TAX_TYPE", key: "KPST_KPRA",         accountCode: "2340", accountName: "KP Sales Tax Payable" },
  { scope: "TAX_TYPE", key: "GBST_GBRA",         accountCode: "2350", accountName: "GB Sales Tax Payable" },
  { scope: "TAX_TYPE", key: "WHT",               accountCode: "2360", accountName: "Withholding Tax Payable" },
  { scope: "TAX_TYPE", key: "ACCOMMODATION_TAX", accountCode: "2370", accountName: "Accommodation Tax Payable" },

  // ── Where cash lands, one per payment method ──────────────────────────────
  { scope: "PAYMENT_METHOD", key: "CASH",             accountCode: "1100", accountName: "Cash in Hand" },
  { scope: "PAYMENT_METHOD", key: "JAZZCASH",         accountCode: "1120", accountName: "JazzCash Wallet" },
  { scope: "PAYMENT_METHOD", key: "EASYPAISA",        accountCode: "1130", accountName: "EasyPaisa Wallet" },
  { scope: "PAYMENT_METHOD", key: "BANK_TRANSFER",    accountCode: "1110", accountName: "Bank Account" },
  { scope: "PAYMENT_METHOD", key: "CREDIT_CARD",      accountCode: "1140", accountName: "Card Settlement" },
  { scope: "PAYMENT_METHOD", key: "DEBIT_CARD",       accountCode: "1140", accountName: "Card Settlement" },
  { scope: "PAYMENT_METHOD", key: "CHEQUE",           accountCode: "1150", accountName: "Cheques in Hand" },
  { scope: "PAYMENT_METHOD", key: "ADVANCE_DEPOSIT",  accountCode: "1100", accountName: "Cash in Hand" },
  { scope: "PAYMENT_METHOD", key: "OTA_COLLECT",      accountCode: "1160", accountName: "OTA Receivable" },
  // A complimentary stay moves no money; it is written off rather than banked.
  { scope: "PAYMENT_METHOD", key: "COMPLIMENTARY",    accountCode: "5300", accountName: "Complimentary & Promotions" },
];

/** Fallback for an expense category with no explicit mapping. */
export const DEFAULT_EXPENSE_ACCOUNT = { accountCode: "5000", accountName: "General Expenses" };

/** Fallback for a folio item type with no explicit mapping. */
export const DEFAULT_REVENUE_ACCOUNT = { accountCode: "4900", accountName: "Other Revenue" };
