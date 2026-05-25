import "express-async-errors";
import "./lib/env"; // validates env on startup

import express from "express";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import { env } from "./lib/env";
import { errorHandler } from "./middleware/error";
import healthRouter from "./routes/health";
import authRouter from "./routes/auth";
import hotelsRouter from "./routes/hotels";
import reservationsRouter from "./routes/reservations";

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? "http://localhost:5173" }));
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

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`🚀  API ready at http://localhost:${env.PORT}`);
  console.log(`    DB role: ${process.env.DATABASE_URL?.match(/\/\/([^:]+)/)?.[1] ?? "?"}`);
});
