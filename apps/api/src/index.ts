import "express-async-errors";
import "./lib/env"; // validates env on startup

import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import path from "path";

import { env } from "./lib/env";
import { errorHandler } from "./middleware/error";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import hotelsRouter from "./routes/hotels";
import reservationsRouter from "./routes/reservations";
import folioRouter from "./routes/folio";
import billingRouter from "./routes/billing";
import { roomsRouter, roomTypesRouter } from "./routes/rooms";
import guestsRouter from "./routes/guests";
import companiesRouter from "./routes/companies";
import housekeepingRouter from "./routes/housekeeping";
import dashboardRouter from "./routes/dashboard";
import usersRouter from "./routes/users";
import posRouter from "./routes/pos";
import reportsRouter from "./routes/reports";
import accountingRouter from "./routes/accounting";
import nightAuditRouter from "./routes/nightAudit";
import notificationsRouter from "./routes/notifications";
import notesRouter from "./routes/notes";
import settingsRouter from "./routes/settings";
import expensesRouter from "./routes/expenses";
import cashbookRouter from "./routes/cashbook";
import groupsRouter from "./routes/groups";
import maintenanceRouter from "./routes/maintenance";
import uploadRouter from "./routes/upload";
import adminRouter from "./routes/admin";
import shiftsRouter from "./routes/shifts";
import auditRouter from "./routes/audit";
import qrPublicRouter from "./routes/qrPublic";
import bookingPublicRouter from "./routes/bookingPublic";
import qrOrdersRouter from "./routes/qrOrders";
import kitchenRouter from "./routes/kitchen";
import inventoryRouter from "./routes/inventory";
import mobileScanRouter from "./routes/mobileScan";
import searchRouter from "./routes/search";
import realtimeRouter from "./routes/realtime";
import pushRouter from "./routes/push";
import ratePlansRouter from "./routes/ratePlans";
import bookingEngineHubRouter from "./routes/bookingEngineHub";
import { briefingWorker } from "./jobs/briefingWorker";
import { scheduleBriefings } from "./jobs/briefingScheduler";
import { emailWorker } from "./jobs/sendBookingConfirmationEmail";
import { promoEmailWorker } from "./jobs/sendPromoCodeEmail";
import { occasionWorker } from "./jobs/occasionWorker";
import { scheduleOccasionSweeps } from "./jobs/occasionScheduler";

const app = express();

// Nginx sits in front of the API as a reverse proxy — trust exactly that one hop so
// X-Forwarded-For is read correctly (req.ip, rate limiting) without trusting arbitrary
// client-supplied headers. "1" trusts only the first proxy hop, not a wide-open chain.
app.set("trust proxy", 1);

// Every hotel gets its own subdomain (e.g. demo-hotel.innflo.co), so a single fixed
// CORS_ORIGIN can't cover them all. Match the apex domain or any direct subdomain of
// PRODUCTION_DOMAIN instead of hardcoding "innflo.co" here.
const productionOriginPattern = new RegExp(
  `^https://([a-z0-9-]+\\.)?${env.PRODUCTION_DOMAIN.replace(/\./g, "\\.")}$`
);

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin(origin, callback) {
    // Gated on its own explicit flag, not NODE_ENV — an ambient string that could be
    // missing or wrong in a given deployment must never be able to silently disable CORS.
    if (env.ALLOW_DEV_CORS_BYPASS) return callback(null, true);
    // No Origin header — server-to-server or non-browser request; nothing to check against.
    if (!origin) return callback(null, true);
    if (origin === env.ADMIN_CORS_ORIGIN) return callback(null, true);
    if (productionOriginPattern.test(origin)) return callback(null, true);
    callback(new Error(`Origin ${origin} not allowed by CORS`));
  },
}));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
// Never gzip the SSE stream — compression buffers chunks internally before flushing,
// which silently delays every res.write() in routes/realtime.ts by seconds and defeats
// the whole point of a push channel. Everything else still gets compressed as normal.
app.use(compression({
  filter: (req, res) => req.path === "/api/realtime/events" ? false : compression.filter(req, res),
}));
app.use(express.json());
app.use(morgan(env.NODE_ENV === "development" ? "dev" : "combined"));

app.use(
  "/api",
  rateLimit({ windowMs: 15 * 60 * 1000, max: 500, standardHeaders: true })
);

app.use("/api/health",       healthRouter);
app.use("/api/auth",         authRouter);
app.use("/api/hotels",       hotelsRouter);
app.use("/api/reservations", reservationsRouter);
app.use("/api/reservations", folioRouter);
app.use("/api/billing",      billingRouter);
app.use("/api/rooms",        roomsRouter);
app.use("/api/room-types",   roomTypesRouter);
app.use("/api/guests",       guestsRouter);
app.use("/api/companies",    companiesRouter);
app.use("/api/housekeeping", housekeepingRouter);
app.use("/api/dashboard",   dashboardRouter);
app.use("/api/users",       usersRouter);
app.use("/api/pos",         posRouter);
app.use("/api/reports",        reportsRouter);
app.use("/api/accounting",     accountingRouter);
app.use("/api/night-audit",    nightAuditRouter);
app.use("/api/notifications",  notificationsRouter);
app.use("/api/notes",          notesRouter);
app.use("/api/settings",       settingsRouter);
app.use("/api/expenses",       expensesRouter);
app.use("/api/cashbook",       cashbookRouter);
app.use("/api/groups",         groupsRouter);
app.use("/api/maintenance",    maintenanceRouter);
app.use("/api/upload",        uploadRouter);
app.use("/api/admin",          adminRouter);
app.use("/api/shifts",         shiftsRouter);
app.use("/api/audit",          auditRouter);
app.use("/api/qr-public",      qrPublicRouter);
app.use("/api/qr-orders",      qrOrdersRouter);
app.use("/api/kitchen",        kitchenRouter);
app.use("/api/inventory",      inventoryRouter);
app.use("/api/m",              mobileScanRouter);
app.use("/api/search",         searchRouter);
app.use("/api/realtime",       realtimeRouter);
app.use("/api/push",           pushRouter);
app.use("/api/rate-plans",     ratePlansRouter);
app.use("/api/booking-engine", bookingEngineHubRouter);
app.use("/api/public/booking", bookingPublicRouter);

app.use(errorHandler);

// Start background jobs (skip in test environment)
if (env.NODE_ENV !== "test") {
  scheduleBriefings().catch(console.error);
  scheduleOccasionSweeps().catch(console.error);
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down gracefully");
  await briefingWorker.close();
  await emailWorker.close();
  await promoEmailWorker.close();
  await occasionWorker.close();
  process.exit(0);
});

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`🚀  API ready at http://localhost:${env.PORT}`);
  console.log(`    DB role: ${process.env.DATABASE_URL?.match(/\/\/([^:]+)/)?.[1] ?? "?"}`);
});
