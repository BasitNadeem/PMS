import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesSchema,
} from "../schemas/expenses";
import { ExpenseService } from "../services/ExpenseService";
import { getOperationalBusinessDate } from "../lib/shiftSchedule";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

// GET /api/expenses/summary — BEFORE /:id
router.get("/summary", requirePermission("expenses:read"), async (req, res) => {
  // The hotel's operating day, not the UTC date. Deriving this from the raw
  // instant sent the default range a day back every night before the Morning
  // boundary, and on the 1st of a month it rolled the whole range into the
  // previous month.
  const hotel = await req.withTenant((db) =>
    db.hotel.findUniqueOrThrow({ where: { id: req.user!.hotelId }, select: { settings: true } })
  );
  const today     = getOperationalBusinessDate((hotel.settings as Record<string, unknown> | null) ?? {});
  const firstDay  = today.slice(0, 8) + "01";
  const startDate = (req.query.startDate as string) || firstDay;
  const endDate   = (req.query.endDate   as string) || today;

  const summary = await ExpenseService.getSummary(req.user!.hotelId, startDate, endDate);
  res.json({ data: summary });
});

// GET /api/expenses
router.get("/", requirePermission("expenses:read"), async (req, res) => {
  const query  = listExpensesSchema.parse(req.query);
  const result = await ExpenseService.listExpenses(req.user!.hotelId, query);
  res.json(result);
});

// GET /api/expenses/:id
router.get("/:id", requirePermission("expenses:read"), async (req, res) => {
  const expense = await ExpenseService.getExpense(req.user!.hotelId, req.params["id"] as string);
  res.json({ data: expense });
});

// POST /api/expenses
router.post("/", requirePermission("expenses:create"), async (req, res) => {
  const dto     = createExpenseSchema.parse(req.body);
  const expense = await ExpenseService.createExpense(req.user!.hotelId, dto, req.user!.userId);
  res.status(201).json({ data: expense });
});

// PATCH /api/expenses/:id
router.patch("/:id", requirePermission("expenses:update"), async (req, res) => {
  const dto     = updateExpenseSchema.parse(req.body);
  const expense = await ExpenseService.updateExpense(
    req.user!.hotelId, req.params["id"] as string, dto, req.user!.userId, req.user!.role,
  );
  res.json({ data: expense });
});

// DELETE /api/expenses/:id
router.delete("/:id", requirePermission("expenses:delete"), async (req, res) => {
  await ExpenseService.deleteExpense(req.user!.hotelId, req.params["id"] as string, req.user!.userId, req.user!.role);
  res.status(204).send();
});

export default router;
