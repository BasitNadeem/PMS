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

export const reportsService = {
  getDailyReport: async (date: string): Promise<DailyReport> => {
    const res = await api.get("/api/reports/daily", { params: { date } });
    return res.data.data;
  },

  getMonthlyReport: async (year: number, month: number): Promise<MonthlyReport> => {
    const res = await api.get("/api/reports/monthly", { params: { year, month } });
    return res.data.data;
  },
};
