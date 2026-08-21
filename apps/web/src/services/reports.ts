import { api } from "../lib/api";

export interface HotelInfo {
  name: string;
  address: string | null;
  phone: string | null;
  city: string | null;
}

export interface PaymentMethodBreakdown {
  cash: number;
  card: number;
  jazzcash: number;
  easypaisa: number;
  bankTransfer: number;
  other: number;
}

export interface ExpenseCategory {
  category: string;
  amount: number;
  count: number;
}

// ── Daily report ─────────────────────────────────────────────────────────────

export interface DailyArrival {
  confirmationNumber: string;
  guestName: string;
  roomNumber: string;
  nights: number;
  amount: number;
  status: string;
}

export interface DailyDeparture {
  confirmationNumber: string;
  guestName: string;
  roomNumber: string;
  nights: number;
  totalCharged: number;
  totalPaid: number;
  balance: number;
}

export interface DailyStayOver {
  confirmationNumber: string;
  guestName: string;
  roomNumber: string;
  checkOutDate: string;
  nightsRemaining: number;
}

export interface CashVariance {
  expectedCash: number;
  ledgerBalance: number;
  variance: number;
}

export interface DailyReport {
  date: string;
  hotel: HotelInfo;
  occupancy: {
    totalRooms: number;
    occupied: number;
    available: number;
    checkIns: number;
    checkOuts: number;
    stayOvers: number;
    occupancyRate: number;
  };
  revenue: {
    roomRevenue: number;
    posRevenue: number;
    otherCharges: number;
    totalCharged: number;
    totalCollected: number;
    outstanding: number;
    byMethod: PaymentMethodBreakdown;
  };
  arrivals: DailyArrival[];
  departures: DailyDeparture[];
  stayOvers: DailyStayOver[];
  expenses: { total: number; byCategory: ExpenseCategory[] };
  operations: {
    housekeeping: {
      totalTasks: number;
      completed: number;
      pending: number;
      checkoutCleans: number;
      checkoutCleansPending: number;
    };
    maintenance: {
      openTickets: number;
      urgentOpen: number;
      resolvedToday: number;
      newToday: number;
    };
    groups: {
      activeGroups: number;
      groupCheckIns: number;
      groupCheckOuts: number;
    };
    pos: {
      totalOrders: number;
      totalRevenue: number;
      postedToRoom: number;
      directPayments: number;
    };
  };
  cashVariance: CashVariance | null;
}

// ── Monthly report ───────────────────────────────────────────────────────────

export interface RevenueByDay {
  date: string;
  revenue: number;
  occupancy: number;
}

export interface TopGuest {
  name: string;
  visits: number;
  totalSpend: number;
}

export interface OccupancyByRoomType {
  roomType: string;
  totalRooms: number;
  occupiedNights: number;
  occupancyRate: number;
  revenue: number;
}

export interface MonthlyReport {
  year: number;
  month: number;
  monthName: string;
  hotel: HotelInfo;
  summary: {
    totalRevenue: number;
    totalExpenses: number;
    netProfit: number;
    profitMargin: number;
    averageOccupancy: number;
    adr: number;
    revpar: number;
    totalGuests: number;
    totalReservations: number;
    averageLengthOfStay: number;
  };
  revenueByDay: RevenueByDay[];
  revenueBySource: {
    roomRevenue: number;
    posRevenue: number;
    otherCharges: number;
  };
  paymentMethods: PaymentMethodBreakdown;
  expensesByCategory: ExpenseCategory[];
  topGuests: TopGuest[];
  groupBookings: {
    totalGroups: number;
    totalGroupRooms: number;
    groupRevenue: number;
  };
  housekeeping: {
    totalTasksCompleted: number;
    averageTasksPerDay: number;
  };
  maintenance: {
    totalTickets: number;
    resolved: number;
    avgResolutionTime: number;
    estimatedCost: number;
    actualCost: number;
  };
  occupancyByRoomType: OccupancyByRoomType[];
}

// ── Revenue by Source report ─────────────────────────────────────────────────

export interface RevenueBySourceDay {
  date: string;
  roomRevenue: number;
  posRevenue: number;
  otherRevenue: number;
  total: number;
}

export interface RevenueBySourceReport {
  dailyBreakdown: RevenueBySourceDay[];
  totals: { roomRevenue: number; posRevenue: number; otherRevenue: number; total: number };
  percentageSplit: { room: number; pos: number; other: number };
}

// ── Payment Methods report ───────────────────────────────────────────────────

export interface PaymentMethodEntry {
  method: string;
  amount: number;
  count: number;
  percentage: number;
}

export interface PaymentMethodsReport {
  methods: PaymentMethodEntry[];
  total: number;
}

// ── Outstanding Balances report ──────────────────────────────────────────────

export interface OutstandingFolioEntry {
  confirmationNumber: string;
  guestName: string;
  roomNumber: string;
  checkOutDate: string;
  balance: number;
  daysOutstanding: number;
}

export interface OutstandingBalancesReport {
  buckets: {
    current: OutstandingFolioEntry[];
    aging30: OutstandingFolioEntry[];
    aging30plus: OutstandingFolioEntry[];
  };
  totals: { current: number; aging30: number; aging30plus: number };
  grandTotal: number;
}

// ── Void & Refund Log report ─────────────────────────────────────────────────

export interface VoidRefundEntry {
  type: "VOID" | "REFUND";
  date: string;
  description: string;
  amount: number;
  performedBy: string;
  reservationConfirmation: string | null;
  notes: string | null;
}

export interface VoidRefundLogReport {
  entries: VoidRefundEntry[];
  totalVoids: number;
  totalRefunds: number;
}

// ── Cash Reconciliation report ───────────────────────────────────────────────

export interface CashAccount {
  name: string;
  type: string;
  incoming: number;
  outgoing: number;
  netFlow: number;
}

export type CashReconciliationReport =
  | { available: true; accounts: CashAccount[]; totals: { incoming: number; outgoing: number; netFlow: number } }
  | { available: false; error: string };

// ── Occupancy Trend report ───────────────────────────────────────────────────

export interface OccupancyTrendDay {
  date: string;
  totalRooms: number;
  occupied: number;
  occupancyRate: number;
}

export interface OccupancyTrendReport {
  dailyBreakdown: OccupancyTrendDay[];
  summary: {
    avgOccupancy: number;
    peakDate: string;
    peakRate: number;
    lowestDate: string;
    lowestRate: number;
    totalRoomNights: number;
  };
}

// ── ADR / RevPAR report ──────────────────────────────────────────────────────

export interface ADRRevPARDay {
  date: string;
  adr: number;
  revpar: number;
  roomsSold: number;
  sellableRooms: number;
  outOfServiceRooms: number;
  occupancyRate: number;
  roomRevenue: number;
}

export interface ADRRevPARReport {
  dailyBreakdown: ADRRevPARDay[];
  summary: {
    avgADR: number;
    avgRevPAR: number;
    totalRoomRevenue: number;
    totalRoomsSold: number;
    sellableRoomNights: number;
    outOfServiceRoomNights: number;
    occupancyRate: number;
  };
}

export interface HistoricalComparisonSummary {
  occupancyRate: number;
  adr: number;
  revpar: number;
  roomRevenue: number;
  reservations: number;
  roomNights: number;
  cancellations: number;
  companyRevenue: number;
  companyRoomNights: number;
  groupRevenue: number;
  groupRoomNights: number;
}

export interface HistoricalComparisonPeriod {
  startDate: string;
  endDate: string;
  summary: HistoricalComparisonSummary;
  days: Array<{
    date: string;
    occupancyRate: number;
    adr: number;
    revpar: number;
    roomRevenue: number;
    roomNights: number;
  }>;
}

export interface HistoricalComparisonReport {
  current: HistoricalComparisonPeriod;
  previousPeriod: HistoricalComparisonPeriod & { variance: Record<keyof HistoricalComparisonSummary, { absolute: number; percentage: number | null }> };
  samePeriodLastYear: HistoricalComparisonPeriod & { variance: Record<keyof HistoricalComparisonSummary, { absolute: number; percentage: number | null }> };
}

export interface PickupPaceSummary {
  sellableRoomNights: number;
  roomsSold: number;
  expectedRoomRevenue: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
}

export interface PickupPaceDelta {
  roomNights: number;
  revenue: number;
  occupancyPoints: number;
  roomNightsPerDay: number;
  revenuePerDay: number;
}

export interface PickupPaceReport {
  startDate: string;
  endDate: string;
  requestedLookbackDays: number;
  current: { observationAt: string; summary: PickupPaceSummary };
  pickupBaseline: { observationAt: string; elapsedDays: number; summary: PickupPaceSummary | null } | null;
  lastYearBaseline: { observationAt: string; summary: PickupPaceSummary | null } | null;
  pickup: PickupPaceDelta | null;
  lastYearVariance: { roomNights: number; revenue: number; occupancyPoints: number } | null;
  days: Array<{
    date: string;
    sellableRooms: number;
    roomsSold: number;
    occupancyRate: number;
    expectedRoomRevenue: number;
    pickupRooms: number | null;
    pickupRevenue: number | null;
    lastYearRoomsSold: number | null;
  }>;
  roomTypes: Array<{ id: string; name: string; current: PickupPaceSummary; pickup: PickupPaceDelta | null }>;
  collection: { startedAt: string; pickupAvailable: boolean; lastYearAvailable: boolean };
}

// ── Hotel forecast ───────────────────────────────────────────────────────────

export interface ForecastDay {
  date: string;
  physicalRooms: number;
  outOfServiceRooms: number;
  sellableRooms: number;
  roomsSold: number;
  availableRooms: number;
  occupancyRate: number;
  adr: number;
  revpar: number;
  expectedRoomRevenue: number;
  arrivals: number;
  departures: number;
  stayovers: number;
}

export interface ForecastRoomTypeDay extends ForecastDay {
  roomTypeId: string;
  roomTypeName: string;
}

export interface ForecastReport {
  startDate: string;
  endDate: string;
  days: ForecastDay[];
  roomTypes: Array<{ id: string; name: string; days: ForecastRoomTypeDay[] }>;
  contribution: {
    categories: Array<{ category: string; reservations: number; roomNights: number; expectedRoomRevenue: number; percentage: number }>;
    companies: Array<{ companyId: string; companyName: string; reservations: number; roomNights: number; expectedRoomRevenue: number; percentage: number }>;
  };
  operational: {
    enquiryDemand: Array<{ date: string; rooms: number }>;
    groups: Array<{ groupId: string; groupName: string; groupRef: string | null; arrivalDate: string; departureDate: string; rooms: number }>;
    maintenanceReturns: Array<{ blockId: string; date: string; roomNumber: string; roomTypeName: string; reason: string }>;
  };
  summary: {
    physicalRoomNights: number;
    outOfServiceRoomNights: number;
    sellableRoomNights: number;
    roomsSold: number;
    availableRoomNights: number;
    expectedRoomRevenue: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
  };
}

export interface EarlyBirdReport {
  archiveId: string | null;
  auditReversedAt: string | null;
  reportDate: string;
  generatedAt: string;
  hotelName: string;
  closedDay: {
    businessDate: string;
    source: "FROZEN_AUDIT";
    isStale: boolean;
    auditId: string | null;
    auditRevision: number;
    runAt: string | null;
    snapshot: import("@/services/nightAudit").BusinessDaySnapshot;
    topSellingItems: {
      pos: Array<{ name: string; quantity: number; revenue: number }>;
      qr: Array<{ name: string; quantity: number; revenue: number }>;
    };
  };
  today: {
    metrics: ForecastDay;
    arrivals: Array<{
      id: string;
      confirmationNumber: string;
      status: string;
      estimatedArrivalTime: string | null;
      isVip: boolean;
      guestName: string;
      roomNumbers: string[];
      companyName: string | null;
      groupName: string | null;
    }>;
    departures: Array<{
      id: string;
      confirmationNumber: string;
      guestName: string;
      roomNumbers: string[];
      guestBalance: number;
      companyBalance: number;
      totalBalance: number;
    }>;
    stayovers: number;
    roomStatus: Record<string, number>;
    housekeeping: Array<{ id: string; taskType: string; status: string; priority: number; isEscalated: boolean; room: { number: string } }>;
    maintenance: Array<{ id: string; ticketNumber: string; title: string; priority: string; status: string; room: { number: string } | null }>;
    outstandingFolios: Array<{
      id: string;
      folioNumber: string;
      balanceDue: number;
      guestBalanceDue: number;
      companyBalanceDue: number;
      reservationId: string | null;
      reservationNumber: string | null;
      guestName: string;
    }>;
    outstandingSummary: { count: number; total: number; guest: number; company: number };
    lowStock: Array<{ id: string; name: string; unit: string; currentStock: number; reorderLevel: number; parLevel: number; urgency: string }>;
    latestNightShift: {
      shiftDate: string;
      notes: string | null;
      variance: number;
      varianceReason: string | null;
      handoverBriefing: unknown;
      signedOffAt: string | null;
    } | null;
  };
  outlook: ForecastReport;
}

export interface EarlyBirdArchive {
  id: string;
  reportDate: string;
  forecastDays: number;
  generatedAt: string;
  nightAuditId: string;
  auditRevision: number;
  auditReversedAt: string | null;
}

// ── Room Type Performance report ─────────────────────────────────────────────

export interface RoomTypePerformanceRow {
  roomTypeName: string;
  totalRooms: number;
  occupiedNights: number;
  occupancyRate: number;
  revenue: number;
  adr: number;
}

// ── Source of Business report ────────────────────────────────────────────────

export interface SourceOfBusinessRow {
  source: string;
  count: number;
  roomNights: number;
  revenue: number;
  avgBookingValue: number;
  percentageOfTotal: number;
}

// ── Length of Stay report ────────────────────────────────────────────────────

export interface LengthOfStayBucket {
  label: string;
  count: number;
  percentage: number;
  avgRevenue: number;
}

export interface LengthOfStayReport {
  buckets: LengthOfStayBucket[];
  summary: { avgLengthOfStay: number; totalStays: number };
}

// ── Guest Directory report ───────────────────────────────────────────────────

export interface GuestDirectoryEntry {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  documentNumber: string | null;
  nationality: string | null;
  totalStays: number;
  totalSpend: number;
  vipLevel: number;
  isBlacklisted: boolean;
  createdAt: string;
}

export interface GuestDirectoryReport {
  guests: GuestDirectoryEntry[];
  total: number;
  page: number;
  limit: number;
}

// ── Repeat Guests report ─────────────────────────────────────────────────────

export interface RepeatGuestRow {
  id: string;
  fullName: string;
  totalStays: number;
  totalSpend: number;
  avgSpendPerStay: number;
  lastStayDate: string | null;
}

export interface RepeatGuestsReport {
  guests: RepeatGuestRow[];
  total: number;
  totalRevenue: number;
}

// ── Guest Blacklist report ───────────────────────────────────────────────────

export interface BlacklistEntry {
  guestName: string;
  phone: string | null;
  documentNumber: string | null;
  reason: string;
  severity: number;
  blacklistedAt: string;
}

export interface GuestBlacklistReport {
  entries: BlacklistEntry[];
  total: number;
  bySeverity: { low: number; medium: number; high: number };
}

// ── Guest Demographics report ────────────────────────────────────────────────

export interface NationalityRow {
  nationality: string;
  count: number;
  percentage: number;
}

export interface GuestTypeRow {
  type: string;
  count: number;
  percentage: number;
}

export interface GuestDemographicsReport {
  total: number;
  localVsForeign: {
    localCount: number;
    foreignCount: number;
    local: number;
    foreign: number;
  };
  byNationality: NationalityRow[];
  byGuestType: GuestTypeRow[];
}

// ── Phase 3 types ─────────────────────────────────────────────────────────────

export interface HKStaffRow {
  staffId: string | null;
  staffName: string;
  tasksCompleted: number;
  avgCompletionMinutes: number | null;
  byType: Array<{ taskType: string; count: number }>;
}

export interface HousekeepingPerformanceReport {
  staffPerformance: HKStaffRow[];
  byType: Array<{ taskType: string; count: number }>;
  summary: { totalCompleted: number; avgCompletionMinutes: number | null; staffCount: number };
}

export interface MaintenanceSummaryReport {
  byStatus: Array<{ status: string; count: number }>;
  byPriority: Array<{ priority: string; count: number }>;
  byCategory: Array<{ category: string; count: number }>;
  costSummary: { totalEstimated: number; totalActual: number; costVariance: number };
  summary: { total: number; avgResolutionHours: number | null; resolvedCount: number };
}

export interface StaffActivityRow {
  staffId: string | null;
  staffName: string;
  totalActions: number;
  creates: number;
  updates: number;
  deletes: number;
  other: number;
  topEntity: string | null;
  recentEntries: Array<{ action: string; entity: string; createdAt: string }>;
}

export interface StaffActivityReport {
  staff: StaffActivityRow[];
  summary: { totalActions: number; staffCount: number; creates: number; updates: number; deletes: number };
}

export interface GroupBookingRow {
  groupId: string;
  groupName: string;
  operatorName: string;
  reservationCount: number;
  roomNights: number;
  totalRevenue: number;
  avgRevenuePerRoom: number;
}

export interface GroupBookingsSummaryReport {
  groups: GroupBookingRow[];
  summary: { totalGroups: number; totalRoomNights: number; totalRevenue: number; avgRevenuePerGroup: number };
}

export interface StockConsumptionItem {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  totalQuantity: number;
  totalCost: number;
}

export interface StockConsumptionReport {
  items: StockConsumptionItem[];
  byCategory: Array<{ category: string; totalCost: number }>;
  summary: { totalTransactions: number; uniqueItems: number; totalCost: number };
}

export interface WasteLossItem {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  wasteQuantity: number;
  costLost: number;
  wastePercentage: number;
}

export interface WasteLossReport {
  items: WasteLossItem[];
  summary: { totalWasteItems: number; totalCostLost: number; totalWasteQuantity: number };
}

export interface LowStockItem {
  itemId: string;
  itemName: string;
  category: string;
  unit: string;
  currentStock: number;
  reorderLevel: number;
  parLevel: number;
  costPerUnit: number;
  estimatedReorderCost: number;
  supplier: string | null;
  urgency: "critical" | "high" | "medium";
}

export interface LowStockReorderReport {
  items: LowStockItem[];
  summary: { totalLowStock: number; critical: number; high: number; medium: number; estimatedReorderCost: number };
}

export interface POSSalesItem {
  posItemId: string;
  itemName: string;
  category: string;
  quantitySold: number;
  revenue: number;
}

export interface POSSalesReport {
  topItems: POSSalesItem[];
  byCategory: Array<{ category: string; revenue: number; percentage: number }>;
  summary: { totalOrders: number; totalRevenue: number; avgOrderValue: number };
}

export type QROrdersReport =
  | {
      available: true;
      byDeliveryType: Array<{ deliveryType: string; orderCount: number; revenue: number }>;
      byPaymentPreference: Array<{ paymentPreference: string; orderCount: number; revenue: number }>;
      byStatus: Array<{ status: string; orderCount: number; revenue: number }>;
      summary: { totalOrders: number; totalRevenue: number };
    }
  | { available: false; error: string };

// ── Service ──────────────────────────────────────────────────────────────────

export const reportsService = {
  getDailyReport: async (date: string): Promise<DailyReport> => {
    const res = await api.get("/api/reports/daily", { params: { date } });
    return res.data.data;
  },

  getEarlyBirdReport: async (date: string, forecastDays: number): Promise<EarlyBirdReport> => {
    const res = await api.get("/api/reports/early-bird", { params: { date, forecastDays } });
    return res.data.data;
  },

  getEarlyBirdHistory: async (page = 1, limit = 20): Promise<{ data: EarlyBirdArchive[]; meta: import("@/services/rooms").PaginationMeta }> => {
    const res = await api.get("/api/reports/early-bird/history", { params: { page, limit } });
    return res.data;
  },

  getMonthlyReport: async (year: number, month: number): Promise<MonthlyReport> => {
    const res = await api.get("/api/reports/monthly", { params: { year, month } });
    return res.data.data;
  },

  getRevenueBySource: async (startDate: string, endDate: string): Promise<RevenueBySourceReport> => {
    const res = await api.get("/api/reports/revenue-source", { params: { startDate, endDate } });
    return res.data.data;
  },

  getPaymentMethods: async (startDate: string, endDate: string): Promise<PaymentMethodsReport> => {
    const res = await api.get("/api/reports/payment-methods", { params: { startDate, endDate } });
    return res.data.data;
  },

  getOutstandingBalances: async (): Promise<OutstandingBalancesReport> => {
    const res = await api.get("/api/reports/outstanding-balances");
    return res.data.data;
  },

  getVoidRefundLog: async (startDate: string, endDate: string): Promise<VoidRefundLogReport> => {
    const res = await api.get("/api/reports/void-refund-log", { params: { startDate, endDate } });
    return res.data.data;
  },

  getCashReconciliation: async (startDate: string, endDate: string): Promise<CashReconciliationReport> => {
    const res = await api.get("/api/reports/cash-reconciliation", { params: { startDate, endDate } });
    return res.data.data;
  },

  getOccupancyTrend: async (startDate: string, endDate: string): Promise<OccupancyTrendReport> => {
    const res = await api.get("/api/reports/occupancy-trend", { params: { startDate, endDate } });
    return res.data.data;
  },

  getADRRevPAR: async (startDate: string, endDate: string): Promise<ADRRevPARReport> => {
    const res = await api.get("/api/reports/adr-revpar", { params: { startDate, endDate } });
    return res.data.data;
  },

  getHistoricalComparison: async (startDate: string, endDate: string): Promise<HistoricalComparisonReport> => {
    const res = await api.get("/api/reports/historical-comparison", { params: { startDate, endDate } });
    return res.data.data;
  },

  getPickupPace: async (startDate: string, days: number, lookbackDays: number): Promise<PickupPaceReport> => {
    const res = await api.get("/api/reports/pickup-pace", { params: { startDate, days, lookbackDays } });
    return res.data.data;
  },

  getForecast: async (startDate: string, days: number): Promise<ForecastReport> => {
    const res = await api.get("/api/reports/forecast", { params: { startDate, days } });
    return res.data.data;
  },

  getRoomTypePerformance: async (startDate: string, endDate: string): Promise<RoomTypePerformanceRow[]> => {
    const res = await api.get("/api/reports/room-type-performance", { params: { startDate, endDate } });
    return res.data.data;
  },

  getSourceOfBusiness: async (startDate: string, endDate: string): Promise<SourceOfBusinessRow[]> => {
    const res = await api.get("/api/reports/source-of-business", { params: { startDate, endDate } });
    return res.data.data;
  },

  getLengthOfStay: async (startDate: string, endDate: string): Promise<LengthOfStayReport> => {
    const res = await api.get("/api/reports/length-of-stay", { params: { startDate, endDate } });
    return res.data.data;
  },

  getGuestDirectory: async (params: {
    search?: string;
    page?: number;
    limit?: number;
    sort?: string;
  }): Promise<GuestDirectoryReport> => {
    const res = await api.get("/api/reports/guest-directory", { params });
    return res.data.data;
  },

  getRepeatGuests: async (minStays: number): Promise<RepeatGuestsReport> => {
    const res = await api.get("/api/reports/repeat-guests", { params: { minStays } });
    return res.data.data;
  },

  getGuestBlacklistReport: async (): Promise<GuestBlacklistReport> => {
    const res = await api.get("/api/reports/guest-blacklist-report");
    return res.data.data;
  },

  getGuestDemographics: async (startDate: string, endDate: string): Promise<GuestDemographicsReport> => {
    const res = await api.get("/api/reports/guest-demographics", { params: { startDate, endDate } });
    return res.data.data;
  },

  // ── Phase 3: Operations ───────────────────────────────────────────────────────

  getHousekeepingPerformance: async (startDate: string, endDate: string): Promise<HousekeepingPerformanceReport> => {
    const res = await api.get("/api/reports/housekeeping-performance", { params: { startDate, endDate } });
    return res.data.data;
  },

  getMaintenanceSummary: async (startDate: string, endDate: string): Promise<MaintenanceSummaryReport> => {
    const res = await api.get("/api/reports/maintenance-summary", { params: { startDate, endDate } });
    return res.data.data;
  },

  getStaffActivity: async (startDate: string, endDate: string, userId?: string): Promise<StaffActivityReport> => {
    const res = await api.get("/api/reports/staff-activity", { params: { startDate, endDate, userId } });
    return res.data.data;
  },

  getGroupBookingsSummary: async (startDate: string, endDate: string): Promise<GroupBookingsSummaryReport> => {
    const res = await api.get("/api/reports/group-bookings-summary", { params: { startDate, endDate } });
    return res.data.data;
  },

  // ── Phase 3: Inventory ────────────────────────────────────────────────────────

  getStockConsumption: async (startDate: string, endDate: string, category?: string): Promise<StockConsumptionReport> => {
    const res = await api.get("/api/reports/stock-consumption", { params: { startDate, endDate, category } });
    return res.data.data;
  },

  getWasteLoss: async (startDate: string, endDate: string): Promise<WasteLossReport> => {
    const res = await api.get("/api/reports/waste-loss", { params: { startDate, endDate } });
    return res.data.data;
  },

  getLowStockReorder: async (): Promise<LowStockReorderReport> => {
    const res = await api.get("/api/reports/low-stock-reorder");
    return res.data.data;
  },

  // ── Phase 3: POS & Dining ─────────────────────────────────────────────────────

  getPOSSales: async (startDate: string, endDate: string): Promise<POSSalesReport> => {
    const res = await api.get("/api/reports/pos-sales", { params: { startDate, endDate } });
    return res.data.data;
  },

  getQROrders: async (startDate: string, endDate: string): Promise<QROrdersReport> => {
    const res = await api.get("/api/reports/qr-orders", { params: { startDate, endDate } });
    return res.data.data;
  },
};
