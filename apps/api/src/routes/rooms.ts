import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { RoomService } from "../services/RoomService";
import {
  listRoomsSchema,
  createRoomSchema,
  updateRoomSchema,
  listRoomTypesSchema,
  createRoomTypeSchema,
  updateRoomTypeSchema,
  checkAvailabilitySchema,
} from "../schemas/rooms";

// ── Room Types router  (mounted at /api/room-types) ───────────────────────────

export const roomTypesRouter: Router = Router();
roomTypesRouter.use(authenticate, tenantMiddleware);

roomTypesRouter.get("/", requirePermission("ROOM_TYPE_READ"), async (req, res) => {
  const query = listRoomTypesSchema.parse(req.query);
  const result = await RoomService.listRoomTypes(req.withTenant, query);
  res.json(result);
});

roomTypesRouter.post("/", requirePermission("ROOM_TYPE_CREATE"), async (req, res) => {
  const dto = createRoomTypeSchema.parse(req.body);
  const roomType = await RoomService.createRoomType(req.withTenant, req.user!, dto);
  res.status(201).json({ data: roomType });
});

roomTypesRouter.patch("/:id", requirePermission("ROOM_TYPE_UPDATE"), async (req, res) => {
  const dto = updateRoomTypeSchema.parse(req.body);
  const roomType = await RoomService.updateRoomType(req.withTenant, req.user!, req.params.id as string, dto);
  res.json({ data: roomType });
});

// ── Rooms router  (mounted at /api/rooms) ────────────────────────────────────

export const roomsRouter: Router = Router();
roomsRouter.use(authenticate, tenantMiddleware);

roomsRouter.get("/", requirePermission("ROOM_READ"), async (req, res) => {
  const query = listRoomsSchema.parse(req.query);
  const result = await RoomService.listRooms(req.withTenant, query);
  res.json(result);
});

// GET /api/rooms/availability — BEFORE /:id
roomsRouter.get("/availability", requirePermission("ROOM_READ"), async (req, res) => {
  const query = checkAvailabilitySchema.parse(req.query);
  const result = await RoomService.checkAvailability(req.withTenant, query);
  res.json({ data: result });
});

roomsRouter.get("/:id", requirePermission("ROOM_READ"), async (req, res) => {
  const room = await RoomService.getRoom(req.withTenant, req.params.id as string);
  res.json({ data: room });
});

roomsRouter.post("/", requirePermission("ROOM_CREATE"), async (req, res) => {
  const dto = createRoomSchema.parse(req.body);
  const room = await RoomService.createRoom(req.withTenant, req.user!, dto);
  res.status(201).json({ data: room });
});

roomsRouter.patch("/:id", requirePermission("ROOM_UPDATE"), async (req, res) => {
  const dto = updateRoomSchema.parse(req.body);
  const room = await RoomService.updateRoom(req.withTenant, req.user!, req.params.id as string, dto);
  res.json({ data: room });
});

roomsRouter.delete("/:id", requirePermission("ROOM_DELETE"), async (req, res) => {
  await RoomService.deactivateRoom(req.withTenant, req.user!, req.params.id as string);
  res.status(204).send();
});
