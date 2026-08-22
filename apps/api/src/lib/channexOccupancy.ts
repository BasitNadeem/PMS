/**
 * Per-date sellable inventory, derived from rooms and reservation_rooms.
 *
 * Innflo stores no availability calendar — it is computed on demand. This is
 * the per-date form of the same rule RoomService.checkAvailability applies to a
 * single stay window, extracted so the two cannot drift.
 *
 * Pure — the caller does the queries and passes rows in.
 */

/**
 * Reservation statuses that release a room. Mirrors the `notIn` filter in
 * RoomService.checkAvailability; a reservation in any other status occupies its
 * room for every night of its stay.
 */
export const NON_OCCUPYING_RESERVATION_STATUSES = [
  "CANCELLED",
  "CHECKED_OUT",
  "NO_SHOW",
] as const;

/**
 * Room statuses that make a room unsellable outright, taken from the
 * `permanentlyBlocked` list ReservationService enforces when assigning a room.
 * Excluded from OTA inventory too: publishing a room that cannot be booked
 * invites an overbooking Channex has no way to prevent.
 */
export const UNSELLABLE_ROOM_STATUSES = ["OUT_OF_ORDER", "BLOCKED"] as const;

/** One reservation_rooms row, reduced to what occupancy needs. */
export interface OccupancySpan {
  roomTypeId: string;
  /** First occupied night. */
  checkInDate: Date;
  /** Departure day — NOT occupied, the room resells that night. */
  checkOutDate: Date;
}

export interface InventoryBlockSpan {
  roomTypeId: string;
  startDate: Date;
  endDate: Date;
}

export interface AvailabilityInput {
  /** ISO dates to produce a number for. */
  dates: string[];
  /** Sellable room count per room type id. */
  roomCountsByType: Map<string, number>;
  /** Overlapping reservation rows, already filtered to occupying statuses. */
  spans: OccupancySpan[];
  blocks?: InventoryBlockSpan[];
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * roomTypeId → ISO date → sellable count.
 *
 * A stay occupies [checkInDate, checkOutDate) — inclusive of arrival, exclusive
 * of departure, which is why a same-day turnover does not double-count.
 * Availability floors at zero: an overbooked room type reports 0, never a
 * negative Channex would reject.
 */
export function computeAvailability(
  input: AvailabilityInput,
): Map<string, Map<string, number>> {
  const { dates, roomCountsByType, spans, blocks = [] } = input;

  const occupied = new Map<string, Map<string, number>>();
  for (const span of spans) {
    const from = toIsoDate(span.checkInDate);
    const to = toIsoDate(span.checkOutDate);
    let byDate = occupied.get(span.roomTypeId);
    if (!byDate) {
      byDate = new Map<string, number>();
      occupied.set(span.roomTypeId, byDate);
    }
    // Walking the requested dates rather than the span keeps this bounded by
    // the sync horizon even when a stay runs far outside it.
    for (const date of dates) {
      if (date >= from && date < to) {
        byDate.set(date, (byDate.get(date) ?? 0) + 1);
      }
    }
  }

  for (const block of blocks) {
    const from = toIsoDate(block.startDate);
    const to = toIsoDate(block.endDate);
    let byDate = occupied.get(block.roomTypeId);
    if (!byDate) {
      byDate = new Map<string, number>();
      occupied.set(block.roomTypeId, byDate);
    }
    for (const date of dates) {
      if (date >= from && date < to) byDate.set(date, (byDate.get(date) ?? 0) + 1);
    }
  }

  const availability = new Map<string, Map<string, number>>();
  for (const [roomTypeId, total] of roomCountsByType) {
    const byDate = new Map<string, number>();
    const occupiedByDate = occupied.get(roomTypeId);
    for (const date of dates) {
      const used = occupiedByDate?.get(date) ?? 0;
      byDate.set(date, Math.max(0, total - used));
    }
    availability.set(roomTypeId, byDate);
  }

  return availability;
}
