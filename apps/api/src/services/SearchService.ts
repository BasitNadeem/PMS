import type { TenantTx } from "@pms/db";

import { resolveUserProfiles } from "../lib/userNames";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export type SearchResultType = "guest" | "reservation" | "room" | "group" | "folio" | "staff";

export interface SearchResultItem {
  id:       string;
  type:     SearchResultType;
  title:    string;
  subtitle: string | null;
  route:    string;
}

const RESULTS_PER_TYPE = 5;

export const SearchService = {
  async search(withTenant: WithTenantFn, q: string, allowedTypes: Set<SearchResultType>): Promise<SearchResultItem[]> {
    return withTenant(async (db) => {
      const results: SearchResultItem[] = [];
      const ci = { contains: q, mode: "insensitive" as const };

      const tasks: Promise<void>[] = [];

      if (allowedTypes.has("guest")) {
        tasks.push(
          db.guest.findMany({
            where: { deletedAt: null, OR: [{ fullName: ci }, { phone: ci }, { email: ci }, { documentNumber: ci }] },
            take: RESULTS_PER_TYPE,
            select: { id: true, fullName: true, phone: true, email: true },
          }).then((rows) => {
            for (const g of rows) {
              results.push({ id: g.id, type: "guest", title: g.fullName, subtitle: g.phone ?? g.email ?? null, route: `/guests/${g.id}` });
            }
          }),
        );
      }

      if (allowedTypes.has("reservation")) {
        tasks.push(
          db.reservation.findMany({
            where: { OR: [{ confirmationNumber: ci }, { legacyConfirmationNumber: ci }, { guest: { fullName: ci } }] },
            take: RESULTS_PER_TYPE,
            orderBy: { createdAt: "desc" },
            include: { guest: { select: { fullName: true } } },
          }).then((rows) => {
            for (const r of rows) {
              results.push({
                id: r.id, type: "reservation", title: r.guest.fullName,
                subtitle: `${r.confirmationNumber} · ${r.status}`, route: `/reservations/${r.id}`,
              });
            }
          }),
        );
      }

      if (allowedTypes.has("room")) {
        tasks.push(
          db.room.findMany({
            where: { number: ci },
            take: RESULTS_PER_TYPE,
            include: { roomType: { select: { name: true } } },
          }).then((rows) => {
            for (const rm of rows) {
              results.push({ id: rm.id, type: "room", title: `Room ${rm.number}`, subtitle: rm.roomType.name, route: "/rooms" });
            }
          }),
        );
      }

      if (allowedTypes.has("group")) {
        tasks.push(
          db.groupBooking.findMany({
            where: { OR: [{ name: ci }, { groupRef: ci }] },
            take: RESULTS_PER_TYPE,
          }).then((rows) => {
            for (const gr of rows) {
              results.push({ id: gr.id, type: "group", title: gr.name, subtitle: gr.groupRef, route: `/groups/${gr.id}` });
            }
          }),
        );
      }

      if (allowedTypes.has("folio")) {
        tasks.push(
          db.folio.findMany({
            where: { folioNumber: ci },
            take: RESULTS_PER_TYPE,
            include: { reservation: { include: { guest: { select: { fullName: true } } } } },
          }).then((rows) => {
            for (const f of rows) {
              results.push({
                id: f.id, type: "folio", title: f.folioNumber,
                subtitle: f.reservation.guest.fullName, route: `/financials/folio/${f.reservationId}`,
              });
            }
          }),
        );
      }

      if (allowedTypes.has("staff")) {
        // Staff cannot be matched with a `where` on the user relation: the RLS
        // policy on `users` is `id = current_user_id()`, so joining through it
        // from a tenant client only ever matches the searcher themselves. The
        // hotel's membership rows come from the tenant client, which is what
        // scopes the result, and the names are resolved separately.
        tasks.push(
          db.hotelUser.findMany({ select: { id: true, userId: true } }).then(async (rows) => {
            const profiles = await resolveUserProfiles(rows.map((row) => row.userId));
            const needle = q.toLowerCase();
            let matched = 0;
            for (const row of rows) {
              if (matched >= RESULTS_PER_TYPE) break;
              const profile = profiles.get(row.userId);
              if (!profile) continue;
              if (
                !profile.name.toLowerCase().includes(needle) &&
                !profile.email.toLowerCase().includes(needle)
              ) continue;
              results.push({ id: row.id, type: "staff", title: profile.name, subtitle: profile.email, route: "/team" });
              matched += 1;
            }
          }),
        );
      }

      await Promise.all(tasks);
      return results;
    });
  },
};
