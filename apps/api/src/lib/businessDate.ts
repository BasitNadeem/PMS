import { adminPrisma } from "@pms/db";
import { getOperationalBusinessDate } from "./shiftSchedule";
import { AppError } from "../utils/AppError";

/**
 * Resolve the hotel operating day for a real transaction timestamp.
 *
 * This is deliberately tenant-scoped: the Morning boundary comes from the
 * target hotel's saved shift schedule. Callers must pass the source
 * transaction timestamp, never the time a repair/backfill happens.
 */
export async function resolveHotelBusinessDate(hotelId: string, occurredAt: Date): Promise<string> {
  const hotel = await adminPrisma.hotel.findUnique({
    where: { id: hotelId },
    select: { settings: true },
  });
  if (!hotel) throw new AppError(404, "Hotel not found while resolving business date");
  return getOperationalBusinessDate(hotel.settings ?? {}, occurredAt);
}
