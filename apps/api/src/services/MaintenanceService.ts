import type { TenantTx } from "@pms/db";
import { MaintenanceStatus, UserRole } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { NotificationService } from "./NotificationService";
import { notifyHotelDataChanged } from "../lib/realtime";
import type {
  ListTicketsQuery,
  CreateTicketDto,
  UpdateTicketDto,
  UpdateTicketStatusDto,
} from "../schemas/maintenance";
import { AppError } from "../utils/AppError";
import { hydrateAssignee, hydrateAssignees } from "../lib/userNames";
import { paginationMeta } from "../utils/pagination";
import { queueChannexSync } from "../lib/channexSync";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

const ALLOWED_TRANSITIONS: Record<MaintenanceStatus, MaintenanceStatus[]> = {
  [MaintenanceStatus.OPEN]:           [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED],
  [MaintenanceStatus.IN_PROGRESS]:    [MaintenanceStatus.AWAITING_PARTS, MaintenanceStatus.RESOLVED, MaintenanceStatus.OPEN],
  [MaintenanceStatus.AWAITING_PARTS]: [MaintenanceStatus.IN_PROGRESS, MaintenanceStatus.RESOLVED],
  [MaintenanceStatus.RESOLVED]:       [MaintenanceStatus.CLOSED, MaintenanceStatus.IN_PROGRESS],
  [MaintenanceStatus.CLOSED]:         [],
};

// Overdue thresholds for tickets still open/in-progress/awaiting parts
const OVERDUE_HOURS: Record<string, number> = {
  URGENT: 2,
  HIGH:   8,
};

const OPEN_STATUSES: MaintenanceStatus[] = [
  MaintenanceStatus.OPEN,
  MaintenanceStatus.IN_PROGRESS,
  MaintenanceStatus.AWAITING_PARTS,
];

function isOverdue(createdAt: Date, priority: string, status: MaintenanceStatus): boolean {
  if (!OPEN_STATUSES.includes(status)) return false;
  const threshold = OVERDUE_HOURS[priority];
  if (!threshold) return false;
  const hoursOpen = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  return hoursOpen > threshold;
}

function mapTicket<T extends { createdAt: Date; priority: string; status: MaintenanceStatus }>(
  ticket: T,
): T & { isOverdue: boolean } {
  return { ...ticket, isOverdue: isOverdue(ticket.createdAt, ticket.priority, ticket.status) };
}

async function assertInventoryDatesAvailable(
  db: TenantTx,
  roomId: string,
  startDate: Date,
  endDate: Date,
  excludeBlockId?: string,
) {
  const reservation = await db.reservationRoom.findFirst({
    where: {
      roomId,
      checkInDate: { lt: endDate },
      checkOutDate: { gt: startDate },
      reservation: { status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] } },
    },
    select: {
      reservation: { select: { confirmationNumber: true, guest: { select: { fullName: true } } } },
    },
  });
  if (reservation) {
    throw new AppError(
      409,
      `This room is reserved for ${reservation.reservation.guest.fullName} (${reservation.reservation.confirmationNumber}) during those dates. Move or update that reservation first.`,
    );
  }

  const overlappingBlock = await db.roomInventoryBlock.findFirst({
    where: {
      roomId,
      cancelledAt: null,
      startDate: { lt: endDate },
      endDate: { gt: startDate },
      ...(excludeBlockId && { id: { not: excludeBlockId } }),
    },
  });
  if (overlappingBlock) {
    throw new AppError(409, "This room already has an inventory block overlapping those dates.");
  }
}

// `assignedTo` always comes back null here — the RLS policy on `users` is
// self-access only, so a tenant client cannot see a colleague's row. It is
// still selected to hold the response shape; hydrateAssignee fills the name in.
const ticketInclude = {
  room: { select: { id: true, number: true, floor: true } },
  assignedTo: { select: { id: true, name: true } },
  inventoryBlock: true,
} as const;

export function computeMaintenanceSummary(
  tickets: { createdAt: Date; priority: string; status: MaintenanceStatus }[],
) {
  const open    = tickets.filter((t) => OPEN_STATUSES.includes(t.status));
  const urgent  = open.filter((t) => t.priority === "URGENT").length;
  const overdue = open.filter((t) => isOverdue(t.createdAt, t.priority, t.status)).length;

  return { open: open.length, urgent, overdue };
}

export const MaintenanceService = {
  async listTickets(withTenant: WithTenantFn, query: ListTicketsQuery) {
    const skip = (query.page - 1) * query.limit;

    const where = {
      ...(query.status       && { status:       query.status as MaintenanceStatus }),
      ...(query.priority     && { priority:     query.priority }),
      ...(query.category     && { category:     query.category }),
      ...(query.roomId       && { roomId:       query.roomId }),
      ...(query.assignedToId && { assignedToId: query.assignedToId }),
    };

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.maintenanceTicket.findMany({
          where,
          include: ticketInclude,
          orderBy: [{ createdAt: "desc" }],
          skip,
          take: query.limit,
        }),
        db.maintenanceTicket.count({ where }),
      ])
    );

    return {
      data: await hydrateAssignees(items.map(mapTicket)),
      meta: paginationMeta(total, query.page, query.limit),
    };
  },

  async getTicket(withTenant: WithTenantFn, ticketId: string) {
    const ticket = await withTenant((db) =>
      db.maintenanceTicket.findUnique({
        where: { id: ticketId },
        include: ticketInclude,
      })
    );
    if (!ticket) throw new AppError(404, "Maintenance ticket not found");
    return hydrateAssignee(mapTicket(ticket));
  },

  async createTicket(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateTicketDto) {
    const ticket = await withTenant(async (db) => {
      let room: { id: string; number: string } | null = null;
      if (dto.roomId) {
        room = await db.room.findUnique({ where: { id: dto.roomId }, select: { id: true, number: true } });
        if (!room) throw new AppError(404, "Room not found");
      }

      const unavailableFrom = dto.roomUnavailable ? new Date(dto.unavailableFrom!) : null;
      const sellableFrom = dto.roomUnavailable ? new Date(dto.sellableFrom!) : null;
      if (room && unavailableFrom && sellableFrom) {
        await assertInventoryDatesAvailable(db, room.id, unavailableFrom, sellableFrom);
      }

      const created = await db.maintenanceTicket.create({
        data: {
          hotelId:      actor.hotelId,
          roomId:       dto.roomId ?? null,
          reportedById: actor.userId,
          ticketNumber: "",
          title:        dto.title,
          description:  dto.description ?? null,
          category:     dto.category,
          priority:     dto.priority,
          assignedToId: dto.assignedToId ?? null,
          scheduledFor:    dto.scheduledFor ? new Date(dto.scheduledFor) : null,
          scheduledEndDate: sellableFrom ?? (dto.scheduledEndDate ? new Date(dto.scheduledEndDate) : null),
          photoUrls:       dto.photoUrls ?? [],
        },
        include: ticketInclude,
      });

      if (room && unavailableFrom && sellableFrom) {
        await db.roomInventoryBlock.create({
          data: {
            hotelId: actor.hotelId,
            roomId: room.id,
            maintenanceTicketId: created.id,
            type: "OUT_OF_SERVICE",
            startDate: unavailableFrom,
            endDate: sellableFrom,
            reason: `Maintenance: ${dto.title}`,
            notes: dto.description,
            createdBy: actor.userId,
          },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "MAINTENANCE_TICKET_CREATE",
          entity:   "maintenance_ticket",
          entityId: created.id,
          after:    JSON.parse(JSON.stringify({
            title: dto.title,
            category: dto.category,
            priority: dto.priority,
            roomUnavailable: dto.roomUnavailable,
            unavailableFrom: dto.unavailableFrom,
            sellableFrom: dto.sellableFrom,
          })),
        },
      });

      if (dto.priority === "HIGH") {
        try {
          await NotificationService.createNotification(db, actor.hotelId, {
            title:      "Maintenance Ticket",
            body:       `${created.room ? `Room ${created.room.number}: ` : ""}${dto.title} — ${dto.priority} priority`,
            type:       "MAINTENANCE",
            entityId:   created.id,
            entityType: "maintenance_ticket",
          });
        } catch { /* notifications are non-critical */ }
      }

      return db.maintenanceTicket.findUniqueOrThrow({ where: { id: created.id }, include: ticketInclude });
    });

    if (dto.priority === "URGENT") {
      try {
        await NotificationService.createNotificationsForRoles(
          actor.hotelId,
          [UserRole.OWNER, UserRole.MANAGER, UserRole.MAINTENANCE],
          {
            title:      "Urgent Maintenance",
            body:       `${ticket.room ? `Room ${ticket.room.number}: ` : ""}${dto.title}`,
            type:       "MAINTENANCE_URGENT",
            entityId:   ticket.id,
            entityType: "maintenance_ticket",
          },
          ticket.assignedToId ? [ticket.assignedToId] : [],
        );
      } catch (err) {
        console.error("Failed to create urgent maintenance notification:", err);
      }
    }

    notifyHotelDataChanged(actor.hotelId);
    if (dto.roomUnavailable) {
      queueChannexSync({ hotelId: actor.hotelId, reason: "ROOM_INVENTORY_BLOCK_CHANGE", dateFrom: dto.unavailableFrom, dateTo: dto.sellableFrom });
    }
    return hydrateAssignee(mapTicket(ticket));
  },

  async updateTicketStatus(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    ticketId: string,
    dto: UpdateTicketStatusDto,
  ) {
    const newStatus = dto.status as MaintenanceStatus;

    const ticket = await withTenant(async (db) => {
      const existing = await db.maintenanceTicket.findUnique({ where: { id: ticketId }, include: { inventoryBlock: true } });
      if (!existing) throw new AppError(404, "Maintenance ticket not found");

      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed.includes(newStatus)) {
        throw new AppError(400, `Cannot transition from ${existing.status} to ${newStatus}`);
      }

      const now = new Date();
      const updated = await db.maintenanceTicket.update({
        where: { id: ticketId },
        data: {
          status:           newStatus,
          ...(dto.resolutionNotes !== undefined && { resolutionNotes: dto.resolutionNotes }),
          ...(newStatus === MaintenanceStatus.RESOLVED && { resolvedAt: now }),
          ...(newStatus !== MaintenanceStatus.RESOLVED && newStatus !== MaintenanceStatus.CLOSED && { resolvedAt: null }),
        },
        include: ticketInclude,
      });

      if (
        (newStatus === MaintenanceStatus.RESOLVED || newStatus === MaintenanceStatus.CLOSED) &&
        existing.roomId
      ) {
        if (existing.inventoryBlock) {
          const blockWasActive = !existing.inventoryBlock.cancelledAt && existing.inventoryBlock.endDate > now;
          if (blockWasActive) {
            await db.roomInventoryBlock.update({
              where: { id: existing.inventoryBlock.id },
              data: {
                cancelledAt: now,
                cancelledBy: actor.userId,
                cancelReason: `Maintenance resolved: ${dto.resolutionNotes ?? "Work completed"}`,
              },
            });
          }

          if (blockWasActive) {
            await db.housekeepingTask.create({
              data: {
                hotelId: actor.hotelId,
                roomId: existing.roomId,
                taskType: "MAINTENANCE_CLEAN",
                priority: 2,
                scheduledDate: now,
                notes: `Post-maintenance clean — ticket ${existing.ticketNumber}`,
              },
            });
          }
        }
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "MAINTENANCE_TICKET_STATUS",
          entity:   "maintenance_ticket",
          entityId: ticketId,
          before:   JSON.parse(JSON.stringify({ status: existing.status })),
          after:    JSON.parse(JSON.stringify({ status: newStatus })),
        },
      });

      return db.maintenanceTicket.findUniqueOrThrow({ where: { id: updated.id }, include: ticketInclude });
    });

    notifyHotelDataChanged(actor.hotelId);
    if (ticket.inventoryBlock) {
      queueChannexSync({ hotelId: actor.hotelId, reason: "ROOM_INVENTORY_BLOCK_CHANGE" });
    }
    return hydrateAssignee(mapTicket(ticket));
  },

  async updateTicket(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    ticketId: string,
    dto: UpdateTicketDto,
  ) {
    const ticket = await withTenant(async (db) => {
      const existing = await db.maintenanceTicket.findUnique({ where: { id: ticketId }, include: { inventoryBlock: true } });
      if (!existing) throw new AppError(404, "Maintenance ticket not found");

      if (dto.roomUnavailable === true && !existing.roomId) {
        throw new AppError(400, "A room is required before this ticket can remove inventory from sale.");
      }
      if (
        dto.roomUnavailable === true &&
        (existing.status === MaintenanceStatus.RESOLVED || existing.status === MaintenanceStatus.CLOSED)
      ) {
        throw new AppError(409, "Reopen the maintenance ticket before removing this room from sale.");
      }

      const wantsInventoryChange = dto.roomUnavailable !== undefined;
      const unavailableFrom = dto.roomUnavailable === true ? new Date(dto.unavailableFrom!) : null;
      const sellableFrom = dto.roomUnavailable === true ? new Date(dto.sellableFrom!) : null;
      if (existing.roomId && unavailableFrom && sellableFrom) {
        await assertInventoryDatesAvailable(db, existing.roomId, unavailableFrom, sellableFrom, existing.inventoryBlock?.id);
      }

      const updated = await db.maintenanceTicket.update({
        where: { id: ticketId },
        data: {
          ...(dto.assignedToId  !== undefined && { assignedToId:  dto.assignedToId }),
          ...(dto.priority      !== undefined && { priority:      dto.priority }),
          ...(dto.category      !== undefined && { category:      dto.category }),
          ...(dto.title         !== undefined && { title:         dto.title }),
          ...(dto.description   !== undefined && { description:   dto.description }),
          ...(dto.scheduledFor     !== undefined && { scheduledFor:    dto.scheduledFor ? new Date(dto.scheduledFor) : null }),
          ...(dto.roomUnavailable === true
            ? { scheduledEndDate: sellableFrom }
            : dto.roomUnavailable === false
              ? { scheduledEndDate: null }
            : dto.scheduledEndDate !== undefined
              ? { scheduledEndDate: dto.scheduledEndDate ? new Date(dto.scheduledEndDate) : null }
              : {}),
          ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
          ...(dto.actualCost    !== undefined && { actualCost:    dto.actualCost }),
        },
        include: ticketInclude,
      });

      if (wantsInventoryChange && existing.inventoryBlock) {
        if (dto.roomUnavailable === false) {
          if (!existing.inventoryBlock.cancelledAt) {
            await db.roomInventoryBlock.update({
              where: { id: existing.inventoryBlock.id },
              data: { cancelledAt: new Date(), cancelledBy: actor.userId, cancelReason: "Maintenance no longer removes room from sale" },
            });
          }
        } else {
          await db.roomInventoryBlock.update({
            where: { id: existing.inventoryBlock.id },
            data: {
              startDate: unavailableFrom!,
              endDate: sellableFrom!,
              reason: `Maintenance: ${dto.title ?? existing.title}`,
              notes: dto.description !== undefined ? dto.description : existing.description,
              cancelledAt: null,
              cancelledBy: null,
              cancelReason: null,
            },
          });
        }
      } else if (dto.roomUnavailable === true && existing.roomId) {
        await db.roomInventoryBlock.create({
          data: {
            hotelId: actor.hotelId,
            roomId: existing.roomId,
            maintenanceTicketId: existing.id,
            type: "OUT_OF_SERVICE",
            startDate: unavailableFrom!,
            endDate: sellableFrom!,
            reason: `Maintenance: ${dto.title ?? existing.title}`,
            notes: dto.description !== undefined ? dto.description : existing.description,
            createdBy: actor.userId,
          },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "MAINTENANCE_TICKET_UPDATE",
          entity:   "maintenance_ticket",
          entityId: ticketId,
          after:    JSON.parse(JSON.stringify(dto)),
        },
      });

      return db.maintenanceTicket.findUniqueOrThrow({ where: { id: updated.id }, include: ticketInclude });
    });

    notifyHotelDataChanged(actor.hotelId);
    if (dto.roomUnavailable !== undefined) {
      queueChannexSync({ hotelId: actor.hotelId, reason: "ROOM_INVENTORY_BLOCK_CHANGE", dateFrom: dto.unavailableFrom, dateTo: dto.sellableFrom });
    }
    return hydrateAssignee(mapTicket(ticket));
  },

  async summary(withTenant: WithTenantFn) {
    const openTickets = await withTenant((db) =>
      db.maintenanceTicket.findMany({
        where:  { status: { in: OPEN_STATUSES } },
        select: { id: true, createdAt: true, priority: true, status: true },
      })
    );

    return computeMaintenanceSummary(openTickets);
  },
};
