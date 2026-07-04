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
import housekeepingRouter from "./routes/housekeeping";
import dashboardRouter from "./routes/dashboard";
import usersRouter from "./routes/users";
import posRouter from "./routes/pos";
import reportsRouter from "./routes/reports";
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
import qrOrdersRouter from "./routes/qrOrders";
import kitchenRouter from "./routes/kitchen";
import inventoryRouter from "./routes/inventory";
import mobileScanRouter from "./routes/mobileScan";
import searchRouter from "./routes/search";
import realtimeRouter from "./routes/realtime";
import pushRouter from "./routes/push";
import { briefingWorker } from "./jobs/briefingWorker";
import { scheduleBriefings } from "./jobs/briefingScheduler";

const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  origin: env.NODE_ENV === "development" ? true : [env.CORS_ORIGIN, env.ADMIN_CORS_ORIGIN],
}));
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use(compression());
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
app.use("/api/housekeeping", housekeepingRouter);
app.use("/api/dashboard",   dashboardRouter);
app.use("/api/users",       usersRouter);
app.use("/api/pos",         posRouter);
app.use("/api/reports",        reportsRouter);
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

app.use(errorHandler);

// Start background jobs (skip in test environment)
if (env.NODE_ENV !== "test") {
  scheduleBriefings().catch(console.error);
}

process.on("SIGTERM", async () => {
  console.log("SIGTERM received — shutting down gracefully");
  await briefingWorker.close();
  process.exit(0);
});

app.listen(env.PORT, "0.0.0.0", () => {
  console.log(`🚀  API ready at http://localhost:${env.PORT}`);
  console.log(`    DB role: ${process.env.DATABASE_URL?.match(/\/\/([^:]+)/)?.[1] ?? "?"}`);
});
