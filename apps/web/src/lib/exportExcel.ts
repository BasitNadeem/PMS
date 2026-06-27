import * as XLSX from "xlsx";
import type { DailyReport, MonthlyReport } from "@/services/reports";

// ── helpers ───────────────────────────────────────────────────────────────────

type Cell = string | number | null;

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

  XLSX.writeFile(wb, `Daily-Report-${slugify(report.hotel.name)}-${report.date}.xlsx`);
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

  XLSX.writeFile(wb, `Monthly-Report-${slugify(report.hotel.name)}-${report.monthName}-${report.year}.xlsx`);
}
