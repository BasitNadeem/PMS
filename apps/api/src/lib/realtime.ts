import type { Response } from "express";
import { redis } from "./redis";

// SSE fan-out, keyed by hotelId. Each process only ever holds the SSE
// connections it personally accepted — that part is inherently per-process,
// since an open HTTP response can't be handed to another process.
//
// The "something changed" signal itself, however, travels over Redis pub/sub
// rather than being written straight into this local map. If the API runs as
// multiple instances (any autoscaled/replicated prod deployment), a write
// request and a given browser's SSE connection can land on different
// instances; publishing through Redis means every instance hears every
// change and can relay it to its own locally-connected clients, regardless
// of which instance handled the write.
const subscribers = new Map<string, Set<Response>>();

const CHANNEL = "pms:realtime:hotel-change";

interface RealtimeChangeMessage {
  hotelId: string;
  ts:      number;
  type:    string | null;
}

const redisSub = redis.duplicate();
redisSub.subscribe(CHANNEL).catch((err) => console.error("Failed to subscribe to realtime channel:", err));

redisSub.on("message", (_channel, message) => {
  let parsed: RealtimeChangeMessage;
  try {
    parsed = JSON.parse(message) as RealtimeChangeMessage;
  } catch {
    return; // malformed payload — ignore
  }
  broadcastLocal(parsed.hotelId, parsed.ts, parsed.type);
});

function broadcastLocal(hotelId: string, ts: number, type: string | null): void {
  const set = subscribers.get(hotelId);
  if (!set || set.size === 0) return;
  const payload = `event: change\ndata: ${JSON.stringify({ ts, type })}\n\n`;
  for (const res of set) {
    try {
      res.write(payload);
    } catch {
      unsubscribe(hotelId, res);
    }
  }
}

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

// Fire-and-forget: tells every connected client for this hotel (across every
// API instance) that dashboard-relevant data changed, so they can refetch
// instantly instead of waiting for the next poll. Never throws.
//
// `type` is optional and intentionally sparse — most callers (folio update,
// housekeeping, POS, etc.) don't pass one, so the client treats those as a
// generic "something changed, go refetch" signal. Only callers that want a
// client-side reaction beyond a silent refetch (e.g. a toast) pass one.
export function notifyHotelDataChanged(hotelId: string, type?: string): void {
  const payload: RealtimeChangeMessage = { hotelId, ts: Date.now(), type: type ?? null };
  redis.publish(CHANNEL, JSON.stringify(payload)).catch((err) => console.error("Failed to publish realtime event:", err));
}
