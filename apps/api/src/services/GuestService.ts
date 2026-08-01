import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { assertNoDuplicateGuest } from "../utils/guestDuplicate";
import { notifyHotelDataChanged } from "../lib/realtime";
import { GuestOccasionService } from "./GuestOccasionService";
import type { ListGuestsQuery, CreateGuestDto, UpdateGuestDto, BlacklistGuestDto, CheckBlacklistDto, SpecialDateDto } from "../schemas/guests";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

const SEVERITY_TO_INT: Record<"LOW" | "MEDIUM" | "HIGH", number> = { LOW: 1, MEDIUM: 2, HIGH: 3 };
const INT_TO_SEVERITY: Record<number, "LOW" | "MEDIUM" | "HIGH"> = { 1: "LOW", 2: "MEDIUM", 3: "HIGH" };

const DOMESTIC_NATIONALITIES = new Set(["pakistani", "pakistan", "pak"]);

/**
 * `isForeigner` drives the demographics report and the foreign-guest register.
 * It is derived rather than asked for separately so the front desk cannot leave
 * it inconsistent with the nationality they just typed. An unknown nationality
 * stays `false` — we record what we know rather than guessing.
 */
function deriveIsForeigner(nationality: string | null | undefined): boolean {
  if (!nationality) return false;
  return !DOMESTIC_NATIONALITIES.has(nationality.trim().toLowerCase());
}

/**
 * Turns a captured date of birth into a birthday entry, so the front desk never
 * types the same date twice.
 *
 * The DOB field is filled during normal registration from the guest's CNIC or
 * passport. Asking again on a separate screen for the same number is the kind of
 * duplicate data entry that quietly kills a feature, so the birthday is derived
 * here instead.
 *
 * An explicit birthday always wins — if someone has corrected the greeting date
 * by hand, re-saving the profile must not overwrite it with the document value.
 *
 * Note this only creates the *date*. Sending anything still requires the
 * separate marketing opt-in, so a document scan cannot silently enrol a guest
 * into birthday emails.
 */
function withDerivedBirthday(
  specialDates: SpecialDateDto[] | undefined,
  dateOfBirth: string | null | undefined,
): SpecialDateDto[] | undefined {
  if (!dateOfBirth) return specialDates;

  const dates = specialDates ?? [];
  if (dates.some((d) => d.kind === "BIRTHDAY")) return dates;

  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) return specialDates;

  return [
    ...dates,
    {
      kind:   "BIRTHDAY" as const,
      month:  dob.getUTCMonth() + 1,
      day:    dob.getUTCDate(),
      year:   dob.getUTCFullYear(),
      source: "DOCUMENT",
    },
  ];
}

/** Collapses casing and duplicate variants so "VIP" and "vip" stay one tag. */
function normaliseTags(tags: string[] | undefined): string[] | undefined {
  if (!tags) return undefined;
  const seen = new Map<string, string>();
  for (const tag of tags) {
    const trimmed = tag.trim();
    if (trimmed) seen.set(trimmed.toLowerCase(), trimmed);
  }
  return [...seen.values()];
}

export const GuestService = {
  async listGuests(withTenant: WithTenantFn, query: ListGuestsQuery) {
    const skip  = (query.page - 1) * query.limit;
    const search = query.search?.trim();

    const where = {
      deletedAt: null,
      ...(query.blacklisted ? { isBlacklisted: true } : {}),
      ...(query.tags?.length ? { tags: { hasSome: query.tags } } : {}),
      ...(query.minVipLevel ? { vipLevel: { gte: query.minVipLevel } } : {}),
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
            tags:           true,
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

  /**
   * Distinct tags already in use, with a count, for the tag picker and filters.
   *
   * Raw SQL is warranted here: Prisma cannot aggregate over the elements of a
   * `String[]` column, and the alternative — pulling every guest's tags into
   * Node to flatten them — scans the whole table on each keystroke. RLS still
   * applies, because the tenant session variables are set on this transaction.
   */
  async listTags(withTenant: WithTenantFn) {
    const rows = await withTenant((db) =>
      db.$queryRaw<Array<{ tag: string; count: bigint }>>`
        SELECT tag, COUNT(*) AS count
        FROM guests g, UNNEST(g.tags) AS tag
        WHERE g.deleted_at IS NULL
        GROUP BY tag
        ORDER BY COUNT(*) DESC, tag ASC
        LIMIT 100
      `
    );
    return rows.map((r) => ({ tag: r.tag, count: Number(r.count) }));
  },

  async getGuest(withTenant: WithTenantFn, id: string) {
    // Both reads share one transaction — a second `withTenant` call would open
    // a second interactive transaction for the same page load.
    const { guest, allStays } = await withTenant(async (db) => ({
      guest: await db.guest.findUnique({
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
                include: {
                  room:     { select: { number: true } },
                  roomType: { select: { name: true } },
                },
              },
            },
            orderBy: { checkInDate: "desc" },
            take: 20,
          },
          specialDates: {
            select: { id: true, kind: true, label: true, month: true, day: true, year: true, source: true },
            orderBy: [{ month: "asc" }, { day: "asc" }],
          },
          blacklistEntries: {
            select: { severity: true },
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
      // The `reservations` above are capped at the 20 most recent for the
      // timeline, so the stats below read the full history separately.
      allStays: await db.reservation.findMany({
        where:  { guestId: id },
        select: {
          status:         true,
          checkInDate:    true,
          checkOutDate:   true,
          actualCheckOut: true,
          rooms:          { select: { roomType: { select: { name: true } } } },
        },
      }),
    }));
    if (!guest) throw new AppError(404, "Guest not found");

    // Everything below is derived on read — no new tables, and nothing for
    // staff to keep up to date.
    const completed = allStays.filter((r) => r.status === "CHECKED_OUT");

    let totalNights = 0;
    const roomTypeCounts = new Map<string, number>();
    for (const stay of completed) {
      const nights = Math.max(
        1,
        Math.round((stay.checkOutDate.getTime() - stay.checkInDate.getTime()) / 86_400_000),
      );
      totalNights += nights;
      for (const room of stay.rooms) {
        const name = room.roomType?.name;
        if (name) roomTypeCounts.set(name, (roomTypeCounts.get(name) ?? 0) + 1);
      }
    }

    const favouriteRoomType = [...roomTypeCounts.entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const lastStayAt = completed
      .map((r) => r.actualCheckOut ?? r.checkOutDate)
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

    const { blacklistEntries, ...guestData } = guest;
    const severity = blacklistEntries[0]?.severity;
    return {
      ...guestData,
      reservationCount: allStays.length,
      blacklistSeverity: severity === 3 ? "HIGH" : severity === 2 ? "MEDIUM" : severity === 1 ? "LOW" : null,
      stats: {
        totalNights,
        avgNightsPerStay:  completed.length > 0 ? +(totalNights / completed.length).toFixed(1) : 0,
        // Spend is stored in minor units; averaging here keeps the frontend
        // free of currency arithmetic.
        avgSpendPerStay:   completed.length > 0 ? Math.round(guest.totalSpend / completed.length) : 0,
        cancelledCount:    allStays.filter((r) => r.status === "CANCELLED").length,
        noShowCount:       allStays.filter((r) => r.status === "NO_SHOW").length,
        upcomingCount:     allStays.filter((r) => r.status === "CONFIRMED").length,
        favouriteRoomType,
        lastStayAt:        lastStayAt?.toISOString() ?? null,
        daysSinceLastStay: lastStayAt
          ? Math.floor((Date.now() - lastStayAt.getTime()) / 86_400_000)
          : null,
      },
    };
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
          documentExpiry: dto.documentExpiry ? new Date(dto.documentExpiry) : null,
          address:        dto.address,
          city:           dto.city,
          country:        dto.country,
          language:       dto.language,
          internalNotes:  dto.internalNotes,
          vipLevel:       dto.vipLevel ?? 0,
          tags:           normaliseTags(dto.tags) ?? [],
          isForeigner:    deriveIsForeigner(dto.nationality),
          marketingOptIn: dto.marketingOptIn ?? false,
          marketingOptInAt: dto.marketingOptIn ? new Date() : null,
          specialDatesDeclinedAt: dto.specialDatesDeclined ? new Date() : null,
        },
      });

      const specialDates = withDerivedBirthday(dto.specialDates, dto.dateOfBirth);
      if (specialDates?.length) {
        await GuestOccasionService.replaceSpecialDates(db, actor.hotelId, guest.id, specialDates);
      }

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

      if (dto.phone !== undefined || dto.documentNumber !== undefined) {
        await assertNoDuplicateGuest(
          db,
          dto.phone ?? existing.phone,
          dto.documentNumber ?? existing.documentNumber,
          dto.allowDuplicate,
          id,
        );
      }

      const updated = await db.guest.update({
        where: { id },
        data: {
          ...(dto.firstName      !== undefined && { firstName: dto.firstName }),
          ...(dto.lastName       !== undefined && { lastName:  dto.lastName  }),
          fullName: `${firstName} ${lastName}`,
          ...(dto.email          !== undefined && { email:          dto.email || null }),
          ...(dto.phone          !== undefined && { phone:          dto.phone }),
          ...(dto.alternatePhone !== undefined && { alternatePhone: dto.alternatePhone }),
          ...(dto.nationality    !== undefined && {
            nationality: dto.nationality,
            isForeigner: deriveIsForeigner(dto.nationality),
          }),
          ...(dto.gender         !== undefined && { gender:         dto.gender }),
          ...(dto.dateOfBirth    !== undefined && { dateOfBirth:    dto.dateOfBirth ? new Date(dto.dateOfBirth) : null }),
          ...(dto.documentType   !== undefined && { documentType:   dto.documentType }),
          ...(dto.documentNumber !== undefined && { documentNumber: dto.documentNumber }),
          ...(dto.documentExpiry !== undefined && { documentExpiry: dto.documentExpiry ? new Date(dto.documentExpiry) : null }),
          ...(dto.address        !== undefined && { address:        dto.address }),
          ...(dto.city           !== undefined && { city:           dto.city }),
          ...(dto.country        !== undefined && { country:        dto.country }),
          ...(dto.language       !== undefined && { language:       dto.language }),
          ...(dto.internalNotes  !== undefined && { internalNotes:  dto.internalNotes }),
          ...(dto.vipLevel       !== undefined && { vipLevel:       dto.vipLevel }),
          ...(dto.tags           !== undefined && { tags:           normaliseTags(dto.tags) ?? [] }),
          // Stamp the consent timestamp only on the transition into opt-in, so
          // an unrelated edit does not rewrite when permission was given.
          ...(dto.marketingOptIn !== undefined && {
            marketingOptIn:   dto.marketingOptIn,
            ...(dto.marketingOptIn && !existing.marketingOptIn && { marketingOptInAt: new Date() }),
            ...(!dto.marketingOptIn && { marketingOptInAt: null }),
          }),
          ...(dto.specialDatesDeclined !== undefined && {
            specialDatesDeclinedAt: dto.specialDatesDeclined
              ? existing.specialDatesDeclinedAt ?? new Date()
              : null,
          }),
        },
      });

      if (dto.specialDates !== undefined) {
        // Explicit edit — the client sent the full list, so replace wholesale.
        await GuestOccasionService.replaceSpecialDates(
          db, actor.hotelId, id, withDerivedBirthday(dto.specialDates, dto.dateOfBirth) ?? [],
        );
      } else if (dto.dateOfBirth) {
        // The date of birth was filled in without touching the dates editor —
        // add the birthday, but never replace the list, or an unrelated profile
        // edit would wipe an anniversary the guest gave us.
        await GuestOccasionService.addBirthdayIfMissing(db, actor.hotelId, id, dto.dateOfBirth);
      }

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
