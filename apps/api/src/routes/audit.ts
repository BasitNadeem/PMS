import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { adminPrisma, Prisma } from "@pms/db";
import { paginationMeta } from "../utils/pagination";

const router = Router();
router.use(authenticate, tenantMiddleware);

const querySchema = z.object({
  entity:    z.string().trim().optional(),
  userId:    z.string().uuid().optional(),
  action:    z.string().trim().optional(),
  startDate: z.string().date().optional(),
  endDate:   z.string().date().optional(),
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(50),
});

router.get("/", requirePermission("AUDIT_READ"), async (req, res) => {
  const query = querySchema.parse(req.query);
  const skip = (query.page - 1) * query.limit;
  const hotelId = req.user!.hotelId;

  const where: Prisma.AuditLogWhereInput = { hotelId };
  if (query.entity) where.entity = query.entity;
  if (query.userId) where.userId = query.userId;
  if (query.action) where.action = { contains: query.action, mode: "insensitive" };
  if (query.startDate || query.endDate) {
    where.createdAt = {
      ...(query.startDate ? { gte: new Date(query.startDate) } : {}),
      ...(query.endDate ? { lte: new Date(query.endDate + "T23:59:59Z") } : {}),
    };
  }

  const [logs, total] = await req.withTenant((db) =>
    Promise.all([
      db.auditLog.findMany({
        where,
        skip,
        take: query.limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true, action: true, entity: true, entityId: true, userId: true,
          before: true, after: true, ipAddress: true, createdAt: true,
        },
      }),
      db.auditLog.count({ where }),
    ])
  );

  const userIds = [...new Set(logs.map((l) => l.userId).filter((id): id is string => !!id))];
  const users = userIds.length > 0
    ? await adminPrisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));

  const hotelUsers = await adminPrisma.hotelUser.findMany({
    where: { hotelId },
    include: { user: { select: { id: true, name: true, email: true } } },
  });

  res.json({
    data: logs.map((l) => ({
      id:        l.id,
      action:    l.action,
      entity:    l.entity,
      entityId:  l.entityId,
      user:      l.userId ? (userMap.get(l.userId) ?? null) : null,
      before:    l.before,
      after:     l.after,
      ipAddress: l.ipAddress,
      createdAt: l.createdAt.toISOString(),
    })),
    meta: paginationMeta(total, query.page, query.limit),
    users: hotelUsers.map((hu) => ({ id: hu.user.id, name: hu.user.name, email: hu.user.email })),
  });
});

export default router;
