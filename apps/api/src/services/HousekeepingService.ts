import type { TenantTx } from "@pms/db";
import { HousekeepingTaskStatus, RoomStatus, UserRole, adminPrisma } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { NotificationService } from "./NotificationService";
import { notifyHotelDataChanged } from "../lib/realtime";
import { getPKTDayRange, getCurrentPKTDate } from "../lib/timezone";
import { sendPushToUser } from "../lib/webpush";
import type {
  ListTasksQuery,
  CreateTaskDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
  HousekeepingPriority,
} from "../schemas/housekeeping";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

const PRIORITY_TO_INT: Record<HousekeepingPriority, number> = {
  URGENT: 4,
  HIGH:   3,
  NORMAL: 2,
  LOW:    1,
};

const INT_TO_PRIORITY: Record<number, HousekeepingPriority> = {
  4: "URGENT",
  3: "HIGH",
  2: "NORMAL",
  1: "LOW",
};

function toPriority(n: number): HousekeepingPriority {
  return INT_TO_PRIORITY[n] ?? "NORMAL";
}

const ALLOWED_TRANSITIONS: Partial<Record<HousekeepingTaskStatus, HousekeepingTaskStatus>> = {
  [HousekeepingTaskStatus.PENDING]:     HousekeepingTaskStatus.IN_PROGRESS,
  [HousekeepingTaskStatus.IN_PROGRESS]: HousekeepingTaskStatus.COMPLETED,
  [HousekeepingTaskStatus.COMPLETED]:   HousekeepingTaskStatus.PENDING,
};

const CLEAN_TASK_TYPES = ["CHECKOUT_CLEAN", "ROUTINE_CLEAN", "MAINTENANCE_CLEAN"];

function mapTask<T extends { priority: number }>(task: T): Omit<T, "priority"> & { priority: HousekeepingPriority } {
  return { ...task, priority: toPriority(task.priority) };
}

// Broadcasts a push notification to every active HOUSEKEEPING staff member in
// the hotel. excludeUserId is only meaningful for STATUS UPDATES (checking a
// task in/out, marking progress) — it stops someone getting notified about
// their own just-completed action. Pass null for NEW task creation, since
// every staff member — including whoever created the task, if they're also
// housekeeping — needs to actually learn a new task exists. Excluding the
// actor there previously meant a single-staff hotel got zero notifications
// whenever that one person created their own task.
async function notifyHousekeepingStaff(
  hotelId: string,
  excludeUserId: string | null,
  payload: { title: string; body: string; url: string },
): Promise<void> {
  // Permanent operational visibility, not a one-off debug line — push delivery
  // failures are swallowed below by design (must never break task creation),
  // so this is the only signal that a broadcast was even attempted at all.
  console.log("notifyHousekeepingStaff called:", { hotelId, excludeUserId, title: payload.title });
  try {
    const staff = await adminPrisma.hotelUser.findMany({
      where:  { hotelId, role: UserRole.HOUSEKEEPING, isActive: true },
      select: { userId: true },
    });
    const targets = excludeUserId
      ? staff.filter((s) => s.userId !== excludeUserId)
      : staff;
    if (targets.length === 0) {
      console.log("notifyHousekeepingStaff: 0 recipients found", {
        hotelId,
        roleSearched: UserRole.HOUSEKEEPING,
        staffFound: staff.length,
        excludedActor: excludeUserId,
      });
      return;
    }
    await Promise.allSettled(
      targets.map((s) => sendPushToUser(s.userId, payload)),
    );
  } catch (err) {
    // Push delivery is genuinely non-critical — never throw out of here and
    // break task creation — but "non-critical" must not mean "invisible".
    console.error("notifyHousekeepingStaff: caught error, continuing without push:", { hotelId, err });
  }
}

export const HousekeepingService = {
  async listTasks(withTenant: WithTenantFn, query: ListTasksQuery) {
    const skip = (query.page - 1) * query.limit;

    const where = {
      ...(query.status       && { status:       query.status as HousekeepingTaskStatus }),
      ...(query.priority     && { priority:      PRIORITY_TO_INT[query.priority] }),
      ...(query.roomId       && { roomId:        query.roomId }),
      ...(query.assignedToId && { assignedToId:  query.assignedToId }),
    };

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.housekeepingTask.findMany({
          where,
          include: {
            room:       { select: { number: true, floor: true, roomType: { select: { name: true } } } },
            assignedTo: { select: { id: true, name: true } },
          },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          skip,
          take: query.limit,
        }),
        db.housekeepingTask.count({ where }),
      ])
    );

    return {
      data: items.map(mapTask),
      meta: paginationMeta(total, query.page, query.limit),
    };
  },

  async getTask(withTenant: WithTenantFn, taskId: string) {
    const task = await withTenant((db) =>
      db.housekeepingTask.findUnique({
        where: { id: taskId },
        include: {
          room:       { select: { id: true, number: true, floor: true, status: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      })
    );
    if (!task) throw new AppError(404, "Housekeeping task not found");
    return mapTask(task);
  },

  async createTask(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateTaskDto) {
    const scheduledDate = dto.scheduledDate ? new Date(dto.scheduledDate) : new Date();

    const task = await withTenant(async (db) => {
      const room = await db.room.findUnique({ where: { id: dto.roomId }, select: { id: true, status: true } });
      if (!room) throw new AppError(404, "Room not found");

      const created = await db.housekeepingTask.create({
        data: {
          hotelId:       actor.hotelId,
          roomId:        dto.roomId,
          taskType:      dto.taskType,
          priority:      PRIORITY_TO_INT[dto.priority],
          scheduledDate,
          notes:         dto.notes ?? null,
          assignedToId:  dto.assignedToId ?? null,
        },
        include: {
          room:       { select: { number: true, floor: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "HOUSEKEEPING_TASK_CREATE",
          entity:   "housekeeping_task",
          entityId: created.id,
          after:    JSON.parse(JSON.stringify({ taskType: dto.taskType, roomId: dto.roomId })),
        },
      });

      if (CLEAN_TASK_TYPES.includes(dto.taskType) && room.status === RoomStatus.VACANT_CLEAN) {
        await db.room.update({
          where: { id: room.id },
          data:  { status: RoomStatus.VACANT_DIRTY },
        });
      }

      if (dto.taskType === "CHECKOUT_CLEAN" || dto.priority === "URGENT") {
        try {
          await NotificationService.createNotification(db, actor.hotelId, {
            title:      "Housekeeping Task",
            body:       `Room ${created.room.number} needs ${dto.taskType.replace(/_/g, " ").toLowerCase()} — ${dto.priority} priority`,
            type:       "HOUSEKEEPING",
            entityId:   created.id,
            entityType: "housekeeping_task",
          });
        } catch { /* notifications are non-critical */ }
      }

      return created;
    });

    notifyHotelDataChanged(actor.hotelId);

    // No exclusion — every housekeeping staff member, including whoever just
    // created this task, needs to know a new task exists.
    await notifyHousekeepingStaff(actor.hotelId, null, {
      title: "🧹 New Cleaning Task",
      body:  `Room ${task.room.number} needs cleaning`,
      url:   "/housekeeping/mobile",
    });

    return mapTask(task);
  },

  async updateTaskStatus(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    taskId: string,
    dto: UpdateTaskStatusDto,
  ) {
    const newStatus = dto.status as HousekeepingTaskStatus;

    const task = await withTenant(async (db) => {
      const existing = await db.housekeepingTask.findUnique({
        where:   { id: taskId },
        include: { room: { select: { id: true, number: true, floor: true, status: true } } },
      });
      if (!existing) throw new AppError(404, "Housekeeping task not found");

      const allowed = ALLOWED_TRANSITIONS[existing.status];
      if (allowed !== newStatus) {
        throw new AppError(
          400,
          `Cannot transition from ${existing.status} to ${newStatus}`,
        );
      }

      const now = new Date();
      const updated = await db.housekeepingTask.update({
        where: { id: taskId },
        data: {
          status:      newStatus,
          ...(newStatus === HousekeepingTaskStatus.IN_PROGRESS && { startedAt:   now }),
          ...(newStatus === HousekeepingTaskStatus.COMPLETED   && { completedAt: now }),
          ...(newStatus === HousekeepingTaskStatus.PENDING     && { completedAt: null }),
        },
        include: {
          room:       { select: { id: true, number: true, floor: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      if (
        newStatus === HousekeepingTaskStatus.COMPLETED &&
        CLEAN_TASK_TYPES.includes(existing.taskType) &&
        existing.room.status === RoomStatus.VACANT_DIRTY
      ) {
        await db.room.update({
          where: { id: existing.room.id },
          data:  { status: RoomStatus.VACANT_CLEAN },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "HOUSEKEEPING_TASK_STATUS",
          entity:   "housekeeping_task",
          entityId: taskId,
          before:   JSON.parse(JSON.stringify({ status: existing.status })),
          after:    JSON.parse(JSON.stringify({ status: newStatus })),
        },
      });

      return updated;
    });

    notifyHotelDataChanged(actor.hotelId);

    // Excludes the actor — correct here, unlike creation: don't notify someone
    // about the status change they themselves just made.
    await notifyHousekeepingStaff(actor.hotelId, actor.userId, {
      title: "Task Updated",
      body:  `Room ${task.room.number} — ${newStatus}`,
      url:   "/housekeeping/mobile",
    });

    return mapTask(task);
  },

  async updateTask(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    taskId: string,
    dto: UpdateTaskDto,
  ) {
    const task = await withTenant(async (db) => {
      const existing = await db.housekeepingTask.findUnique({ where: { id: taskId } });
      if (!existing) throw new AppError(404, "Housekeeping task not found");

      const updated = await db.housekeepingTask.update({
        where: { id: taskId },
        data: {
          ...(dto.assignedToId  !== undefined && { assignedToId:  dto.assignedToId }),
          ...(dto.priority      !== undefined && { priority:      PRIORITY_TO_INT[dto.priority] }),
          ...(dto.notes         !== undefined && { notes:         dto.notes }),
          ...(dto.scheduledDate !== undefined && { scheduledDate: new Date(dto.scheduledDate) }),
        },
        include: {
          room:       { select: { number: true, floor: true } },
          assignedTo: { select: { id: true, name: true } },
        },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "HOUSEKEEPING_TASK_UPDATE",
          entity:   "housekeeping_task",
          entityId: taskId,
          after:    JSON.parse(JSON.stringify(dto)),
        },
      });

      return updated;
    });

    notifyHotelDataChanged(actor.hotelId);
    return mapTask(task);
  },

  async summary(withTenant: WithTenantFn) {
    const todayStart = getPKTDayRange(getCurrentPKTDate()).start;

    const [pending, inProgress, completedToday] = await withTenant((db) =>
      Promise.all([
        db.housekeepingTask.count({ where: { status: HousekeepingTaskStatus.PENDING } }),
        db.housekeepingTask.count({ where: { status: HousekeepingTaskStatus.IN_PROGRESS } }),
        db.housekeepingTask.count({
          where: { status: HousekeepingTaskStatus.COMPLETED, completedAt: { gte: todayStart } },
        }),
      ])
    );

    return { pending, inProgress, completedToday };
  },
};
