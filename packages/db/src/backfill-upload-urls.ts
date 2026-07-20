/**
 * One-time data fix — NOT a schema migration.
 *
 * Before this fix, POST /api/upload returned a bare relative path
 * ("/uploads/xxx.jpg") instead of an absolute URL. That only ever resolved
 * correctly on the API's own origin — every stored image broke when rendered
 * from any other origin (app.innflo.co, every *.innflo.co hotel subdomain).
 * routes/upload.ts now returns an absolute URL for all NEW uploads, but that
 * fix does nothing for rows that already have a relative path stored. This
 * script rewrites those existing rows in place.
 *
 * Idempotent — safe to run more than once. Anything already starting with
 * "http" is left untouched.
 *
 * Covers every field confirmed to actually be populated via the internal
 * upload endpoint (verified against real data, not assumed):
 *   - hotels.settings->logoUrl        (JSON field)
 *   - room_types.photo_urls           (array field)
 *   - maintenance_tickets.photo_urls  (array field)
 *   - expenses.attachment_url         (raw-SQL table, not in schema.prisma —
 *                                      needs $queryRaw/$executeRaw)
 *
 * Other candidate fields (users.avatar_url, guests.document_scan_url,
 * housekeeping_tasks.issue_photo_urls, messages.media_urls, pos_items.photo_url,
 * menu_items.image_url) were checked and excluded: each is either never
 * written to by any UI/service code path, or currently has zero non-null rows
 * in the database — nothing to backfill, and no evidence they're populated via
 * this upload endpoint at all.
 *
 * Run: pnpm backfill:upload-urls
 */

import "dotenv/config";
import { adminPrisma } from "./index";

const API_PUBLIC_URL = process.env.API_PUBLIC_URL;
if (!API_PUBLIC_URL) {
  throw new Error(
    "API_PUBLIC_URL env var is required (e.g. https://api.innflo.co) — " +
    "this script uses it as the single source of truth for the prefix, " +
    "same as routes/upload.ts itself."
  );
}

const RELATIVE_PREFIX = "/uploads/";

function needsFix(url: string | null | undefined): url is string {
  return !!url && url.startsWith(RELATIVE_PREFIX);
}

function fix(url: string): string {
  return `${API_PUBLIC_URL}${url}`;
}

let totalChanged = 0;

async function backfillHotelLogos() {
  const hotels = await adminPrisma.hotel.findMany({
    select: { id: true, slug: true, settings: true },
  });
  for (const hotel of hotels) {
    const settings = (hotel.settings ?? {}) as Record<string, unknown>;
    const logoUrl = settings.logoUrl;
    if (typeof logoUrl !== "string" || !needsFix(logoUrl)) continue;

    const newUrl = fix(logoUrl);
    await adminPrisma.hotel.update({
      where: { id: hotel.id },
      data: { settings: { ...settings, logoUrl: newUrl } },
    });
    console.log(`[hotels.settings.logoUrl] ${hotel.slug} (${hotel.id})`);
    console.log(`  old: ${logoUrl}`);
    console.log(`  new: ${newUrl}`);
    totalChanged++;
  }
}

async function backfillRoomTypePhotos() {
  const roomTypes = await adminPrisma.roomType.findMany({
    select: { id: true, name: true, photoUrls: true },
  });
  for (const rt of roomTypes) {
    if (!rt.photoUrls.some(needsFix)) continue;

    const newUrls = rt.photoUrls.map((u) => (needsFix(u) ? fix(u) : u));
    await adminPrisma.roomType.update({
      where: { id: rt.id },
      data: { photoUrls: newUrls },
    });
    console.log(`[room_types.photo_urls] ${rt.name} (${rt.id})`);
    console.log(`  old: ${JSON.stringify(rt.photoUrls)}`);
    console.log(`  new: ${JSON.stringify(newUrls)}`);
    totalChanged++;
  }
}

async function backfillMaintenanceTicketPhotos() {
  const tickets = await adminPrisma.maintenanceTicket.findMany({
    select: { id: true, title: true, photoUrls: true },
  });
  for (const t of tickets) {
    if (!t.photoUrls.some(needsFix)) continue;

    const newUrls = t.photoUrls.map((u) => (needsFix(u) ? fix(u) : u));
    await adminPrisma.maintenanceTicket.update({
      where: { id: t.id },
      data: { photoUrls: newUrls },
    });
    console.log(`[maintenance_tickets.photo_urls] ${t.title} (${t.id})`);
    console.log(`  old: ${JSON.stringify(t.photoUrls)}`);
    console.log(`  new: ${JSON.stringify(newUrls)}`);
    totalChanged++;
  }
}

// expenses is a raw-SQL table (see README — never modeled in schema.prisma),
// so it needs $queryRaw/$executeRaw rather than a Prisma model accessor.
async function backfillExpenseAttachments() {
  const expenses = await adminPrisma.$queryRaw<
    { id: string; description: string; attachment_url: string | null }[]
  >`SELECT id, description, attachment_url FROM expenses WHERE attachment_url LIKE ${RELATIVE_PREFIX + "%"}`;

  for (const e of expenses) {
    if (!needsFix(e.attachment_url)) continue;

    const newUrl = fix(e.attachment_url);
    await adminPrisma.$executeRaw`UPDATE expenses SET attachment_url = ${newUrl} WHERE id = ${e.id}::uuid`;
    console.log(`[expenses.attachment_url] ${e.description} (${e.id})`);
    console.log(`  old: ${e.attachment_url}`);
    console.log(`  new: ${newUrl}`);
    totalChanged++;
  }
}

async function main() {
  console.log(`Backfilling relative upload URLs → ${API_PUBLIC_URL}${RELATIVE_PREFIX}...\n`);

  await backfillHotelLogos();
  await backfillRoomTypePhotos();
  await backfillMaintenanceTicketPhotos();
  await backfillExpenseAttachments();

  console.log(`\n✅  Done. ${totalChanged} row(s) changed.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => adminPrisma.$disconnect());
