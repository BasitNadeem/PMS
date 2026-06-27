import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import type {
  ListRoomsQuery,
  CreateRoomDto,
  UpdateRoomDto,
  ListRoomTypesQuery,
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
  CheckAvailabilityQuery,
} from "../schemas/rooms";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export const RoomService = {
  // ── Room Types ──────────────────────────────────────────────────────────────

  async listRoomTypes(withTenant: WithTenantFn, query: ListRoomTypesQuery) {
    const skip = (query.page - 1) * query.limit;
    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.roomType.findMany({
          where:   { isActive: true },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          skip,
          take: query.limit,
        }),
        db.roomType.count({ where: { isActive: true } }),
      ])
    );
    return { data: items, meta: paginationMeta(total, query.page, query.limit) };
  },

  async createRoomType(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateRoomTypeDto) {
    return withTenant(async (db) => {
      const roomType = await db.roomType.create({
        data: {
          hotelId:      actor.hotelId,
          name:         dto.name,
          typeName:     dto.typeName,
          description:  dto.description,
          maxOccupancy: dto.maxOccupancy,
          defaultRate:  dto.defaultRate,
          sortOrder:    dto.sortOrder,
        },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "ROOM_TYPE_CREATE",
          entity:   "room_type",
          entityId: roomType.id,
        },
      });

      return roomType;
    });
  },

  async updateRoomType(withTenant: WithTenantFn, actor: JwtPayload, id: string, dto: UpdateRoomTypeDto) {
    return withTenant(async (db) => {
      const existing = await db.roomType.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Room type not found");

      const updated = await db.roomType.update({
        where: { id },
        data:  dto,
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "ROOM_TYPE_UPDATE",
          entity:   "room_type",
          entityId: id,
          after:    JSON.parse(JSON.stringify(dto)),
        },
      });

      return updated;
    });
  },

  // ── Rooms ───────────────────────────────────────────────────────────────────

  async listRooms(withTenant: WithTenantFn, query: ListRoomsQuery) {
    const skip  = (query.page - 1) * query.limit;
    const where = {
      isActive: true,
      ...(query.status && { status: query.status }),
    };

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.room.findMany({
          where,
          include: { roomType: true },
          orderBy: [{ floor: "asc" }, { number: "asc" }],
          skip,
          take: query.limit,
        }),
        db.room.count({ where }),
      ])
    );
    return { data: items, meta: paginationMeta(total, query.page, query.limit) };
  },

  async getRoom(withTenant: WithTenantFn, id: string) {
    const room = await withTenant((db) =>
      db.room.findUnique({
        where:   { id },
        include: { roomType: true },
      })
    );
    if (!room) throw new AppError(404, "Room not found");
    return room;
  },

  async createRoom(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateRoomDto) {
    return withTenant(async (db) => {
      const roomType = await db.roomType.findUnique({ where: { id: dto.roomTypeId } });
      if (!roomType) throw new AppError(404, "Room type not found");

      const room = await db.room.create({
        data: {
          hotelId:    actor.hotelId,
          roomTypeId: dto.roomTypeId,
          number:     dto.number,
          floor:      dto.floor,
          status:     dto.status,
          notes:      dto.notes,
        },
        include: { roomType: true },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "ROOM_CREATE",
          entity:   "room",
          entityId: room.id,
        },
      });

      return room;
    });
  },

  async updateRoom(withTenant: WithTenantFn, actor: JwtPayload, id: string, dto: UpdateRoomDto) {
    return withTenant(async (db) => {
      const existing = await db.room.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Room not found");

      if (dto.roomTypeId) {
        const roomType = await db.roomType.findUnique({ where: { id: dto.roomTypeId } });
        if (!roomType) throw new AppError(404, "Room type not found");
      }

      const updated = await db.room.update({
        where:   { id },
        data:    dto,
        include: { roomType: true },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "ROOM_UPDATE",
          entity:   "room",
          entityId: id,
          after:    JSON.parse(JSON.stringify(dto)),
        },
      });

      return updated;
    });
  },

  async deactivateRoom(withTenant: WithTenantFn, actor: JwtPayload, id: string) {
    return withTenant(async (db) => {
      const existing = await db.room.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Room not found");

      await db.room.update({ where: { id }, data: { isActive: false } });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "ROOM_DELETE",
          entity:   "room",
          entityId: id,
        },
      });
    });
  },

  // Lets the frontend warn about a room conflict the moment a room+date pair
  // is chosen, instead of only finding out after submitting the full form.
  async checkAvailability(withTenant: WithTenantFn, query: CheckAvailabilityQuery) {
    return withTenant(async (db) => {
      const rooms = await db.room.findMany({
        where: {
          isActive: true,
          ...(query.roomId      && { id: query.roomId }),
          ...(query.roomTypeId  && { roomTypeId: query.roomTypeId }),
        },
        select: { id: true, number: true, floor: true, roomTypeId: true },
      });
      if (rooms.length === 0) {
        return { availableRoomIds: [], totalRooms: 0, conflicts: [] };
      }

      const conflictRows = await db.reservationRoom.findMany({
        where: {
          roomId:       { in: rooms.map((r) => r.id) },
          checkInDate:  { lt: new Date(query.checkOutDate) },
          checkOutDate: { gt: new Date(query.checkInDate) },
          reservation: {
            status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] },
            ...(query.excludeReservationId && { id: { not: query.excludeReservationId } }),
          },
        },
        select: {
          roomId: true,
          checkInDate: true,
          checkOutDate: true,
          reservation: { select: { confirmationNumber: true, guest: { select: { fullName: true } } } },
        },
      });

      const conflictByRoomId = new Map(conflictRows.map((c) => [c.roomId, c]));
      const availableRoomIds = rooms.filter((r) => !conflictByRoomId.has(r.id)).map((r) => r.id);
      const conflicts = rooms
        .filter((r) => conflictByRoomId.has(r.id))
        .map((r) => {
          const c = conflictByRoomId.get(r.id)!;
          return {
            roomId:              r.id,
            roomNumber:          r.number,
            guestName:           c.reservation.guest.fullName,
            confirmationNumber:  c.reservation.confirmationNumber,
            checkInDate:         c.checkInDate,
            checkOutDate:        c.checkOutDate,
          };
        });

      return { availableRoomIds, totalRooms: rooms.length, conflicts };
    });
  },
};
