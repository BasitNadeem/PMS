import { adminPrisma } from "@pms/db";

/**
 * Display names for a set of user ids.
 *
 * The `users` table carries an RLS policy of `id = current_user_id()`, so a
 * tenant-scoped client can only ever see the row belonging to whoever is
 * logged in. Joining to it from inside `withTenant` therefore yields null for
 * every colleague — silently on an optional relation, and as an unhandled
 * "Field is required to return data, got null" on a required one, which
 * surfaces to the front desk as a bare 500.
 *
 * Names are resolved here instead, through the admin client, which never
 * reads more than the id and the name.
 */
export async function resolveUserNames(
  ids: Iterable<string | null | undefined>,
): Promise<Map<string, string>> {
  const unique = [...new Set(
    [...ids].filter((id): id is string => typeof id === "string" && id.length > 0),
  )];
  if (unique.length === 0) return new Map();

  const rows = await adminPrisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(rows.map((row) => [row.id, row.name]));
}

/** As resolveUserNames, but also carries the address for search subtitles. */
export async function resolveUserProfiles(
  ids: Iterable<string | null | undefined>,
): Promise<Map<string, { name: string; email: string }>> {
  const unique = [...new Set(
    [...ids].filter((id): id is string => typeof id === "string" && id.length > 0),
  )];
  if (unique.length === 0) return new Map();

  const rows = await adminPrisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true, email: true },
  });
  return new Map(rows.map((row) => [row.id, { name: row.name, email: row.email }]));
}

interface HasAssignee {
  assignedToId: string | null;
  assignedTo?: { id: string; name: string } | null;
}

/**
 * Fills in the `assignedTo` of rows loaded through a tenant-scoped client.
 *
 * `assignedTo` is an optional relation on housekeeping tasks and maintenance
 * tickets, so RLS does not raise on it — it just hands back null, and the
 * board then shows every colleague's work as unassigned. One batched lookup
 * per page restores the names without a query per row.
 */
export async function hydrateAssignees<T extends HasAssignee>(rows: T[]): Promise<T[]> {
  const names = await resolveUserNames(rows.map((row) => row.assignedToId));
  return rows.map((row) =>
    row.assignedToId
      ? { ...row, assignedTo: { id: row.assignedToId, name: names.get(row.assignedToId) ?? "Unknown" } }
      : row,
  );
}

export async function hydrateAssignee<T extends HasAssignee>(row: T): Promise<T> {
  const [hydrated] = await hydrateAssignees([row]);
  return hydrated as T;
}
