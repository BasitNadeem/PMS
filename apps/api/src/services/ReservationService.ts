import type { TenantTx } from "@pms/db";
import { ReservationStatus, FolioItemType, RoomStatus, MaintenanceStatus, Prisma } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { recalculateFolioTotals } from "../utils/folioTotals";
import { recalculateGuestStats } from "../utils/guestStats";
import { createLedgerEntryFromPayment } from "./CashBookService";
import type {
  ListReservationsQuery,
  CreateReservationDto,
  UpdateReservationDto,
} from "../schemas/reservations";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { NotificationService } from "./NotificationService";
import { notifyHousekeepingStaff } from "./HousekeepingService";
import { notifyHotelDataChanged } from "../lib/realtime";
import { enqueueReservationEmail } from "../lib/reservationEmails";
import {
  calculateAccommodationCharges,
  parseAccommodationTaxBreakdown,
} from "../lib/accommodationCharges";
import { postStayFeeIfNeeded } from "../lib/stayFees";

function shortDate(d: Date) {
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

interface RoomConflictRow {
  checkInDate: Date;
  checkOutDate: Date;
  room: { number: string };
  reservation: { confirmationNumber: string; guest: { fullName: string } };
}

// Names who has the room and for which dates, so the "wise prompt" the
// frontend shows actually explains the conflict instead of a bare 409.
export function formatRoomConflictMessage(conflict: RoomConflictRow): string {
  const { number } = conflict.room;
  const { fullName } = conflict.reservation.guest;
  const ref = conflict.reservation.confirmationNumber;
  return (
    `Room ${number} is already booked for ${fullName} from ${shortDate(conflict.checkInDate)} ` +
    `to ${shortDate(conflict.checkOutDate)}${ref ? ` (Confirmation #${ref})` : ""}. ` +
    `Please choose a different room or date.`
  );
}

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

type SortDir = "asc" | "desc";

function buildReservationOrderBy(sortBy: string, sortDir: SortDir) {
  const dir = sortDir === "desc" ? "desc" as const : "asc" as const;
  const tiebreak = { createdAt: "desc" as const };
  if (sortBy === "checkOut") return [{ checkOutDate: dir }, tiebreak];
  if (sortBy === "created")  return [{ createdAt: dir }];
  if (sortBy === "status")   return [{ status: dir }, tiebreak];
  return [{ checkInDate: dir }, tiebreak];
}

const ALLOWED_TRANSITIONS: Partial<Record<ReservationStatus, ReservationStatus[]>> = {
  ENQUIRY:    ["CONFIRMED", "CANCELLED"],
  CONFIRMED:  ["CHECKED_IN", "CANCELLED", "NO_SHOW"],
  CHECKED_IN: ["CHECKED_OUT"],
};

export const ReservationService = {
  async list(withTenant: WithTenantFn, query: ListReservationsQuery) {
    const skip   = (query.page - 1) * query.limit;
    const search = query.search?.trim();

    const where = {
      ...(query.statuses?.length ? { status: { in: query.statuses } } : query.status ? { status: query.status } : {}),
      ...(query.checkInDate  && { checkInDate:  { gte: new Date(query.checkInDate) } }),
      ...(query.checkOutDate && { checkOutDate: { lte: new Date(query.checkOutDate) } }),
      ...(search && {
        OR: [
          { guest:              { fullName:           { contains: search, mode: "insensitive" as const } } },
          { confirmationNumber: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.reservation.findMany({
          where,
          include: {
            guest: { select: { id: true, fullName: true, phone: true } },
            rooms: {
              include: {
                room:     { select: { number: true, floor: true } },
                roomType: { select: { name: true, typeName: true } },
              },
            },
            group: { select: { groupRef: true, payerType: true, name: true } },
          },
          orderBy: buildReservationOrderBy(query.sortBy, query.sortDir),
          skip,
          take: query.limit,
        }),
        db.reservation.count({ where }),
      ])
    );

    return { data: items, meta: paginationMeta(total, query.page, query.limit) };
  },

  async counts(withTenant: WithTenantFn) {
    // Fetch all reservations but only the status + groupId fields so we can
    // deduplicate group bookings — a group of N rooms should count as 1, not N.
    const rows = await withTenant((db) =>
      db.reservation.findMany({ select: { status: true, groupId: true } })
    );

    const seenGroups = new Set<string>();
    const result: Partial<Record<ReservationStatus, number>> = {};

    for (const row of rows) {
      if (row.groupId) {
        // Only count the first reservation seen for each group+status pair
        const key = `${row.groupId}|${row.status}`;
        if (seenGroups.has(key)) continue;
        seenGroups.add(key);
      }
      result[row.status] = (result[row.status] ?? 0) + 1;
    }

    return result;
  },

  async get(withTenant: WithTenantFn, id: string) {
    const reservation = await withTenant((db) =>
      db.reservation.findUnique({
        where: { id },
        include: {
          guest: {
            select: {
              id: true, fullName: true, firstName: true, lastName: true,
              phone: true, email: true, documentType: true,
              documentNumber: true, nationality: true,
            },
          },
          rooms: {
            include: {
              room:     { select: { id: true, number: true, floor: true, status: true } },
              roomType: { select: { id: true, name: true, typeName: true, maxOccupancy: true } },
            },
          },
          folio: {
            select: {
              id: true, folioNumber: true, chargesTotal: true,
              paymentsTotal: true, balanceDue: true, isOpen: true,
            },
          },
        },
      })
    );
    if (!reservation) throw new AppError(404, "Reservation not found");
    return reservation;
  },

  async create(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateReservationDto) {
    const { reservation, advancePayment } = await withTenant(async (db) => {
      const conflict = await db.reservationRoom.findFirst({
        where: {
          roomId:      dto.roomId,
          checkInDate:  { lt: new Date(dto.checkOutDate) },
          checkOutDate: { gt: new Date(dto.checkInDate) },
          reservation:  { status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] } },
        },
        include: {
          room:        { select: { number: true } },
          reservation: { select: { confirmationNumber: true, guest: { select: { fullName: true } } } },
        },
      });
      if (conflict) {
        throw new AppError(409, formatRoomConflictMessage(conflict));
      }

      const room = await db.room.findUnique({ where: { id: dto.roomId }, select: { status: true, number: true } });
      if (!room) throw new AppError(404, "Room not found");
      const permanentlyBlocked: RoomStatus[] = [RoomStatus.OUT_OF_ORDER, RoomStatus.BLOCKED];
      if (permanentlyBlocked.includes(room.status)) {
        throw new AppError(409, `Room ${room.number} is currently ${room.status.toLowerCase().replace(/_/g, " ")} and cannot be reserved`);
      }

      // Block if an open maintenance ticket covers the check-in date.
      const maintenanceConflict = await db.maintenanceTicket.findFirst({
        where: {
          roomId:          dto.roomId,
          status:          { notIn: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] },
          scheduledEndDate: { not: null, gte: new Date(dto.checkInDate) },
        },
        select: { scheduledEndDate: true },
      });
      if (maintenanceConflict) {
        const endStr = maintenanceConflict.scheduledEndDate!.toISOString().slice(0, 10);
        throw new AppError(409, `Room ${room.number} is under maintenance until ${endStr}`);
      }

      const nights = Math.ceil(
        (new Date(dto.checkOutDate).getTime() - new Date(dto.checkInDate).getTime()) /
        (1000 * 60 * 60 * 24)
      );
      const hotel = await db.hotel.findUniqueOrThrow({
        where: { id: actor.hotelId },
        select: { settings: true },
      });
      const charges = calculateAccommodationCharges(
        dto.ratePerNight * nights,
        (hotel.settings ?? {}) as Record<string, unknown>,
      );
      const totalAmount = charges.totalAmount;
      const advancePaid = dto.advancePayment ?? 0;
      if (advancePaid > totalAmount) {
        throw new AppError(400, "Advance payment cannot exceed the reservation total");
      }
      const balanceDue = totalAmount - advancePaid;

      // Auto-inherit VIP status from the guest's profile unless explicitly overridden.
      let isVip = dto.isVip;
      if (isVip === undefined) {
        const guest = await db.guest.findUnique({ where: { id: dto.guestId }, select: { vipLevel: true } });
        isVip = (guest?.vipLevel ?? 0) > 0;
      }

      const reservation = await db.reservation.create({
        data: {
          hotelId:            actor.hotelId,
          guestId:            dto.guestId,
          confirmationNumber: "",
          status:             "CONFIRMED",
          checkInDate:        new Date(dto.checkInDate),
          checkOutDate:       new Date(dto.checkOutDate),
          adults:             dto.adults,
          children:           dto.children,
          source:             dto.source,
          specialRequests:    dto.specialRequests,
          quotedRate:         dto.ratePerNight,
          subtotalAmount:     charges.subtotalAmount,
          taxAmount:          charges.taxAmount,
          taxInclusive:       charges.taxInclusive,
          taxBreakdown:       charges.taxBreakdown as unknown as Prisma.InputJsonValue,
          totalAmount,
          advancePaid,
          balanceDue,
          isVip,
          rooms: {
            create: {
              roomId:       dto.roomId,
              roomTypeId:   dto.roomTypeId,
              ratePerNight: dto.ratePerNight,
              checkInDate:  new Date(dto.checkInDate),
              checkOutDate: new Date(dto.checkOutDate),
            },
          },
        },
        include: {
          guest: { select: { id: true, fullName: true, phone: true } },
          rooms: { include: { room: { select: { number: true } }, roomType: { select: { name: true, typeName: true } } } },
        },
      });

      // Folio is NOT created here — it is created at check-in.
      // Advance payments are stored against the reservation (folioId: null)
      // and linked to the folio when it is created at check-in.
      let advancePayment: { id: string; amount: number; method: string } | null = null;
      if (advancePaid > 0) {
        advancePayment = await db.payment.create({
          data: {
            hotelId:       actor.hotelId,
            folioId:       null,
            reservationId: reservation.id,
            method:        dto.advancePaymentMethod ?? "CASH",
            status:        "COMPLETED",
            amount:        advancePaid,
            postedBy:      actor.userId,
            notes:         "Advance payment collected at booking",
          },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "RESERVATION_CREATE",
          entity:   "reservation",
          entityId: reservation.id,
          after:    JSON.parse(JSON.stringify({ source: dto.source, totalAmount, advancePaid })),
        },
      });

      try {
        const roomNum = reservation.rooms[0]?.room.number ?? "?";
        await NotificationService.createNotification(db, actor.hotelId, {
          title:      "New Reservation",
          body:       `${reservation.guest.fullName} — Room ${roomNum} · ${shortDate(reservation.checkInDate)} to ${shortDate(reservation.checkOutDate)}`,
          type:       "NEW_BOOKING",
          entityId:   reservation.id,
          entityType: "reservation",
        });
      } catch { /* notifications are non-critical */ }

      return { reservation, advancePayment };
    });

    if (advancePayment) {
      createLedgerEntryFromPayment(
        actor.hotelId,
        { id: advancePayment.id, amount: advancePayment.amount, method: advancePayment.method, reservationId: reservation.id },
        actor.userId,
      ).catch(() => { /* already logged inside */ });
    }

    try {
      await enqueueReservationEmail("CONFIRMED", [reservation.id], actor.hotelId);
    } catch (err) {
      console.error("Failed to enqueue staff-created reservation confirmation email:", err);
    }

    notifyHotelDataChanged(actor.hotelId);
    return reservation;
  },

  async updateStatus(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    id: string,
    newStatus: ReservationStatus,
  ) {
    let checkoutCleanRoomNumber: string | null = null;

    // A late fee must exist on the folio before the balance guard below runs.
    // This preflight is deliberately a separate committed tenant transaction:
    // if it adds a fee, checkout is blocked until staff settle that new balance.
    if (newStatus === "CHECKED_OUT") {
      await withTenant(async (db) => {
        const reservation = await db.reservation.findUnique({
          where: { id },
          include: { folio: { select: { id: true, isOpen: true } } },
        });
        if (!reservation || reservation.status !== "CHECKED_IN") return;

        let folio = reservation.folio;
        if (!folio && reservation.groupId) {
          const master = await db.reservation.findFirst({
            where: { groupId: reservation.groupId, folio: { isNot: null } },
            include: { folio: { select: { id: true, isOpen: true } } },
          });
          folio = master?.folio ?? null;
        }
        if (!folio?.isOpen) return;

        const hotel = await db.hotel.findUniqueOrThrow({
          where: { id: actor.hotelId },
          select: { settings: true },
        });
        await postStayFeeIfNeeded(db, {
          hotelId: actor.hotelId,
          reservationId: id,
          folioId: folio.id,
          kind: "LATE_CHECKOUT",
          now: new Date(),
          stayDate: reservation.checkOutDate,
          settings: (hotel.settings ?? {}) as Record<string, unknown>,
        });
      });
    }

    return withTenant(async (db) => {
      const existing = await db.reservation.findUnique({
        where: { id },
        include: {
          guest:  { select: { fullName: true } },
          rooms: {
            include: { room: { select: { number: true } } },
          },
          folio: { select: { id: true } },
        },
      });
      if (!existing) throw new AppError(404, "Reservation not found");

      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (!allowed?.includes(newStatus)) {
        throw new AppError(400, `Cannot transition from ${existing.status} to ${newStatus}`);
      }

      // Block checkout when there is an outstanding folio balance.
      // For SINGLE billing groups, sub-reservations have no folio of their own —
      // we look up the shared group folio instead.
      if (newStatus === "CHECKED_OUT") {
        let folioBalance: number | null = null;

        if (existing.folio) {
          const folio = await db.folio.findUnique({
            where:  { id: existing.folio.id },
            select: { balanceDue: true },
          });
          folioBalance = folio?.balanceDue ?? null;
        } else if (existing.groupId) {
          const masterRes = await db.reservation.findFirst({
            where:   { groupId: existing.groupId, folio: { isNot: null } },
            include: { folio: { select: { balanceDue: true } } },
          });
          folioBalance = masterRes?.folio?.balanceDue ?? null;
        }

        if (folioBalance !== null && folioBalance > 0) {
          throw new AppError(400, "Cannot check out: the folio has an outstanding balance. Please settle the bill before checking out.");
        }
      }

      const now = new Date();
      const updated = await db.reservation.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === "CHECKED_IN"  && { actualCheckIn:  now }),
          ...(newStatus === "CHECKED_OUT" && { actualCheckOut: now }),
          ...(newStatus === "CANCELLED"   && { cancelledAt: now, cancelledBy: actor.userId }),
        },
      });

      const roomIds = existing.rooms.map((r) => r.roomId);
      if (roomIds.length > 0) {
        const roomStatus =
          newStatus === "CHECKED_IN"                  ? "OCCUPIED"     :
          newStatus === "CHECKED_OUT"                 ? "VACANT_DIRTY" :
          newStatus === "CANCELLED"                   ? "VACANT_CLEAN" :
          null;

        if (roomStatus) {
          await db.room.updateMany({
            where: { id: { in: roomIds } },
            data:  { status: roomStatus },
          });
        }
      }

      // Create folio at check-in (not at reservation creation).
      // For SINGLE billing groups: the first checked-in reservation creates one folio;
      // subsequent group reservations post charges to that same folio (no new folio created).
      if (newStatus === "CHECKED_IN" && !existing.folio) {
        let masterFolioId: string | null = null;

        if (existing.groupId) {
          const group = await db.groupBooking.findUnique({
            where:  { id: existing.groupId },
            select: { billingType: true },
          });
          if (group?.billingType === "SINGLE") {
            const siblingWithFolio = await db.reservation.findFirst({
              where:   { groupId: existing.groupId, id: { not: id }, folio: { isNot: null } },
              include: { folio: { select: { id: true } } },
            });
            masterFolioId = siblingWithFolio?.folio?.id ?? null;
          }
        }

        if (masterFolioId) {
          // SINGLE billing: re-use the group's existing folio
          existing.folio = { id: masterFolioId };
          // Back-link any advance payments to the master folio
          const advancePayments = await db.payment.findMany({
            where:  { reservationId: id, folioId: null },
            select: { id: true },
          });
          if (advancePayments.length > 0) {
            await db.payment.updateMany({
              where: { id: { in: advancePayments.map((p) => p.id) } },
              data:  { folioId: masterFolioId },
            });
          }
        } else {
          // SPLIT billing or first reservation of a SINGLE-bill group: create a new folio
          const folioNumber = `FLO-${Date.now()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;
          const advancePayments = await db.payment.findMany({
            where:  { reservationId: id, folioId: null },
            select: { id: true, amount: true },
          });
          const advanceTotal = advancePayments.reduce((s, p) => s + p.amount, 0);
          const newFolio = await db.folio.create({
            data: {
              hotelId:       actor.hotelId,
              reservationId: id,
              folioNumber,
              paymentsTotal: advanceTotal,
              balanceDue:    existing.balanceDue,
            },
          });
          if (advancePayments.length > 0) {
            await db.payment.updateMany({
              where: { id: { in: advancePayments.map((p) => p.id) } },
              data:  { folioId: newFolio.id },
            });
          }
          existing.folio = { id: newFolio.id };
        }
      }

      // Auto-post room charge on check-in
      if (newStatus === "CHECKED_IN" && existing.folio && existing.rooms.length > 0) {
        const reservationRoom = existing.rooms[0];
        const nights = Math.ceil(
          (existing.checkOutDate.getTime() - existing.checkInDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const fmtDate = (d: Date) =>
          d.toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
        const description =
          `Room charge – Room ${reservationRoom.room.number} · ` +
          `${fmtDate(existing.checkInDate)} to ${fmtDate(existing.checkOutDate)}`;
        const amount = existing.subtotalAmount;

        await db.folioItem.create({
          data: {
            hotelId:     actor.hotelId,
            folioId:     existing.folio.id,
            type:        FolioItemType.ROOM_CHARGE,
            description,
            unitAmount:  amount,
            quantity:    1,
            amount,
            netAmount:   amount,
          },
        });

        for (const tax of parseAccommodationTaxBreakdown(existing.taxBreakdown)) {
          if (tax.amount <= 0) continue;
          await db.folioItem.create({
            data: {
              hotelId: actor.hotelId,
              folioId: existing.folio.id,
              type: FolioItemType.TAX,
              description: `${tax.label} (${tax.rate}%)`,
              unitAmount: tax.amount,
              quantity: 1,
              amount: tax.amount,
              taxAmount: tax.amount,
              netAmount: tax.amount,
            },
          });
        }

        const hotel = await db.hotel.findUniqueOrThrow({
          where: { id: actor.hotelId },
          select: { settings: true },
        });
        await postStayFeeIfNeeded(db, {
          hotelId: actor.hotelId,
          reservationId: id,
          folioId: existing.folio.id,
          kind: "EARLY_CHECKIN",
          now,
          stayDate: existing.checkInDate,
          settings: (hotel.settings ?? {}) as Record<string, unknown>,
        });

        await recalculateFolioTotals(db, existing.folio.id);
      }

      // Close folio on check-out.
      // For SINGLE billing groups: close the shared folio only when the last room checks out.
      if (newStatus === "CHECKED_OUT") {
        let shouldCloseFolioId: string | null = null;

        if (existing.groupId) {
          const group = await db.groupBooking.findUnique({
            where:  { id: existing.groupId },
            select: { billingType: true },
          });
          if (group?.billingType === "SINGLE") {
            const remainingCheckedIn = await db.reservation.count({
              where: { groupId: existing.groupId, id: { not: id }, status: "CHECKED_IN" },
            });
            if (remainingCheckedIn === 0) {
              const masterRes = await db.reservation.findFirst({
                where:   { groupId: existing.groupId, folio: { isNot: null } },
                include: { folio: { select: { id: true } } },
              });
              shouldCloseFolioId = masterRes?.folio?.id ?? null;
            }
          } else if (existing.folio) {
            shouldCloseFolioId = existing.folio.id;
          }
        } else if (existing.folio) {
          shouldCloseFolioId = existing.folio.id;
        }

        if (shouldCloseFolioId) {
          await db.folio.update({
            where: { id: shouldCloseFolioId },
            data:  { isOpen: false, closedAt: now, closedBy: actor.userId },
          });
        }
      }

      // Auto-create checkout clean housekeeping task
      if (newStatus === "CHECKED_OUT" && existing.rooms.length > 0) {
        const reservationRoom = existing.rooms[0];
        await db.housekeepingTask.create({
          data: {
            hotelId:       actor.hotelId,
            roomId:        reservationRoom.roomId,
            taskType:      "CHECKOUT_CLEAN",
            priority:      3, // HIGH
            scheduledDate: now,
            notes:         `Checkout clean — ${existing.guest.fullName} checked out`,
          },
        });
        checkoutCleanRoomNumber = reservationRoom.room.number;
      }

      // Lifetime stay count, spend and VIP level are only meaningful once the
      // stay is complete, so they are recomputed here rather than at booking.
      if (newStatus === "CHECKED_OUT") {
        await recalculateGuestStats(db, existing.guestId);
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   `RESERVATION_${newStatus}`,
          entity:   "reservation",
          entityId: id,
          before:   JSON.parse(JSON.stringify({ status: existing.status })),
          after:    JSON.parse(JSON.stringify({ status: newStatus })),
        },
      });

      try {
        const roomNum = existing.rooms[0]?.room.number ?? "?";
        if (newStatus === "CHECKED_IN") {
          await NotificationService.createNotification(db, actor.hotelId, {
            title:      "Guest Checked In",
            body:       `${existing.guest.fullName} checked into Room ${roomNum}`,
            type:       "CHECK_IN",
            entityId:   id,
            entityType: "reservation",
          });
        } else if (newStatus === "CHECKED_OUT") {
          await NotificationService.createNotification(db, actor.hotelId, {
            title:      "Guest Checked Out",
            body:       `${existing.guest.fullName} checked out of Room ${roomNum}`,
            type:       "CHECK_OUT",
            entityId:   id,
            entityType: "reservation",
          });
        }
      } catch { /* notifications are non-critical */ }

      return updated;
    }).then(async (updated) => {
      notifyHotelDataChanged(actor.hotelId);
      if (newStatus === "CHECKED_OUT" && checkoutCleanRoomNumber) {
        await notifyHousekeepingStaff(actor.hotelId, null, {
          title: "🧹 Checkout Cleaning Required",
          body:  `Room ${checkoutCleanRoomNumber} needs cleaning`,
          url:   "/housekeeping/mobile",
        });
      }
      if (newStatus === "CONFIRMED" || newStatus === "CANCELLED") {
        try {
          await enqueueReservationEmail(newStatus, [id], actor.hotelId);
        } catch (err) {
          console.error(`Failed to enqueue reservation ${newStatus.toLowerCase()} email:`, err);
        }
      }
      return updated;
    });
  },

  async update(withTenant: WithTenantFn, actor: JwtPayload, id: string, dto: UpdateReservationDto) {
    return withTenant(async (db) => {
      const existing = await db.reservation.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Reservation not found");

      const updated = await db.reservation.update({
        where: { id },
        data: {
          ...(dto.adults          !== undefined && { adults:          dto.adults }),
          ...(dto.children        !== undefined && { children:        dto.children }),
          ...(dto.source          !== undefined && { source:          dto.source }),
          ...(dto.specialRequests !== undefined && { specialRequests: dto.specialRequests }),
          ...(dto.internalNotes   !== undefined && { internalNotes:   dto.internalNotes }),
          ...(dto.isVip           !== undefined && { isVip:           dto.isVip }),
        },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   dto.isVip !== undefined ? "RESERVATION_VIP_TOGGLE" : "RESERVATION_UPDATE",
          entity:   "reservation",
          entityId: id,
          after:    JSON.parse(JSON.stringify(dto)),
        },
      });

      return updated;
    }).then((updated) => {
      notifyHotelDataChanged(actor.hotelId);
      return updated;
    });
  },
};
