import type { TenantTx } from "@pms/db";
import { AppError } from "./AppError";

// Shared by GuestService.createGuest and GroupService.createGroup (which
// creates a leader guest inline) so a front-desk agent re-typing the same
// phone/document number gets a clear warning instead of a silent duplicate
// guest profile.
export async function assertNoDuplicateGuest(
  db: TenantTx,
  phone: string | null | undefined,
  documentNumber: string | null | undefined,
  allowDuplicate?: boolean,
  excludeGuestId?: string,
): Promise<void> {
  if (allowDuplicate) return;

  // Only match on values we actually have. A null arm would become
  // `OR: [{ phone: null }]`, which matches every guest missing a phone number
  // and reports them all as duplicates of each other.
  const conditions = [
    ...(phone ? [{ phone }] : []),
    ...(documentNumber ? [{ documentNumber }] : []),
  ];
  if (conditions.length === 0) return;

  const existing = await db.guest.findFirst({
    where: {
      ...(excludeGuestId ? { id: { not: excludeGuestId } } : {}),
      OR: conditions,
    },
    select: { id: true, fullName: true, phone: true, documentNumber: true },
  });
  if (!existing) return;

  const matchedOn = existing.phone === phone ? "phone number" : "document number";
  throw new AppError(
    409,
    `A guest with this ${matchedOn} already exists: ${existing.fullName}. ` +
      `Use the existing profile, or confirm this is a different person to continue.`,
    { existingGuestId: existing.id },
  );
}
