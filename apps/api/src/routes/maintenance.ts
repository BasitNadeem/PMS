import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  listTicketsSchema,
  createTicketSchema,
  updateTicketSchema,
  updateTicketStatusSchema,
} from "../schemas/maintenance";
import { MaintenanceService } from "../services/MaintenanceService";
import { checkFeatureAccess } from "../lib/subscription";

const router: Router = Router();

router.use(authenticate, tenantMiddleware);
router.use(async (req, _res, next) => {
  await checkFeatureAccess(req.user!.hotelId, "maintenanceTickets");
  next();
});

// GET /api/maintenance/summary — BEFORE /:id
router.get("/summary", requirePermission("MAINTENANCE_READ"), async (req, res) => {
  const result = await MaintenanceService.summary(req.withTenant);
  res.json({ data: result });
});

// GET /api/maintenance
router.get("/", requirePermission("MAINTENANCE_READ"), async (req, res) => {
  const query = listTicketsSchema.parse(req.query);
  const result = await MaintenanceService.listTickets(req.withTenant, query);
  res.json(result);
});

// GET /api/maintenance/:id
router.get("/:id", requirePermission("MAINTENANCE_READ"), async (req, res) => {
  const ticket = await MaintenanceService.getTicket(req.withTenant, req.params.id as string);
  res.json({ data: ticket });
});

// POST /api/maintenance
router.post("/", requirePermission("MAINTENANCE_CREATE"), async (req, res) => {
  const body = createTicketSchema.parse(req.body);
  const ticket = await MaintenanceService.createTicket(req.withTenant, req.user!, body);
  res.status(201).json({ data: ticket });
});

// PATCH /api/maintenance/:id/status
router.patch("/:id/status", requirePermission("MAINTENANCE_UPDATE"), async (req, res) => {
  const body = updateTicketStatusSchema.parse(req.body);
  const ticket = await MaintenanceService.updateTicketStatus(req.withTenant, req.user!, req.params.id as string, body);
  res.json({ data: ticket });
});

// PATCH /api/maintenance/:id
router.patch("/:id", requirePermission("MAINTENANCE_UPDATE"), async (req, res) => {
  const body = updateTicketSchema.parse(req.body);
  const ticket = await MaintenanceService.updateTicket(req.withTenant, req.user!, req.params.id as string, body);
  res.json({ data: ticket });
});

export default router;
