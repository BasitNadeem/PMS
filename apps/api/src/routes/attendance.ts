import { Router } from "express";
import { adminPrisma, Prisma } from "@pms/db";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { listAttendanceSchema, markAttendanceSchema, type MarkAttendanceDto } from "../schemas/attendance";
import { paginationMeta } from "../utils/pagination";

interface AttendanceRow {
  id: string;
  hotel_id: string;
  user_id: string;
  attendance_date: Date;
  first_login_at: Date | null;
  last_login_at: Date | null;
  login_count: number;
  source: "APP_LOGIN" | "MANUAL";
  status: "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";
  role: string;
  notes: string | null;
}

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

function serializeRow(row: AttendanceRow, user: { id: string; name: string; email: string } | null) {
  return {
    id: row.id,
    hotelId: row.hotel_id,
    userId: row.user_id,
    attendanceDate: row.attendance_date.toISOString().slice(0, 10),
    firstLoginAt: row.first_login_at?.toISOString() ?? null,
    lastLoginAt: row.last_login_at?.toISOString() ?? null,
    loginCount: row.login_count,
    source: row.source,
    status: row.status,
    role: row.role,
    notes: row.notes,
    user,
  };
}

async function resolveUsers(rows: AttendanceRow[]) {
  const userIds = [...new Set(rows.map((row) => row.user_id))];
  if (userIds.length === 0) return new Map<string, { id: string; name: string; email: string }>();
  const users = await adminPrisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });
  return new Map(users.map((user) => [user.id, user]));
}

router.get("/", requirePermission("STAFF_READ"), async (req, res) => {
  const query = listAttendanceSchema.parse(req.query);
  const hotelId = req.user!.hotelId;
  const conditions: Prisma.Sql[] = [Prisma.sql`hotel_id = ${hotelId}::uuid`];
  if (query.startDate) conditions.push(Prisma.sql`attendance_date >= ${query.startDate}::date`);
  if (query.endDate) conditions.push(Prisma.sql`attendance_date <= ${query.endDate}::date`);
  const where = Prisma.join(conditions, " AND ");
  const skip = (query.page - 1) * query.limit;

  const [rows, countRows] = await req.withTenant((db) => Promise.all([
    db.$queryRaw<AttendanceRow[]>`
      SELECT id, hotel_id, user_id, attendance_date, first_login_at, last_login_at,
             login_count, source, status, role, notes
      FROM attendance_records
      WHERE ${where}
      ORDER BY attendance_date DESC, COALESCE(first_login_at, created_at) DESC
      LIMIT ${query.limit}::int OFFSET ${skip}::int
    `,
    db.$queryRaw<[{ count: bigint }]>`SELECT COUNT(*)::bigint AS count FROM attendance_records WHERE ${where}`,
  ]));
  const users = await resolveUsers(rows);
  const total = Number(countRows[0]?.count ?? 0);

  res.json({
    data: rows.map((row) => serializeRow(row, users.get(row.user_id) ?? null)),
    meta: paginationMeta(total, query.page, query.limit),
  });
});

router.post("/", requirePermission("STAFF_UPDATE"), async (req, res) => {
  const dto: MarkAttendanceDto = markAttendanceSchema.parse(req.body);
  const hotelId = req.user!.hotelId;
  const member = await adminPrisma.hotelUser.findFirst({
    where: { hotelId, userId: dto.userId, isActive: true },
    select: { userId: true },
  });
  if (!member) {
    res.status(404).json({ error: "Active staff member not found for this hotel" });
    return;
  }

  const row = await req.withTenant(async (db) => {
    const records = await db.$queryRaw<AttendanceRow[]>`
      INSERT INTO attendance_records
        (hotel_id, user_id, attendance_date, login_count, source, status, notes, created_at, updated_at)
      VALUES
        (${hotelId}::uuid, ${dto.userId}::uuid, ${dto.attendanceDate}::date, 0, 'MANUAL', ${dto.status}, ${dto.notes ?? null}, now(), now())
      ON CONFLICT (hotel_id, user_id, attendance_date)
      DO UPDATE SET
        source = 'MANUAL',
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = now()
      RETURNING id, hotel_id, user_id, attendance_date, first_login_at, last_login_at,
                login_count, source, status, role, notes
    `;
    await db.auditLog.create({
      data: {
        hotelId,
        userId: req.user!.userId,
        action: "ATTENDANCE_MANUAL_MARK",
        entity: "attendance_record",
        entityId: records[0]!.id,
        after: { userId: dto.userId, attendanceDate: dto.attendanceDate, status: dto.status },
      },
    });
    return records;
  });
  const users = await resolveUsers(row);
  res.status(201).json({ data: serializeRow(row[0]!, users.get(dto.userId) ?? null) });
});

export default router;
