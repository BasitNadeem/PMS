import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { Prisma } from "@pms/db";
import { AppError } from "../utils/AppError";

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.details !== undefined && { details: err.details }),
    });
    return;
  }

  // body-parser throws this when a request exceeds a route's configured limit.
  // Without it the failure surfaces as an opaque 500, which reads as a server
  // bug rather than "your photo was too big" — the one thing the person holding
  // the phone can actually act on.
  if (err instanceof Error && (err as { type?: string }).type === "entity.too.large") {
    res.status(413).json({ error: "That upload is too large. Try again with a smaller photo." });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ error: "Validation error", details: err.errors });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ error: "A record with this value already exists" });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ error: "Record not found" });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
