import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  listTasksSchema,
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "../schemas/housekeeping";
import { HousekeepingService } from "../services/HousekeepingService";

const router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/housekeeping/summary — BEFORE /:id
router.get("/summary", requirePermission("HOUSEKEEPING_READ"), async (req, res) => {
  const result = await HousekeepingService.summary(req.withTenant);
  res.json({ data: result });
});

// GET /api/housekeeping
router.get("/", requirePermission("HOUSEKEEPING_READ"), async (req, res) => {
  const query = listTasksSchema.parse(req.query);
  const result = await HousekeepingService.listTasks(req.withTenant, query);
  res.json(result);
});

// GET /api/housekeeping/:id
router.get("/:id", requirePermission("HOUSEKEEPING_READ"), async (req, res) => {
  const task = await HousekeepingService.getTask(req.withTenant, req.params.id as string);
  res.json({ data: task });
});

// POST /api/housekeeping
router.post("/", requirePermission("HOUSEKEEPING_CREATE"), async (req, res) => {
  const body = createTaskSchema.parse(req.body);
  const task = await HousekeepingService.createTask(req.withTenant, req.user!, body);
  res.status(201).json({ data: task });
});

// PATCH /api/housekeeping/:id/status
router.patch("/:id/status", requirePermission("HOUSEKEEPING_UPDATE"), async (req, res) => {
  const body = updateTaskStatusSchema.parse(req.body);
  const task = await HousekeepingService.updateTaskStatus(req.withTenant, req.user!, req.params.id as string, body);
  res.json({ data: task });
});

// PATCH /api/housekeeping/:id
router.patch("/:id", requirePermission("HOUSEKEEPING_UPDATE"), async (req, res) => {
  const body = updateTaskSchema.parse(req.body);
  const task = await HousekeepingService.updateTask(req.withTenant, req.user!, req.params.id as string, body);
  res.json({ data: task });
});

export default router;
