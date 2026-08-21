import { Router } from "express";
import { z } from "zod";
import { authenticate } from "../middleware/auth";
import { tenantMiddleware } from "../middleware/tenant";
import { requirePermission } from "../middleware/permission";
import { ReportService } from "../services/ReportService";
import { HotelMetricsService } from "../services/HotelMetricsService";
import { getCurrentPKTDate } from "../lib/timezone";
import { EarlyBirdReportService } from "../services/EarlyBirdReportService";
import { BookingPaceService } from "../services/BookingPaceService";

const router: Router = Router();
router.use(authenticate, tenantMiddleware);

const dateRangeSchema = z.object({
  startDate: z.string().date(),
  endDate: z.string().date(),
}).superRefine((value, ctx) => {
  if (value.endDate < value.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "End date must be on or after start date" });
  const days = Math.round((Date.parse(`${value.endDate}T00:00:00Z`) - Date.parse(`${value.startDate}T00:00:00Z`)) / 86_400_000) + 1;
  if (days > 366) ctx.addIssue({ code: "custom", path: ["endDate"], message: "Report range cannot exceed 366 days" });
});

const forecastSchema = z.object({
  startDate: z.string().date().optional(),
  days: z.coerce.number().int().min(1).max(90).default(10),
});

function addUtcDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

// ── GET /api/reports/daily?date=YYYY-MM-DD ────────────────────────────────────

router.get("/daily", requirePermission("reports:read"), async (req, res) => {
  const { date } = z.object({ date: z.string().date() }).parse(req.query);
  const data = await ReportService.getDailyReport(req.withTenant, req.user!.hotelId, date);
  res.json({ data });
});

// ── GET /api/reports/early-bird?date=&forecastDays=10 ───────────────────────

router.get("/early-bird", requirePermission("reports:read"), async (req, res) => {
  const query = z.object({
    date: z.string().date().optional(),
    forecastDays: z.coerce.number().int().min(1).max(30).default(10),
  }).parse(req.query);
  const data = await EarlyBirdReportService.getReport(
    req.withTenant,
    req.user!.hotelId,
    query.date ?? getCurrentPKTDate(),
    query.forecastDays,
    req.user!.userId,
  );
  res.json({ data });
});

// ── GET /api/reports/early-bird/history ─────────────────────────────────────

router.get("/early-bird/history", requirePermission("reports:read"), async (req, res) => {
  const query = z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }).parse(req.query);
  const result = await EarlyBirdReportService.listArchives(
    req.withTenant,
    req.user!.hotelId,
    query,
  );
  res.json(result);
});

// ── GET /api/reports/monthly?year=2026&month=6 ────────────────────────────────

router.get("/monthly", requirePermission("reports:read"), async (req, res) => {
  const { year, month } = z.object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
  }).parse(req.query);
  const data = await ReportService.getMonthlyReport(req.withTenant, req.user!.hotelId, year, month);
  res.json({ data });
});

// ── GET /api/reports/revenue-source?startDate=&endDate= ──────────────────────

router.get("/revenue-source", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getRevenueBySource(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/payment-methods?startDate=&endDate= ─────────────────────

router.get("/payment-methods", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getPaymentMethodBreakdown(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/outstanding-balances ─────────────────────────────────────

router.get("/outstanding-balances", requirePermission("reports:read"), async (req, res) => {
  const data = await ReportService.getOutstandingBalances(req.withTenant);
  res.json({ data });
});

// ── GET /api/reports/void-refund-log?startDate=&endDate= ─────────────────────

router.get("/void-refund-log", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getVoidRefundLog(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/cash-reconciliation?startDate=&endDate= ─────────────────

router.get("/cash-reconciliation", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getCashReconciliation(req.user!.hotelId, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/occupancy-trend?startDate=&endDate= ─────────────────────

router.get("/occupancy-trend", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getOccupancyTrend(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/adr-revpar?startDate=&endDate= ──────────────────────────

router.get("/adr-revpar", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getADRRevPAR(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/historical-comparison?startDate=&endDate= ──────────────

router.get("/historical-comparison", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getHistoricalComparison(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/pickup-pace?startDate=&days=30&lookbackDays=7 ──────────

router.get("/pickup-pace", requirePermission("reports:read"), async (req, res) => {
  const query = z.object({
    startDate: z.string().date().optional(),
    days: z.coerce.number().int().min(1).max(90).default(30),
    lookbackDays: z.coerce.number().int().refine((value) => [1, 7, 14, 30].includes(value), "Lookback must be 1, 7, 14 or 30 days").default(7),
  }).parse(req.query);
  const startDate = query.startDate ?? getCurrentPKTDate();
  if (startDate > addUtcDays(getCurrentPKTDate(), 90)) {
    throw new z.ZodError([{ code: "custom", path: ["startDate"], message: "Pickup report can start at most 90 days ahead" }]);
  }
  const data = await BookingPaceService.getReport(
    req.withTenant,
    req.user!.hotelId,
    startDate,
    query.days,
    query.lookbackDays,
  );
  res.json({ data });
});

// ── GET /api/reports/forecast?startDate=&days=10 ─────────────────────────────

router.get("/forecast", requirePermission("reports:read"), async (req, res) => {
  const query = forecastSchema.parse(req.query);
  const startDate = query.startDate ?? getCurrentPKTDate();
  const endDate = addUtcDays(startDate, query.days - 1);
  const data = await HotelMetricsService.getRange(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/room-type-performance?startDate=&endDate= ───────────────

router.get("/room-type-performance", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getRoomTypePerformance(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/source-of-business?startDate=&endDate= ──────────────────

router.get("/source-of-business", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getSourceOfBusiness(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/length-of-stay?startDate=&endDate= ──────────────────────

router.get("/length-of-stay", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getLengthOfStay(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── GET /api/reports/guest-directory?search=&page=&limit=&sort= ──────────────

const guestDirectorySchema = z.object({
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(25),
  sort: z.enum(["name", "totalStays", "totalSpend", "createdAt"]).default("name"),
});

router.get("/guest-directory", requirePermission("reports:read"), async (req, res) => {
  const query = guestDirectorySchema.parse(req.query);
  const data = await ReportService.getGuestDirectory(req.withTenant, {
    search: query.search,
    page: query.page,
    limit: query.limit,
    sort: query.sort,
  });
  res.json({ data });
});

// ── GET /api/reports/repeat-guests?minStays= ─────────────────────────────────

router.get("/repeat-guests", requirePermission("reports:read"), async (req, res) => {
  const { minStays } = z.object({ minStays: z.coerce.number().int().min(1).default(2) }).parse(req.query);
  const data = await ReportService.getRepeatGuests(req.withTenant, minStays);
  res.json({ data });
});

// ── GET /api/reports/guest-blacklist-report ───────────────────────────────────

router.get("/guest-blacklist-report", requirePermission("reports:read"), async (req, res) => {
  const data = await ReportService.getGuestBlacklistReport(req.withTenant);
  res.json({ data });
});

// ── GET /api/reports/guest-demographics?startDate=&endDate= ──────────────────

router.get("/guest-demographics", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getGuestDemographics(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── Phase 3: Operations ───────────────────────────────────────────────────────

router.get("/housekeeping-performance", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getHousekeepingPerformance(req.withTenant, startDate, endDate);
  res.json({ data });
});

router.get("/maintenance-summary", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getMaintenanceSummary(req.withTenant, startDate, endDate);
  res.json({ data });
});

router.get("/staff-activity", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const { userId } = z.object({ userId: z.string().uuid().optional() }).parse(req.query);
  const data = await ReportService.getStaffActivity(req.withTenant, startDate, endDate, userId);
  res.json({ data });
});

router.get("/group-bookings-summary", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getGroupBookingsSummary(req.withTenant, startDate, endDate);
  res.json({ data });
});

// ── Phase 3: Inventory ────────────────────────────────────────────────────────

router.get("/stock-consumption", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const { category } = z.object({ category: z.string().trim().optional() }).parse(req.query);
  const data = await ReportService.getStockConsumption(req.withTenant, startDate, endDate, category);
  res.json({ data });
});

router.get("/waste-loss", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getWasteLoss(req.withTenant, startDate, endDate);
  res.json({ data });
});

router.get("/low-stock-reorder", requirePermission("reports:read"), async (req, res) => {
  const data = await ReportService.getLowStockReorder(req.withTenant);
  res.json({ data });
});

// ── Phase 3: POS & Dining ─────────────────────────────────────────────────────

router.get("/pos-sales", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getPOSSales(req.withTenant, startDate, endDate);
  res.json({ data });
});

router.get("/qr-orders", requirePermission("reports:read"), async (req, res) => {
  const { startDate, endDate } = dateRangeSchema.parse(req.query);
  const data = await ReportService.getQROrders(req.user!.hotelId, startDate, endDate);
  res.json({ data });
});

export default router;
