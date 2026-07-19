import { Router, json } from "express";
import jwt from "jsonwebtoken";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  listInventorySchema,
  createInventoryItemSchema,
  updateInventoryItemSchema,
  createTransactionSchema,
} from "../schemas/inventory";
import { scanInventorySchema } from "../schemas/inventoryScan";
import { InventoryService } from "../services/InventoryService";
import { InventoryScanService } from "../services/InventoryScanService";
import { ScanSessionService } from "../services/ScanSessionService";
import { env } from "../lib/env";
import type { JwtPayload } from "../middleware/auth";
import { checkFeatureAccess } from "../lib/subscription";

const router: Router = Router();

router.use(authenticate, tenantMiddleware);
router.use(async (req, _res, next) => {
  await checkFeatureAccess(req.user!.hotelId, "inventoryManagement");
  next();
});

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

// POST /api/inventory/scan — desktop direct upload (base64 image, authenticated)
router.post(
  "/scan",
  requirePermission("pos:manage"),
  json({ limit: "5mb" }),
  async (req, res) => {
    const dto    = scanInventorySchema.parse(req.body);
    const result = await InventoryScanService.scan(req.withTenant, req.user!.hotelId, dto);
    res.json({ data: result });
  },
);

// POST /api/inventory/scan-sessions — desktop creates QR session
router.post("/scan-sessions", requirePermission("pos:manage"), async (req, res) => {
  const { token } = await ScanSessionService.create(req.user!.hotelId);
  res.status(201).json({ data: { token } });
});

// GET /api/inventory/scan-sessions/:token/events — desktop SSE stream
// EventSource cannot set headers, so JWT is accepted via ?auth= query param.
router.get("/scan-sessions/:token/events", async (req, res) => {
  const rawJwt = (
    req.headers.authorization?.replace("Bearer ", "") ??
    (req.query.auth as string | undefined)
  );
  if (!rawJwt) { res.status(401).json({ error: "Unauthorized" }); return; }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(rawJwt, env.JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const token   = req.params.token as string;
  const session = await ScanSessionService.get(token);
  if (!session)                            { res.status(404).json({ error: "Session not found or expired" }); return; }
  if (session.hotelId !== payload.hotelId) { res.status(403).json({ error: "Forbidden" }); return; }

  // Already completed before desktop connected (fast mobile)
  if (session.status === "done") {
    res.json({ data: session.result });
    return;
  }

  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();
  res.write("event: connected\ndata: {}\n\n");

  ScanSessionService.registerSSE(token, res);

  const heartbeat = setInterval(() => res.write("event: ping\ndata: {}\n\n"), 30_000);
  res.on("close", () => clearInterval(heartbeat));
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
