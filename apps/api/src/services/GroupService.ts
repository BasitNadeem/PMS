import { Prisma, type TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { NotificationService } from "./NotificationService";
import { ReservationService, formatRoomConflictMessage } from "./ReservationService";
import { assertNoDuplicateGuest } from "../utils/guestDuplicate";
import { notifyHotelDataChanged } from "../lib/realtime";
import { enqueueReservationEmail } from "../lib/reservationEmails";
import { calculateAccommodationCharges } from "../lib/accommodationCharges";
import { assertCompanyBelongsToHotel } from "./CompanyService";
import {
  GROUP_STATUSES,
  type ListGroupsQuery,
  type CreateGroupDto,
  type UpdateGroupDto,
  type GroupStatus,
  type PaymentTerms,
  type AddGuestToGroupDto,
} from "../schemas/groups";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

const PENDING_ROOM_NOTE = "PENDING_ASSIGNMENT";

// Payment terms that mean "the company settles this later, not the guest".
// CREDIT_30/CREDIT_60 are legacy spellings kept so pre-existing groups behave
// the same; new bookings all use COMPANY_CREDIT.
const BILLS_TO_COMPANY = new Set<string>(["COMPANY_CREDIT", "CREDIT_30", "CREDIT_60"]);

const GROUP_TRANSITIONS: Partial<Record<GroupStatus, GroupStatus[]>> = {
  ENQUIRY:    ["CONFIRMED", "CANCELLED"],
  CONFIRMED:  ["CHECKED_IN", "CANCELLED"],
  CHECKED_IN: ["CHECKED_OUT"],
};

interface GroupNotes {
  paymentTerms:   PaymentTerms;
  advancePaid:    number;
  negotiatedRate: number;
  status:         GroupStatus;
  totalRooms:     number;
  checkInDate:    string;
  checkOutDate:   string;
  internalNotes:  string;
}

const DEFAULT_NOTES: GroupNotes = {
  paymentTerms:   "CASH",
  advancePaid:    0,
  negotiatedRate: 0,
  status:         "ENQUIRY",
  totalRooms:     0,
  checkInDate:    "",
  checkOutDate:   "",
  internalNotes:  "",
};

function parseNotes(notes: string | null): GroupNotes {
  if (!notes) return { ...DEFAULT_NOTES };
  try {
    const parsed = JSON.parse(notes) as Partial<GroupNotes>;
    return { ...DEFAULT_NOTES, ...parsed };
  } catch {
    return { ...DEFAULT_NOTES };
  }
}

function serializeNotes(data: GroupNotes): string {
  return JSON.stringify(data);
}

function nightsBetween(checkIn: string | Date, checkOut: string | Date): number {
  const a = new Date(checkIn).getTime();
  const b = new Date(checkOut).getTime();
  return Math.max(1, Math.ceil((b - a) / (1000 * 60 * 60 * 24)));
}

function shortDate(d: Date) {
  return d.toLocaleDateString("en-PK", { day: "numeric", month: "short" });
}

export async function generateGroupRef(db: TenantTx, hotelId: string): Promise<string> {
  const year   = new Date().getFullYear();
  const prefix = `GRP-${year}-`;

  const last = await db.groupBooking.findFirst({
    where:   { hotelId, groupRef: { startsWith: prefix } },
    orderBy: { groupRef: "desc" },
    select:  { groupRef: true },
  });

  let next = 1;
  if (last?.groupRef) {
    const num = parseInt(last.groupRef.slice(prefix.length), 10);
    if (!isNaN(num)) next = num + 1;
  }
  return `${prefix}${String(next).padStart(3, "0")}`;
}

const GROUP_INCLUDE = {
  reservations: {
    include: {
      guest: { select: { id: true, fullName: true, phone: true } },
      rooms: {
        include: {
          room:     { select: { id: true, number: true, floor: true } },
          roomType: { select: { id: true, name: true, typeName: true } },
        },
      },
      folio: {
        select: { id: true, chargesTotal: true, paymentsTotal: true, balanceDue: true, isOpen: true },
      },
    },
    orderBy: { createdAt: "asc" as const },
  },
  members: {
    include: {
      guest: { select: { id: true, fullName: true, phone: true } },
    },
  },
  company: {
    select: { id: true, name: true, type: true, creditLimit: true, balance: true, paymentTerms: true },
  },
} as const;

type GroupCompany = {
  id: string; name: string; type: string;
  creditLimit: bigint; balance: bigint; paymentTerms: string;
};

/** BIGINT paisa -> number, so the group response can be JSON-serialised. */
function groupCompanyJson(company: GroupCompany | null) {
  if (!company) return null;
  return {
    ...company,
    creditLimit: Number(company.creditLimit),
    balance:     Number(company.balance),
  };
}

export const GroupService = {
  async listGroups(withTenant: WithTenantFn, query: ListGroupsQuery) {
    const search = query.search?.trim();

    const groups = await withTenant((db) =>
      db.groupBooking.findMany({
        where: {
          ...(search && {
            OR: [
              { name:      { contains: search, mode: "insensitive" as const } },
              { groupRef:  { contains: search, mode: "insensitive" as const } },
              { payerName: { contains: search, mode: "insensitive" as const } },
            ],
          }),
        },
        include: {
          _count: { select: { reservations: true, members: true } },
        },
        orderBy: { createdAt: "desc" },
      })
    );

    const enriched = groups.map((g) => {
      const notes = parseNotes(g.notes);
      return {
        id:           g.id,
        name:         g.name,
        groupRef:     g.groupRef,
        payerType:    g.payerType,
        payerName:    g.payerName,
        payerContact: g.payerContact,
        billingType:  g.billingType,
        status:       notes.status,
        checkInDate:  notes.checkInDate,
        checkOutDate: notes.checkOutDate,
        totalRooms:   g._count.reservations,
        memberCount:  g._count.members,
        createdAt:    g.createdAt,
      };
    });

    const filtered = query.status
      ? enriched.filter((g) => g.status === query.status)
      : enriched;

    const total = filtered.length;
    const start = (query.page - 1) * query.limit;
    const data  = filtered.slice(start, start + query.limit);

    return { data, meta: paginationMeta(total, query.page, query.limit) };
  },

  async getSummary(withTenant: WithTenantFn) {
    const groups = await withTenant((db) =>
      db.groupBooking.findMany({ select: { notes: true } })
    );

    const counts: Record<GroupStatus, number> & { total: number } = {
      ENQUIRY: 0, CONFIRMED: 0, CHECKED_IN: 0, CHECKED_OUT: 0, CANCELLED: 0,
      total: groups.length,
    };

    for (const g of groups) {
      const status = parseNotes(g.notes).status;
      if (GROUP_STATUSES.includes(status)) counts[status] += 1;
    }

    return counts;
  },

  async getGroup(withTenant: WithTenantFn, groupId: string) {
    const group = await withTenant((db) =>
      db.groupBooking.findUnique({
        where:   { id: groupId },
        include: GROUP_INCLUDE,
      })
    );
    if (!group) throw new AppError(404, "Group booking not found");

    const notes = parseNotes(group.notes);

    let totalCharged = 0;
    let totalPaid    = 0;
    let totalBalance = 0;
    for (const r of group.reservations) {
      if (r.folio) {
        totalCharged += r.folio.chargesTotal;
        totalPaid    += r.folio.paymentsTotal;
        totalBalance += r.folio.balanceDue;
      }
    }

    const reservations = group.reservations.map((r) => ({
      id:                 r.id,
      confirmationNumber: r.confirmationNumber,
      status:             r.status,
      checkInDate:        r.checkInDate,
      checkOutDate:       r.checkOutDate,
      subtotalAmount:     r.subtotalAmount,
      taxAmount:          r.taxAmount,
      taxInclusive:       r.taxInclusive,
      taxBreakdown:       r.taxBreakdown,
      totalAmount:        r.totalAmount,
      guest:              r.guest,
      room: r.rooms[0]
        ? {
            pending:  r.rooms[0].notes === PENDING_ROOM_NOTE,
            number:   r.rooms[0].room.number,
            floor:    r.rooms[0].room.floor,
            roomType: r.rooms[0].roomType,
          }
        : null,
      folio: r.folio,
    }));

    return {
      id:             group.id,
      name:           group.name,
      groupRef:       group.groupRef,
      payerType:      group.payerType,
      companyId:      group.companyId,
      // creditLimit and balance are BIGINT paisa on the company table, so they
      // arrive as JS BigInt and cannot be JSON-serialised as-is.
      company:        groupCompanyJson(group.company),
      payerName:      group.payerName,
      payerContact:   group.payerContact,
      billingType:    group.billingType,
      paymentTerms:   notes.paymentTerms,
      advancePaid:    notes.advancePaid,
      negotiatedRate: notes.negotiatedRate,
      status:         notes.status,
      checkInDate:    notes.checkInDate,
      checkOutDate:   notes.checkOutDate,
      internalNotes:  notes.internalNotes,
      createdAt:      group.createdAt,
      reservations,
      members: group.members.map((m) => ({
        id:       m.id,
        isLeader: m.isLeader,
        roomPreference: m.roomPreference,
        guest:    m.guest,
      })),
      summary: {
        totalRooms:   group.reservations.length,
        totalCharged,
        totalPaid,
        totalBalance,
      },
    };
  },

  async createGroup(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateGroupDto) {
    return withTenant(async (db) => {
      if (dto.companyId) {
        await assertCompanyBelongsToHotel(db, actor.hotelId, dto.companyId);
      }
      const groupRef = dto.groupRef?.trim() || (await generateGroupRef(db, actor.hotelId));
      const nights   = nightsBetween(dto.checkInDate, dto.checkOutDate);

      const notes: GroupNotes = {
        paymentTerms:   dto.paymentTerms,
        advancePaid:    Math.round(dto.advancePaid * 100),
        negotiatedRate: dto.negotiatedRate,
        status:         "ENQUIRY",
        totalRooms:     dto.totalRooms,
        checkInDate:    dto.checkInDate,
        checkOutDate:   dto.checkOutDate,
        internalNotes:  dto.notes ?? "",
      };

      const group = await db.groupBooking.create({
        data: {
          hotelId:      actor.hotelId,
          name:         dto.name,
          groupRef,
          billingType:  dto.billingType,
          payerType:    dto.payerType,
          payerName:    dto.payerName,
          payerContact: dto.payerContact,
          companyId:    dto.companyId ?? null,
          notes:        serializeNotes(notes),
        },
      });

      // ── Leader guest ──────────────────────────────────────────────────────
      let leaderGuestId: string;
      if (dto.leaderGuest.existingGuestId) {
        leaderGuestId = dto.leaderGuest.existingGuestId;
      } else if (dto.leaderGuest.newGuest) {
        const ng = dto.leaderGuest.newGuest;
        await assertNoDuplicateGuest(db, ng.phone, ng.documentNumber, ng.allowDuplicate);
        const guest = await db.guest.create({
          data: {
            hotelId:        actor.hotelId,
            firstName:      ng.firstName,
            lastName:       ng.lastName,
            fullName:       `${ng.firstName} ${ng.lastName}`,
            phone:          ng.phone,
            documentType:   ng.documentType,
            documentNumber: ng.documentNumber,
          },
        });
        leaderGuestId = guest.id;
      } else {
        throw new AppError(400, "Leader guest is required");
      }

      await db.groupMember.create({
        data: { groupId: group.id, guestId: leaderGuestId, isLeader: true },
      });

      // ── Reservations + folios ────────────────────────────────────────────
      const usedRoomIds = new Set<string>();
      let createdRooms = 0;
      const hotel = await db.hotel.findUniqueOrThrow({
        where: { id: actor.hotelId },
        select: { settings: true },
      });
      const hotelSettings = (hotel.settings ?? {}) as Record<string, unknown>;

      for (const roomSpec of dto.rooms) {
        const roomType = await db.roomType.findUnique({ where: { id: roomSpec.roomTypeId } });
        if (!roomType) throw new AppError(404, `Room type ${roomSpec.roomTypeId} not found`);

        const candidates = await db.room.findMany({
          where:   { hotelId: actor.hotelId, roomTypeId: roomSpec.roomTypeId, isActive: true },
          orderBy: { number: "asc" },
        });
        if (candidates.length === 0) {
          throw new AppError(400, `No rooms configured for room type "${roomType.name}"`);
        }

        const ratePerNight = roomSpec.ratePerNight ?? roomType.defaultRate;
        const charges = calculateAccommodationCharges(ratePerNight * nights, hotelSettings);
        const totalAmount = charges.totalAmount;
        const checkInDate  = new Date(dto.checkInDate);
        const checkOutDate = new Date(dto.checkOutDate);

        for (let i = 0; i < roomSpec.quantity; i++) {
          let chosenRoomId: string | null = null;
          for (const candidate of candidates) {
            if (usedRoomIds.has(candidate.id)) continue;
            const conflict = await db.reservationRoom.findFirst({
              where: {
                roomId:       candidate.id,
                checkInDate:  { lt: checkOutDate },
                checkOutDate: { gt: checkInDate },
                reservation:  { status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] } },
              },
            });
            if (!conflict) { chosenRoomId = candidate.id; break; }
          }

          const pending = chosenRoomId === null;
          const roomId  = chosenRoomId ?? candidates[0]!.id;
          usedRoomIds.add(roomId);

          // Folio is NOT created here — it is created at check-in.
          await db.reservation.create({
            data: {
              hotelId:            actor.hotelId,
              guestId:            leaderGuestId,
              groupId:            group.id,
              // Inherited from the group so checkout can find the credit
              // account without walking back up to the group every time.
              companyId:          group.companyId,
              // Credit terms on the group are what makes the balance
              // transferable at checkout instead of blocking it.
              billToCompany:      group.companyId !== null && BILLS_TO_COMPANY.has(dto.paymentTerms),
              confirmationNumber: "",
              status:             "ENQUIRY",
              source:             "WALK_IN",
              checkInDate,
              checkOutDate,
              adults:             1,
              quotedRate:         ratePerNight,
              subtotalAmount:     charges.subtotalAmount,
              taxAmount:          charges.taxAmount,
              taxInclusive:       charges.taxInclusive,
              taxBreakdown:       charges.taxBreakdown as unknown as Prisma.InputJsonValue,
              totalAmount,
              balanceDue:         totalAmount,
              rooms: {
                create: {
                  roomId,
                  roomTypeId:   roomSpec.roomTypeId,
                  ratePerNight,
                  checkInDate,
                  checkOutDate,
                  notes: pending ? PENDING_ROOM_NOTE : null,
                },
              },
            },
          });

          createdRooms++;
        }
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "GROUP_CREATE",
          entity:   "group_booking",
          entityId: group.id,
          after:    JSON.parse(JSON.stringify({ name: dto.name, groupRef, totalRooms: createdRooms })),
        },
      });

      try {
        await NotificationService.createNotification(db, actor.hotelId, {
          title:      "New Group Booking",
          body:       `${dto.name} · ${createdRooms} room${createdRooms !== 1 ? "s" : ""}`,
          type:       "NEW_GROUP_BOOKING",
          entityId:   group.id,
          entityType: "group_booking",
        });
      } catch { /* notifications are non-critical */ }

      return GroupService.getGroup(async (fn) => fn(db), group.id);
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },

  async updateGroup(withTenant: WithTenantFn, actor: JwtPayload, groupId: string, dto: UpdateGroupDto) {
    return withTenant(async (db) => {
      const existing = await db.groupBooking.findUnique({ where: { id: groupId } });
      if (!existing) throw new AppError(404, "Group booking not found");

      const notes = parseNotes(existing.notes);
      const updatedNotes: GroupNotes = {
        ...notes,
        ...(dto.paymentTerms   !== undefined && { paymentTerms:   dto.paymentTerms }),
        ...(dto.advancePaid    !== undefined && { advancePaid:    Math.round(dto.advancePaid * 100) }),
        ...(dto.negotiatedRate !== undefined && { negotiatedRate: dto.negotiatedRate }),
        ...(dto.checkInDate    !== undefined && { checkInDate:    dto.checkInDate }),
        ...(dto.checkOutDate   !== undefined && { checkOutDate:   dto.checkOutDate }),
        ...(dto.totalRooms     !== undefined && { totalRooms:     dto.totalRooms }),
        ...(dto.notes          !== undefined && { internalNotes:  dto.notes }),
      };

      if (dto.companyId) {
        await assertCompanyBelongsToHotel(db, actor.hotelId, dto.companyId);
      }

      await db.groupBooking.update({
        where: { id: groupId },
        data: {
          ...(dto.name         !== undefined && { name:         dto.name }),
          ...(dto.payerType    !== undefined && { payerType:    dto.payerType }),
          ...(dto.payerName    !== undefined && { payerName:    dto.payerName }),
          ...(dto.payerContact !== undefined && { payerContact: dto.payerContact }),
          ...(dto.companyId    !== undefined && { companyId:    dto.companyId ?? null }),
          ...(dto.billingType  !== undefined && { billingType:  dto.billingType }),
          notes: serializeNotes(updatedNotes),
        },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "GROUP_UPDATE",
          entity:   "group_booking",
          entityId: groupId,
          after:    JSON.parse(JSON.stringify(dto)),
        },
      });

      return GroupService.getGroup(async (fn) => fn(db), groupId);
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },

  async updateGroupStatus(withTenant: WithTenantFn, actor: JwtPayload, groupId: string, newStatus: GroupStatus) {
    return withTenant(async (db) => {
      const existing = await db.groupBooking.findUnique({ where: { id: groupId } });
      if (!existing) throw new AppError(404, "Group booking not found");

      const notes = parseNotes(existing.notes);
      const allowed = GROUP_TRANSITIONS[notes.status];
      if (!allowed?.includes(newStatus)) {
        throw new AppError(400, `Cannot transition from ${notes.status} to ${newStatus}`);
      }

      await db.groupBooking.update({
        where: { id: groupId },
        data:  { notes: serializeNotes({ ...notes, status: newStatus }) },
      });

      if (newStatus === "CONFIRMED") {
        await db.reservation.updateMany({
          where: { groupId, status: "ENQUIRY" },
          data:  { status: "CONFIRMED" },
        });
      } else if (newStatus === "CANCELLED") {
        await db.reservation.updateMany({
          where: { groupId, status: { notIn: ["CHECKED_IN", "CHECKED_OUT", "CANCELLED"] } },
          data:  { status: "CANCELLED", cancelledAt: new Date(), cancelledBy: actor.userId },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   `GROUP_${newStatus}`,
          entity:   "group_booking",
          entityId: groupId,
          before:   JSON.parse(JSON.stringify({ status: notes.status })),
          after:    JSON.parse(JSON.stringify({ status: newStatus })),
        },
      });

      return GroupService.getGroup(async (fn) => fn(db), groupId);
    }).then(async (result) => {
      notifyHotelDataChanged(actor.hotelId);
      if (newStatus === "CONFIRMED" || newStatus === "CANCELLED") {
        try {
          const reservationIds = await withTenant((db) =>
            db.reservation.findMany({
              where: { groupId },
              select: { id: true },
            }).then((rows) => rows.map((row) => row.id))
          );
          await enqueueReservationEmail(newStatus, reservationIds, actor.hotelId);
        } catch (err) {
          console.error(`Failed to enqueue group ${newStatus.toLowerCase()} email:`, err);
        }
      }
      return result;
    });
  },

  async checkInGroup(withTenant: WithTenantFn, actor: JwtPayload, groupId: string) {
    const reservations = await withTenant((db) =>
      db.reservation.findMany({
        where: { groupId, status: "CONFIRMED" },
        select: { id: true },
      })
    );

    for (const r of reservations) {
      await ReservationService.updateStatus(withTenant, actor, r.id, "CHECKED_IN");
    }

    return withTenant(async (db) => {
      const existing = await db.groupBooking.findUnique({ where: { id: groupId } });
      if (!existing) throw new AppError(404, "Group booking not found");
      const notes = parseNotes(existing.notes);

      await db.groupBooking.update({
        where: { id: groupId },
        data:  { notes: serializeNotes({ ...notes, status: "CHECKED_IN" }) },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "GROUP_CHECKED_IN",
          entity:   "group_booking",
          entityId: groupId,
          before:   JSON.parse(JSON.stringify({ status: notes.status })),
          after:    JSON.parse(JSON.stringify({ status: "CHECKED_IN" })),
        },
      });

      return GroupService.getGroup(async (fn) => fn(db), groupId);
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },

  async checkOutGroup(withTenant: WithTenantFn, actor: JwtPayload, groupId: string) {
    const reservations = await withTenant((db) =>
      db.reservation.findMany({
        where: { groupId, status: "CHECKED_IN" },
        select: { id: true },
      })
    );

    for (const r of reservations) {
      await ReservationService.updateStatus(withTenant, actor, r.id, "CHECKED_OUT");
    }

    return withTenant(async (db) => {
      const existing = await db.groupBooking.findUnique({ where: { id: groupId } });
      if (!existing) throw new AppError(404, "Group booking not found");
      const notes = parseNotes(existing.notes);

      await db.groupBooking.update({
        where: { id: groupId },
        data:  { notes: serializeNotes({ ...notes, status: "CHECKED_OUT" }) },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "GROUP_CHECKED_OUT",
          entity:   "group_booking",
          entityId: groupId,
          before:   JSON.parse(JSON.stringify({ status: notes.status })),
          after:    JSON.parse(JSON.stringify({ status: "CHECKED_OUT" })),
        },
      });

      return GroupService.getGroup(async (fn) => fn(db), groupId);
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },

  async addMember(withTenant: WithTenantFn, actor: JwtPayload, groupId: string, dto: AddGuestToGroupDto) {
    return withTenant(async (db) => {
      const group = await db.groupBooking.findUnique({ where: { id: groupId } });
      if (!group) throw new AppError(404, "Group booking not found");

      const existingMember = await db.groupMember.findUnique({
        where: { groupId_guestId: { groupId, guestId: dto.guestId } },
      });
      if (existingMember) throw new AppError(409, "Guest is already a member of this group");

      if (dto.isLeader) {
        await db.groupMember.updateMany({ where: { groupId }, data: { isLeader: false } });
      }

      await db.groupMember.create({
        data: {
          groupId,
          guestId:        dto.guestId,
          isLeader:       dto.isLeader,
          roomPreference: dto.roomPreference,
        },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "GROUP_MEMBER_ADD",
          entity:   "group_booking",
          entityId: groupId,
          after:    JSON.parse(JSON.stringify({ guestId: dto.guestId, isLeader: dto.isLeader })),
        },
      });

      return GroupService.getGroup(async (fn) => fn(db), groupId);
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },

  async assignRoom(withTenant: WithTenantFn, actor: JwtPayload, groupId: string, reservationId: string, roomId: string) {
    return withTenant(async (db) => {
      const reservation = await db.reservation.findUnique({
        where:   { id: reservationId },
        include: { rooms: true },
      });
      if (!reservation || reservation.groupId !== groupId) {
        throw new AppError(404, "Reservation not found in this group");
      }

      const reservationRoom = reservation.rooms[0];
      if (!reservationRoom) throw new AppError(404, "Reservation has no room slot to assign");

      const conflict = await db.reservationRoom.findFirst({
        where: {
          roomId,
          id:           { not: reservationRoom.id },
          checkInDate:  { lt: reservation.checkOutDate },
          checkOutDate: { gt: reservation.checkInDate },
          reservation:  { status: { notIn: ["CANCELLED", "CHECKED_OUT", "NO_SHOW"] } },
        },
        include: {
          room:        { select: { number: true } },
          reservation: { select: { confirmationNumber: true, guest: { select: { fullName: true } } } },
        },
      });
      if (conflict) throw new AppError(409, formatRoomConflictMessage(conflict));

      const room = await db.room.findUnique({ where: { id: roomId } });
      if (!room) throw new AppError(404, "Room not found");

      await db.reservationRoom.update({
        where: { id: reservationRoom.id },
        data:  { roomId, roomTypeId: room.roomTypeId, notes: null },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "GROUP_ROOM_ASSIGN",
          entity:   "reservation",
          entityId: reservationId,
          after:    JSON.parse(JSON.stringify({ roomId })),
        },
      });

      return GroupService.getGroup(async (fn) => fn(db), groupId);
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },
};
