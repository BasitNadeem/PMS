import { api } from "../lib/api";
import type { ReservationStatus } from "./reservations";

export interface DashboardOccupancy {
  totalRooms:    number;
  occupiedRooms: number;
  availableRooms: number;
  occupancyRate: number;
}

export interface DashboardToday {
  arrivalsToday:      number;
  departuresToday:    number;
  newBookingsToday:   number;
  arrivalsYesterday:  number;
  departuresYesterday: number;
}

export interface DashboardReservations {
  confirmedCount:     number;
  checkedInCount:     number;
  pendingCount:       number;
  checkedInYesterday: number;
}

export interface DashboardRevenueTrendPoint {
  date:   string;
  amount: number;
}

export interface DashboardRevenue {
  revenueToday:       number;
  paymentsToday:      number;
  outstandingBalance: number;
  revenueYesterday:   number;
}

export interface DashboardHousekeeping {
  pendingTasks:          number;
  inProgressTasks:       number;
  checkoutCleansPending: number;
}

export interface DashboardMaintenance {
  open:    number;
  urgent:  number;
  overdue: number;
}

export interface DashboardRecentReservation {
  id:                 string;
  confirmationNumber: string;
  status:             ReservationStatus;
  checkInDate:        string;
  checkOutDate:       string;
  guestName:          string;
  guestId:            string;
  roomNumber:         string | null;
  groupId:            string | null;
  isVip:              boolean;
}

export interface DashboardInventory {
  lowStockCount:   number;
  outOfStockCount: number;
}

export interface DashboardCollectItem {
  id:         string;
  guestName:  string;
  roomNumber: string | null;
  balanceDue: number;
}

export interface DashboardDeparturesToCollect {
  total: number;
  items: DashboardCollectItem[];
}

export type DashboardScheduleEventType = "checkin" | "checkout" | "housekeeping";

export interface DashboardScheduleEvent {
  id:          string;
  time:        string; // "HH:MM", 24-hour
  type:        DashboardScheduleEventType;
  label:       string;
  sublabel:    string;
  isDone:      boolean;   // actual timestamp exists — event already occurred
  isVip?:      boolean;
  taskType?:   string;    // CHECKOUT_CLEAN | TURNDOWN | DEEP_CLEAN | INSPECTION | …
  hasIssue?:   boolean;
  balanceDue?: number;    // paise; > 0 means outstanding balance on departure
}

export type DashboardOperationalReminder =
  | {
      id: string;
      kind: "SHIFT_HANDOVER";
      status: "DUE_SOON" | "OVERDUE";
      shiftDate: string;
      shiftType: "MORNING" | "EVENING" | "NIGHT";
      endsAt: string;
      minutesFromEnd: number;
      url: string;
    }
  | {
      id: string;
      kind: "NIGHT_AUDIT";
      status: "DUE_SOON" | "OVERDUE";
      businessDate: string;
      openedAt: string;
      url: string;
    };

export interface DashboardData {
  occupancy:           DashboardOccupancy;
  today:               DashboardToday;
  reservations:        DashboardReservations;
  revenue:             DashboardRevenue;
  housekeeping:        DashboardHousekeeping;
  maintenance:         DashboardMaintenance;
  inventory:           DashboardInventory;
  recentReservations:  DashboardRecentReservation[];
  upcomingReservations: DashboardRecentReservation[];
  departuresToCollect: DashboardDeparturesToCollect;
  schedule:            DashboardScheduleEvent[];
  operationalReminders: DashboardOperationalReminder[];
}

export type RevenueTrendRange = "14d" | "30d" | "6m";

export const dashboardService = {
  getDashboard: async (): Promise<DashboardData> => {
    const res = await api.get("/api/dashboard");
    return res.data.data;
  },
  getRevenueTrend: async (range: RevenueTrendRange): Promise<DashboardRevenueTrendPoint[]> => {
    const res = await api.get("/api/dashboard/revenue-trend", { params: { range } });
    return res.data.data;
  },
};
