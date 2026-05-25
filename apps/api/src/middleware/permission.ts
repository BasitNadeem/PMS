import type { Request, Response, NextFunction } from "express";
import { AppError } from "../utils/AppError";

export function requirePermission(key: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user?.permissions?.includes(key)) {
      throw new AppError(403, `Missing permission: ${key}`);
    }
    next();
  };
}
