import { Router } from "express";
import { adminPrisma, Prisma } from "@pms/db";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { createLeaveSchema, leaveIdSchema, listLeavesSchema, type CreateLeaveDto } from "../schemas/leaves";
import { paginationMeta } from "../utils/pagination";

interface LeaveRow {
  id: string;
  hotel_id: string;
  user_id: string;
  leave_date: Date;
  notes: string | null;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

function serializeRow(row: LeaveRow, user: { id: string; name: string; email: string } | null) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    userId: row.user_id,
    leaveDate: row.leave_date.toISOString().slice(0, 10),
    notes: row.notes,
    createdById: row.created_by_id,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    user,
  };
}

async function resolveUsers(rows: LeaveRow[]) {
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  if (userIds.length === 0) return new Map<string, { id: string; name: string; email: string }>();
  const users = await adminPrisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

router.get("/", requirePermission("STAFF_READ"), async (req, res) => {
  const query = listLeavesSchema.parse(req.query);
  const hotelId = req.user!.hotelId;
  const conditions: Prisma.Sql[] = [Prisma.sql`hotel_id = ${hotelId}::uuid`];
  if (query.startDate) conditions.push(Prisma.sql`leave_date >= ${query.startDate}::date`);
  if (query.endDate) conditions.push(Prisma.sql`leave_date <= ${query.endDate}::date`);
  const where = Prisma.join(conditions, " AND ");
  const skip = (query.page - 1) * query.limit;

  const [rows, countRows] = await req.withTenant((db) => Promise.all([
    db.$queryRaw<LeaveRow[]>`
      SELECT id, hotel_id, user_id, leave_date, notes, created_by_id, created_at, updated_at
      FROM leave_records
      WHERE ${where}
      ORDER BY leave_date ASC, created_at ASC
      LIMIT ${query.limit}::int OFFSET ${skip}::int
    `,
    db.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint AS count FROM leave_records WHERE ${where}`,
  ]));
  const users = await resolveUsers(rows);
  const total = Number(countRows[0]?.count ?? 0);
  res.json({ data: rows.map((row) => serializeRow(row, users.get(row.user_id) ?? null)), meta: paginationMeta(total, query.page, query.limit) });
});

router.post("/", requirePermission("STAFF_UPDATE"), async (req, res) => {
  const dto: CreateLeaveDto = createLeaveSchema.parse(req.body);
  const hotelId = req.user!.hotelId;
  const member = await adminPrisma.hotelUser.findFirst({
    where: { hotelId, userId: dto.userId, isActive: true },
    select: { userId: true },
  });
  if (!member) {
    res.status(404).json({ error: "Active staff member not found for this hotel" });
    return;
  }

  const rows = await req.withTenant(async (db) => {
    const records = await db.$queryRaw<LeaveRow[]>`
      INSERT INTO leave_records
        (hotel_id, user_id, leave_date, notes, created_by_id, created_at, updated_at)
      SELECT ${hotelId}::uuid, ${dto.userId}::uuid, day::date, ${dto.notes ?? null}, ${req.user!.userId}::uuid, now(), now()
      FROM generate_series(${dto.startDate}::date, ${dto.endDate}::date, interval '1 day') AS day
      ON CONFLICT (hotel_id, user_id, leave_date)
      DO UPDATE SET
        notes = EXCLUDED.notes,
        created_by_id = EXCLUDED.created_by_id,
        updated_at = now()
      RETURNING id, hotel_id, user_id, leave_date, notes, created_by_id, created_at, updated_at
    `;
    await db.auditLog.create({
      data: {
        hotelId,
        userId: req.user!.userId,
        action: "LEAVE_SCHEDULED",
        entity: "leave_record",
        entityId: records[0]!.id,
        after: { userId: dto.userId, startDate: dto.startDate, endDate: dto.endDate, days: records.length },
      },
    });
    return records;
  });
  const users = await resolveUsers(rows);
  res.status(201).json({ data: rows.map((row) => serializeRow(row, users.get(row.user_id) ?? null)) });
});

router.delete("/:id", requirePermission("STAFF_UPDATE"), async (req, res) => {
  const id = leaveIdSchema.parse(req.params.id);
  const hotelId = req.user!.hotelId;
  const row = await req.withTenant(async (db) => {
    const records = await db.$queryRaw<LeaveRow[]>`
      DELETE FROM leave_records
      WHERE id = ${id}::uuid AND hotel_id = ${hotelId}::uuid
      RETURNING id, hotel_id, user_id, leave_date, notes, created_by_id, created_at, updated_at
    `;
    if (records.length > 0) {
      await db.auditLog.create({
        data: {
          hotelId,
          userId: req.user!.userId,
          action: "LEAVE_REMOVED",
          entity: "leave_record",
          entityId: id,
          before: { userId: records[0]!.user_id, leaveDate: records[0]!.leave_date.toISOString().slice(0, 10) },
        },
      });
    }
    return records[0] ?? null;
  });
  if (!row) {
    res.status(404).json({ error: "Leave record not found" });
    return;
  }
  res.json({ data: { id: row.id } });
});

export default router;
