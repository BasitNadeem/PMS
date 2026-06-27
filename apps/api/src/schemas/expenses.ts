import { z } from "zod";

export const EXPENSE_CATEGORIES = [
  "SALARY", "UTILITIES", "SUPPLIES", "MAINTENANCE", "FOOD_BEVERAGE",
  "MARKETING", "RENT", "INSURANCE", "EQUIPMENT", "MISCELLANEOUS",
] as const;
export type ExpenseCategory = typeof EXPENSE_CATEGORIES[number];

export const EXPENSE_PAYMENT_METHODS = [
  "CASH", "BANK_TRANSFER", "CHEQUE", "ONLINE",
] as const;

export const createExpenseSchema = z.object({
  date:          z.string().date(),
  category:      z.enum(EXPENSE_CATEGORIES),
  description:   z.string().trim().min(2),
  amount:        z.number().int().positive(),
  paymentMethod: z.enum(EXPENSE_PAYMENT_METHODS),
  paidTo:        z.string().trim().min(1),
  receiptRef:    z.string().trim().optional(),
  notes:         z.string().trim().optional(),
});
export type CreateExpenseDto = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = createExpenseSchema.partial();
export type UpdateExpenseDto = z.infer<typeof updateExpenseSchema>;

export const listExpensesSchema = z.object({
  category:  z.enum(EXPENSE_CATEGORIES).optional(),
  startDate: z.string().date().optional(),
  endDate:   z.string().date().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
});
export type ListExpensesQuery = z.infer<typeof listExpensesSchema>;
