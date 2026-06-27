import type { Response } from "express";

// In-memory pub/sub for Server-Sent Events, keyed by hotelId.
// One process only — fine for this deployment's current scale; would need
// a shared bus (Redis pub/sub) if the API ever runs as multiple instances.
const subscribers = new Map<string, Set<Response>>();

export function subscribe(hotelId: string, res: Response): void {
  if (!subscribers.has(hotelId)) subscribers.set(hotelId, new Set());
  subscribers.get(hotelId)!.add(res);
}

export function unsubscribe(hotelId: string, res: Response): void {
  const set = subscribers.get(hotelId);
  if (!set) return;
  set.delete(res);
  if (set.size === 0) subscribers.delete(hotelId);
}

// Fire-and-forget: tells every connected client for this hotel that
// dashboard-relevant data changed, so they can refetch instantly instead
// of waiting for the next poll. Never throws.
export function notifyHotelDataChanged(hotelId: string): void {
  const set = subscribers.get(hotelId);
  if (!set || set.size === 0) return;
  const payload = `event: change\ndata: ${JSON.stringify({ ts: Date.now() })}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      unsubscribe(hotelId, res);
    }
  }
}
