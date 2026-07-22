import type { TenantTx } from "@pms/db";
import { MaintenanceStatus, RoomStatus, UserRole } from "@pms/db";
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
import { paginationMeta } from "../utils/pagination";

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
          include: {
            room:       { select: { id: true, number: true, floor: true } },
            assignedTo: { select: { id: true, name: true } },
          },
          orderBy: [{ createdAt: "desc" }],
          skip,
          take: query.limit,
        }),
        db.maintenanceTicket.count({ where }),
      ])
    );

    return {
      data: items.map(mapTicket),
      meta: paginationMeta(total, query.page, query.limit),
    };
  },

  async getTicket(withTenant: WithTenantFn, ticketId: string) {
    const ticket = await withTenant((db) =>
      db.maintenanceTicket.findUnique({
        where: { id: ticketId },
        include: {
          room:       { select: { id: true, number: true, floor: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      })
    );
    if (!ticket) throw new AppError(404, "Maintenance ticket not found");
    return mapTicket(ticket);
  },

  async createTicket(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateTicketDto) {
    const ticket = await withTenant(async (db) => {
      let room: { id: string; status: RoomStatus } | null = null;
      if (dto.roomId) {
        room = await db.room.findUnique({ where: { id: dto.roomId }, select: { id: true, status: true } });
        if (!room) throw new AppError(404, "Room not found");
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
          scheduledEndDate: dto.scheduledEndDate ? new Date(dto.scheduledEndDate) : null,
          photoUrls:       dto.photoUrls ?? [],
        },
        include: {
          room:       { select: { id: true, number: true, floor: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      if (
        room &&
        (room.status === RoomStatus.VACANT_CLEAN || room.status === RoomStatus.VACANT_DIRTY)
      ) {
        await db.room.update({
          where: { id: room.id },
          data:  { status: RoomStatus.UNDER_MAINTENANCE },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "MAINTENANCE_TICKET_CREATE",
          entity:   "maintenance_ticket",
          entityId: created.id,
          after:    JSON.parse(JSON.stringify({ title: dto.title, category: dto.category, priority: dto.priority })),
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

      return created;
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
    return mapTicket(ticket);
  },

  async updateTicketStatus(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    ticketId: string,
    dto: UpdateTicketStatusDto,
  ) {
    const newStatus = dto.status as MaintenanceStatus;

    const ticket = await withTenant(async (db) => {
      const existing = await db.maintenanceTicket.findUnique({ where: { id: ticketId } });
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
        include: {
          room:       { select: { id: true, number: true, floor: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      if (
        (newStatus === MaintenanceStatus.RESOLVED || newStatus === MaintenanceStatus.CLOSED) &&
        existing.roomId
      ) {
        const room = await db.room.findUnique({ where: { id: existing.roomId }, select: { id: true, status: true } });

        if (room?.status === RoomStatus.UNDER_MAINTENANCE) {
          const otherOpenTickets = await db.maintenanceTicket.count({
            where: {
              roomId: existing.roomId,
              status: { in: OPEN_STATUSES },
              id:     { not: ticketId },
            },
          });

          if (otherOpenTickets === 0) {
            await db.room.update({
              where: { id: room.id },
              data:  { status: RoomStatus.VACANT_DIRTY },
            });

            await db.housekeepingTask.create({
              data: {
                hotelId:       actor.hotelId,
                roomId:        room.id,
                taskType:      "MAINTENANCE_CLEAN",
                priority:      2, // NORMAL
                scheduledDate: now,
                notes:         `Post-maintenance clean — ticket ${existing.ticketNumber}`,
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

      return updated;
    });

    notifyHotelDataChanged(actor.hotelId);
    return mapTicket(ticket);
  },

  async updateTicket(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    ticketId: string,
    dto: UpdateTicketDto,
  ) {
    const ticket = await withTenant(async (db) => {
      const existing = await db.maintenanceTicket.findUnique({ where: { id: ticketId } });
      if (!existing) throw new AppError(404, "Maintenance ticket not found");

      const updated = await db.maintenanceTicket.update({
        where: { id: ticketId },
        data: {
          ...(dto.assignedToId  !== undefined && { assignedToId:  dto.assignedToId }),
          ...(dto.priority      !== undefined && { priority:      dto.priority }),
          ...(dto.category      !== undefined && { category:      dto.category }),
          ...(dto.title         !== undefined && { title:         dto.title }),
          ...(dto.description   !== undefined && { description:   dto.description }),
          ...(dto.scheduledFor     !== undefined && { scheduledFor:    dto.scheduledFor ? new Date(dto.scheduledFor) : null }),
          ...(dto.scheduledEndDate !== undefined && { scheduledEndDate: dto.scheduledEndDate ? new Date(dto.scheduledEndDate) : null }),
          ...(dto.estimatedCost !== undefined && { estimatedCost: dto.estimatedCost }),
          ...(dto.actualCost    !== undefined && { actualCost:    dto.actualCost }),
        },
        include: {
          room:       { select: { id: true, number: true, floor: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

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

      return updated;
    });

    notifyHotelDataChanged(actor.hotelId);
    return mapTicket(ticket);
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
