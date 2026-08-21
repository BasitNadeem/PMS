import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { updateSettingsSchema, updateRolePermissionsSchema } from "../schemas/settings";
import { SettingsService } from "../services/SettingsService";
import { PermissionsService } from "../services/PermissionsService";
import { AppError } from "../utils/AppError";
import { collectBriefingData } from "../jobs/collectBriefingData";
import { formatBriefingMessage } from "../jobs/formatBriefingMessage";
import { sendWhatsappMessage } from "../jobs/sendWhatsappMessage";
import { scheduleHotelBriefing } from "../jobs/briefingScheduler";
import { getEffectiveLimits, checkFeatureAccess } from "../lib/subscription";
import { adminPrisma } from "@pms/db";
import { getCurrentPKTDate } from "../lib/timezone";
import { occasionQueue } from "../jobs/queues";
import {
  ChannexProvisioningService,
  acknowledgeIngestionAlert,
} from "../services/ChannexProvisioningService";
import { enqueueChannexSync } from "../lib/channexSync";
import {
  scheduleHotelChannexSync,
  cancelHotelChannexSync,
} from "../jobs/channexScheduler";
import {
  provisionChannexSchema,
  updateChannelManagerSchema,
} from "../schemas/settings";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

// No requirePermission — permissions table is seeded empty.
// Read: any authenticated staff. Write: OWNER/MANAGER enforced in SettingsService.

router.get("/", async (req, res) => {
  const settings = await SettingsService.getSettings(req.withTenant, req.user!.hotelId);
  res.json({ data: settings });
});

router.patch("/", async (req, res) => {
  const dto = updateSettingsSchema.parse(req.body);
  const updated = await SettingsService.updateSettings(
    req.withTenant,
    req.user!.hotelId,
    dto,
    req.user!.role,
  );
  res.json({ data: updated });
});

// POST /api/settings/schedule-briefing
// Re-registers the nightly BullMQ repeatable job for this hotel.
// Called after the owner saves their WhatsApp number.
router.post("/schedule-briefing", async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "whatsappBriefing");
  if (req.user!.role !== "OWNER") {
    throw new AppError(403, "Only owners can schedule briefings");
  }
  const settings = await SettingsService.getSettings(req.withTenant, req.user!.hotelId);
  await scheduleHotelBriefing(req.user!.hotelId, settings.name);
  res.json({ data: { success: true } });
});

// POST /api/settings/test-briefing
// Fires a briefing immediately (bypasses the queue — runs inline).
router.post("/test-briefing", async (req, res) => {
  await checkFeatureAccess(req.user!.hotelId, "whatsappBriefing");
  if (req.user!.role !== "OWNER") {
    throw new AppError(403, "Only owners can send test briefings");
  }

  const settings = await SettingsService.getSettings(req.withTenant, req.user!.hotelId);
  const s        = (settings.settings ?? {}) as Record<string, unknown>;
  const number   = s.ownerWhatsappNumber as string | undefined;

  if (!number) {
    throw new AppError(400, "No WhatsApp number configured");
  }

  const briefingData = await collectBriefingData(req.user!.hotelId);
  const message      = formatBriefingMessage(briefingData);
  const result       = await sendWhatsappMessage(number, message);

  if (!result.success) {
    throw new AppError(500, result.error ?? "Failed to send briefing");
  }

  res.json({
    data: {
      success:   true,
      stubMode:  result.messageId?.startsWith("stub_") ?? false,
      messageId: result.messageId,
      sentTo:    number,
    },
  });
});

// POST /api/settings/run-occasion-sweep
// Owner-only manual trigger so a hotel can verify its occasion configuration
// without waiting for the daily scheduler. It uses the same worker as cron.
router.post("/run-occasion-sweep", async (req, res) => {
  if (req.user!.role !== "OWNER") {
    throw new AppError(403, "Only owners can run occasion offers");
  }
  const hotel = await SettingsService.getSettings(req.withTenant, req.user!.hotelId);
  await occasionQueue.add("occasion-sweep-manual", {
    hotelId: req.user!.hotelId,
    hotelName: hotel.name,
  }, { jobId: `occasion-manual-${req.user!.hotelId}-${Date.now()}` });
  res.json({ data: { queued: true } });
});

// GET /api/settings/permissions
// Returns every non-OWNER system role with its full permission matrix.
router.get("/permissions", async (req, res) => {
  const data = await PermissionsService.getRolePermissions(req.user!.hotelId);
  res.json({ data });
});

// PATCH /api/settings/permissions/:roleId
// OWNER-only. Toggles individual permissions for a non-OWNER role.
router.patch("/permissions/:roleId", async (req, res) => {
  if (req.user!.role !== "OWNER") {
    throw new AppError(403, "Only owners can manage role permissions");
  }
  const dto = updateRolePermissionsSchema.parse(req.body);
  const result = await PermissionsService.updateRolePermissions(
    req.user!.hotelId,
    req.params.roleId as string,
    dto,
  );
  res.json(result);
});

// GET /api/settings/plan — current plan + usage (read-only, any authenticated user)
router.get("/plan", async (req, res) => {
  const today = new Date(`${getCurrentPKTDate()}T00:00:00.000Z`);
  const [subscription, roomCount, userCount, ratePlanCount, promoCodeCount] = await Promise.all([
    getEffectiveLimits(req.user!.hotelId),
    req.withTenant((db) => db.room.count({ where: { isActive: true } })),
    adminPrisma.hotelUser.count({ where: { hotelId: req.user!.hotelId, isActive: true } }),
    req.withTenant((db) => db.ratePlan.count({ where: { isActive: true } })),
    req.withTenant((db) => db.ratePlanCode.count({ where: {
      isActive: true,
      AND: [
        { OR: [{ validTo: null }, { validTo: { gte: today } }] },
        { OR: [{ maxUses: null }, { usedCount: 0 }] },
      ],
    } })),
  ]);

  const hotel = await adminPrisma.hotel.findUnique({
    where: { id: req.user!.hotelId },
    select: {
      isTrialAccount: true,
      trialEndsAt: true,
      subscriptionPlan: { select: { name: true, priceMonthly: true, slug: true } },
    },
  });

  res.json({
    data: {
      planName: hotel?.subscriptionPlan?.name ?? "No Plan",
      planSlug: hotel?.subscriptionPlan?.slug ?? null,
      priceMonthly: hotel?.subscriptionPlan?.priceMonthly ?? 0,
      isTrialAccount: hotel?.isTrialAccount ?? false,
      trialEndsAt: hotel?.trialEndsAt ?? null,
      trialExpired: subscription.trialExpired,
      limits: subscription.limits,
      usage: {
        maxRooms: roomCount,
        maxUsers: userCount,
        maxActiveRatePlans: ratePlanCount,
        maxActivePromoCodes: promoCodeCount,
      },
      features: subscription.features,
    },
  });
});

// GET /api/settings/export — full data snapshot (OWNER only)
router.get("/export", async (req, res) => {
  if (req.user!.role !== "OWNER") {
    throw new AppError(403, "Only the hotel owner can export data");
  }
  await checkFeatureAccess(req.user!.hotelId, "reportsExport");

  const hotelId = req.user!.hotelId;

  const [hotelSettings, guests, reservations, rooms] = await Promise.all([
    SettingsService.getSettings(req.withTenant, hotelId),
    req.withTenant((db) =>
      db.guest.findMany({
        select: {
          fullName: true, phone: true, email: true,
          documentNumber: true, nationality: true,
          totalStays: true, isBlacklisted: true, createdAt: true,
        },
        orderBy: { fullName: "asc" },
      }),
    ),
    req.withTenant((db) =>
      db.reservation.findMany({
        select: {
          confirmationNumber: true, status: true,
          checkInDate: true, checkOutDate: true,
          adults: true, children: true, source: true, createdAt: true,
          guest: { select: { fullName: true, phone: true } },
          rooms: {
            select: {
              ratePerNight: true,
              room: { select: { number: true } },
              roomType: { select: { name: true } },
            },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ),
    req.withTenant((db) =>
      db.room.findMany({
        select: {
          number: true, floor: true, status: true, isActive: true,
          roomType: { select: { name: true, defaultRate: true } },
        },
        orderBy: { number: "asc" },
      }),
    ),
  ]);

  type ExpenseRow = {
    date: string; category: string; description: string; amount: number;
    payment_method: string | null; paid_to: string | null;
    receipt_ref: string | null; notes: string | null;
  };
  type LedgerRow = {
    entry_type: string; amount: number; account_name: string | null;
    source_type: string | null; description: string | null;
    payment_method: string | null; created_at: string;
  };

  const [expenses, ledger] = await Promise.all([
    adminPrisma.$queryRaw<ExpenseRow[]>`
      SELECT date::text, category, description, amount,
             payment_method, paid_to, receipt_ref, notes
      FROM expenses
      WHERE hotel_id = ${hotelId}::uuid
      ORDER BY date DESC
    `,
    adminPrisma.$queryRaw<LedgerRow[]>`
      SELECT le.entry_type, le.amount, ca.name AS account_name,
             le.source_type, le.description, le.payment_method,
             le.created_at::text
      FROM ledger_entries le
      LEFT JOIN cash_accounts ca ON ca.id = le.account_id
      WHERE le.hotel_id = ${hotelId}::uuid
      ORDER BY le.created_at DESC
      LIMIT 5000
    `,
  ]);

  res.json({
    data: {
      hotelName: hotelSettings.name,
      exportedAt: new Date().toISOString(),
      guests,
      reservations: reservations.map((r) => ({
        ...r,
        checkInDate: r.checkInDate.toISOString(),
        checkOutDate: r.checkOutDate.toISOString(),
        createdAt: r.createdAt.toISOString(),
      })),
      rooms,
      expenses,
      ledger,
    },
  });
});

// POST /api/settings/deactivate — set hotel isActive = false (OWNER only)
router.post("/deactivate", async (req, res) => {
  if (req.user!.role !== "OWNER") {
    throw new AppError(403, "Only the hotel owner can deactivate the hotel");
  }

  await adminPrisma.hotel.update({
    where: { id: req.user!.hotelId },
    data: { isActive: false },
  });

  await req.withTenant((db) =>
    db.auditLog.create({
      data: {
        hotelId: req.user!.hotelId,
        userId: req.user!.userId,
        action: "HOTEL_DEACTIVATE",
        entity: "hotel",
        entityId: req.user!.hotelId,
      },
    }),
  );

  res.json({ data: { success: true } });
});

// ── Channel Manager (Channex) ────────────────────────────────────────────────
// OWNER-only throughout, enforced inline per the convention at the top of this
// file. Distribution controls pricing and inventory on public OTAs — this is
// not something a front-desk account should be able to switch on.

function requireOwner(role: string): void {
  if (role !== "OWNER") {
    throw new AppError(403, "Only the hotel owner can manage channel distribution");
  }
}

// GET /api/settings/channel-manager — connection, mapping and alert snapshot
router.get("/channel-manager", async (req, res) => {
  requireOwner(req.user!.role);
  const status = await ChannexProvisioningService.getStatus(req.user!.hotelId);
  res.json({ data: status });
});

// POST /api/settings/channel-manager/provision — create or refresh the property
router.post("/channel-manager/provision", async (req, res) => {
  requireOwner(req.user!.role);
  const body = provisionChannexSchema.parse(req.body ?? {});
  const result = await ChannexProvisioningService.provisionHotel(req.user!.hotelId, {
    ratePlanIds: body.ratePlanIds,
  });

  // 422 rather than 500 when the hotel is simply incomplete: the response
  // carries the exact field list, which the panel renders as a checklist.
  res.status(result.success ? 200 : (result.missingFields ? 422 : 502)).json({
    data: result,
    ...(result.error && { error: result.error }),
  });
});

// PATCH /api/settings/channel-manager — activation and per-direction sync toggles
router.patch("/channel-manager", async (req, res) => {
  requireOwner(req.user!.role);
  const body = updateChannelManagerSchema.parse(req.body);
  const hotelId = req.user!.hotelId;

  const existing = await adminPrisma.channelConfig.findUnique({
    where: { hotelId_channelType: { hotelId, channelType: "CHANNEL_MANAGER" } },
  });
  if (!existing) throw new AppError(404, "Channel manager is not set up for this hotel");

  const updated = await adminPrisma.channelConfig.update({
    where: { hotelId_channelType: { hotelId, channelType: "CHANNEL_MANAGER" } },
    data: {
      ...(body.isActive      !== undefined && { isActive:      body.isActive }),
      ...(body.syncInventory !== undefined && { syncInventory: body.syncInventory }),
      ...(body.syncRates     !== undefined && { syncRates:     body.syncRates }),
    },
  });

  // The nightly repeatable follows activation, so a disconnected hotel stops
  // being swept and a reconnected one resumes without a redeploy.
  if (body.isActive === true)  await scheduleHotelChannexSync(hotelId);
  if (body.isActive === false) await cancelHotelChannexSync(hotelId);

  await req.withTenant((db) =>
    db.auditLog.create({
      data: {
        hotelId, userId: req.user!.userId,
        action: "CHANNEL_MANAGER_UPDATE", entity: "channel_config", entityId: updated.id,
        after: JSON.parse(JSON.stringify(body)),
      },
    }),
  );

  res.json({ data: { isActive: updated.isActive, syncInventory: updated.syncInventory, syncRates: updated.syncRates } });
});

// POST /api/settings/channel-manager/sync — "Sync now"
// Mirrors the manual occasion sweep above: enqueue, never run inline.
router.post("/channel-manager/sync", async (req, res) => {
  requireOwner(req.user!.role);
  const queued = await enqueueChannexSync({
    hotelId: req.user!.hotelId,
    reason:  "MANUAL",
    immediate: true,
  });
  res.json({ data: { queued } });
});

// POST /api/settings/channel-manager/alerts/:id/acknowledge
// Clears a handled overbooking or failure so the panel reflects reality.
router.post("/channel-manager/alerts/:id/acknowledge", async (req, res) => {
  requireOwner(req.user!.role);
  const cleared = await acknowledgeIngestionAlert(req.user!.hotelId, req.params.id as string);
  if (!cleared) throw new AppError(404, "Alert not found or already cleared");
  res.json({ data: { acknowledged: true } });
});

export default router;
