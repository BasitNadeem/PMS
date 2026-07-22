import { Router } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";
import type { JwtPayload } from "../middleware/auth";
import { subscribe, unsubscribe } from "../lib/realtime";

const router: Router = Router();

// GET /api/realtime/events?token=...
// EventSource can't send an Authorization header, so the access token is
// passed as a query param here and verified manually instead of going
// through the standard `authenticate` middleware.
router.get("/events", (req, res) => {
  const token = req.query.token;
  if (typeof token !== "string" || !token) {
    res.status(401).end();
    return;
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    res.status(401).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Tells an Nginx (or similar) reverse proxy in front of this API not to buffer the
  // response — proxy buffering holds onto SSE chunks until a threshold fills, which
  // silently delays every event by seconds regardless of how fast the server writes.
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();
  res.write(": connected\n\n");

  subscribe(payload.hotelId, res);

  // Keep intermediary proxies from closing the idle connection.
  const heartbeat = setInterval(() => res.write(": ping\n\n"), 30_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe(payload.hotelId, res);
  });
});

export default router;
