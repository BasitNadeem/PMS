export interface BriefingData {
  hotelName: string;
  date:      string;
  occupancy: {
    occupiedRooms: number;
    totalRooms:    number;
    occupancyRate: number;
  };
  // ADR = room revenue / rooms sold. RevPAR = room revenue / all sellable rooms.
  // Occupancy alone is misleading — a full house at throwaway rates reads as a
  // good night without these two.
  performance: {
    adr:         number; // paisas
    revpar:      number; // paisas
    roomRevenue: number; // paisas
  };
  revenue: {
    totalCollected:      number; // paisas
    totalCharged:        number; // paisas — kept for the log, no longer messaged
    outstandingBalance:  number; // paisas
  };
  posSales: {
    totalRevenue: number; // paisas
    orderCount:   number;
  };
  expensesToday: number; // paisas
  // null when the hotel has no cash-drawer account with any activity — i.e. the
  // Balance Book was never set up. Reporting PKR 0 there would be a lie that reads
  // as "we hold no cash" rather than "nobody told us".
  cashInHand:    number | null; // paisas — CASH_DRAWER + PETTY_CASH balances
  // Shift reports flagged with a cash discrepancy in the last 3 days. This is a
  // theft/error signal and the highest-value line in the whole briefing.
  shiftDiscrepancies: number;
  activity: {
    checkInsToday:     number;
    checkOutsToday:    number;
    newBookingsToday:  number;
  };
  tomorrowArrivals:       number;
  housekeeping: {
    pendingTasks:          number;
    checkoutCleansPending: number;
  };
  maintenance: {
    openTickets:   number;
    urgentTickets: number;
  };
  openFoliosWithBalance:  number;
  anomalies:              string[];
}

function pkr(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

function buildAnomalies(data: BriefingData): string[] {
  const anomalies: string[] = [];

  if (data.revenue.outstandingBalance > 0) {
    anomalies.push(
      `${pkr(data.revenue.outstandingBalance)} outstanding across ${data.openFoliosWithBalance} open folio${data.openFoliosWithBalance !== 1 ? "s" : ""}`,
    );
  }

  if (data.housekeeping.checkoutCleansPending > 2) {
    anomalies.push(`${data.housekeeping.checkoutCleansPending} checkout cleans still pending`);
  }

  if (data.shiftDiscrepancies > 0) {
    anomalies.push(
      `${data.shiftDiscrepancies} shift${data.shiftDiscrepancies !== 1 ? "s" : ""} closed with a cash discrepancy`,
    );
  }

  if (data.maintenance.urgentTickets > 0) {
    anomalies.push(`${data.maintenance.urgentTickets} urgent maintenance ticket${data.maintenance.urgentTickets !== 1 ? "s" : ""} open`);
  }

  if (data.occupancy.occupancyRate === 0 && new Date().getHours() >= 18) {
    anomalies.push("0% occupancy — no guests checked in today");
  }

  return anomalies;
}


// ── Shared value builders ───────────────────────────────────────────────────
// Both the logged text and the WhatsApp parameters read from these, so the two
// can never drift apart and claim different numbers for the same night.

// Occupancy carries one decimal to match Reports, but "75.0%" reads badly in a
// message, so a whole number prints without the redundant ".0".
function pct(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function occupancyLine(d: BriefingData): string {
  return `${d.occupancy.occupiedRooms}/${d.occupancy.totalRooms} (${pct(d.occupancy.occupancyRate)}%)`;
}

function posLine(d: BriefingData): string {
  if (d.posSales.orderCount === 0) return "No orders";
  return `${pkr(d.posSales.totalRevenue)} (${d.posSales.orderCount} order${d.posSales.orderCount !== 1 ? "s" : ""})`;
}

function outstandingLine(d: BriefingData): string {
  if (d.revenue.outstandingBalance <= 0) return "Nothing outstanding";
  return `${pkr(d.revenue.outstandingBalance)} across ${d.openFoliosWithBalance} folio${d.openFoliosWithBalance !== 1 ? "s" : ""}`;
}

function cashLine(d: BriefingData): string {
  return d.cashInHand === null ? "Not set up in Balance Book" : pkr(d.cashInHand);
}

function movementLine(d: BriefingData): string {
  return `${d.activity.checkInsToday} in · ${d.activity.checkOutsToday} out · ${d.activity.newBookingsToday} new booking${d.activity.newBookingsToday !== 1 ? "s" : ""}`;
}

function housekeepingLine(d: BriefingData): string {
  if (d.housekeeping.pendingTasks === 0) return "All clear";
  return d.housekeeping.checkoutCleansPending > 0
    ? `${d.housekeeping.pendingTasks} pending (${d.housekeeping.checkoutCleansPending} checkout cleans)`
    : `${d.housekeeping.pendingTasks} pending`;
}

function maintenanceLine(d: BriefingData): string {
  if (d.maintenance.openTickets === 0) return "All clear";
  return d.maintenance.urgentTickets > 0
    ? `${d.maintenance.openTickets} open (${d.maintenance.urgentTickets} urgent)`
    : `${d.maintenance.openTickets} open`;
}

export function formatBriefingMessage(data: BriefingData): string {
  const allAnomalies = [...data.anomalies, ...buildAnomalies(data)];

  const lines: string[] = [
    `🌙 *${data.hotelName}* — Nightly Briefing`,
    `📅 ${data.date}`,
    "",
    "━━━━━━━━━━",
    "🛏 *OCCUPANCY*",
    `Rooms: ${occupancyLine(data)}`,
    `ADR: ${pkr(data.performance.adr)}  |  RevPAR: ${pkr(data.performance.revpar)}`,
    "",
    "━━━━━━━━━━",
    "💰 *TODAY'S MONEY*",
    `Collected: ${pkr(data.revenue.totalCollected)}`,
    `Restaurant: ${posLine(data)}`,
    `Expenses: ${pkr(data.expensesToday)}`,
    `Cash in hand: ${cashLine(data)}`,
    `Outstanding: ${outstandingLine(data)}`,
    "",
    "━━━━━━━━━━",
    "🚪 *MOVEMENT*",
    `Today: ${movementLine(data)}`,
    `Arrivals tomorrow: ${data.tomorrowArrivals}`,
    "",
    "━━━━━━━━━━",
    `🧹 Housekeeping: ${housekeepingLine(data)}`,
    `🔧 Maintenance: ${maintenanceLine(data)}`,
    "",
    "⚠️ *NEEDS ATTENTION*",
    allAnomalies.length > 0 ? allAnomalies.map((a) => `• ${a}`).join("\n") : "Nothing — all clear.",
    "",
    "Tap below for the full report.",
  ];

  return lines.join("\n");
}

/**
 * Meta rejects a body parameter containing a newline, a tab, or four or more
 * consecutive spaces, and rejects empty parameters outright. Every value handed
 * to the Cloud API goes through here so a stray character in a hotel name can
 * never fail an entire night's sends.
 */
function param(value: string): string {
  const cleaned = value.replace(/[\r\n\t]+/g, " ").replace(/ {3,}/g, "  ").trim();
  return cleaned.length > 0 ? cleaned : "—";
}

/**
 * The ordered body parameters for the `nightly_briefing` WhatsApp template.
 *
 * The layout — line breaks, labels, emoji — lives in the approved template in
 * WhatsApp Manager, not here; only the values travel. Changing the ORDER or the
 * COUNT of these means resubmitting the template for approval, so keep them in
 * lockstep with the template body documented in WHATSAPP_BRIEFING.md.
 */
export function buildBriefingTemplateParams(data: BriefingData): string[] {
  const allAnomalies = [...data.anomalies, ...buildAnomalies(data)];

  return [
    param(data.hotelName),                                                                      // {{1}}
    param(data.date),                                                                           // {{2}}
    param(occupancyLine(data)),                                                                 // {{3}}
    param(pkr(data.performance.adr)),                                                           // {{4}}
    param(pkr(data.performance.revpar)),                                                        // {{5}}
    param(pkr(data.revenue.totalCollected)),                                                    // {{6}}
    param(posLine(data)),                                                                       // {{7}}
    param(pkr(data.expensesToday)),                                                             // {{8}}
    param(cashLine(data)),                                                                      // {{9}}
    param(outstandingLine(data)),                                                               // {{10}}
    param(movementLine(data)),                                                                  // {{11}}
    param(String(data.tomorrowArrivals)),                                                       // {{12}}
    param(housekeepingLine(data)),                                                              // {{13}}
    param(maintenanceLine(data)),                                                               // {{14}}
    param(allAnomalies.length > 0 ? allAnomalies.join(" · ") : "Nothing — all clear."),          // {{15}}
  ];
}
