import { api } from "@/lib/api";

export const EXPENSE_CATEGORIES = [
  "SALARY", "UTILITIES", "SUPPLIES", "MAINTENANCE", "FOOD_BEVERAGE",
  "MARKETING", "RENT", "INSURANCE", "EQUIPMENT", "MISCELLANEOUS",
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  SALARY:        "Salary",
  UTILITIES:     "Utilities",
  SUPPLIES:      "Supplies",
  MAINTENANCE:   "Maintenance",
  FOOD_BEVERAGE: "Food & Beverage",
  MARKETING:     "Marketing",
  RENT:          "Rent",
  INSURANCE:     "Insurance",
  EQUIPMENT:     "Equipment",
  MISCELLANEOUS: "Miscellaneous",
};

export const CATEGORY_STYLE: Record<ExpenseCategory, { bg: string; text: string }> = {
  SALARY:        { bg: "bg-slate-soft",  text: "text-slate" },
  UTILITIES:     { bg: "bg-amber-soft",  text: "text-amber" },
  SUPPLIES:      { bg: "bg-pine-soft",   text: "text-pine-deep" },
  MAINTENANCE:   { bg: "bg-coral-soft",  text: "text-coral-deep" },
  FOOD_BEVERAGE: { bg: "bg-pine-soft",   text: "text-pine" },
  MARKETING:     { bg: "bg-dusk-soft",   text: "text-dusk" },
  RENT:          { bg: "bg-clay-soft",   text: "text-clay" },
  INSURANCE:     { bg: "bg-line-soft",   text: "text-ink-mute" },
  EQUIPMENT:     { bg: "bg-slate-soft",  text: "text-slate" },
  MISCELLANEOUS: { bg: "bg-line-soft",   text: "text-ink-mute" },
};

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH:          "Cash",
  BANK_TRANSFER: "Bank Transfer",
  CHEQUE:        "Cheque",
  ONLINE:        "Online",
};

export interface Expense {
  id:             string;
  hotel_id:       string;
  date:           string;
  category:       ExpenseCategory;
  description:    string;
  amount:         number;
  payment_method: string;
  paid_to:        string;
  receipt_ref:    string | null;
  notes:          string | null;
  created_by_id:  string;
  created_at:     string;
  updated_at:     string;
}

export interface ExpenseCategorySummary {
  category: string;
  total:    number;
  count:    number;
}

export interface ExpenseSummary {
  totalAmount:  number;
  byCategory:   ExpenseCategorySummary[];
}

export interface CreateExpenseDto {
  date:          string;
  category:      ExpenseCategory;
  description:   string;
  amount:        number;
  paymentMethod: string;
  paidTo:        string;
  receiptRef?:   string;
  notes?:        string;
}

export interface PaginationMeta {
  total:      number;
  page:       number;
  limit:      number;
  totalPages: number;
}

export const expensesService = {
  getExpenses: async (params: {
    category?:  string;
    startDate?: string;
    endDate?:   string;
    page?:      number;
    limit?:     number;
  }): Promise<{ data: Expense[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/expenses", { params });
    return res.data;
  },

  getExpenseSummary: async (startDate: string, endDate: string): Promise<ExpenseSummary> => {
    const res = await api.get("/api/expenses/summary", { params: { startDate, endDate } });
    return res.data.data;
  },

  createExpense: async (dto: CreateExpenseDto): Promise<Expense> => {
    const res = await api.post("/api/expenses", dto);
    return res.data.data;
  },

  updateExpense: async (id: string, dto: Partial<CreateExpenseDto>): Promise<Expense> => {
    const res = await api.patch(`/api/expenses/${id}`, dto);
    return res.data.data;
  },

  deleteExpense: async (id: string): Promise<void> => {
    await api.delete(`/api/expenses/${id}`);
  },
};
