import { Request, Response, NextFunction } from "express";
import { withTenant, TenantTx } from "@pms/db";

declare global {
  namespace Express {
    interface Request {
      /**
       * Runs fn inside a Prisma transaction with RLS session vars set.
       * Available on every authenticated route after the `authenticate` middleware.
       *
       * Usage:
       *   const rooms = await req.withTenant((db) => db.room.findMany(...));
       */
      withTenant: <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;
    }
  }
}

/**
 * Attaches req.withTenant after authenticate() has set req.user.
 * Must be used after authenticate, not before.
 */
export function tenantMiddleware(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    next();
    return;
  }
  const { hotelId, userId } = req.user;
  req.withTenant = <T>(fn: (db: TenantTx) => Promise<T>) =>
    withTenant(hotelId, userId, fn);
  next();
}
