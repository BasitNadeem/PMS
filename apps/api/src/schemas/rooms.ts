import { z } from "zod";
import { RoomStatus, RoomTypeName } from "@pms/db";

// ── Room Types ────────────────────────────────────────────────────────────────

export const listRoomTypesSchema = z.object({
  page:  z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(100),
});
export type ListRoomTypesQuery = z.infer<typeof listRoomTypesSchema>;

export const createRoomTypeSchema = z.object({
  name:         z.string().trim().min(1),
  typeName:     z.nativeEnum(RoomTypeName).default("DOUBLE"),
  description:  z.string().trim().optional(),
  maxOccupancy: z.number().int().min(1),
  defaultRate:  z.number().int().positive(),
  sortOrder:    z.number().int().min(0).default(0),
});
export type CreateRoomTypeDto = z.infer<typeof createRoomTypeSchema>;

export const updateRoomTypeSchema = createRoomTypeSchema.partial();
export type UpdateRoomTypeDto = z.infer<typeof updateRoomTypeSchema>;

// ── Rooms ─────────────────────────────────────────────────────────────────────

export const listRoomsSchema = z.object({
  status: z.nativeEnum(RoomStatus).optional(),
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(100),
});
export type ListRoomsQuery = z.infer<typeof listRoomsSchema>;

export const createRoomSchema = z.object({
  number:     z.string().trim().min(1),
  floor:      z.number().int().min(0).optional(),
  roomTypeId: z.string().uuid(),
  status:     z.nativeEnum(RoomStatus).default("VACANT_CLEAN"),
  notes:      z.string().trim().optional(),
});
export type CreateRoomDto = z.infer<typeof createRoomSchema>;

export const updateRoomSchema = createRoomSchema.partial();
export type UpdateRoomDto = z.infer<typeof updateRoomSchema>;

// ── Availability check (proactive conflict warning, before reservation create) ──

export const checkAvailabilitySchema = z.object({
  checkInDate:           z.string(),
  checkOutDate:          z.string(),
  roomId:                z.string().uuid().optional(),
  roomTypeId:            z.string().uuid().optional(),
  excludeReservationId:  z.string().uuid().optional(),
}).refine((d) => !!d.roomId !== !!d.roomTypeId, {
  message: "Provide either roomId or roomTypeId, not both",
});
export type CheckAvailabilityQuery = z.infer<typeof checkAvailabilitySchema>;
