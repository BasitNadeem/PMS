import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
  createOrderSchema,
  listOrdersSchema,
} from "../schemas/pos";
import { PosMenuService } from "../services/PosMenuService";
import { PosService } from "../services/PosService";
import { createLedgerEntryFromPosOrder } from "../services/CashBookService";
import { deductInventoryForOrder } from "../services/InventoryService";

const router = Router();

router.use(authenticate, tenantMiddleware);

// ── Categories ────────────────────────────────────────────────────────────────

// GET /api/pos/categories/admin — BEFORE /categories/:id
router.get("/categories/admin", requirePermission("POS_READ"), async (req, res) => {
  const categories = await PosMenuService.listCategories(req.withTenant, true);
  res.json({ data: categories });
});

// GET /api/pos/categories
router.get("/categories", requirePermission("POS_READ"), async (req, res) => {
  const categories = await PosMenuService.listCategories(req.withTenant, false);
  res.json({ data: categories });
});

// POST /api/pos/categories
router.post("/categories", requirePermission("POS_UPDATE"), async (req, res) => {
  const body     = createCategorySchema.parse(req.body);
  const category = await PosMenuService.createCategory(req.withTenant, req.user!, body);
  res.status(201).json({ data: category });
});

// PATCH /api/pos/categories/:id
router.patch("/categories/:id", requirePermission("POS_UPDATE"), async (req, res) => {
  const id       = req.params.id as string;
  const body     = updateCategorySchema.parse(req.body);
  const category = await PosMenuService.updateCategory(req.withTenant, req.user!, id, body);
  res.json({ data: category });
});

// DELETE /api/pos/categories/:id
router.delete("/categories/:id", requirePermission("POS_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  await PosMenuService.deleteCategory(req.withTenant, req.user!, id);
  res.status(204).send();
});

// ── Items ─────────────────────────────────────────────────────────────────────

// POST /api/pos/categories/:id/items
router.post("/categories/:id/items", requirePermission("POS_UPDATE"), async (req, res) => {
  const categoryId = req.params.id as string;
  const body       = createItemSchema.parse(req.body);
  const item       = await PosMenuService.createItem(req.withTenant, req.user!, categoryId, body);
  res.status(201).json({ data: item });
});

// PATCH /api/pos/items/:id/toggle — BEFORE /items/:id
router.patch("/items/:id/toggle", requirePermission("POS_UPDATE"), async (req, res) => {
  const id   = req.params.id as string;
  const item = await PosMenuService.toggleItemAvailability(req.withTenant, req.user!, id);
  res.json({ data: item });
});

// PATCH /api/pos/items/:id
router.patch("/items/:id", requirePermission("POS_UPDATE"), async (req, res) => {
  const id   = req.params.id as string;
  const body = updateItemSchema.parse(req.body);
  const item = await PosMenuService.updateItem(req.withTenant, req.user!, id, body);
  res.json({ data: item });
});

// DELETE /api/pos/items/:id
router.delete("/items/:id", requirePermission("POS_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  await PosMenuService.deleteItem(req.withTenant, req.user!, id);
  res.status(204).send();
});

// ── Orders ────────────────────────────────────────────────────────────────────

// GET /api/pos/orders
router.get("/orders", requirePermission("POS_READ"), async (req, res) => {
  const query  = listOrdersSchema.parse(req.query);
  const result = await PosService.listOrders(req.withTenant, query);
  res.json(result);
});

// POST /api/pos/orders
router.post("/orders", requirePermission("POS_CREATE"), async (req, res) => {
  const body  = createOrderSchema.parse(req.body);
  const order = await PosService.createOrder(req.withTenant, req.user!, body);
  res.status(201).json({ data: order });

  // Auto-entry in cash book for direct payments — fire-and-forget, never fails the order
  if (order.status === "PAID" && order.paymentMethod) {
    createLedgerEntryFromPosOrder(
      req.user!.hotelId,
      { id: order.id, orderNumber: order.orderNumber, total: order.total, paymentMethod: order.paymentMethod },
      req.user!.userId,
    ).catch(() => { /* already logged inside */ });
  }

  // Deduct inventory only when the order is immediately PAID (DIRECT payment).
  // FOLIO orders remain OPEN and are never marked PAID, so we must not deduct
  // at creation time for them — they would double-count if the guest later cancels.
  if (order.status === "PAID") {
    deductInventoryForOrder(
      req.withTenant,
      req.user!.hotelId,
      order.id,
      order.items.map((i) => ({ posItemId: i.posItemId, quantity: i.quantity })),
      req.user!.userId,
    ).catch((err) => console.error("[Inventory] POS deduction error:", err));
  }
});

// PATCH /api/pos/orders/:id/status
router.patch("/orders/:id/status", requirePermission("POS_UPDATE"), async (req, res) => {
  const id    = req.params.id as string;
  const order = await PosService.updateOrderStatus(req.withTenant, req.user!, id);
  res.json({ data: order });
});

export default router;
