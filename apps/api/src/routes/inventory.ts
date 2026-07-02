import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  listInventorySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  createTransactionSchema,
} from "../schemas/inventory";
import { InventoryService } from "../services/InventoryService";

const router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/inventory/summary — BEFORE /:id
router.get("/summary", requirePermission("pos:read"), async (req, res) => {
  const summary = await InventoryService.getSummary(req.withTenant, req.user!.hotelId);
  res.json({ data: summary });
});

// GET /api/inventory/low-stock — BEFORE /:id
router.get("/low-stock", requirePermission("pos:read"), async (req, res) => {
  const items = await InventoryService.getLowStockItems(req.withTenant, req.user!.hotelId);
  res.json({ data: items });
});

// GET /api/inventory
router.get("/", requirePermission("pos:read"), async (req, res) => {
  const query  = listInventorySchema.parse(req.query);
  const result = await InventoryService.listItems(req.withTenant, req.user!.hotelId, query);
  res.json(result);
});

// GET /api/inventory/:id
router.get("/:id", requirePermission("pos:read"), async (req, res) => {
  const item = await InventoryService.getItem(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
  );
  res.json({ data: item });
});

// POST /api/inventory
router.post("/", requirePermission("pos:manage"), async (req, res) => {
  const body = createInventoryItemSchema.parse(req.body);
  const item = await InventoryService.createItem(
    req.withTenant,
    req.user!.hotelId,
    body,
    req.user!.userId,
  );
  res.status(201).json({ data: item });
});

// PATCH /api/inventory/:id
router.patch("/:id", requirePermission("pos:manage"), async (req, res) => {
  const body = updateInventoryItemSchema.parse(req.body);
  const item = await InventoryService.updateItem(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    body,
    req.user!.userId,
  );
  res.json({ data: item });
});

// DELETE /api/inventory/:id — soft delete (sets isActive=false)
router.delete("/:id", requirePermission("pos:manage"), async (req, res) => {
  await InventoryService.deactivateItem(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    req.user!.userId,
  );
  res.status(204).send();
});

// POST /api/inventory/:id/transactions
router.post("/:id/transactions", requirePermission("pos:manage"), async (req, res) => {
  const body = createTransactionSchema.parse(req.body);
  const item = await InventoryService.recordTransaction(
    req.withTenant,
    req.user!.hotelId,
    req.params.id as string,
    body,
    req.user!.userId,
  );
  res.status(201).json({ data: item });
});

export default router;
