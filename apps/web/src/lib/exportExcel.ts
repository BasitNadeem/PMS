import * as XLSX from "xlsx";
import { api, getErrorMessage } from "@/lib/api";
import type { ExportAllData } from "@/services/settings";
import type { LedgerEntry, LedgerSummary } from "@/services/cashbook";
import type {
  DailyReport,
  MonthlyReport,
  RevenueBySourceReport,
  PaymentMethodsReport,
  OutstandingBalancesReport,
  VoidRefundLogReport,
  CashReconciliationReport,
  OccupancyTrendReport,
  ADRRevPARReport,
  RoomTypePerformanceRow,
  SourceOfBusinessRow,
  LengthOfStayReport,
  GuestDirectoryReport,
  RepeatGuestsReport,
  GuestBlacklistReport,
  GuestDemographicsReport,
  HousekeepingPerformanceReport,
  MaintenanceSummaryReport,
  StaffActivityReport,
  GroupBookingsSummaryReport,
  StockConsumptionReport,
  WasteLossReport,
  LowStockReorderReport,
  POSSalesReport,
  QROrdersReport,
} from "@/services/reports";

// ── helpers ───────────────────────────────────────────────────────────────────

type Cell = string | number | null;

function writeSubscriptionFile(workbook: XLSX.WorkBook, filename: string): void {
  void api.get<{ data: { features: Record<string, boolean> } }>("/api/settings/plan")
    .then(({ data }) => {
      if (data.data.features.reportsExport !== true) {
        window.alert("Report exports are not included in this subscription plan.");
        return;
      }
      XLSX.writeFile(workbook, filename);
    })
    .catch((error: unknown) => {
      window.alert(getErrorMessage(error, "Unable to verify report export access. Please try again."));
    });
}

function rupees(paisas: number): number {
  return Math.floor(paisas / 100);
}

const METHOD_LABELS: Record<string, string> = {
  cash: "Cash", card: "Card", jazzcash: "JazzCash",
  easypaisa: "Easypaisa", bankTransfer: "Bank Transfer", other: "Other",
};

function slugify(value: string): string {
  return value.trim().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "");
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

/**
 * Build a worksheet from an array-of-arrays with a leading title block.
 * Each "block" is: optional bold-label row, one header row, data rows, optional total row.
 */
interface Block {
  label?: string;
  headers: string[];
  rows: Cell[][];
  totalRow?: Cell[];
}

function buildSheet(title: string, subtitle: string, blocks: Block[]): XLSX.WorkSheet {
  const aoa: Cell[][] = [];

  // Title header
  aoa.push([title]);
  aoa.push([subtitle]);
  aoa.push(["", "Generated:", new Date().toLocaleString("en-PK")]);
  aoa.push([]);

  for (const block of blocks) {
    if (block.label) {
      aoa.push([block.label]);
    }
    aoa.push(block.headers);
    for (const row of block.rows) aoa.push(row);
    if (block.totalRow) aoa.push(block.totalRow);
    aoa.push([]); // spacer between blocks
  }

  return XLSX.utils.aoa_to_sheet(aoa);
}

// ── DAILY REPORT ─────────────────────────────────────────────────────────────

export function exportDailyReportExcel(report: DailyReport) {
  const wb = XLSX.utils.book_new();
  const period = new Date(report.date).toLocaleDateString("en-PK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });

  // ── Sheet 1: Summary ───────────────────────────────────────────────────────
  const ws1 = buildSheet(
    "Daily Operations Report",
    `${report.hotel.name} — ${period}`,
    [
      {
        label: "OCCUPANCY",
        headers: ["Total Rooms", "Occupied", "Available", "Check-ins", "Check-outs", "Stay-overs", "Occupancy %"],
        rows: [[
          report.occupancy.totalRooms,
          report.occupancy.occupied,
          report.occupancy.available,
          report.occupancy.checkIns,
          report.occupancy.checkOuts,
          report.occupancy.stayOvers,
          report.occupancy.occupancyRate,
        ]],
      },
      {
        label: "REVENUE (PKR)",
        headers: ["Room Revenue", "POS Revenue", "Other Charges", "Total Charged", "Total Collected", "Outstanding"],
        rows: [[
          rupees(report.revenue.roomRevenue),
          rupees(report.revenue.posRevenue),
          rupees(report.revenue.otherCharges),
          rupees(report.revenue.totalCharged),
          rupees(report.revenue.totalCollected),
          rupees(report.revenue.outstanding),
        ]],
      },
      {
        label: "PAYMENT METHODS (PKR)",
        headers: Object.values(METHOD_LABELS),
        rows: [Object.keys(METHOD_LABELS).map((k) =>
          rupees(report.revenue.byMethod[k as keyof typeof report.revenue.byMethod])
        )],
      },
      ...(report.cashVariance
        ? [{
          label: "CASH VARIANCE (PKR)",
          headers: ["Expected Cash", "Ledger Balance", "Variance"],
          rows: [[
            rupees(report.cashVariance.expectedCash),
            rupees(report.cashVariance.ledgerBalance),
            rupees(report.cashVariance.variance),
          ]],
        }]
        : []),
    ],
  );
  setColWidths(ws1, [22, 18, 18, 18, 18, 18, 14]);
  XLSX.utils.book_append_sheet(wb, ws1, "Summary");

  // ── Sheet 2: Arrivals ──────────────────────────────────────────────────────
  const ws2 = buildSheet(
    "Arrivals",
    `${report.hotel.name} — ${period}`,
    [{
      headers: ["Confirmation #", "Guest Name", "Room(s)", "Nights", "Amount (PKR)", "Status"],
      rows: report.arrivals.length > 0
        ? report.arrivals.map((a) => [
          a.confirmationNumber, a.guestName, a.roomNumber,
          a.nights, rupees(a.amount), a.status,
        ])
        : [["—", "No arrivals on this date", "", "", "", ""]],
    }],
  );
  setColWidths(ws2, [20, 28, 14, 8, 16, 14]);
  XLSX.utils.book_append_sheet(wb, ws2, "Arrivals");

  // ── Sheet 3: Departures ────────────────────────────────────────────────────
  const ws3 = buildSheet(
    "Departures",
    `${report.hotel.name} — ${period}`,
    [{
      headers: ["Confirmation #", "Guest Name", "Room(s)", "Nights", "Charged (PKR)", "Paid (PKR)", "Balance (PKR)"],
      rows: report.departures.length > 0
        ? report.departures.map((d) => [
          d.confirmationNumber, d.guestName, d.roomNumber,
          d.nights, rupees(d.totalCharged), rupees(d.totalPaid), rupees(d.balance),
        ])
        : [["—", "No departures on this date", "", "", "", "", ""]],
    }],
  );
  setColWidths(ws3, [20, 28, 14, 8, 16, 14, 14]);
  XLSX.utils.book_append_sheet(wb, ws3, "Departures");

  // ── Sheet 4: Stay-overs ────────────────────────────────────────────────────
  const ws4 = buildSheet(
    "Stay-overs",
    `${report.hotel.name} — ${period}`,
    [{
      headers: ["Confirmation #", "Guest Name", "Room(s)", "Check-out Date", "Nights Remaining"],
      rows: report.stayOvers.length > 0
        ? report.stayOvers.map((s) => [
          s.confirmationNumber, s.guestName, s.roomNumber,
          s.checkOutDate.slice(0, 10), s.nightsRemaining,
        ])
        : [["—", "No stay-overs on this date", "", "", ""]],
    }],
  );
  setColWidths(ws4, [20, 28, 14, 16, 16]);
  XLSX.utils.book_append_sheet(wb, ws4, "Stay-overs");

  // ── Sheet 5: Expenses ──────────────────────────────────────────────────────
  const expTotal = report.expenses.byCategory.reduce((s, c) => s + c.amount, 0);
  const ws5 = buildSheet(
    "Expenses",
    `${report.hotel.name} — ${period}`,
    [{
      headers: ["Category", "Amount (PKR)", "Count"],
      rows: report.expenses.byCategory.length > 0
        ? report.expenses.byCategory.map((c) => [
          c.category.replace(/_/g, " "), rupees(c.amount), c.count,
        ])
        : [["No expenses recorded", "", ""]],
      totalRow: report.expenses.byCategory.length > 0
        ? ["TOTAL", rupees(expTotal), report.expenses.byCategory.reduce((s, c) => s + c.count, 0)]
        : undefined,
    }],
  );
  setColWidths(ws5, [28, 16, 10]);
  XLSX.utils.book_append_sheet(wb, ws5, "Expenses");

  // ── Sheet 6: Operations ────────────────────────────────────────────────────
  const ws6 = buildSheet(
    "Operations Snapshot",
    `${report.hotel.name} — ${period}`,
    [
      {
        label: "HOUSEKEEPING",
        headers: ["Total Tasks", "Completed", "Pending", "Checkout Cleans", "Checkout Cleans Pending"],
        rows: [[
          report.operations.housekeeping.totalTasks,
          report.operations.housekeeping.completed,
          report.operations.housekeeping.pending,
          report.operations.housekeeping.checkoutCleans,
          report.operations.housekeeping.checkoutCleansPending,
        ]],
      },
      {
        label: "MAINTENANCE",
        headers: ["Open Tickets", "Urgent Open", "Resolved Today", "New Today"],
        rows: [[
          report.operations.maintenance.openTickets,
          report.operations.maintenance.urgentOpen,
          report.operations.maintenance.resolvedToday,
          report.operations.maintenance.newToday,
        ]],
      },
      {
        label: "POS",
        headers: ["Total Orders", "Revenue (PKR)", "Posted to Room", "Direct Payments"],
        rows: [[
          report.operations.pos.totalOrders,
          rupees(report.operations.pos.totalRevenue),
          report.operations.pos.postedToRoom,
          report.operations.pos.directPayments,
        ]],
      },
      {
        label: "GROUPS",
        headers: ["Active Groups", "Group Check-ins", "Group Check-outs"],
        rows: [[
          report.operations.groups.activeGroups,
          report.operations.groups.groupCheckIns,
          report.operations.groups.groupCheckOuts,
        ]],
      },
    ],
  );
  setColWidths(ws6, [24, 18, 18, 18, 22]);
  XLSX.utils.book_append_sheet(wb, ws6, "Operations");

  writeSubscriptionFile(wb, `Daily-Report-${slugify(report.hotel.name)}-${report.date}.xlsx`);
}

// ── MONTHLY REPORT ────────────────────────────────────────────────────────────

export function exportMonthlyReportExcel(report: MonthlyReport) {
  const wb = XLSX.utils.book_new();
  const period = `${report.monthName} ${report.year}`;

  // ── Sheet 1: Executive Summary ─────────────────────────────────────────────
  const ws1 = buildSheet(
    "Monthly Summary Report",
    `${report.hotel.name} — ${period}`,
    [
      {
        label: "FINANCIAL SUMMARY (PKR)",
        headers: ["Total Revenue", "Total Expenses", "Net Profit", "Profit Margin %"],
        rows: [[
          rupees(report.summary.totalRevenue),
          rupees(report.summary.totalExpenses),
          rupees(report.summary.netProfit),
          report.summary.profitMargin,
        ]],
      },
      {
        label: "OCCUPANCY METRICS",
        headers: ["Avg Occupancy %", "ADR (PKR)", "RevPAR (PKR)", "Avg Length of Stay (nights)"],
        rows: [[
          report.summary.averageOccupancy,
          rupees(report.summary.adr),
          rupees(report.summary.revpar),
          report.summary.averageLengthOfStay,
        ]],
      },
      {
        label: "VOLUME",
        headers: ["Total Reservations", "Total Guests", "Group Bookings", "Group Revenue (PKR)", "Group Rooms"],
        rows: [[
          report.summary.totalReservations,
          report.summary.totalGuests,
          report.groupBookings.totalGroups,
          rupees(report.groupBookings.groupRevenue),
          report.groupBookings.totalGroupRooms,
        ]],
      },
      {
        label: "REVENUE BY SOURCE (PKR)",
        headers: ["Room Revenue", "POS Revenue", "Other Charges", "Total"],
        rows: [[
          rupees(report.revenueBySource.roomRevenue),
          rupees(report.revenueBySource.posRevenue),
          rupees(report.revenueBySource.otherCharges),
          rupees(report.revenueBySource.roomRevenue + report.revenueBySource.posRevenue + report.revenueBySource.otherCharges),
        ]],
      },
      {
        label: "PAYMENT METHODS (PKR)",
        headers: Object.values(METHOD_LABELS),
        rows: [Object.keys(METHOD_LABELS).map((k) =>
          rupees(report.paymentMethods[k as keyof typeof report.paymentMethods])
        )],
      },
    ],
  );
  setColWidths(ws1, [26, 20, 20, 22, 20]);
  XLSX.utils.book_append_sheet(wb, ws1, "Executive Summary");

  // ── Sheet 2: Revenue by Day ────────────────────────────────────────────────
  const ws2 = buildSheet(
    "Revenue by Day",
    `${report.hotel.name} — ${period}`,
    [{
      headers: ["Date", "Revenue (PKR)", "Occupancy %"],
      rows: report.revenueByDay.map((d) => [d.date, rupees(d.revenue), d.occupancy]),
      totalRow: [
        "TOTAL",
        rupees(report.revenueByDay.reduce((s, d) => s + d.revenue, 0)),
        report.summary.averageOccupancy + " (avg)",
      ],
    }],
  );
  setColWidths(ws2, [14, 18, 14]);
  XLSX.utils.book_append_sheet(wb, ws2, "Revenue by Day");

  // ── Sheet 3: Expenses ──────────────────────────────────────────────────────
  const expTotal = report.expensesByCategory.reduce((s, c) => s + c.amount, 0);
  const ws3 = buildSheet(
    "Expenses by Category",
    `${report.hotel.name} — ${period}`,
    [{
      headers: ["Category", "Amount (PKR)", "Count", "% of Revenue"],
      rows: report.expensesByCategory.length > 0
        ? report.expensesByCategory.map((c) => [
          c.category.replace(/_/g, " "),
          rupees(c.amount),
          c.count,
          report.summary.totalRevenue > 0
            ? Math.round((c.amount / report.summary.totalRevenue) * 1000) / 10
            : 0,
        ])
        : [["No expenses recorded", "", "", ""]],
      totalRow: report.expensesByCategory.length > 0
        ? ["TOTAL", rupees(expTotal), report.expensesByCategory.reduce((s, c) => s + c.count, 0), ""]
        : undefined,
    }],
  );
  setColWidths(ws3, [28, 18, 10, 16]);
  XLSX.utils.book_append_sheet(wb, ws3, "Expenses");

  // ── Sheet 4: Occupancy by Room Type ───────────────────────────────────────
  const ws4 = buildSheet(
    "Occupancy by Room Type",
    `${report.hotel.name} — ${period}`,
    [{
      headers: ["Room Type", "Total Rooms", "Occupied Nights", "Occupancy %", "Revenue (PKR)"],
      rows: report.occupancyByRoomType.length > 0
        ? report.occupancyByRoomType.map((rt) => [
          rt.roomType, rt.totalRooms, rt.occupiedNights, rt.occupancyRate, rupees(rt.revenue),
        ])
        : [["No room type data", "", "", "", ""]],
      totalRow: report.occupancyByRoomType.length > 0
        ? [
          "TOTAL",
          report.occupancyByRoomType.reduce((s, rt) => s + rt.totalRooms, 0),
          report.occupancyByRoomType.reduce((s, rt) => s + rt.occupiedNights, 0),
          report.summary.averageOccupancy,
          rupees(report.occupancyByRoomType.reduce((s, rt) => s + rt.revenue, 0)),
        ]
        : undefined,
    }],
  );
  setColWidths(ws4, [24, 14, 18, 14, 18]);
  XLSX.utils.book_append_sheet(wb, ws4, "Occupancy by Room Type");

  // ── Sheet 5: Top Guests ────────────────────────────────────────────────────
  const ws5 = buildSheet(
    "Top Guests by Spend",
    `${report.hotel.name} — ${period}`,
    [{
      headers: ["Rank", "Guest Name", "Visits", "Total Spend (PKR)"],
      rows: report.topGuests.length > 0
        ? report.topGuests.map((g, i) => [i + 1, g.name, g.visits, rupees(g.totalSpend)])
        : [[1, "No guest data this month", "", ""]],
    }],
  );
  setColWidths(ws5, [8, 32, 10, 20]);
  XLSX.utils.book_append_sheet(wb, ws5, "Top Guests");

  // ── Sheet 6: Operations ────────────────────────────────────────────────────
  const ws6 = buildSheet(
    "Operations Summary",
    `${report.hotel.name} — ${period}`,
    [
      {
        label: "HOUSEKEEPING",
        headers: ["Tasks Completed", "Avg Tasks per Day"],
        rows: [[
          report.housekeeping.totalTasksCompleted,
          report.housekeeping.averageTasksPerDay,
        ]],
      },
      {
        label: "MAINTENANCE",
        headers: ["Total Tickets", "Resolved", "Avg Resolution (hrs)", "Estimated Cost (PKR)", "Actual Cost (PKR)"],
        rows: [[
          report.maintenance.totalTickets,
          report.maintenance.resolved,
          report.maintenance.avgResolutionTime,
          rupees(report.maintenance.estimatedCost),
          rupees(report.maintenance.actualCost),
        ]],
      },
      {
        label: "GROUP BOOKINGS",
        headers: ["Total Groups", "Total Group Rooms", "Group Revenue (PKR)"],
        rows: [[
          report.groupBookings.totalGroups,
          report.groupBookings.totalGroupRooms,
          rupees(report.groupBookings.groupRevenue),
        ]],
      },
    ],
  );
  setColWidths(ws6, [28, 18, 20, 22, 20]);
  XLSX.utils.book_append_sheet(wb, ws6, "Operations");

  writeSubscriptionFile(wb, `Monthly-Report-${slugify(report.hotel.name)}-${report.monthName}-${report.year}.xlsx`);
}

// ── REVENUE BY SOURCE ─────────────────────────────────────────────────────────

export function exportRevenueSourceToExcel(
  report: RevenueBySourceReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const period = `${startDate} to ${endDate}`;

  const ws1 = buildSheet(
    "Revenue by Source",
    period,
    [
      {
        label: "PERIOD TOTALS (PKR)",
        headers: ["Room Revenue", "POS Revenue", "Other Revenue", "Grand Total"],
        rows: [[
          rupees(report.totals.roomRevenue),
          rupees(report.totals.posRevenue),
          rupees(report.totals.otherRevenue),
          rupees(report.totals.total),
        ]],
      },
      {
        label: "PERCENTAGE SPLIT",
        headers: ["Room %", "POS %", "Other %"],
        rows: [[report.percentageSplit.room, report.percentageSplit.pos, report.percentageSplit.other]],
      },
      {
        label: "DAILY BREAKDOWN (PKR)",
        headers: ["Date", "Room Revenue", "POS Revenue", "Other Revenue", "Total"],
        rows: report.dailyBreakdown.map((d) => [
          d.date,
          rupees(d.roomRevenue),
          rupees(d.posRevenue),
          rupees(d.otherRevenue),
          rupees(d.total),
        ]),
        totalRow: [
          "TOTAL",
          rupees(report.totals.roomRevenue),
          rupees(report.totals.posRevenue),
          rupees(report.totals.otherRevenue),
          rupees(report.totals.total),
        ],
      },
    ],
  );
  setColWidths(ws1, [14, 18, 16, 18, 16]);
  XLSX.utils.book_append_sheet(wb, ws1, "Revenue by Source");

  writeSubscriptionFile(wb, `Revenue-by-Source-${startDate}-to-${endDate}.xlsx`);
}

// ── PAYMENT METHODS ───────────────────────────────────────────────────────────

const PAYMENT_METHOD_DISPLAY: Record<string, string> = {
  CASH: "Cash",
  JAZZCASH: "JazzCash",
  EASYPAISA: "Easypaisa",
  BANK_TRANSFER: "Bank Transfer",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  CHEQUE: "Cheque",
  ADVANCE_DEPOSIT: "Advance Deposit",
  OTA_COLLECT: "OTA Collect",
  COMPLIMENTARY: "Complimentary",
};

export function exportPaymentMethodsToExcel(
  report: PaymentMethodsReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();

  const ws = buildSheet(
    "Payment Method Breakdown",
    `${startDate} to ${endDate}`,
    [{
      headers: ["Payment Method", "Transactions", "Amount (PKR)", "% of Total"],
      rows: report.methods
        .filter((m) => m.count > 0)
        .map((m) => [
          PAYMENT_METHOD_DISPLAY[m.method] ?? m.method,
          m.count,
          rupees(m.amount),
          m.percentage,
        ]),
      totalRow: ["TOTAL", report.methods.reduce((s, m) => s + m.count, 0), rupees(report.total), 100],
    }],
  );
  setColWidths(ws, [22, 16, 18, 14]);
  XLSX.utils.book_append_sheet(wb, ws, "Payment Methods");

  writeSubscriptionFile(wb, `Payment-Methods-${startDate}-to-${endDate}.xlsx`);
}

// ── OUTSTANDING BALANCES ──────────────────────────────────────────────────────

export function exportOutstandingBalancesToExcel(report: OutstandingBalancesReport) {
  const wb = XLSX.utils.book_new();
  const now = new Date().toLocaleDateString("en-PK");

  const allEntries = [
    ...report.buckets.current.map((e) => ({ ...e, bucket: "0–7 Days" })),
    ...report.buckets.aging30.map((e) => ({ ...e, bucket: "8–30 Days" })),
    ...report.buckets.aging30plus.map((e) => ({ ...e, bucket: "30+ Days" })),
  ];

  const ws = buildSheet(
    "Outstanding Balances",
    `Snapshot as of ${now}`,
    [
      {
        label: "AGING SUMMARY (PKR)",
        headers: ["0–7 Days", "8–30 Days", "30+ Days", "Grand Total"],
        rows: [[
          rupees(report.totals.current),
          rupees(report.totals.aging30),
          rupees(report.totals.aging30plus),
          rupees(report.grandTotal),
        ]],
      },
      {
        label: "ALL OUTSTANDING FOLIOS",
        headers: ["Aging Bucket", "Guest", "Room(s)", "Confirmation #", "Checkout Date", "Days Outstanding", "Balance (PKR)"],
        rows: allEntries.length > 0
          ? allEntries.map((e) => [
            e.bucket,
            e.guestName,
            e.roomNumber,
            e.confirmationNumber,
            e.checkOutDate,
            e.daysOutstanding,
            rupees(e.balance),
          ])
          : [["—", "No outstanding balances", "", "", "", "", ""]],
        totalRow: allEntries.length > 0
          ? ["TOTAL", "", "", "", "", "", rupees(report.grandTotal)]
          : undefined,
      },
    ],
  );
  setColWidths(ws, [14, 28, 14, 20, 14, 18, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "Outstanding Balances");

  writeSubscriptionFile(wb, `Outstanding-Balances-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── VOID & REFUND LOG ─────────────────────────────────────────────────────────

export function exportVoidRefundLogToExcel(
  report: VoidRefundLogReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();

  const ws = buildSheet(
    "Void & Refund Log",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY (PKR)",
        headers: ["Total Voids", "Total Refunds", "Combined"],
        rows: [[
          rupees(report.totalVoids),
          rupees(report.totalRefunds),
          rupees(report.totalVoids + report.totalRefunds),
        ]],
      },
      {
        label: "LOG ENTRIES",
        headers: ["Date", "Type", "Description", "Amount (PKR)", "Reservation #", "Performed By", "Notes"],
        rows: report.entries.length > 0
          ? report.entries.map((e) => [
            new Date(e.date).toLocaleString("en-PK"),
            e.type,
            e.description,
            rupees(e.amount),
            e.reservationConfirmation ?? "—",
            e.performedBy,
            e.notes ?? "",
          ])
          : [["—", "No voids or refunds in this period", "", "", "", "", ""]],
      },
    ],
  );
  setColWidths(ws, [20, 10, 32, 16, 18, 22, 28]);
  XLSX.utils.book_append_sheet(wb, ws, "Void & Refund Log");

  writeSubscriptionFile(wb, `Void-Refund-Log-${startDate}-to-${endDate}.xlsx`);
}

// ── CASH RECONCILIATION ───────────────────────────────────────────────────────

export function exportCashReconciliationToExcel(
  report: CashReconciliationReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();

  if (!report.available) {
    const ws = buildSheet(
      "Cash Reconciliation",
      `${startDate} to ${endDate}`,
      [{ headers: ["Status"], rows: [[report.error]] }],
    );
    XLSX.utils.book_append_sheet(wb, ws, "Unavailable");
  } else {
    const ws = buildSheet(
      "Cash / Bank Reconciliation",
      `${startDate} to ${endDate}`,
      [
        {
          label: "PERIOD TOTALS (PKR)",
          headers: ["Total Incoming", "Total Outgoing", "Net Flow"],
          rows: [[
            rupees(report.totals.incoming),
            rupees(report.totals.outgoing),
            rupees(report.totals.netFlow),
          ]],
        },
        {
          label: "BY ACCOUNT (PKR)",
          headers: ["Account", "Type", "Incoming", "Outgoing", "Net Flow"],
          rows: report.accounts.map((a) => [
            a.name,
            a.type,
            rupees(a.incoming),
            rupees(a.outgoing),
            rupees(a.netFlow),
          ]),
          totalRow: [
            "TOTAL", "",
            rupees(report.totals.incoming),
            rupees(report.totals.outgoing),
            rupees(report.totals.netFlow),
          ],
        },
      ],
    );
    setColWidths(ws, [28, 18, 18, 18, 16]);
    XLSX.utils.book_append_sheet(wb, ws, "Cash Reconciliation");
  }

  writeSubscriptionFile(wb, `Cash-Reconciliation-${startDate}-to-${endDate}.xlsx`);
}

// ── OCCUPANCY TREND ───────────────────────────────────────────────────────────

export function exportOccupancyTrendToExcel(report: OccupancyTrendReport, startDate: string, endDate: string) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Occupancy Trend Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Avg Occupancy %", "Peak Date", "Peak Rate %", "Lowest Date", "Lowest Rate %", "Total Room-Nights"],
        rows: [[
          report.summary.avgOccupancy,
          report.summary.peakDate,
          report.summary.peakRate,
          report.summary.lowestDate,
          report.summary.lowestRate,
          report.summary.totalRoomNights,
        ]],
      },
      {
        label: "DAILY BREAKDOWN",
        headers: ["Date", "Total Rooms", "Occupied", "Occupancy %"],
        rows: report.dailyBreakdown.map((d) => [d.date, d.totalRooms, d.occupied, d.occupancyRate]),
      },
    ],
  );
  setColWidths(ws, [14, 14, 12, 14]);
  XLSX.utils.book_append_sheet(wb, ws, "Occupancy Trend");
  writeSubscriptionFile(wb, `Occupancy-Trend-${startDate}-to-${endDate}.xlsx`);
}

// ── ADR / RevPAR ──────────────────────────────────────────────────────────────

export function exportADRRevPARToExcel(report: ADRRevPARReport, startDate: string, endDate: string) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "ADR / RevPAR Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Avg ADR (PKR)", "Avg RevPAR (PKR)", "Total Room Revenue (PKR)", "Total Rooms Sold"],
        rows: [[
          rupees(report.summary.avgADR),
          rupees(report.summary.avgRevPAR),
          rupees(report.summary.totalRoomRevenue),
          report.summary.totalRoomsSold,
        ]],
      },
      {
        label: "DAILY BREAKDOWN",
        headers: ["Date", "Rooms Sold", "Room Revenue (PKR)", "ADR (PKR)", "RevPAR (PKR)"],
        rows: report.dailyBreakdown.map((d) => [
          d.date,
          d.roomsSold,
          rupees(d.roomRevenue),
          rupees(d.adr),
          rupees(d.revpar),
        ]),
      },
    ],
  );
  setColWidths(ws, [14, 14, 22, 16, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "ADR RevPAR");
  writeSubscriptionFile(wb, `ADR-RevPAR-${startDate}-to-${endDate}.xlsx`);
}

// ── ROOM TYPE PERFORMANCE ─────────────────────────────────────────────────────

export function exportRoomTypePerformanceToExcel(rows: RoomTypePerformanceRow[], startDate: string, endDate: string) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Room Type Performance",
    `${startDate} to ${endDate}`,
    [
      {
        headers: ["Room Type", "Total Rooms", "Occupied Nights", "Occupancy %", "Revenue (PKR)", "ADR (PKR)"],
        rows: rows.map((r) => [
          r.roomTypeName,
          r.totalRooms,
          r.occupiedNights,
          r.occupancyRate,
          rupees(r.revenue),
          rupees(r.adr),
        ]),
      },
    ],
  );
  setColWidths(ws, [24, 14, 18, 14, 18, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "Room Type Performance");
  writeSubscriptionFile(wb, `Room-Type-Performance-${startDate}-to-${endDate}.xlsx`);
}

// ── SOURCE OF BUSINESS ────────────────────────────────────────────────────────

const SOURCE_DISPLAY: Record<string, string> = {
  WALK_IN: "Walk-In", PHONE: "Phone", WHATSAPP: "WhatsApp",
  DIRECT_WEBSITE: "Direct Website", BOOKING_COM: "Booking.com",
  AGODA: "Agoda", EXPEDIA: "Expedia", AIRBNB: "Airbnb",
  BOOKME_PK: "Bookme.pk", SASTATICKET_PK: "SastaTicket.pk",
  TRAVEL_AGENT: "Travel Agent", OTA_OTHER: "Other OTA",
};

export function exportSourceOfBusinessToExcel(rows: SourceOfBusinessRow[], startDate: string, endDate: string) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Source of Business Report",
    `${startDate} to ${endDate}`,
    [
      {
        headers: ["Source", "Bookings", "Room-Nights", "Revenue (PKR)", "Avg Booking Value (PKR)", "% of Total"],
        rows: rows.map((r) => [
          SOURCE_DISPLAY[r.source] ?? r.source,
          r.count,
          r.roomNights,
          rupees(r.revenue),
          rupees(r.avgBookingValue),
          r.percentageOfTotal,
        ]),
        totalRow: [
          "TOTAL",
          rows.reduce((s, r) => s + r.count, 0),
          rows.reduce((s, r) => s + r.roomNights, 0),
          rupees(rows.reduce((s, r) => s + r.revenue, 0)),
          "",
          100,
        ],
      },
    ],
  );
  setColWidths(ws, [22, 12, 14, 18, 24, 14]);
  XLSX.utils.book_append_sheet(wb, ws, "Source of Business");
  writeSubscriptionFile(wb, `Source-of-Business-${startDate}-to-${endDate}.xlsx`);
}

// ── LENGTH OF STAY ────────────────────────────────────────────────────────────

export function exportLengthOfStayToExcel(report: LengthOfStayReport, startDate: string, endDate: string) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Length of Stay Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Avg Length of Stay (nights)", "Total Stays"],
        rows: [[report.summary.avgLengthOfStay, report.summary.totalStays]],
      },
      {
        label: "DISTRIBUTION",
        headers: ["Stay Duration", "Stays", "% of Total", "Avg Revenue (PKR)"],
        rows: report.buckets.map((b) => [
          b.label,
          b.count,
          b.percentage,
          rupees(b.avgRevenue),
        ]),
        totalRow: ["TOTAL", report.summary.totalStays, 100, ""],
      },
    ],
  );
  setColWidths(ws, [20, 12, 14, 22]);
  XLSX.utils.book_append_sheet(wb, ws, "Length of Stay");
  writeSubscriptionFile(wb, `Length-of-Stay-${startDate}-to-${endDate}.xlsx`);
}

// ── GUEST DIRECTORY ───────────────────────────────────────────────────────────

export function exportGuestDirectoryToExcel(report: GuestDirectoryReport, search?: string) {
  const wb = XLSX.utils.book_new();
  const subtitle = search ? `Search: "${search}" — ${report.guests.length} of ${report.total} guests` : `${report.guests.length} of ${report.total} guests`;
  const ws = buildSheet(
    "Guest Directory",
    subtitle,
    [
      {
        headers: ["Full Name", "Phone", "Email", "Document #", "Nationality", "Stays", "Total Spend (PKR)", "VIP Level", "Blacklisted", "Since"],
        rows: report.guests.map((g) => [
          g.fullName,
          g.phone ?? "",
          g.email ?? "",
          g.documentNumber ?? "",
          g.nationality ?? "",
          g.totalStays,
          rupees(g.totalSpend),
          g.vipLevel > 0 ? `VIP ${g.vipLevel}` : "",
          g.isBlacklisted ? "Yes" : "No",
          g.createdAt.slice(0, 10),
        ]),
      },
      ...(report.total > report.guests.length
        ? [{ label: `Note: Showing ${report.guests.length} of ${report.total} total guests. Export is capped at 1000 rows.`, headers: [], rows: [] }]
        : []),
    ],
  );
  setColWidths(ws, [26, 16, 28, 18, 18, 8, 20, 12, 12, 14]);
  XLSX.utils.book_append_sheet(wb, ws, "Guest Directory");
  writeSubscriptionFile(wb, `Guest-Directory-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── REPEAT GUESTS ─────────────────────────────────────────────────────────────

export function exportRepeatGuestsToExcel(report: RepeatGuestsReport, minStays: number) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Repeat Guests Report",
    `Guests with ${minStays}+ stays`,
    [
      {
        label: "SUMMARY",
        headers: ["Total Repeat Guests", "Total Revenue (PKR)"],
        rows: [[report.total, rupees(report.totalRevenue)]],
      },
      {
        label: "TOP GUESTS BY SPEND",
        headers: ["Rank", "Guest Name", "Total Stays", "Total Spend (PKR)", "Avg Spend / Stay (PKR)", "Last Stay Date"],
        rows: report.guests.map((g, i) => [
          i + 1,
          g.fullName,
          g.totalStays,
          rupees(g.totalSpend),
          rupees(g.avgSpendPerStay),
          g.lastStayDate ?? "—",
        ]),
      },
    ],
  );
  setColWidths(ws, [8, 28, 14, 22, 26, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "Repeat Guests");
  writeSubscriptionFile(wb, `Repeat-Guests-min${minStays}-stays.xlsx`);
}

// ── GUEST BLACKLIST ───────────────────────────────────────────────────────────

const SEVERITY_LABEL: Record<number, string> = { 1: "Low", 2: "Medium" };
function severityLabel(s: number): string {
  return SEVERITY_LABEL[s] ?? "High";
}

export function exportGuestBlacklistToExcel(report: GuestBlacklistReport) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Guest Blacklist Report",
    `Snapshot as of ${new Date().toLocaleDateString("en-PK")}`,
    [
      {
        label: "SUMMARY",
        headers: ["Total Entries", "Low Severity", "Medium Severity", "High Severity"],
        rows: [[report.total, report.bySeverity.low, report.bySeverity.medium, report.bySeverity.high]],
      },
      {
        label: "BLACKLIST ENTRIES",
        headers: ["Guest Name", "Phone", "Document #", "Severity", "Reason", "Blacklisted On"],
        rows: report.entries.map((e) => [
          e.guestName,
          e.phone ?? "",
          e.documentNumber ?? "",
          severityLabel(e.severity),
          e.reason,
          e.blacklistedAt,
        ]),
      },
    ],
  );
  setColWidths(ws, [26, 16, 18, 14, 40, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "Guest Blacklist");
  writeSubscriptionFile(wb, `Guest-Blacklist-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ── GUEST DEMOGRAPHICS ────────────────────────────────────────────────────────

const GUEST_TYPE_DISPLAY: Record<string, string> = {
  INDIVIDUAL: "Individual", GROUP: "Group",
  CORPORATE: "Corporate", TOUR_OPERATOR: "Tour Operator",
};

export function exportGuestDemographicsToExcel(
  report: GuestDemographicsReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Guest Demographics Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "LOCAL vs FOREIGN",
        headers: ["Category", "Count", "Percentage"],
        rows: [
          ["Local", report.localVsForeign.localCount, report.localVsForeign.local],
          ["Foreign", report.localVsForeign.foreignCount, report.localVsForeign.foreign],
        ],
        totalRow: ["TOTAL", report.total, 100],
      },
      {
        label: "NATIONALITY BREAKDOWN",
        headers: ["Nationality", "Guests", "Percentage"],
        rows: report.byNationality.map((n) => [n.nationality, n.count, n.percentage]),
      },
      {
        label: "GUEST TYPE BREAKDOWN",
        headers: ["Guest Type", "Reservations", "Percentage"],
        rows: report.byGuestType.map((t) => [
          GUEST_TYPE_DISPLAY[t.type] ?? t.type,
          t.count,
          t.percentage,
        ]),
        totalRow: ["TOTAL", report.total, 100],
      },
    ],
  );
  setColWidths(ws, [28, 14, 14]);
  XLSX.utils.book_append_sheet(wb, ws, "Guest Demographics");
  writeSubscriptionFile(wb, `Guest-Demographics-${startDate}-to-${endDate}.xlsx`);
}

// ── Phase 3 exports ───────────────────────────────────────────────────────────

export function exportHousekeepingPerformanceToExcel(
  report: HousekeepingPerformanceReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Housekeeping Performance Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Tasks Completed", report.summary.totalCompleted],
          ["Staff Count", report.summary.staffCount],
          ["Avg Completion Time (min)", report.summary.avgCompletionMinutes ?? "N/A"],
        ],
      },
      {
        label: "STAFF PERFORMANCE",
        headers: ["Staff Name", "Tasks Completed", "Avg Completion (min)"],
        rows: report.staffPerformance.map((s) => [
          s.staffName,
          s.tasksCompleted,
          s.avgCompletionMinutes ?? "N/A",
        ]),
      },
      {
        label: "BY TASK TYPE",
        headers: ["Task Type", "Count"],
        rows: report.byType.map((t) => [t.taskType, t.count]),
      },
    ],
  );
  setColWidths(ws, [28, 16, 20]);
  XLSX.utils.book_append_sheet(wb, ws, "HK Performance");
  writeSubscriptionFile(wb, `Housekeeping-Performance-${startDate}-to-${endDate}.xlsx`);
}

export function exportMaintenanceSummaryToExcel(
  report: MaintenanceSummaryReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Maintenance Summary Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Tickets", report.summary.total],
          ["Resolved", report.summary.resolvedCount],
          ["Avg Resolution (hours)", report.summary.avgResolutionHours ?? "N/A"],
          ["Total Estimated Cost (PKR)", Math.floor((report.costSummary.totalEstimated) / 100)],
          ["Total Actual Cost (PKR)", Math.floor((report.costSummary.totalActual) / 100)],
          ["Cost Variance (PKR)", Math.floor((report.costSummary.costVariance) / 100)],
        ],
      },
      {
        label: "BY STATUS",
        headers: ["Status", "Count"],
        rows: report.byStatus.map((r) => [r.status, r.count]),
      },
      {
        label: "BY PRIORITY",
        headers: ["Priority", "Count"],
        rows: report.byPriority.map((r) => [r.priority, r.count]),
      },
      {
        label: "BY CATEGORY",
        headers: ["Category", "Count"],
        rows: report.byCategory.map((r) => [r.category, r.count]),
      },
    ],
  );
  setColWidths(ws, [28, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "Maintenance Summary");
  writeSubscriptionFile(wb, `Maintenance-Summary-${startDate}-to-${endDate}.xlsx`);
}

export function exportStaffActivityToExcel(
  report: StaffActivityReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Staff Activity Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Actions", report.summary.totalActions],
          ["Staff Active", report.summary.staffCount],
          ["Creates", report.summary.creates],
          ["Updates", report.summary.updates],
          ["Deletes", report.summary.deletes],
        ],
      },
      {
        label: "STAFF BREAKDOWN",
        headers: ["Staff Name", "Total Actions", "Creates", "Updates", "Deletes", "Top Entity"],
        rows: report.staff.map((s) => [
          s.staffName,
          s.totalActions,
          s.creates,
          s.updates,
          s.deletes,
          s.topEntity ?? "",
        ]),
      },
    ],
  );
  setColWidths(ws, [28, 14, 10, 10, 10, 20]);
  XLSX.utils.book_append_sheet(wb, ws, "Staff Activity");
  writeSubscriptionFile(wb, `Staff-Activity-${startDate}-to-${endDate}.xlsx`);
}

export function exportGroupBookingsSummaryToExcel(
  report: GroupBookingsSummaryReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Group Bookings Summary Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Groups", report.summary.totalGroups],
          ["Total Room-Nights", report.summary.totalRoomNights],
          ["Total Revenue (PKR)", Math.floor(report.summary.totalRevenue / 100)],
          ["Avg Revenue per Group (PKR)", Math.floor(report.summary.avgRevenuePerGroup / 100)],
        ],
      },
      {
        label: "GROUP BREAKDOWN",
        headers: ["Group Name", "Operator", "Reservations", "Room-Nights", "Revenue (PKR)", "Avg/Room (PKR)"],
        rows: report.groups.map((g) => [
          g.groupName,
          g.operatorName,
          g.reservationCount,
          g.roomNights,
          Math.floor(g.totalRevenue / 100),
          Math.floor(g.avgRevenuePerRoom / 100),
        ]),
        totalRow: [
          "TOTAL", "", "",
          report.summary.totalRoomNights,
          Math.floor(report.summary.totalRevenue / 100),
          "",
        ],
      },
    ],
  );
  setColWidths(ws, [28, 24, 14, 14, 16, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "Group Bookings");
  writeSubscriptionFile(wb, `Group-Bookings-Summary-${startDate}-to-${endDate}.xlsx`);
}

export function exportStockConsumptionToExcel(
  report: StockConsumptionReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Stock Consumption Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Transactions", report.summary.totalTransactions],
          ["Unique Items", report.summary.uniqueItems],
          ["Total Cost (PKR)", Math.floor(report.summary.totalCost / 100)],
        ],
      },
      {
        label: "BY CATEGORY",
        headers: ["Category", "Total Cost (PKR)"],
        rows: report.byCategory.map((c) => [c.category, Math.floor(c.totalCost / 100)]),
      },
      {
        label: "ITEM BREAKDOWN",
        headers: ["Item Name", "Category", "Unit", "Quantity Consumed", "Total Cost (PKR)"],
        rows: report.items.map((i) => [
          i.itemName,
          i.category,
          i.unit,
          i.totalQuantity,
          Math.floor(i.totalCost / 100),
        ]),
        totalRow: ["TOTAL", "", "", "", Math.floor(report.summary.totalCost / 100)],
      },
    ],
  );
  setColWidths(ws, [28, 18, 10, 18, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "Stock Consumption");
  writeSubscriptionFile(wb, `Stock-Consumption-${startDate}-to-${endDate}.xlsx`);
}

export function exportWasteLossToExcel(
  report: WasteLossReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Waste & Loss Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Items with Waste", report.summary.totalWasteItems],
          ["Total Quantity Wasted", report.summary.totalWasteQuantity],
          ["Total Cost Lost (PKR)", Math.floor(report.summary.totalCostLost / 100)],
        ],
      },
      {
        label: "WASTE BREAKDOWN",
        headers: ["Item Name", "Category", "Unit", "Qty Wasted", "Cost Lost (PKR)", "Waste %"],
        rows: report.items.map((i) => [
          i.itemName,
          i.category,
          i.unit,
          i.wasteQuantity,
          Math.floor(i.costLost / 100),
          i.wastePercentage,
        ]),
        totalRow: ["TOTAL", "", "", report.summary.totalWasteQuantity, Math.floor(report.summary.totalCostLost / 100), ""],
      },
    ],
  );
  setColWidths(ws, [28, 18, 10, 14, 16, 10]);
  XLSX.utils.book_append_sheet(wb, ws, "Waste & Loss");
  writeSubscriptionFile(wb, `Waste-Loss-${startDate}-to-${endDate}.xlsx`);
}

export function exportLowStockReorderToExcel(report: LowStockReorderReport) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "Low Stock / Reorder Report",
    `As of today`,
    [
      {
        label: "SUMMARY",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Low-Stock Items", report.summary.totalLowStock],
          ["Critical (out of stock)", report.summary.critical],
          ["High urgency", report.summary.high],
          ["Medium urgency", report.summary.medium],
          ["Est. Reorder Cost (PKR)", Math.floor(report.summary.estimatedReorderCost / 100)],
        ],
      },
      {
        label: "LOW STOCK ITEMS",
        headers: ["Item Name", "Category", "Unit", "Current Stock", "Reorder Level", "Par Level", "Urgency", "Est. Cost (PKR)", "Supplier"],
        rows: report.items.map((i) => [
          i.itemName,
          i.category,
          i.unit,
          i.currentStock,
          i.reorderLevel,
          i.parLevel,
          i.urgency.toUpperCase(),
          Math.floor(i.estimatedReorderCost / 100),
          i.supplier ?? "",
        ]),
      },
    ],
  );
  setColWidths(ws, [28, 18, 10, 14, 14, 10, 10, 14, 22]);
  XLSX.utils.book_append_sheet(wb, ws, "Low Stock Reorder");
  writeSubscriptionFile(wb, `Low-Stock-Reorder.xlsx`);
}

export function exportPOSSalesToExcel(
  report: POSSalesReport,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "POS Sales Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Orders", report.summary.totalOrders],
          ["Total Revenue (PKR)", Math.floor(report.summary.totalRevenue / 100)],
          ["Avg Order Value (PKR)", Math.floor(report.summary.avgOrderValue / 100)],
        ],
      },
      {
        label: "BY CATEGORY",
        headers: ["Category", "Revenue (PKR)", "% of Total"],
        rows: report.byCategory.map((c) => [c.category, Math.floor(c.revenue / 100), c.percentage]),
      },
      {
        label: "TOP 10 ITEMS",
        headers: ["Item Name", "Category", "Qty Sold", "Revenue (PKR)"],
        rows: report.topItems.map((i) => [
          i.itemName,
          i.category,
          i.quantitySold,
          Math.floor(i.revenue / 100),
        ]),
      },
    ],
  );
  setColWidths(ws, [32, 18, 12, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "POS Sales");
  writeSubscriptionFile(wb, `POS-Sales-${startDate}-to-${endDate}.xlsx`);
}

// ── CASH BOOK EXPORT ─────────────────────────────────────────────────────────

const CASHBOOK_SOURCE_DISPLAY: Record<string, string> = {
  FOLIO_PAYMENT:   "Room Payment",
  EXPENSE:         "Expense",
  BANK_DEPOSIT:    "Bank Deposit",
  CASH_WITHDRAWAL: "Cash Withdrawal",
  OPENING_BALANCE: "Opening Balance",
  ADJUSTMENT:      "Adjustment",
  OTHER:           "Manual Entry",
};

const ENTRY_METHOD_LABELS: Record<string, string> = {
  CASH:          "Cash",
  JAZZCASH:      "JazzCash",
  EASYPAISA:     "Easypaisa",
  CREDIT_CARD:   "Card",
  DEBIT_CARD:    "Card",
  BANK_TRANSFER: "Bank Transfer",
  OTHER:         "Other",
};

export function exportCashBookToExcel(
  entries: LedgerEntry[],
  summary: LedgerSummary,
  filters: { startDate?: string; endDate?: string; entryType?: string },
) {
  const wb = XLSX.utils.book_new();

  const period = filters.startDate && filters.endDate
    ? `${filters.startDate} to ${filters.endDate}`
    : filters.startDate ?? filters.endDate ?? "All time";

  const filterLabel = filters.entryType === "INCOMING" ? "Incoming only"
    : filters.entryType === "OUTGOING" ? "Outgoing only"
    : "All transactions";

  const ws = buildSheet(
    "Balance Book",
    `${period} — ${filterLabel}`,
    [
      {
        label: "SUMMARY (PKR)",
        headers: ["Total In", "Total Out", "Net Flow"],
        rows: [[
          rupees(summary.totalIncoming),
          rupees(summary.totalOutgoing),
          rupees(summary.netFlow),
        ]],
      },
      {
        label: "TRANSACTIONS",
        headers: ["Date", "Description", "Source", "Account", "Payment Method", "In (PKR)", "Out (PKR)", "Balance After (PKR)"],
        rows: entries.map((e) => {
          const isIn = e.entry_type === "INCOMING";
          return [
            e.entry_date.slice(0, 10),
            e.description ?? "",
            CASHBOOK_SOURCE_DISPLAY[e.source_type] ?? e.source_type,
            e.account_name ?? "",
            e.payment_method ? (ENTRY_METHOD_LABELS[e.payment_method] ?? e.payment_method) : "",
            isIn  ? rupees(e.amount) : "",
            !isIn ? rupees(e.amount) : "",
            rupees(e.balance_after),
          ];
        }),
        totalRow: [
          "TOTAL", "", "", "", "",
          rupees(summary.totalIncoming),
          rupees(summary.totalOutgoing),
          "",
        ],
      },
    ],
  );
  setColWidths(ws, [12, 36, 18, 20, 16, 14, 14, 18]);
  XLSX.utils.book_append_sheet(wb, ws, "Balance Book");

  const filename = `Balance-Book-${(filters.startDate ?? "all").slice(0, 10)}-to-${(filters.endDate ?? "all").slice(0, 10)}.xlsx`;
  writeSubscriptionFile(wb, filename);
}

// ── FULL DATA EXPORT ──────────────────────────────────────────────────────────

export function exportAllDataToExcel(data: ExportAllData) {
  const wb = XLSX.utils.book_new();
  const { hotelName } = data;
  const today = new Date().toLocaleDateString("en-PK");

  // Sheet 1: Guests
  const wsGuests = buildSheet(
    "Guest Directory",
    `${hotelName} — All Guests as of ${today}`,
    [{
      headers: ["Full Name", "Phone", "Email", "Document #", "Nationality", "Total Stays", "Blacklisted", "Member Since"],
      rows: data.guests.map((g) => [
        g.fullName, g.phone ?? "", g.email ?? "",
        g.documentNumber ?? "", g.nationality ?? "",
        g.totalStays, g.isBlacklisted ? "Yes" : "No", g.createdAt.slice(0, 10),
      ]),
    }],
  );
  setColWidths(wsGuests, [28, 16, 28, 18, 16, 12, 12, 14]);
  XLSX.utils.book_append_sheet(wb, wsGuests, "Guests");

  // Sheet 2: Reservations
  const wsRes = buildSheet(
    "Reservations",
    `${hotelName} — All Reservations`,
    [{
      headers: ["Confirmation #", "Guest", "Phone", "Room(s)", "Room Type", "Check-in", "Check-out", "Adults", "Children", "Source", "Rate/Night (PKR)", "Status", "Created"],
      rows: data.reservations.map((r) => [
        r.confirmationNumber,
        r.guest.fullName,
        r.guest.phone ?? "",
        r.rooms.map((rr) => rr.room.number).join(", "),
        r.rooms.map((rr) => rr.roomType.name).join(", "),
        r.checkInDate.slice(0, 10),
        r.checkOutDate.slice(0, 10),
        r.adults, r.children, r.source,
        r.rooms.reduce((sum, rr) => sum + Math.floor(rr.ratePerNight / 100), 0),
        r.status,
        r.createdAt.slice(0, 10),
      ]),
    }],
  );
  setColWidths(wsRes, [18, 24, 16, 14, 20, 12, 12, 8, 10, 16, 18, 14, 12]);
  XLSX.utils.book_append_sheet(wb, wsRes, "Reservations");

  // Sheet 3: Rooms
  const wsRooms = buildSheet(
    "Room Inventory",
    `${hotelName} — Rooms`,
    [{
      headers: ["Room Number", "Floor", "Room Type", "Base Rate (PKR/night)", "Status", "Active"],
      rows: data.rooms.map((r) => [
        r.number, r.floor ?? "",
        r.roomType.name, Math.floor(r.roomType.defaultRate / 100),
        r.status, r.isActive ? "Yes" : "No",
      ]),
    }],
  );
  setColWidths(wsRooms, [14, 8, 24, 22, 16, 8]);
  XLSX.utils.book_append_sheet(wb, wsRooms, "Rooms");

  // Sheet 4: Expenses
  const expTotal = data.expenses.reduce((sum, e) => sum + Math.floor(e.amount / 100), 0);
  const wsExp = buildSheet(
    "Expenses",
    `${hotelName} — All Expenses`,
    [{
      headers: ["Date", "Category", "Description", "Amount (PKR)", "Payment Method", "Paid To", "Receipt Ref", "Notes"],
      rows: data.expenses.map((e) => [
        e.date.slice(0, 10),
        e.category.replace(/_/g, " "),
        e.description,
        Math.floor(e.amount / 100),
        e.payment_method ?? "",
        e.paid_to ?? "",
        e.receipt_ref ?? "",
        e.notes ?? "",
      ]),
      totalRow: data.expenses.length > 0
        ? ["TOTAL", "", "", expTotal, "", "", "", ""]
        : undefined,
    }],
  );
  setColWidths(wsExp, [12, 20, 32, 16, 18, 24, 18, 28]);
  XLSX.utils.book_append_sheet(wb, wsExp, "Expenses");

  // Sheet 5: Cash Book
  const wsLedger = buildSheet(
    "Cash Book / Ledger",
    `${hotelName} — Ledger Entries`,
    [{
      headers: ["Date", "Type", "Account", "Source Type", "Description", "Payment Method", "Amount (PKR)"],
      rows: data.ledger.map((l) => [
        l.created_at.slice(0, 10),
        l.entry_type,
        l.account_name ?? "",
        l.source_type ?? "",
        l.description ?? "",
        l.payment_method ?? "",
        Math.floor(l.amount / 100),
      ]),
    }],
  );
  setColWidths(wsLedger, [12, 12, 20, 16, 36, 18, 16]);
  XLSX.utils.book_append_sheet(wb, wsLedger, "Cash Book");

  writeSubscriptionFile(wb, `${slugify(hotelName)}-Full-Export-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportQROrdersToExcel(
  report: Extract<QROrdersReport, { available: true }>,
  startDate: string,
  endDate: string,
) {
  const wb = XLSX.utils.book_new();
  const ws = buildSheet(
    "QR Orders Report",
    `${startDate} to ${endDate}`,
    [
      {
        label: "SUMMARY",
        headers: ["Metric", "Value"],
        rows: [
          ["Total Orders", report.summary.totalOrders],
          ["Total Revenue (PKR)", Math.floor(report.summary.totalRevenue / 100)],
        ],
      },
      {
        label: "BY DELIVERY TYPE",
        headers: ["Delivery Type", "Orders", "Revenue (PKR)"],
        rows: report.byDeliveryType.map((r) => [r.deliveryType, r.orderCount, Math.floor(r.revenue / 100)]),
      },
      {
        label: "BY PAYMENT PREFERENCE",
        headers: ["Payment Preference", "Orders", "Revenue (PKR)"],
        rows: report.byPaymentPreference.map((r) => [r.paymentPreference, r.orderCount, Math.floor(r.revenue / 100)]),
      },
      {
        label: "BY STATUS",
        headers: ["Status", "Orders", "Revenue (PKR)"],
        rows: report.byStatus.map((r) => [r.status, r.orderCount, Math.floor(r.revenue / 100)]),
      },
    ],
  );
  setColWidths(ws, [28, 12, 16]);
  XLSX.utils.book_append_sheet(wb, ws, "QR Orders");
  writeSubscriptionFile(wb, `QR-Orders-${startDate}-to-${endDate}.xlsx`);
}
