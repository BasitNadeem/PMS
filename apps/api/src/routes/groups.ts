import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import {
  listGroupsSchema,
  createGroupSchema,
  updateGroupSchema,
  updateGroupStatusSchema,
  addGuestToGroupSchema,
  assignRoomSchema,
} from "../schemas/groups";
import { GroupService } from "../services/GroupService";

const router = Router();

router.use(authenticate, tenantMiddleware);

// GET /api/groups/summary — counts by status. MUST be declared before /:id.
router.get("/summary", requirePermission("RESERVATION_READ"), async (req, res) => {
  const result = await GroupService.getSummary(req.withTenant);
  res.json({ data: result });
});

// GET /api/groups
router.get("/", requirePermission("RESERVATION_READ"), async (req, res) => {
  const query = listGroupsSchema.parse(req.query);
  const result = await GroupService.listGroups(req.withTenant, query);
  res.json(result);
});

// GET /api/groups/:id
router.get("/:id", requirePermission("RESERVATION_READ"), async (req, res) => {
  const id = req.params.id as string;
  const group = await GroupService.getGroup(req.withTenant, id);
  res.json({ data: group });
});

// POST /api/groups
router.post("/", requirePermission("RESERVATION_CREATE"), async (req, res) => {
  const body = createGroupSchema.parse(req.body);
  const group = await GroupService.createGroup(req.withTenant, req.user!, body);
  res.status(201).json({ data: group });
});

// PATCH /api/groups/:id
router.patch("/:id", requirePermission("RESERVATION_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  const body = updateGroupSchema.parse(req.body);
  const group = await GroupService.updateGroup(req.withTenant, req.user!, id, body);
  res.json({ data: group });
});

// PATCH /api/groups/:id/status
router.patch("/:id/status", requirePermission("RESERVATION_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  const { status } = updateGroupStatusSchema.parse(req.body);
  const group = await GroupService.updateGroupStatus(req.withTenant, req.user!, id, status);
  res.json({ data: group });
});

// POST /api/groups/:id/checkin
router.post("/:id/checkin", requirePermission("RESERVATION_CHECKIN"), async (req, res) => {
  const id = req.params.id as string;
  const group = await GroupService.checkInGroup(req.withTenant, req.user!, id);
  res.json({ data: group });
});

// POST /api/groups/:id/checkout
router.post("/:id/checkout", requirePermission("RESERVATION_CHECKOUT"), async (req, res) => {
  const id = req.params.id as string;
  const group = await GroupService.checkOutGroup(req.withTenant, req.user!, id);
  res.json({ data: group });
});

// POST /api/groups/:id/members
router.post("/:id/members", requirePermission("RESERVATION_UPDATE"), async (req, res) => {
  const id = req.params.id as string;
  const body = addGuestToGroupSchema.parse(req.body);
  const group = await GroupService.addMember(req.withTenant, req.user!, id, body);
  res.status(201).json({ data: group });
});

// PATCH /api/groups/:id/reservations/:reservationId/room
router.patch("/:id/reservations/:reservationId/room", requirePermission("RESERVATION_UPDATE"), async (req, res) => {
  const id            = req.params.id as string;
  const reservationId = req.params.reservationId as string;
  const { roomId }    = assignRoomSchema.parse(req.body);
  const group = await GroupService.assignRoom(req.withTenant, req.user!, id, reservationId, roomId);
  res.json({ data: group });
});

export default router;
