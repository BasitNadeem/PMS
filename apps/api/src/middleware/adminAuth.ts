import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../lib/env";

export interface AdminJwtPayload {
  isSuperAdmin: true;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      admin?: AdminJwtPayload;
    }
  }
}

export function adminAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Admin authentication required" });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, env.ADMIN_JWT_SECRET) as AdminJwtPayload;
    if (!payload.isSuperAdmin) {
      res.status(401).json({ error: "Admin authentication required" });
      return;
    }
    req.admin = payload;
    next();
  } catch {
    res.status(401).json({ error: "Admin authentication required" });
  }
}
