export interface BriefingData {
  hotelName: string;
  date:      string;
  occupancy: {
    occupiedRooms: number;
    totalRooms:    number;
    occupancyRate: number;
  };
  revenue: {
    totalCollected:      number; // paisas
    totalCharged:        number; // paisas
    outstandingBalance:  number; // paisas
  };
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

  if (data.maintenance.urgentTickets > 0) {
    anomalies.push(`${data.maintenance.urgentTickets} urgent maintenance ticket${data.maintenance.urgentTickets !== 1 ? "s" : ""} open`);
  }

  if (data.occupancy.occupancyRate === 0 && new Date().getHours() >= 18) {
    anomalies.push("0% occupancy — no guests checked in today");
  }

  return anomalies;
}

export function formatBriefingMessage(data: BriefingData): string {
  const allAnomalies = [...data.anomalies, ...buildAnomalies(data)];
  const available    = data.occupancy.totalRooms - data.occupancy.occupiedRooms;

  const lines: string[] = [
    `*${data.hotelName} — Nightly Briefing*`,
    `📅 ${data.date} | 11:00 PM`,
    "",
    "━━━━━━━━━",
    "*OCCUPANCY*",
    `🛏 Occupied: ${data.occupancy.occupiedRooms}/${data.occupancy.totalRooms} rooms (${data.occupancy.occupancyRate}%)`,
    `✅ Available: ${available} rooms`,
    "",
    "━━━━━━━━━",
    "*TODAY'S REVENUE*",
    `💰 Collected: ${pkr(data.revenue.totalCollected)}`,
    `📋 Charged: ${pkr(data.revenue.totalCharged)}`,
    ...(data.revenue.outstandingBalance > 0
      ? [`⚠️ Outstanding: ${pkr(data.revenue.outstandingBalance)}`]
      : []),
    "",
    "━━━━━━━━━",
    "*TODAY'S ACTIVITY*",
    `📥 Check-ins: ${data.activity.checkInsToday}`,
    `📤 Check-outs: ${data.activity.checkOutsToday}`,
    `📝 New bookings: ${data.activity.newBookingsToday}`,
    "",
    "━━━━━━━━━",
    "*TOMORROW*",
    `🔔 Expected arrivals: ${data.tomorrowArrivals}`,
    "",
    "━━━━━━━━━",
    "*HOUSEKEEPING*",
    `🧹 Pending tasks: ${data.housekeeping.pendingTasks}`,
    ...(data.housekeeping.checkoutCleansPending > 0
      ? [`🚪 Checkout cleans pending: ${data.housekeeping.checkoutCleansPending}`]
      : []),
    "",
    "━━━━━━━━━",
    "*MAINTENANCE*",
    `🔧 Open tickets: ${data.maintenance.openTickets}`,
    ...(data.maintenance.urgentTickets > 0
      ? [`🚨 Urgent: ${data.maintenance.urgentTickets}`]
      : []),
  ];

  if (allAnomalies.length > 0) {
    lines.push("", "━━━━━━━━━", "*⚠️ ALERTS*");
    for (const anomaly of allAnomalies) {
      lines.push(`• ${anomaly}`);
    }
  }

  lines.push(
    "",
    "━━━━━━━━━",
    "_Sent automatically by Hotel PMS_",
    "_To stop receiving these alerts, contact your system administrator_",
  );

  return lines.join("\n");
}
