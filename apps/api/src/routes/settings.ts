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

const router = Router();
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

// GET /api/settings/permissions
// Returns every non-OWNER system role with its full permission matrix.
router.get("/permissions", async (_req, res) => {
  const data = await PermissionsService.getRolePermissions();
  res.json({ data });
});

// PATCH /api/settings/permissions/:roleId
// OWNER-only. Toggles individual permissions for a non-OWNER role.
router.patch("/permissions/:roleId", async (req, res) => {
  if (req.user!.role !== "OWNER") {
    throw new AppError(403, "Only owners can manage role permissions");
  }
  const dto = updateRolePermissionsSchema.parse(req.body);
  const result = await PermissionsService.updateRolePermissions(req.params.roleId as string, dto);
  res.json(result);
});

export default router;
