import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { assertNoDuplicateGuest } from "../utils/guestDuplicate";
import { notifyHotelDataChanged } from "../lib/realtime";
import type { ListGuestsQuery, CreateGuestDto, UpdateGuestDto, BlacklistGuestDto, CheckBlacklistDto } from "../schemas/guests";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

const SEVERITY_TO_INT: Record<"LOW" | "MEDIUM" | "HIGH", number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const INT_TO_SEVERITY: Record<number, "LOW" | "MEDIUM" | "HIGH"> = { 1: "LOW", 2: "MEDIUM", 3: "HIGH" };

export const GuestService = {
  async listGuests(withTenant: WithTenantFn, query: ListGuestsQuery) {
    const skip  = (query.page - 1) * query.limit;
    const search = query.search?.trim();

    const where = {
      deletedAt: null,
      ...(query.blacklisted ? { isBlacklisted: true } : {}),
      ...(search && {
        OR: [
          { fullName:       { contains: search, mode: "insensitive" as const } },
          { email:          { contains: search, mode: "insensitive" as const } },
          { phone:          { contains: search, mode: "insensitive" as const } },
          { documentNumber: { contains: search, mode: "insensitive" as const } },
        ],
      }),
    };

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.guest.findMany({
          where,
          select: {
            id:             true,
            firstName:      true,
            lastName:       true,
            fullName:       true,
            email:          true,
            phone:          true,
            nationality:    true,
            city:           true,
            country:        true,
            documentType:   true,
            documentNumber: true,
            totalStays:     true,
            totalSpend:     true,
            isBlacklisted:  true,
            vipLevel:       true,
            createdAt:      true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: query.limit,
        }),
        db.guest.count({ where }),
      ])
    );

    return { data: items, meta: paginationMeta(total, query.page, query.limit) };
  },

  async getGuest(withTenant: WithTenantFn, id: string) {
    const guest = await withTenant((db) =>
      db.guest.findUnique({
        where: { id, deletedAt: null },
        include: {
          reservations: {
            select: {
              id:                 true,
              confirmationNumber: true,
              checkInDate:        true,
              checkOutDate:       true,
              status:             true,
              rooms: {
                include: { room: { select: { number: true } } },
              },
            },
            orderBy: { checkInDate: "desc" },
            take: 20,
          },
        },
      })
    );
    if (!guest) throw new AppError(404, "Guest not found");
    return guest;
  },

  async createGuest(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateGuestDto) {
    return withTenant(async (db) => {
      await assertNoDuplicateGuest(db, dto.phone, dto.documentNumber, dto.allowDuplicate);

      const guest = await db.guest.create({
        data: {
          hotelId:        actor.hotelId,
          firstName:      dto.firstName,
          lastName:       dto.lastName,
          fullName:       `${dto.firstName} ${dto.lastName}`,
          email:          dto.email || null,
          phone:          dto.phone,
          alternatePhone: dto.alternatePhone,
          nationality:    dto.nationality,
          gender:         dto.gender,
          dateOfBirth:    dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
          documentType:   dto.documentType,
          documentNumber: dto.documentNumber,
          address:        dto.address,
          city:           dto.city,
          country:        dto.country,
          internalNotes:  dto.internalNotes,
        },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "GUEST_CREATE",
          entity:   "guest",
          entityId: guest.id,
        },
      });

      return guest;
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },

  async updateGuest(withTenant: WithTenantFn, actor: JwtPayload, id: string, dto: UpdateGuestDto) {
    return withTenant(async (db) => {
      const existing = await db.guest.findUnique({ where: { id, deletedAt: null } });
      if (!existing) throw new AppError(404, "Guest not found");

      const firstName = dto.firstName ?? existing.firstName;
      const lastName  = dto.lastName  ?? existing.lastName;

      const updated = await db.guest.update({
        where: { id },
        data: {
          ...(dto.firstName      !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName       !== undefined && { lastName:  dto.lastName  }),
          fullName: `${firstName} ${lastName}`,
          ...(dto.email          !== undefined && { email:          dto.email || null }),
          ...(dto.phone          !== undefined && { phone:          dto.phone }),
          ...(dto.alternatePhone !== undefined && { alternatePhone: dto.alternatePhone }),
          ...(dto.nationality    !== undefined && { nationality:    dto.nationality }),
          ...(dto.gender         !== undefined && { gender:         dto.gender }),
          ...(dto.dateOfBirth    !== undefined && { dateOfBirth:    dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
          ...(dto.documentType   !== undefined && { documentType:   dto.documentType }),
          ...(dto.documentNumber !== undefined && { documentNumber: dto.documentNumber }),
          ...(dto.address        !== undefined && { address:        dto.address }),
          ...(dto.city           !== undefined && { city:           dto.city }),
          ...(dto.country        !== undefined && { country:        dto.country }),
          ...(dto.internalNotes  !== undefined && { internalNotes:  dto.internalNotes }),
          ...(dto.vipLevel       !== undefined && { vipLevel:       dto.vipLevel }),
        },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "GUEST_UPDATE",
          entity:   "guest",
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

  async blacklistGuest(withTenant: WithTenantFn, hotelId: string, guestId: string, dto: BlacklistGuestDto, actorId: string) {
    const severityInt = SEVERITY_TO_INT[dto.severity];
    return withTenant(async (db) => {
      const guest = await db.guest.findFirst({ where: { id: guestId, hotelId } });
      if (!guest) throw new AppError(404, "Guest not found");

      await db.guestBlacklist.create({
        data: {
          hotelId,
          guestId,
          reason:         dto.reason,
          severity:       severityInt,
          documentNumber: dto.documentNumber ?? guest.documentNumber ?? null,
          documentType:   guest.documentType,
        },
      });

      await db.guest.update({
        where: { id: guestId },
        data:  { isBlacklisted: true, blacklistReason: dto.reason },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "GUEST_BLACKLISTED",
          entity:   "guest",
          entityId: guestId,
          after:    { reason: dto.reason, severity: dto.severity },
        },
      });

      return db.guest.findFirst({ where: { id: guestId } });
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async removeFromBlacklist(withTenant: WithTenantFn, hotelId: string, guestId: string, actorId: string) {
    return withTenant(async (db) => {
      const guest = await db.guest.findFirst({ where: { id: guestId, hotelId } });
      if (!guest) throw new AppError(404, "Guest not found");

      await db.guestBlacklist.deleteMany({ where: { guestId, hotelId } });

      await db.guest.update({
        where: { id: guestId },
        data:  { isBlacklisted: false, blacklistReason: null },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "GUEST_UNBLACKLISTED",
          entity:   "guest",
          entityId: guestId,
        },
      });

      return db.guest.findFirst({ where: { id: guestId } });
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async checkBlacklist(withTenant: WithTenantFn, dto: CheckBlacklistDto) {
    return withTenant(async (db) => {
      const conditions: { documentNumber?: string; phone?: string; email?: string }[] = [];
      if (dto.documentNumber) conditions.push({ documentNumber: dto.documentNumber });
      if (dto.phone)          conditions.push({ phone: dto.phone });
      if (dto.email)          conditions.push({ email: dto.email });

      const matches = await db.guest.findMany({
        where: { isBlacklisted: true, deletedAt: null, OR: conditions },
        include: { blacklistEntries: { orderBy: { createdAt: "desc" }, take: 1 } },
      });

      return {
        matched: matches.length > 0,
        matches: matches.map((g) => {
          const bl = g.blacklistEntries[0];
          return {
            guestId:        g.id,
            guestName:      g.fullName,
            documentNumber: g.documentNumber,
            reason:         g.blacklistReason ?? bl?.reason ?? "",
            severity:       INT_TO_SEVERITY[bl?.severity ?? 1] ?? "LOW",
            blacklistedAt:  bl?.createdAt?.toISOString() ?? null,
          };
        }),
      };
    });
  },
};
