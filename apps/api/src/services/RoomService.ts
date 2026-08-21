import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { acquireSubscriptionQuotaLock, checkRoomLimit } from "../lib/subscription";
import { notifyHotelDataChanged } from "../lib/realtime";
import { queueChannexSync } from "../lib/channexSync";
import type {
  ListRoomsQuery,
  CreateRoomDto,
  UpdateRoomDto,
  ListRoomTypesQuery,
  CreateRoomTypeDto,
  UpdateRoomTypeDto,
  CheckAvailabilityQuery,
  CreateRoomInventoryBlockDto,
  CancelRoomInventoryBlockDto,
  BulkUpdateRoomReadinessDto,
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
          photoUrls:    dto.photoUrls ?? [],
          amenities:    dto.amenities ?? [],
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
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
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
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      // default_rate is the base every rate falls back to, and occupancy and
      // room counts feed availability — any of them moving invalidates the
      // whole published horizon, so this resyncs the full window.
      queueChannexSync({ hotelId: actor.hotelId, reason: "ROOM_TYPE_CHANGE" });
      return result;
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
          include: {
            roomType: true,
            reservationRooms: {
              where: { reservation: { status: "CHECKED_IN" } },
              orderBy: { actualCheckIn: "desc" },
              take: 1,
              select: {
                reservation: {
                  select: {
                    id: true,
                    confirmationNumber: true,
                    checkOutDate: true,
                    guest: { select: { id: true, fullName: true } },
                  },
                },
              },
            },
            inventoryBlocks: {
              where: { cancelledAt: null, endDate: { gt: new Date() } },
              orderBy: { startDate: "asc" },
              take: 1,
            },
          },
          orderBy: [{ floor: "asc" }, { number: "asc" }],
          skip,
          take: query.limit,
        }),
        db.room.count({ where }),
      ])
    );
    return {
      data: items.map(({ reservationRooms, ...room }) => ({
        ...room,
        currentReservation:
          room.status === "OCCUPIED"
            ? reservationRooms[0]?.reservation ?? null
            : null,
      })),
      meta: paginationMeta(total, query.page, query.limit),
    };
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
      await acquireSubscriptionQuotaLock(db, actor.hotelId, "maxRooms");
      const roomCount = await db.room.count({ where: { isActive: true } });
      await checkRoomLimit(actor.hotelId, roomCount);

      const roomType = await db.roomType.findUnique({ where: { id: dto.roomTypeId } });
      if (!roomType) throw new AppError(404, "Room type not found");

      const room = await db.room.create({
        data: {
          hotelId:    actor.hotelId,
          roomTypeId: dto.roomTypeId,
          number:     dto.number,
          floor:      dto.floor,
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
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
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
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },

  async bulkUpdateReadiness(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    dto: BulkUpdateRoomReadinessDto,
  ) {
    const result = await withTenant(async (db) => {
      const roomIds = [...new Set(dto.roomIds)];
      const rooms = await db.room.findMany({
        where: { id: { in: roomIds }, isActive: true },
        select: {
          id: true,
          number: true,
          status: true,
          inventoryBlocks: {
            where: { cancelledAt: null, endDate: { gt: new Date() } },
            take: 1,
            select: { id: true },
          },
        },
      });
      if (rooms.length !== roomIds.length) throw new AppError(404, "One or more selected rooms were not found");

      const unsafe = rooms.filter((room) =>
        !["VACANT_CLEAN", "VACANT_DIRTY"].includes(room.status) || room.inventoryBlocks.length > 0,
      );
      if (unsafe.length > 0) {
        throw new AppError(
          409,
          `Only vacant rooms can be changed in bulk. Remove room${unsafe.length === 1 ? "" : "s"} ${unsafe.map((room) => room.number).join(", ")} from the selection.`,
        );
      }

      await db.room.updateMany({ where: { id: { in: roomIds } }, data: { status: dto.status } });
      await db.auditLog.createMany({
        data: rooms.map((room) => ({
          hotelId: actor.hotelId,
          userId: actor.userId,
          action: "ROOM_READINESS_BULK_UPDATE",
          entity: "room",
          entityId: room.id,
          before: { status: room.status },
          after: { status: dto.status },
        })),
      });
      return { updated: rooms.length, roomIds, status: dto.status };
    });
    notifyHotelDataChanged(actor.hotelId);
    return result;
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
    }).then(() => {
      notifyHotelDataChanged(actor.hotelId);
    });
  },

  // Lets the frontend warn about a room conflict the moment a room+date pair
  // is chosen, instead of only finding out after submitting the full form.
  async checkAvailability(withTenant: WithTenantFn, query: CheckAvailabilityQuery) {
    return withTenant(async (db) => {
      const rooms = await db.room.findMany({
        where: {
          isActive: true,
          status: { notIn: ["OUT_OF_ORDER", "BLOCKED"] },
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

      const inventoryBlockRows = await db.roomInventoryBlock.findMany({
        where: {
          roomId: { in: rooms.map((room) => room.id) },
          cancelledAt: null,
          startDate: { lt: new Date(query.checkOutDate) },
          endDate: { gt: new Date(query.checkInDate) },
        },
        select: { id: true, roomId: true, type: true, startDate: true, endDate: true, reason: true },
      });

      const conflictByRoomId = new Map(conflictRows.map((c) => [c.roomId, c]));
      const blockByRoomId = new Map(inventoryBlockRows.map((block) => [block.roomId, block]));
      const availableRoomIds = rooms
        .filter((room) => !conflictByRoomId.has(room.id) && !blockByRoomId.has(room.id))
        .map((room) => room.id);
      const conflicts = rooms
        .filter((r) => conflictByRoomId.has(r.id) || blockByRoomId.has(r.id))
        .map((r) => {
          const c = conflictByRoomId.get(r.id);
          const block = blockByRoomId.get(r.id);
          if (block) {
            return {
              roomId: r.id,
              roomNumber: r.number,
              conflictType: "INVENTORY_BLOCK" as const,
              inventoryBlockType: block.type,
              reason: block.reason,
              checkInDate: block.startDate,
              checkOutDate: block.endDate,
              guestName: null,
              confirmationNumber: null,
            };
          }
          return {
            roomId:              r.id,
            roomNumber:          r.number,
            conflictType:        "RESERVATION" as const,
            inventoryBlockType:  null,
            reason:              null,
            guestName:           c!.reservation.guest.fullName,
            confirmationNumber:  c!.reservation.confirmationNumber,
            checkInDate:         c!.checkInDate,
            checkOutDate:        c!.checkOutDate,
          };
        });

      return { availableRoomIds, totalRooms: rooms.length, conflicts };
    });
  },

  async listInventoryBlocks(withTenant: WithTenantFn, roomId: string) {
    return withTenant(async (db) => {
      const room = await db.room.findUnique({ where: { id: roomId }, select: { id: true } });
      if (!room) throw new AppError(404, "Room not found");
      return db.roomInventoryBlock.findMany({
        where: { roomId },
        orderBy: [{ cancelledAt: "asc" }, { startDate: "desc" }],
      });
    });
  },

  async createInventoryBlock(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    roomId: string,
    dto: CreateRoomInventoryBlockDto,
  ) {
    const result = await withTenant(async (db) => {
      const room = await db.room.findUnique({ where: { id: roomId }, select: { id: true, number: true, isActive: true } });
      if (!room || !room.isActive) throw new AppError(404, "Room not found");

      const startDate = new Date(dto.startDate);
      const endDate = new Date(dto.endDate);
      const reservationConflict = await db.reservationRoom.findFirst({
        where: {
          roomId,
          checkInDate: { lt: endDate },
          checkOutDate: { gt: startDate },
          reservation: { status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] } },
        },
        include: {
          room: { select: { number: true } },
          reservation: { select: { confirmationNumber: true, guest: { select: { fullName: true } } } },
        },
      });
      if (reservationConflict) {
        throw new AppError(409, `Room ${room.number} already has reservation ${reservationConflict.reservation.confirmationNumber} during these dates. Move or update that reservation before removing the room from inventory.`);
      }

      const existingBlock = await db.roomInventoryBlock.findFirst({
        where: { roomId, cancelledAt: null, startDate: { lt: endDate }, endDate: { gt: startDate } },
      });
      if (existingBlock) throw new AppError(409, `Room ${room.number} already has an inventory block overlapping these dates.`);

      const block = await db.roomInventoryBlock.create({
        data: {
          hotelId: actor.hotelId,
          roomId,
          type: dto.type,
          startDate,
          endDate,
          reason: dto.reason,
          notes: dto.notes,
          createdBy: actor.userId,
        },
      });
      await db.auditLog.create({
        data: {
          hotelId: actor.hotelId,
          userId: actor.userId,
          action: "ROOM_INVENTORY_BLOCK_CREATE",
          entity: "room_inventory_block",
          entityId: block.id,
          after: JSON.parse(JSON.stringify({ roomId, roomNumber: room.number, ...dto })),
        },
      });
      return block;
    });
    notifyHotelDataChanged(actor.hotelId);
    queueChannexSync({ hotelId: actor.hotelId, reason: "ROOM_INVENTORY_BLOCK_CHANGE" });
    return result;
  },

  async cancelInventoryBlock(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    roomId: string,
    blockId: string,
    dto: CancelRoomInventoryBlockDto,
  ) {
    const result = await withTenant(async (db) => {
      const block = await db.roomInventoryBlock.findFirst({ where: { id: blockId, roomId } });
      if (!block) throw new AppError(404, "Inventory block not found");
      if (block.maintenanceTicketId) {
        throw new AppError(409, "This inventory block is managed by a maintenance ticket. Resolve or edit the ticket instead.");
      }
      if (block.cancelledAt) throw new AppError(409, "This inventory block is already cancelled");
      const cancelled = await db.roomInventoryBlock.update({
        where: { id: blockId },
        data: { cancelledAt: new Date(), cancelledBy: actor.userId, cancelReason: dto.reason },
      });
      await db.auditLog.create({
        data: {
          hotelId: actor.hotelId,
          userId: actor.userId,
          action: "ROOM_INVENTORY_BLOCK_CANCEL",
          entity: "room_inventory_block",
          entityId: blockId,
          before: JSON.parse(JSON.stringify(block)),
          after: JSON.parse(JSON.stringify({ cancelReason: dto.reason })),
        },
      });
      return cancelled;
    });
    notifyHotelDataChanged(actor.hotelId);
    queueChannexSync({ hotelId: actor.hotelId, reason: "ROOM_INVENTORY_BLOCK_CHANGE" });
    return result;
  },
};
