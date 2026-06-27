import type { TenantTx } from "@pms/db";
import { AppError } from "./AppError";

// Shared by GuestService.createGuest and GroupService.createGroup (which
// creates a leader guest inline) so a front-desk agent re-typing the same
// phone/document number gets a clear warning instead of a silent duplicate
// guest profile.
export async function assertNoDuplicateGuest(
  db: TenantTx,
  phone: string,
  documentNumber: string,
  allowDuplicate?: boolean,
): Promise<void> {
  if (allowDuplicate) return;

  const existing = await db.guest.findFirst({
    where: { OR: [{ phone }, { documentNumber }] },
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
