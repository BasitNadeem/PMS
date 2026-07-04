// QR scan session: desktop creates a session → gets a token → shows QR.
// Mobile opens /scan/:token, takes photo, POSTs to /api/m/scan/:token.
// Desktop listens on SSE → receives result when mobile is done.
//
// SSE client map is in-process. For multi-process production, replace with
// Redis pub/sub (SUBSCRIBE scan_result:{token}).

import type { Response } from "express";
import { redis } from "../lib/redis";

const TTL_SECS = 600; // 10 minutes

export interface ScanSession {
  hotelId: string;
  status:  "waiting" | "done" | "error";
  result?: unknown;
  error?:  string;
}

const key = (token: string) => `pms:scan_session:${token}`;

// In-memory SSE registry (single-process only)
const sseClients = new Map<string, Response>();

export const ScanSessionService = {
  async create(hotelId: string): Promise<{ token: string }> {
    const token: string = crypto.randomUUID();
    const session: ScanSession = { hotelId, status: "waiting" };
    await redis.setex(key(token), TTL_SECS, JSON.stringify(session));
    return { token };
  },

  async get(token: string): Promise<ScanSession | null> {
    const raw = await redis.get(key(token));
    return raw ? (JSON.parse(raw) as ScanSession) : null;
  },

  registerSSE(token: string, res: Response): void {
    sseClients.set(token, res);
    res.on("close", () => sseClients.delete(token));
  },

  async complete(token: string, result: unknown): Promise<void> {
    await redis.setex(
      key(token),
      TTL_SECS,
      JSON.stringify({ ...(await this.get(token)), status: "done", result }),
    );
    const client = sseClients.get(token);
    if (client) {
      client.write(`event: scan_result\ndata: ${JSON.stringify(result)}\n\n`);
      client.end();
      sseClients.delete(token);
    }
  },

  async fail(token: string, error: string): Promise<void> {
    await redis.setex(
      key(token),
      TTL_SECS,
      JSON.stringify({ ...(await this.get(token)), status: "error", error }),
    );
    const client = sseClients.get(token);
    if (client) {
      client.write(`event: scan_error\ndata: ${JSON.stringify({ error })}\n\n`);
      client.end();
      sseClients.delete(token);
    }
  },
};
