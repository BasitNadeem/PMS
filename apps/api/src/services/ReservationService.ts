import type { TenantTx } from "@pms/db";
import { ReservationStatus, FolioItemType, RoomStatus, MaintenanceStatus, Prisma } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { recalculateFolioTotals } from "../utils/folioTotals";
import { recalculateGuestStats } from "../utils/guestStats";
import { createLedgerEntryFromPayment } from "./CashBookService";
import { assertCompanyBelongsToHotel, CompanyService } from "./CompanyService";
import type {
  ListReservationsQuery,
  CreateReservationDto,
  UpdateReservationDto,
  ManageCheckedInStayDto,
  ReverseReservationLifecycleDto,
} from "../schemas/reservations";
import { AppError } from "../utils/AppError";
import { resolveUserNames } from "../lib/userNames";
import { paginationMeta } from "../utils/pagination";
import { NotificationService } from "./NotificationService";
import { notifyHousekeepingStaff } from "./HousekeepingService";
import { notifyHotelDataChanged } from "../lib/realtime";
import { enqueueReservationEmail } from "../lib/reservationEmails";
import { queueChannexSync } from "../lib/channexSync";
import { toIsoDate } from "../lib/channexRanges";

/**
 * Status transitions that change how many rooms are sellable, and therefore
 * require a channel-manager resync. CHECKED_IN is excluded on purpose: the room
 * was already consumed by CONFIRMED, so availability does not move.
 */
const INVENTORY_AFFECTING_STATUSES: ReservationStatus[] = [
  "CONFIRMED", "CANCELLED", "NO_SHOW", "CHECKED_OUT",
];
import {
  calculateAccommodationCharges,
  parseAccommodationTaxBreakdown,
} from "../lib/accommodationCharges";
import { postStayFeeIfNeeded } from "../lib/stayFees";
import { getCurrentPKTDate } from "../lib/timezone";

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
    `to ${shortDate(conflict.checkOutDate)}${ref ? ` (Res ID ${ref})` : ""}. ` +
    `Please choose a different room or date.`
  );
}

async function assertNoInventoryBlock(
  db: TenantTx,
  roomId: string,
  roomNumber: string,
  checkInDate: Date,
  checkOutDate: Date,
) {
  const block = await db.roomInventoryBlock.findFirst({
    where: {
      roomId,
      cancelledAt: null,
      startDate: { lt: checkOutDate },
      endDate: { gt: checkInDate },
    },
    orderBy: { startDate: "asc" },
  });
  if (!block) return;
  const label = block.type === "OUT_OF_ORDER" ? "out of order" : "out of service";
  throw new AppError(
    409,
    `Room ${roomNumber} is ${label} from ${shortDate(block.startDate)} to ${shortDate(block.endDate)} (${block.reason}). Please choose a different room or date.`,
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

// Dates/room/rate may only change before anything physical has happened —
// once a guest is checked in, a "date edit" is really a room-transfer/stay
// operation with folio implications, not a plain correction.
const STAY_EDITABLE_STATUSES: ReservationStatus[] = ["ENQUIRY", "CONFIRMED", "WAITLISTED"];

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
          { legacyConfirmationNumber: { contains: search, mode: "insensitive" as const } },
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
          group: { select: { id: true, groupRef: true, name: true, payerType: true } },
          company: { select: { id: true, name: true, code: true, type: true } },
          payments: {
            orderBy: { postedAt: "desc" },
            select: {
              id: true, method: true, status: true, amount: true,
              transactionRef: true, receiptNumber: true, postedAt: true,
              isRefund: true,
            },
          },
          upsells: {
            orderBy: { createdAt: "asc" },
            select: {
              id: true, name: true, category: true, quantity: true,
              unitAmount: true, amount: true, postedAt: true,
            },
          },
          stayChanges: {
            orderBy: { createdAt: "desc" },
          },
        },
      })
    );
    if (!reservation) throw new AppError(404, "Reservation not found");
    const entries = await withTenant((db) =>
      db.auditLog.findMany({
        where: { entity: "reservation", entityId: id },
        orderBy: { createdAt: "desc" },
        take: 25,
        select: {
          id: true, action: true, notes: true, before: true, after: true,
          createdAt: true, userId: true,
        },
      })
    );
    const actorNames = await resolveUserNames(entries.map((e) => e.userId));
    const activity = entries.map(({ userId, ...entry }) => ({
      ...entry,
      user: userId ? { id: userId, name: actorNames.get(userId) ?? "Unknown" } : null,
    }));
    return { ...reservation, activity };
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
      await assertNoInventoryBlock(db, dto.roomId, room.number, new Date(dto.checkInDate), new Date(dto.checkOutDate));

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

      if (dto.companyId) {
        await assertCompanyBelongsToHotel(db, actor.hotelId, dto.companyId);
      }

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
          appliedRatePlanName: dto.appliedRatePlanName ?? null,
          subtotalAmount:     charges.subtotalAmount,
          taxAmount:          charges.taxAmount,
          taxInclusive:       charges.taxInclusive,
          taxBreakdown:       charges.taxBreakdown as unknown as Prisma.InputJsonValue,
          totalAmount,
          advancePaid,
          balanceDue,
          isVip,
          companyId:     dto.companyId ?? null,
          billToCompany: dto.billToCompany ?? false,
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
      let advancePayment: { id: string; amount: number; method: string; postedAt: Date } | null = null;
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
        { id: advancePayment.id, amount: advancePayment.amount, method: advancePayment.method, reservationId: reservation.id, occurredAt: advancePayment.postedAt },
        actor.userId,
      ).catch(() => { /* already logged inside */ });
    }

    try {
      await enqueueReservationEmail("CONFIRMED", [reservation.id], actor.hotelId);
    } catch (err) {
      console.error("Failed to enqueue staff-created reservation confirmation email:", err);
    }

    // A new stay consumes inventory — resync the channel manager over the
    // affected dates. Fire-and-forget; a Channex problem never reaches the
    // booking response.
    queueChannexSync({
      hotelId:  actor.hotelId,
      reason:   "RESERVATION",
      dateFrom: toIsoDate(reservation.checkInDate),
      dateTo:   toIsoDate(reservation.checkOutDate),
    });

    notifyHotelDataChanged(actor.hotelId);
    return reservation;
  },

  async updateStatus(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    id: string,
    newStatus: ReservationStatus,
    reason?: string,
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

      if (newStatus === "NO_SHOW") {
        if (!reason?.trim()) {
          throw new AppError(400, "A reason is required when marking a reservation as no-show");
        }

        const hotel = await db.hotel.findUniqueOrThrow({
          where: { id: actor.hotelId },
          select: { currentBusinessDate: true },
        });
        const businessDate = hotel.currentBusinessDate?.toISOString().slice(0, 10) ?? getCurrentPKTDate();
        const arrivalDate = existing.checkInDate.toISOString().slice(0, 10);
        if (arrivalDate > businessDate) {
          throw new AppError(400, "A future arrival cannot be marked as no-show");
        }
      }

      // ── ID verification gate ────────────────────────────────────────────
      // One chokepoint instead of four. Creation flows disagree about identity
      // documents by design — the booking engine cannot demand a CNIC from
      // someone booking online at midnight — so requiring one at creation would
      // either break public booking or leave a hole. Every stay passes through
      // this transition exactly once, whatever created it.
      let idOverrideReason: string | null = null;
      if (newStatus === "CHECKED_IN") {
        const hotel = await db.hotel.findUniqueOrThrow({
          where:  { id: actor.hotelId },
          select: { settings: true },
        });
        const settings = (hotel.settings ?? {}) as Record<string, unknown>;

        if (settings.requireIdAtCheckIn === true && !existing.idVerifiedAt) {
          const captured = await db.guestDocument.count({
            where: { reservationId: id, deletedAt: null },
          });

          if (captured === 0) {
            if (!reason?.trim()) {
              // Coded so the desk can render an actionable panel — capture the
              // ID right here — instead of a toast the guest is left standing
              // through. Most stays are booked by phone, mail or an agent, so
              // this is the first moment anyone can photograph a document.
              throw new AppError(
                409,
                "This guest has no ID on file. Capture the ID, or ask a manager to check in with a recorded reason.",
                { code: "ID_REQUIRED" },
              );
            }
            // Gated separately from RESERVATION_CHECKIN on purpose: waiving the
            // requirement is a different decision from performing a check-in.
            //
            // The colon-style key specifically, NOT "RESERVATION_CANCEL". Both
            // exist, and they are granted differently: FRONT_DESK holds
            // RESERVATION_CANCEL but not reservations:cancel, so gating on the
            // screaming-snake key would hand the override to the very people it
            // is meant to escalate past. Verified against role_permissions —
            // reservations:cancel is OWNER and MANAGER only.
            if (!actor.permissions.includes("reservations:cancel")) {
              throw new AppError(
                403,
                "You do not have permission to check in without ID. Ask a manager to approve it.",
              );
            }
            idOverrideReason = reason.trim();
          }
        }
      }

      // Checkout follows the actual charge responsibility, not the old
      // reservation-wide BTC flag. Guest-assigned debt must be paid first;
      // only the outstanding COMPANY-assigned portion moves to city ledger.
      // Reservations created before item allocation continue through the
      // legacy all-or-nothing `billToCompany` fallback below.
      // For SINGLE billing groups, sub-reservations have no folio of their own —
      // we look up the shared group folio instead.
      if (newStatus === "CHECKED_OUT") {
        let checkoutFolio: {
          id: string;
          balanceDue: number;
          guestBalanceDue: number;
          companyBalanceDue: number;
          companyResponsibilityTotal: number;
          items: Array<{ payerCompanyId: string | null }>;
        } | null = null;

        if (existing.folio) {
          checkoutFolio = await db.folio.findUnique({
            where:  { id: existing.folio.id },
            select: {
              id: true, balanceDue: true, guestBalanceDue: true,
              companyBalanceDue: true, companyResponsibilityTotal: true,
              items: {
                where: { isVoided: false, payerType: "COMPANY" },
                select: { payerCompanyId: true },
              },
            },
          });
        } else if (existing.groupId) {
          const masterRes = await db.reservation.findFirst({
            where:   { groupId: existing.groupId, folio: { isNot: null } },
            include: {
              folio: {
                select: {
                  id: true, balanceDue: true, guestBalanceDue: true,
                  companyBalanceDue: true, companyResponsibilityTotal: true,
                  items: {
                    where: { isVoided: false, payerType: "COMPANY" },
                    select: { payerCompanyId: true },
                  },
                },
              },
            },
          });
          checkoutFolio = masterRes?.folio ?? null;
        }

        if (checkoutFolio?.balanceDue && checkoutFolio.balanceDue > 0) {
          const allocatedCompanyIds = Array.from(new Set(
            checkoutFolio.items
              .map((item) => item.payerCompanyId)
              .filter((companyId): companyId is string => companyId !== null),
          ));
          const hasItemLevelBtc = checkoutFolio.companyResponsibilityTotal > 0;
          const legacyCompanyId = existing.companyId
            ?? (existing.groupId
              ? (await db.groupBooking.findUnique({
                  where: { id: existing.groupId }, select: { companyId: true },
                }))?.companyId ?? null
              : null);
          const companyId = hasItemLevelBtc ? allocatedCompanyIds[0] ?? null : legacyCompanyId;

          // With item-level responsibility, only the BTC share may leave the
          // folio for city ledger. A Guest share must be paid first. Historical
          // whole-folio BTC reservations predate the split fields, so their
          // Guest-defaulted balance continues through the legacy fallback.
          if (hasItemLevelBtc && checkoutFolio.guestBalanceDue > 0) {
            throw new AppError(
              400,
              `Cannot check out: the guest still owes PKR ${(checkoutFolio.guestBalanceDue / 100).toLocaleString("en-PK")}. Record the guest payment first.`,
            );
          }
          if (hasItemLevelBtc && allocatedCompanyIds.length !== 1) {
            throw new AppError(409, "Cannot check out: BTC charges must be assigned to one company.");
          }
          if (!hasItemLevelBtc && (!existing.billToCompany || !companyId)) {
            throw new AppError(400, "Cannot check out: the folio has an outstanding balance. Please settle the bill before checking out.");
          }
          if (!companyId || checkoutFolio.companyBalanceDue <= 0 && hasItemLevelBtc) {
            throw new AppError(409, "Cannot check out: the BTC responsibility is missing a valid company assignment.");
          }

          // Gated separately from RESERVATION_CHECKOUT: extending credit is a
          // different decision from letting a settled guest leave.
          if (!actor.permissions.includes("COMPANY_LEDGER_POST")) {
            throw new AppError(403, "You do not have permission to bill this folio to a company account. Ask a manager to complete the checkout.");
          }

          // Inside the same transaction as the status change, so a credit-limit
          // rejection aborts the checkout rather than leaving a checked-out
          // guest with an untransferred balance.
          await CompanyService.transferFolio(db, actor, checkoutFolio.id, companyId, {
            ...(hasItemLevelBtc ? { amount: checkoutFolio.companyBalanceDue } : {}),
            idempotencyKey: `checkout:${checkoutFolio.id}`,
          });
          const remaining = await db.folio.findUniqueOrThrow({
            where: { id: checkoutFolio.id },
            select: { guestBalanceDue: true, companyBalanceDue: true },
          });
          if (remaining.guestBalanceDue > 0 || remaining.companyBalanceDue > 0) {
            throw new AppError(
              409,
              "Checkout could not settle the full folio. Review the Guest/BTC allocation and company ledger transfer before trying again.",
            );
          }
        }
      }

      const now = new Date();
      const updated = await db.reservation.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === "CHECKED_IN"  && { actualCheckIn:  now }),
          ...(idOverrideReason !== null   && { idOverrideReason }),
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

        // Extras chosen in the booking engine were price-locked at booking but
        // had nowhere to post until this folio existed. postedAt guards against
        // double-posting if a reservation is checked in more than once.
        const pendingUpsells = await db.reservationUpsell.findMany({
          where: { reservationId: id, postedAt: null },
        });
        for (const upsell of pendingUpsells) {
          await db.folioItem.create({
            data: {
              hotelId:     actor.hotelId,
              folioId:     existing.folio.id,
              type:        upsell.category,
              description: upsell.name,
              unitAmount:  upsell.unitAmount,
              quantity:    upsell.quantity,
              amount:      upsell.amount,
              netAmount:   upsell.amount,
            },
          });
          await db.reservationUpsell.update({
            where: { id: upsell.id },
            data:  { postedAt: now },
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
          notes:      newStatus === "NO_SHOW" ? reason!.trim() : null,
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

      // Broader than the email set above: every transition that frees or
      // consumes a room changes what the OTAs may sell. CHECKED_IN is absent
      // deliberately — the room was already occupied, so inventory is unchanged.
      if (INVENTORY_AFFECTING_STATUSES.includes(newStatus)) {
        queueChannexSync({
          hotelId:  actor.hotelId,
          reason:   "RESERVATION_STATUS",
          dateFrom: toIsoDate(updated.checkInDate),
          dateTo:   toIsoDate(updated.checkOutDate),
        });
      }
      return updated;
    });
  },

  async reverseLifecycle(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    id: string,
    dto: ReverseReservationLifecycleDto,
  ) {
    const updated = await withTenant(async (db) => {
      const existing = await db.reservation.findUnique({
        where: { id },
        include: {
          rooms: { include: { room: { select: { number: true, status: true } } } },
          folio: {
            include: {
              payments: { select: { id: true, postedAt: true } },
              companyLedgerEntries: { select: { id: true, type: true, reversedAt: true } },
            },
          },
          guest: { select: { id: true, fullName: true } },
          upsells: { select: { id: true, postedAt: true } },
        },
      });
      if (!existing) throw new AppError(404, "Reservation not found");
      const room = existing.rooms[0];
      if (!room) throw new AppError(400, "This reservation has no assigned room to restore.");
      if (existing.groupId && !existing.folio) {
        throw new AppError(409, "This room uses a shared group folio. Reverse it from the reservation that owns the group folio, or correct the group manually.");
      }

      if (dto.action === "CHECK_IN") {
        if (existing.status !== "CHECKED_IN" || !existing.actualCheckIn) {
          throw new AppError(409, "Only a currently checked-in reservation can have its check-in reversed.");
        }
        if (existing.folio?.payments.some((payment) => payment.postedAt > existing.actualCheckIn!)) {
          throw new AppError(409, "Check-in cannot be reversed after a folio payment. Reverse the payment first.");
        }
        if (existing.upsells.some((upsell) => upsell.postedAt && upsell.postedAt >= existing.actualCheckIn!)) {
          throw new AppError(409, "Check-in cannot be reversed after booking extras were posted to the folio.");
        }
        const automaticPostingWindowEnd = new Date(existing.actualCheckIn.getTime() + 60_000);
        const operationalItems = existing.folio
          ? await db.folioItem.findMany({
              where: {
                folioId: existing.folio.id,
                createdAt: { gte: existing.actualCheckIn },
                isVoided: false,
                NOT: {
                  OR: [
                    { createdAt: { lte: automaticPostingWindowEnd }, type: { in: [FolioItemType.ROOM_CHARGE, FolioItemType.TAX] } },
                    { notes: `AUTO_EARLY_CHECKIN_FEE:${id}` },
                  ],
                },
              },
              select: { id: true },
            })
          : [];
        if (operationalItems.length > 0) {
          throw new AppError(409, "Check-in cannot be reversed after guest charges were posted. Void those charges first.");
        }

        const reversedItemIds = existing.folio
          ? (await db.folioItem.findMany({
              where: {
                folioId: existing.folio.id,
                isVoided: false,
                OR: [
                  { createdAt: { gte: existing.actualCheckIn, lte: automaticPostingWindowEnd }, type: { in: [FolioItemType.ROOM_CHARGE, FolioItemType.TAX] } },
                  { notes: `AUTO_EARLY_CHECKIN_FEE:${id}` },
                ],
              },
              select: { id: true },
            })).map((item) => item.id)
          : [];
        if (reversedItemIds.length > 0) {
          await db.folioItem.updateMany({
            where: { id: { in: reversedItemIds } },
            data: { isVoided: true, voidedAt: new Date(), voidedBy: actor.userId, voidReason: `Check-in reversed: ${dto.reason}` },
          });
        }

        // A folio created solely by an accidental check-in is operational
        // scaffolding, not a financial record. Remove it so it does not remain
        // in Billing as a confusing PKR 0 "open" folio. Anything carrying real
        // financial history is preserved instead.
        let removedFolioId: string | null = null;
        if (existing.folio) {
          const [splitCount, activeItemCount, payerChangeCount] = await Promise.all([
            db.folioSplit.count({ where: { folioId: existing.folio.id } }),
            db.folioItem.count({ where: { folioId: existing.folio.id, isVoided: false } }),
            db.folioItemPayerChange.count({ where: { folioItem: { folioId: existing.folio.id } } }),
          ]);
          const canRemoveGeneratedFolio =
            !existing.groupId &&
            existing.folio.payments.length === 0 &&
            existing.folio.companyLedgerEntries.length === 0 &&
            !existing.folio.invoiceId &&
            splitCount === 0 &&
            payerChangeCount === 0 &&
            activeItemCount === 0;

          if (canRemoveGeneratedFolio) {
            removedFolioId = existing.folio.id;
            await db.folio.delete({ where: { id: existing.folio.id } });
          } else {
            await recalculateFolioTotals(db, existing.folio.id);
          }
        }

        const result = await db.reservation.update({
          where: { id },
          data: { status: "CONFIRMED", actualCheckIn: null },
        });
        await db.reservationRoom.updateMany({ where: { reservationId: id }, data: { actualCheckIn: null } });
        await db.room.update({ where: { id: room.roomId }, data: { status: RoomStatus.VACANT_CLEAN } });
        await db.reservationLifecycleReversal.create({
          data: {
            hotelId: actor.hotelId, reservationId: id, actionReversed: "CHECK_IN",
            previousStatus: "CHECKED_IN", restoredStatus: "CONFIRMED",
            originalActionAt: existing.actualCheckIn, reason: dto.reason,
            affectedFolioItemIds: removedFolioId ? [] : reversedItemIds, createdBy: actor.userId,
          },
        });
        await db.auditLog.create({
          data: {
            hotelId: actor.hotelId, userId: actor.userId, action: "RESERVATION_CHECK_IN_REVERSED",
            entity: "reservation", entityId: id, notes: dto.reason,
            before: { status: "CHECKED_IN", actualCheckIn: existing.actualCheckIn.toISOString(), roomStatus: room.room.status },
            after: {
              status: "CONFIRMED", actualCheckIn: null, roomStatus: "VACANT_CLEAN",
              voidedFolioItemIds: removedFolioId ? [] : reversedItemIds,
              removedGeneratedFolioId: removedFolioId,
            },
          },
        });
        return result;
      }

      if (existing.status !== "CHECKED_OUT" || !existing.actualCheckOut) {
        throw new AppError(409, "Only a currently checked-out reservation can have its checkout reversed.");
      }
      if (room.room.status !== RoomStatus.VACANT_CLEAN && room.room.status !== RoomStatus.VACANT_DIRTY) {
        throw new AppError(409, `Checkout cannot be reversed while Room ${room.room.number} is ${room.room.status.replace(/_/g, " ").toLowerCase()}.`);
      }
      if (existing.folio?.companyLedgerEntries.some((entry) => entry.type === "CHARGE" && !entry.reversedAt)) {
        throw new AppError(409, "Checkout cannot be reversed after BTC transfer. Reverse the company ledger charge first.");
      }
      if (existing.folio?.payments.some((payment) => payment.postedAt > existing.actualCheckOut!)) {
        throw new AppError(409, "Checkout cannot be reversed after a later folio payment. Reverse the payment first.");
      }
      const roomConflict = await db.reservationRoom.findFirst({
        where: {
          roomId: room.roomId,
          reservationId: { not: id },
          checkInDate: { lt: existing.checkOutDate },
          checkOutDate: { gt: existing.checkInDate },
          reservation: { status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] } },
        },
        include: {
          room: { select: { number: true } },
          reservation: { select: { confirmationNumber: true, guest: { select: { fullName: true } } } },
        },
      });
      if (roomConflict) throw new AppError(409, formatRoomConflictMessage(roomConflict));
      await assertNoInventoryBlock(db, room.roomId, room.room.number, existing.checkInDate, existing.checkOutDate);

      const checkoutTasks = await db.housekeepingTask.findMany({
        where: {
          roomId: room.roomId,
          taskType: "CHECKOUT_CLEAN",
          createdAt: { gte: existing.actualCheckOut },
        },
        orderBy: { createdAt: "asc" },
        select: { id: true, status: true, startedAt: true },
      });
      if (checkoutTasks.some((task) => task.startedAt || !["PENDING", "SKIPPED"].includes(task.status))) {
        throw new AppError(409, "Checkout cannot be reversed because checkout cleaning has already started.");
      }
      const taskIds = checkoutTasks.map((task) => task.id);
      if (taskIds.length > 0) {
        await db.housekeepingTask.updateMany({
          where: { id: { in: taskIds } },
          data: { status: "SKIPPED", notes: `Checkout reversed — ${dto.reason}` },
        });
      }
      let checkoutFeeIds: string[] = [];
      if (existing.folio) {
        checkoutFeeIds = (await db.folioItem.findMany({
          where: { folioId: existing.folio.id, notes: `AUTO_LATE_CHECKOUT_FEE:${id}`, isVoided: false },
          select: { id: true },
        })).map((item) => item.id);
        if (checkoutFeeIds.length > 0) {
          await db.folioItem.updateMany({
            where: { id: { in: checkoutFeeIds } },
            data: { isVoided: true, voidedAt: new Date(), voidedBy: actor.userId, voidReason: `Checkout reversed: ${dto.reason}` },
          });
        }
        await db.folio.update({
          where: { id: existing.folio.id },
          data: { isOpen: true, closedAt: null, closedBy: null },
        });
        await recalculateFolioTotals(db, existing.folio.id);
      }
      const result = await db.reservation.update({
        where: { id },
        data: { status: "CHECKED_IN", actualCheckOut: null },
      });
      await db.reservationRoom.updateMany({ where: { reservationId: id }, data: { actualCheckOut: null } });
      await db.room.update({ where: { id: room.roomId }, data: { status: RoomStatus.OCCUPIED } });
      await db.reservationLifecycleReversal.create({
        data: {
          hotelId: actor.hotelId, reservationId: id, actionReversed: "CHECK_OUT",
          previousStatus: "CHECKED_OUT", restoredStatus: "CHECKED_IN",
          originalActionAt: existing.actualCheckOut, reason: dto.reason,
          affectedFolioItemIds: checkoutFeeIds, affectedTaskIds: taskIds, createdBy: actor.userId,
        },
      });
      await db.auditLog.create({
        data: {
          hotelId: actor.hotelId, userId: actor.userId, action: "RESERVATION_CHECK_OUT_REVERSED",
          entity: "reservation", entityId: id, notes: dto.reason,
          before: { status: "CHECKED_OUT", actualCheckOut: existing.actualCheckOut.toISOString(), roomStatus: room.room.status, folioOpen: existing.folio?.isOpen ?? null },
          after: { status: "CHECKED_IN", actualCheckOut: null, roomStatus: "OCCUPIED", folioOpen: existing.folio ? true : null, voidedFolioItemIds: checkoutFeeIds, skippedTaskIds: taskIds },
        },
      });
      await recalculateGuestStats(db, existing.guest.id);
      return result;
    });

    notifyHotelDataChanged(actor.hotelId);
    queueChannexSync({
      hotelId: actor.hotelId, reason: "RESERVATION_STATUS",
      dateFrom: toIsoDate(updated.checkInDate), dateTo: toIsoDate(updated.checkOutDate),
    });
    return updated;
  },

  async manageCheckedInStay(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    id: string,
    dto: ManageCheckedInStayDto,
  ) {
    if (!actor.permissions.includes("FOLIO_UPDATE")) {
      throw new AppError(403, "You do not have permission to post stay changes to the folio");
    }

    let oldRoomForCleaning: string | null = null;
    let syncWindow: { dateFrom: string; dateTo: string } | null = null;

    await withTenant(async (db) => {
      const existing = await db.reservation.findUnique({
        where: { id },
        include: {
          rooms: {
            include: {
              room: { select: { id: true, number: true, status: true } },
              roomType: { select: { id: true, name: true, defaultRate: true } },
            },
          },
          folio: { select: { id: true, isOpen: true } },
        },
      });
      if (!existing) throw new AppError(404, "Reservation not found");
      if (existing.status !== "CHECKED_IN") {
        throw new AppError(409, "Manage stay is only available after the guest has checked in");
      }

      const current = existing.rooms[0];
      if (!current) throw new AppError(409, "Reservation has no active room assignment");

      let folio = existing.folio;
      if (!folio && existing.groupId) {
        const master = await db.reservation.findFirst({
          where: { groupId: existing.groupId, folio: { isNot: null } },
          include: { folio: { select: { id: true, isOpen: true } } },
        });
        folio = master?.folio ?? null;
      }
      if (!folio) throw new AppError(409, "A folio must exist before the stay can be changed");
      if (!folio.isOpen) throw new AppError(409, "Cannot change a stay with a closed folio");

      const hotel = await db.hotel.findUniqueOrThrow({
        where: { id: actor.hotelId },
        select: { currentBusinessDate: true, settings: true },
      });
      const businessDate = hotel.currentBusinessDate
        ? new Date(hotel.currentBusinessDate)
        : new Date(`${getCurrentPKTDate()}T00:00:00.000Z`);
      const effectiveDate = businessDate < existing.checkInDate ? existing.checkInDate : businessDate;
      const revisedCheckOut = dto.checkOutDate ? new Date(dto.checkOutDate) : existing.checkOutDate;
      const checkOutChanged = revisedCheckOut.getTime() !== existing.checkOutDate.getTime();
      if (revisedCheckOut <= existing.checkInDate) {
        throw new AppError(400, "The revised check-out must be after check-in");
      }
      if (revisedCheckOut < effectiveDate) {
        throw new AppError(400, "The revised check-out cannot be before the current business date");
      }
      if (effectiveDate >= existing.checkOutDate && !checkOutChanged) {
        throw new AppError(409, "The stay has no remaining nights to change");
      }

      const targetRoomId = dto.newRoomId ?? current.roomId;
      const target = await db.room.findUnique({
        where: { id: targetRoomId },
        include: { roomType: { select: { id: true, name: true, defaultRate: true } } },
      });
      if (!target || !target.isActive) throw new AppError(404, "Destination room not found");

      const isRoomMove = target.id !== current.roomId;
      if (isRoomMove) {
        if (target.status !== RoomStatus.VACANT_CLEAN) {
          throw new AppError(409, `Room ${target.number} is not ready. Only a vacant, clean room can receive a checked-in guest.`);
        }
      }
      if (isRoomMove || revisedCheckOut > existing.checkOutDate) {
        const conflict = await db.reservationRoom.findFirst({
          where: {
            roomId: target.id,
            checkInDate: { lt: revisedCheckOut },
            checkOutDate: { gt: effectiveDate },
            reservation: {
              id: { not: id },
              status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] },
            },
          },
          include: {
            room: { select: { number: true } },
            reservation: { select: { confirmationNumber: true, guest: { select: { fullName: true } } } },
          },
        });
        if (conflict) throw new AppError(409, formatRoomConflictMessage(conflict));
        await assertNoInventoryBlock(db, target.id, target.number, effectiveDate, revisedCheckOut);
      }

      if (isRoomMove || revisedCheckOut > existing.checkOutDate) {
        const maintenance = await db.maintenanceTicket.findFirst({
          where: {
            roomId: target.id,
            status: { notIn: [MaintenanceStatus.RESOLVED, MaintenanceStatus.CLOSED] },
            OR: [
              { scheduledEndDate: null },
              { scheduledEndDate: { gte: effectiveDate } },
            ],
          },
          select: { id: true },
        });
        if (maintenance) throw new AppError(409, `Room ${target.number} has an open maintenance restriction`);
      }

      const newRate =
        dto.pricingMode === "CUSTOM_RATE" ? dto.customRatePerNight! :
        dto.pricingMode === "USE_NEW_ROOM_RATE" ? target.roomType.defaultRate :
        current.ratePerNight;
      const oldRemainingNights = Math.max(0, Math.ceil(
        (existing.checkOutDate.getTime() - effectiveDate.getTime()) / 86_400_000,
      ));
      const revisedRemainingNights = Math.max(0, Math.ceil(
        (revisedCheckOut.getTime() - effectiveDate.getTime()) / 86_400_000,
      ));
      const settings = (hotel.settings ?? {}) as Record<string, unknown>;
      const oldRemaining = calculateAccommodationCharges(current.ratePerNight * oldRemainingNights, settings);
      const dateAdjustedAtAgreedRate = calculateAccommodationCharges(
        current.ratePerNight * revisedRemainingNights,
        settings,
      );
      const isEarlyDeparture = checkOutChanged && revisedCheckOut < existing.checkOutDate;
      const creditEarlyDeparture = isEarlyDeparture && dto.earlyDepartureTreatment === "CREDIT_UNUSED_NIGHTS";
      const customEarlyDepartureCredit = isEarlyDeparture && dto.earlyDepartureTreatment === "CUSTOM_CREDIT"
        ? dto.earlyDepartureCreditAmount ?? 0
        : 0;
      if (dto.earlyDepartureTreatment === "CUSTOM_CREDIT" && !isEarlyDeparture) {
        throw new AppError(400, "A custom early departure credit requires an earlier check-out date.");
      }
      if (customEarlyDepartureCredit > oldRemaining.totalAmount) {
        throw new AppError(400, "The custom early departure credit cannot exceed the remaining stay charges.");
      }
      const billableDateAdjusted = isEarlyDeparture && !creditEarlyDeparture
        ? oldRemaining
        : dateAdjustedAtAgreedRate;
      const newRemaining = calculateAccommodationCharges(newRate * revisedRemainingNights, settings);
      const effectiveNewRemaining = isEarlyDeparture && !creditEarlyDeparture
        ? calculateAccommodationCharges(newRate * oldRemainingNights, settings)
        : newRemaining;
      const dateSubtotalDelta = billableDateAdjusted.subtotalAmount - oldRemaining.subtotalAmount;
      const dateTaxDelta = billableDateAdjusted.taxAmount - oldRemaining.taxAmount;
      const pricingSubtotalDelta = effectiveNewRemaining.subtotalAmount - billableDateAdjusted.subtotalAmount;
      const pricingTaxDelta = effectiveNewRemaining.taxAmount - billableDateAdjusted.taxAmount;
      const dateDelta = billableDateAdjusted.totalAmount - oldRemaining.totalAmount;
      const pricingDelta = effectiveNewRemaining.totalAmount - billableDateAdjusted.totalAmount;
      const totalStayDelta = dateDelta + pricingDelta;

      if (!isRoomMove && !checkOutChanged && pricingDelta === 0 && dto.rebateAmount === 0 && customEarlyDepartureCredit === 0) {
        throw new AppError(400, "Nothing changed. Change the room, check-out date, rate, or rebate.");
      }

      const folioItemIds: string[] = [];
      const fromLabel = `Room ${current.room.number} · ${current.roomType.name}`;
      const toLabel = `Room ${target.number} · ${target.roomType.name}`;
      const customerEvents: string[] = [];
      if (isRoomMove) customerEvents.push(`Room changed: ${fromLabel} to ${toLabel}`);
      if (checkOutChanged) {
        customerEvents.push(
          revisedCheckOut > existing.checkOutDate
            ? `Stay extended to ${shortDate(revisedCheckOut)}`
            : `Early departure revised to ${shortDate(revisedCheckOut)}${creditEarlyDeparture ? " · unused nights credited" : customEarlyDepartureCredit > 0 ? ` · approved credit PKR ${(customEarlyDepartureCredit / 100).toLocaleString("en-PK")}` : " · original stay charges retained"}`,
        );
      }
      if (pricingDelta !== 0) customerEvents.push("Agreed room rate adjusted");
      if (dto.rebateAmount > 0) customerEvents.push("Guest service rebate");
      const customerDescription = customerEvents.join(" · ");
      const postFolioDelta = async (
        delta: number,
        positiveType: FolioItemType,
        positiveDescription: string,
        negativeDescription: string,
      ) => {
        if (delta === 0) return;
        const amount = Math.abs(delta);
        const type = delta > 0 ? positiveType : FolioItemType.DISCOUNT;
        const item = await db.folioItem.create({
          data: {
            hotelId: actor.hotelId,
            folioId: folio.id,
            type,
            description: delta > 0 ? positiveDescription : negativeDescription,
            unitAmount: amount,
            amount,
            netAmount: amount,
            roomId: target.id,
            ...(type === FolioItemType.TAX && { taxAmount: amount }),
          },
        });
        folioItemIds.push(item.id);
      };

      if (isRoomMove) {
        const item = await db.folioItem.create({
          data: {
            hotelId: actor.hotelId,
            folioId: folio.id,
            type: FolioItemType.ADJUSTMENT,
            description: `Room changed: ${fromLabel} to ${toLabel}${pricingDelta === 0 ? " — no rate change" : ""}`,
            unitAmount: 0,
            amount: 0,
            netAmount: 0,
            roomId: target.id,
          },
        });
        folioItemIds.push(item.id);
      }

      if (isEarlyDeparture && !creditEarlyDeparture && customEarlyDepartureCredit === 0) {
        const item = await db.folioItem.create({
          data: {
            hotelId: actor.hotelId,
            folioId: folio.id,
            type: FolioItemType.ADJUSTMENT,
            description: `Early departure: check-out ${shortDate(revisedCheckOut)} — original stay charges retained`,
            unitAmount: 0,
            amount: 0,
            netAmount: 0,
            roomId: target.id,
          },
        });
        folioItemIds.push(item.id);
      }

      if (customEarlyDepartureCredit > 0) {
        const item = await db.folioItem.create({
          data: {
            hotelId: actor.hotelId,
            folioId: folio.id,
            type: FolioItemType.DISCOUNT,
            description: `Approved early departure credit, check-out ${shortDate(revisedCheckOut)}`,
            unitAmount: customEarlyDepartureCredit,
            amount: customEarlyDepartureCredit,
            netAmount: customEarlyDepartureCredit,
            roomId: target.id,
          },
        });
        folioItemIds.push(item.id);
      }

      if (dateDelta > 0) {
        const additionalNights = revisedRemainingNights - oldRemainingNights;
        const extensionDescription = `Stay extension: ${additionalNights} additional night${additionalNights === 1 ? "" : "s"}, check-out ${shortDate(revisedCheckOut)}`;
        await postFolioDelta(
          dateSubtotalDelta,
          FolioItemType.ADJUSTMENT,
          extensionDescription,
          `Stay extension rate credit, check-out ${shortDate(revisedCheckOut)}`,
        );
        await postFolioDelta(
          dateTaxDelta,
          FolioItemType.TAX,
          `Tax on stay extension, check-out ${shortDate(revisedCheckOut)}`,
          `Tax credit on stay extension, check-out ${shortDate(revisedCheckOut)}`,
        );
      } else if (dateDelta < 0) {
        const removedNights = oldRemainingNights - revisedRemainingNights;
        const creditDescription = `Early departure credit: ${removedNights} unused night${removedNights === 1 ? "" : "s"}, check-out ${shortDate(revisedCheckOut)}`;
        await postFolioDelta(
          dateSubtotalDelta,
          FolioItemType.ADJUSTMENT,
          `Early departure rate adjustment, check-out ${shortDate(revisedCheckOut)}`,
          creditDescription,
        );
        await postFolioDelta(
          dateTaxDelta,
          FolioItemType.TAX,
          `Tax adjustment on early departure, check-out ${shortDate(revisedCheckOut)}`,
          `Tax credit on early departure, check-out ${shortDate(revisedCheckOut)}`,
        );
      }

      if (pricingDelta > 0) {
        const rateDescription = `${isRoomMove ? "Room change" : "Room"} rate adjustment${isRoomMove ? `: ${toLabel}` : ""}`;
        await postFolioDelta(
          pricingSubtotalDelta,
          FolioItemType.ADJUSTMENT,
          rateDescription,
          `${rateDescription} credit`,
        );
        await postFolioDelta(
          pricingTaxDelta,
          FolioItemType.TAX,
          `Tax on ${rateDescription.toLowerCase()}`,
          `Tax credit on ${rateDescription.toLowerCase()}`,
        );
      } else if (pricingDelta < 0) {
        const rateCreditDescription = `${isRoomMove ? "Room change" : "Room"} rate credit${isRoomMove ? `: ${toLabel}` : ""}`;
        await postFolioDelta(
          pricingSubtotalDelta,
          FolioItemType.ADJUSTMENT,
          `${rateCreditDescription} adjustment`,
          rateCreditDescription,
        );
        await postFolioDelta(
          pricingTaxDelta,
          FolioItemType.TAX,
          `Tax adjustment on ${rateCreditDescription.toLowerCase()}`,
          `Tax credit on ${rateCreditDescription.toLowerCase()}`,
        );
      }

      if (dto.rebateAmount > 0) {
        const item = await db.folioItem.create({
          data: {
            hotelId: actor.hotelId,
            folioId: folio.id,
            type: FolioItemType.DISCOUNT,
            description: "Guest service rebate",
            unitAmount: dto.rebateAmount,
            amount: dto.rebateAmount,
            netAmount: dto.rebateAmount,
            roomId: target.id,
          },
        });
        folioItemIds.push(item.id);
      }

      const nextSubtotal = Math.max(0, existing.subtotalAmount + (effectiveNewRemaining.subtotalAmount - oldRemaining.subtotalAmount));
      const nextTax = Math.max(0, existing.taxAmount + (effectiveNewRemaining.taxAmount - oldRemaining.taxAmount));
      const nextTotal = Math.max(0, existing.totalAmount + totalStayDelta - customEarlyDepartureCredit - dto.rebateAmount);

      await db.reservation.update({
        where: { id },
        data: {
          quotedRate: newRate,
          checkOutDate: revisedCheckOut,
          subtotalAmount: nextSubtotal,
          taxAmount: nextTax,
          totalAmount: nextTotal,
          // A lower rate or shorter stay changes the contracted accommodation
          // total; it is not a promotional discount. Only an explicit
          // goodwill rebate belongs in the reservation discount accumulator.
          discountAmount: { increment: customEarlyDepartureCredit + dto.rebateAmount },
          balanceDue: Math.max(0, nextTotal - existing.advancePaid),
        },
      });
      await db.reservationRoom.update({
        where: { id: current.id },
        data: {
          roomId: target.id,
          roomTypeId: target.roomType.id,
          ratePerNight: newRate,
          checkOutDate: revisedCheckOut,
          // The immutable stay-change row preserves the previous assignment.
          // The live ReservationRoom must cover only the destination room's
          // remaining occupancy window or availability would falsely show the
          // new room occupied before the move happened.
          ...(isRoomMove && { checkInDate: effectiveDate }),
        },
      });

      if (isRoomMove) {
        await db.room.update({ where: { id: current.roomId }, data: { status: RoomStatus.VACANT_DIRTY } });
        await db.room.update({ where: { id: target.id }, data: { status: RoomStatus.OCCUPIED } });
        await db.housekeepingTask.create({
          data: {
            hotelId: actor.hotelId,
            roomId: current.roomId,
            taskType: "ROOM_MOVE_CLEAN",
            priority: 3,
            scheduledDate: effectiveDate,
            notes: `Room move clean after ${existing.confirmationNumber}`,
          },
        });
        oldRoomForCleaning = current.room.number;
      }

      const changeType = dto.rebateAmount > 0 && !isRoomMove && !checkOutChanged && pricingDelta === 0
        ? "REBATE"
        : checkOutChanged
          ? revisedCheckOut > existing.checkOutDate ? "STAY_EXTENSION" : "EARLY_DEPARTURE"
          : isRoomMove ? "ROOM_MOVE"
          : "RATE_ADJUSTMENT";
      const stayChange = await db.reservationStayChange.create({
        data: {
          hotelId: actor.hotelId,
          reservationId: id,
          reservationRoomId: current.id,
          changeType,
          effectiveDate,
          fromRoomId: current.roomId,
          toRoomId: target.id,
          fromRoomNumber: current.room.number,
          toRoomNumber: target.number,
          fromRoomTypeName: current.roomType.name,
          toRoomTypeName: target.roomType.name,
          previousRate: current.ratePerNight,
          newRate,
          previousCheckOut: existing.checkOutDate,
          newCheckOut: revisedCheckOut,
          earlyDepartureTreatment: isEarlyDeparture ? dto.earlyDepartureTreatment : null,
          earlyDepartureCreditAmount: customEarlyDepartureCredit,
          rateAdjustment: totalStayDelta,
          rebateAmount: dto.rebateAmount,
          internalReason: dto.reason,
          customerDescription,
          folioItemIds,
          createdBy: actor.userId,
        },
      });

      await recalculateFolioTotals(db, folio.id);
      await db.auditLog.create({
        data: {
          hotelId: actor.hotelId,
          userId: actor.userId,
          action: "RESERVATION_STAY_CHANGE",
          entity: "reservation",
          entityId: id,
          notes: dto.reason,
          before: JSON.parse(JSON.stringify({
            roomId: current.roomId,
            ratePerNight: current.ratePerNight,
            checkOutDate: toIsoDate(existing.checkOutDate),
          })),
          after: JSON.parse(JSON.stringify({
            stayChangeId: stayChange.id,
            roomId: target.id,
            ratePerNight: newRate,
            checkOutDate: toIsoDate(revisedCheckOut),
            earlyDepartureTreatment: isEarlyDeparture ? dto.earlyDepartureTreatment : null,
            earlyDepartureCreditAmount: customEarlyDepartureCredit,
            rateAdjustment: totalStayDelta,
            rebateAmount: dto.rebateAmount,
          })),
        },
      });

      syncWindow = {
        dateFrom: toIsoDate(effectiveDate),
        dateTo: toIsoDate(revisedCheckOut > existing.checkOutDate ? revisedCheckOut : existing.checkOutDate),
      };
    });

    notifyHotelDataChanged(actor.hotelId);
    if (oldRoomForCleaning) {
      await notifyHousekeepingStaff(actor.hotelId, null, {
        title: "🧹 Room Move Cleaning Required",
        body: `Room ${oldRoomForCleaning} needs cleaning after a guest room move`,
        url: "/housekeeping/mobile",
      });
    }
    if (syncWindow) {
      const window = syncWindow as { dateFrom: string; dateTo: string };
      queueChannexSync({
        hotelId: actor.hotelId,
        reason: "RESERVATION",
        dateFrom: window.dateFrom,
        dateTo: window.dateTo,
      });
    }
    return ReservationService.get(withTenant, id);
  },

  async update(withTenant: WithTenantFn, actor: JwtPayload, id: string, dto: UpdateReservationDto) {
    // Hoisted out of the transaction so the post-commit .then() can see it —
    // the same shape updateStatus uses for checkoutCleanRoomNumber.
    let channexWindow: { dateFrom: string; dateTo: string } | null = null;

    return withTenant(async (db) => {
      const existing = await db.reservation.findUnique({
        where: { id },
        include: { rooms: true },
      });
      if (!existing) throw new AppError(404, "Reservation not found");

      if (dto.companyId) {
        await assertCompanyBelongsToHotel(db, actor.hotelId, dto.companyId);
      }

      const stayChanged =
        dto.checkInDate !== undefined || dto.checkOutDate !== undefined ||
        dto.roomId       !== undefined || dto.ratePerNight !== undefined;

      let stayUpdate: {
        checkInDate: Date; checkOutDate: Date; roomId: string; roomTypeId: string;
        ratePerNight: number; totalAmount: number; subtotalAmount: number;
        taxAmount: number; taxInclusive: boolean; taxBreakdown: Prisma.InputJsonValue;
        balanceDue: number;
      } | null = null;
      let stayDiff: Record<string, { from: unknown; to: unknown }> | null = null;

      if (stayChanged) {
        if (!STAY_EDITABLE_STATUSES.includes(existing.status)) {
          throw new AppError(409, `Dates and room can only be edited before check-in (current status: ${existing.status})`);
        }
        const currentRoom = existing.rooms[0];
        if (!currentRoom) throw new AppError(409, "Reservation has no room to edit");

        const checkInDate  = dto.checkInDate  ? new Date(dto.checkInDate)  : existing.checkInDate;
        const checkOutDate = dto.checkOutDate ? new Date(dto.checkOutDate) : existing.checkOutDate;
        if (checkOutDate <= checkInDate) throw new AppError(400, "Check-out must be after check-in");

        const roomId     = dto.roomId     ?? currentRoom.roomId;
        const roomTypeId = dto.roomId     ? dto.roomTypeId! : currentRoom.roomTypeId;
        const ratePerNight = dto.ratePerNight ?? currentRoom.ratePerNight;

        const conflict = await db.reservationRoom.findFirst({
          where: {
            roomId,
            checkInDate:  { lt: checkOutDate },
            checkOutDate: { gt: checkInDate },
            reservation: {
              status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] },
              id: { not: id },
            },
          },
          include: {
            room:        { select: { number: true } },
            reservation: { select: { confirmationNumber: true, guest: { select: { fullName: true } } } },
          },
        });
        if (conflict) throw new AppError(409, formatRoomConflictMessage(conflict));

        const selectedRoom = await db.room.findUnique({ where: { id: roomId }, select: { number: true } });
        if (!selectedRoom) throw new AppError(404, "Room not found");
        await assertNoInventoryBlock(db, roomId, selectedRoom.number, checkInDate, checkOutDate);

        if (dto.roomId) {
          const room = await db.room.findUnique({ where: { id: roomId }, select: { status: true, number: true } });
          if (!room) throw new AppError(404, "Room not found");
          const permanentlyBlocked: RoomStatus[] = [RoomStatus.OUT_OF_ORDER, RoomStatus.BLOCKED];
          if (permanentlyBlocked.includes(room.status)) {
            throw new AppError(409, `Room ${room.number} is currently ${room.status.toLowerCase().replace(/_/g, " ")} and cannot be reserved`);
          }
        }

        const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
        const hotel = await db.hotel.findUniqueOrThrow({
          where: { id: actor.hotelId },
          select: { settings: true },
        });
        const charges = calculateAccommodationCharges(
          ratePerNight * nights,
          (hotel.settings ?? {}) as Record<string, unknown>,
        );
        if (charges.totalAmount < existing.advancePaid) {
          throw new AppError(400, "New total is less than the advance already collected — adjust the advance first");
        }

        stayUpdate = {
          checkInDate, checkOutDate, roomId, roomTypeId, ratePerNight,
          totalAmount:    charges.totalAmount,
          subtotalAmount: charges.subtotalAmount,
          taxAmount:      charges.taxAmount,
          taxInclusive:   charges.taxInclusive,
          taxBreakdown:   charges.taxBreakdown as unknown as Prisma.InputJsonValue,
          balanceDue:     charges.totalAmount - existing.advancePaid,
        };
        stayDiff = {
          checkInDate:  { from: existing.checkInDate.toISOString().slice(0, 10), to: dto.checkInDate ?? null },
          checkOutDate: { from: existing.checkOutDate.toISOString().slice(0, 10), to: dto.checkOutDate ?? null },
          roomId:       { from: currentRoom.roomId, to: dto.roomId ?? null },
          ratePerNight: { from: currentRoom.ratePerNight, to: dto.ratePerNight ?? null },
        };

        // Union of the old and new stay windows. Moving a booking forward frees
        // the original dates as well as consuming the new ones, and both have
        // to be republished or the vacated nights stay invisible to the OTAs.
        const starts = [toIsoDate(existing.checkInDate), toIsoDate(checkInDate)].sort();
        const ends   = [toIsoDate(existing.checkOutDate), toIsoDate(checkOutDate)].sort();
        channexWindow = { dateFrom: starts[0], dateTo: ends[ends.length - 1] };
      }

      const updated = await db.reservation.update({
        where: { id },
        data: {
          ...(dto.adults          !== undefined && { adults:          dto.adults }),
          ...(dto.children        !== undefined && { children:        dto.children }),
          ...(dto.source          !== undefined && { source:          dto.source }),
          ...(dto.specialRequests !== undefined && { specialRequests: dto.specialRequests }),
          ...(dto.internalNotes   !== undefined && { internalNotes:   dto.internalNotes }),
          ...(dto.isVip           !== undefined && { isVip:           dto.isVip }),
          ...(dto.companyId       !== undefined && { companyId:       dto.companyId ?? null }),
          ...(dto.billToCompany   !== undefined && { billToCompany:   dto.billToCompany }),
          ...(stayUpdate && {
            checkInDate:    stayUpdate.checkInDate,
            checkOutDate:   stayUpdate.checkOutDate,
            quotedRate:     stayUpdate.ratePerNight,
            subtotalAmount: stayUpdate.subtotalAmount,
            taxAmount:      stayUpdate.taxAmount,
            taxInclusive:   stayUpdate.taxInclusive,
            taxBreakdown:   stayUpdate.taxBreakdown,
            totalAmount:    stayUpdate.totalAmount,
            balanceDue:     stayUpdate.balanceDue,
            rooms: {
              update: {
                where: { id: existing.rooms[0].id },
                data: {
                  roomId:       stayUpdate.roomId,
                  roomTypeId:   stayUpdate.roomTypeId,
                  ratePerNight: stayUpdate.ratePerNight,
                  checkInDate:  stayUpdate.checkInDate,
                  checkOutDate: stayUpdate.checkOutDate,
                },
              },
            },
          }),
        },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   stayDiff ? "RESERVATION_STAY_EDIT" : dto.isVip !== undefined ? "RESERVATION_VIP_TOGGLE" : "RESERVATION_UPDATE",
          entity:   "reservation",
          entityId: id,
          after:    JSON.parse(JSON.stringify(stayDiff ? { ...dto, stayDiff } : dto)),
        },
      });

      return updated;
    }).then((updated) => {
      notifyHotelDataChanged(actor.hotelId);
      // Only a stay edit moves inventory or price; a VIP toggle or a note does
      // not, so the sync is gated on the same flag that guarded the rewrite.
      if (channexWindow) {
        queueChannexSync({ hotelId: actor.hotelId, reason: "RESERVATION_EDIT", ...channexWindow });
      }
      return updated;
    });
  },
};
