import type { TenantTx } from "@pms/db";
import { FolioItemType } from "@pms/db";
import { recalculateFolioTotals } from "../utils/folioTotals";

export type StayFeeKind = "EARLY_CHECKIN" | "LATE_CHECKOUT";

function scheduledPKTInstant(stayDate: Date, configuredTime: unknown, fallback: string): Date {
  const time = typeof configuredTime === "string" && /^\d{2}:\d{2}$/.test(configuredTime)
    ? configuredTime
    : fallback;
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(Date.UTC(
    stayDate.getUTCFullYear(),
    stayDate.getUTCMonth(),
    stayDate.getUTCDate(),
    hours - 5,
    minutes,
  ));
}

export function shouldApplyStayFee(
  kind: StayFeeKind,
  now: Date,
  stayDate: Date,
  settings: Record<string, unknown>,
): boolean {
  const boundary = kind === "EARLY_CHECKIN"
    ? scheduledPKTInstant(stayDate, settings.checkInTime, "14:00")
    : scheduledPKTInstant(stayDate, settings.checkOutTime, "12:00");
  return kind === "EARLY_CHECKIN" ? now < boundary : now > boundary;
}

export function getStayFeePaisas(
  kind: StayFeeKind,
  settings: Record<string, unknown>,
): number {
  const key = kind === "EARLY_CHECKIN" ? "earlyCheckinFee" : "lateCheckoutFee";
  const value = settings[key];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, Math.round(value * 100))
    : 0;
}

export async function postStayFeeIfNeeded(
  db: TenantTx,
  input: {
    hotelId: string;
    reservationId: string;
    folioId: string;
    kind: StayFeeKind;
    now: Date;
    stayDate: Date;
    settings: Record<string, unknown>;
  },
): Promise<boolean> {
  const fee = getStayFeePaisas(input.kind, input.settings);
  if (fee === 0 || !shouldApplyStayFee(input.kind, input.now, input.stayDate, input.settings)) {
    return false;
  }

  const marker = `AUTO_${input.kind}_FEE:${input.reservationId}`;
  const existing = await db.folioItem.findFirst({
    where: { folioId: input.folioId, notes: marker, isVoided: false },
    select: { id: true },
  });
  if (existing) return false;

  const description = input.kind === "EARLY_CHECKIN"
    ? "Early check-in fee"
    : "Late check-out fee";
  await db.folioItem.create({
    data: {
      hotelId: input.hotelId,
      folioId: input.folioId,
      type: FolioItemType.MISCELLANEOUS,
      description,
      unitAmount: fee,
      quantity: 1,
      amount: fee,
      netAmount: fee,
      notes: marker,
    },
  });
  await recalculateFolioTotals(db, input.folioId);
  return true;
}
