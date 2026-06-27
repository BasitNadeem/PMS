import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import {
  createExpenseSchema,
  updateExpenseSchema,
  listExpensesSchema,
} from "../schemas/expenses";
import { ExpenseService } from "../services/ExpenseService";

// No requirePermission — permissions table is seeded empty.
// Role checks for destructive operations are enforced inside ExpenseService.
const router = Router();
router.use(authenticate, tenantMiddleware);

// GET /api/expenses/summary — BEFORE /:id
router.get("/summary", async (req, res) => {
  const today     = new Date().toISOString().slice(0, 10);
  const firstDay  = today.slice(0, 8) + "01";
  const startDate = (req.query.startDate as string) || firstDay;
  const endDate   = (req.query.endDate   as string) || today;

  const summary = await ExpenseService.getSummary(req.user!.hotelId, startDate, endDate);
  res.json({ data: summary });
});

// GET /api/expenses
router.get("/", async (req, res) => {
  const query  = listExpensesSchema.parse(req.query);
  const result = await ExpenseService.listExpenses(req.user!.hotelId, query);
  res.json(result);
});

// GET /api/expenses/:id
router.get("/:id", async (req, res) => {
  const expense = await ExpenseService.getExpense(req.user!.hotelId, req.params.id);
  res.json({ data: expense });
});

// POST /api/expenses
router.post("/", async (req, res) => {
  const dto     = createExpenseSchema.parse(req.body);
  const expense = await ExpenseService.createExpense(req.user!.hotelId, dto, req.user!.userId);
  res.status(201).json({ data: expense });
});

// PATCH /api/expenses/:id
router.patch("/:id", async (req, res) => {
  const dto     = updateExpenseSchema.parse(req.body);
  const expense = await ExpenseService.updateExpense(
    req.user!.hotelId, req.params.id, dto, req.user!.userId, req.user!.role,
  );
  res.json({ data: expense });
});

// DELETE /api/expenses/:id
router.delete("/:id", async (req, res) => {
  await ExpenseService.deleteExpense(req.user!.hotelId, req.params.id, req.user!.userId, req.user!.role);
  res.status(204).send();
});

export default router;
