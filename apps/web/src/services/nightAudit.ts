import { api } from "@/lib/api";
import type { PaginationMeta } from "@/services/rooms";

export interface NoShowCandidate {
  reservationId: string;
  confirmationNumber: string;
  guestName: string;
  roomNumber: string;
  checkInDate: string;
}

export interface OverdueDeparture {
  reservationId: string;
  confirmationNumber: string;
  guestName: string;
  roomNumber: string;
  checkOutDate: string;
  daysOverdue: number;
}

export interface RoomChargeMismatch {
  reservationId: string;
  confirmationNumber: string;
  expected: number;
  actual: number;
  difference: number;
}

export interface PreflightCheck {
  noShowCandidates: NoShowCandidate[];
  overdueDepartures: OverdueDeparture[];
  roomChargeMismatches: RoomChargeMismatch[];
  openBalances: { count: number; total: number };
  unsignedShiftReports: Array<{ id: string; shiftType: string }>;
  unresolvedDiscrepancies: number;
  unpostedPosOrders: number;
  alreadyAudited: boolean;
}

export interface NightAuditRecord {
  id: string;
  businessDate: string;
  runAt: string;
  runBy: string;
  runByName: string;
  occupancyRate: number;
  roomRevenue: number;
  posRevenue: number;
  totalCollected: number;
  totalOutstanding: number;
  noShowsFlagged: number;
  openBalanceCount: number;
  revision: number;
  reversedAt: string | null;
  reversedBy: string | null;
  reversedByName: string | null;
  reversalReason: string | null;
}

export interface NightAuditRecordDetail extends NightAuditRecord {
  hotelId: string;
  snapshot: BusinessDaySnapshot | LegacyNightAuditSnapshot;
}

export interface MoneyBreakdown {
  received: number;
  refunded: number;
  net: number;
  transactions: number;
}

export interface AuditControlException {
  code: string;
  title: string;
  detail: string;
  route?: string;
}

export interface BusinessDaySnapshot {
  version: 2 | 3;
  date: string;
  generatedAt: string;
  boundaries: {
    stayDate: string;
    activityStartsAt: string;
    activityEndsAt: string;
    timezone: string;
  };
  occupancy: {
    totalRooms: number;
    physicalRooms: number;
    outOfServiceRooms: number;
    sellableRooms: number;
    occupied: number;
    roomsSold: number;
    availableRooms: number;
    checkIns: number;
    checkOuts: number;
    occupancyRate: number;
    adr: number;
    revpar: number;
  };
  reservations: {
    arrivals: number;
    departures: number;
    stayovers: number;
    actualCheckIns: number;
    actualCheckOuts: number;
    cancellations: number;
    noShows: number;
    confirmedArrivals: number;
  };
  revenue: {
    roomRevenue: number;
    posRevenue: number;
    qrRevenue: number;
    taxes: number;
    discounts: number;
    rebates: number;
    adjustments: number;
    totalFolioRevenue: number;
    guestResponsibility: number;
    companyResponsibility: number;
    totalCollected: number;
    outstanding: number;
    expenses: number;
  };
  payments: {
    received: number;
    refunded: number;
    netCollected: number;
    directCollections: number;
    postedDirectCollections?: number;
    reconcilableNetCollected?: number;
    balanceBookIncoming: number;
    balanceBookCollectionNet?: number;
    balanceBookDifference?: number;
    byMethod: Record<string, MoneyBreakdown>;
  };
  companyCredit: {
    transferred: number;
    payments: number;
    adjustments: number;
    writeOffs: number;
    guestOutstanding: number;
    companyOutstandingOnFolios: number;
  };
  foodAndBeverage: {
    pos: {
      orders: number; subtotal: number; tax: number; discount: number; total: number;
      outlets?: Array<{ name: string; orders: number; revenue: number }>;
      channels?: Array<{ name: string; revenue: number }>;
      categories?: Array<{ id: string; name: string; quantity: number; revenue: number }>;
      items?: Array<{ name: string; quantity: number; revenue: number }>;
    };
    qr: {
      orders: number;
      total: number;
      groups: Array<{ status: string; paymentPreference: string; orders: number; total: number }>;
      items?: Array<{ name: string; quantity: number; revenue: number }>;
    };
  };
  inventory?: {
    transactions: number;
    consumption: Array<{ itemId: string; name: string; unit: string; consumed: number; wasted: number; cost: number }>;
    lowStock: Array<{ id: string; name: string; unit: string; currentStock: number; reorderLevel: number; parLevel: number; urgency: string }>;
  };
  operationalCoverage?: {
    roomStatus: Record<string, number>;
    dirtyRooms: number;
    outOfServiceRooms: Array<{ id: string; type: string; reason: string; room: { id: string; number: string } }>;
    housekeeping: Array<{ id: string; taskType: string; status: string; priority: number; isEscalated: boolean; room: { id: string; number: string } }>;
    maintenance: Array<{ id: string; ticketNumber: string; title: string; status: string; priority: string; room: { id: string; number: string } | null }>;
    unsignedShiftReports: Array<{ id: string; shiftType: string }>;
  };
  balanceBook: {
    incoming: number;
    outgoing: number;
    net: number;
    entries: number;
    expenses: number;
    expenseEntries: number;
    expenseLedgerOutgoing?: number;
    expenseDifference?: number;
    byMethod: Array<{
      direction: string;
      paymentMethod: string | null;
      sourceType: string;
      amount: number;
      entries: number;
    }>;
  };
  reconciliation: {
    openFolios: number;
    openBalance: number;
    guestOutstanding: number;
    companyOutstanding: number;
    unpostedPosOrders: number;
    unresolvedExceptions?: number;
  };
  operations?: { posOrders: number; noShowsFlagged: number; openBalances: { count: number; total: number } };
  auditPreflight?: PreflightCheck;
  auditResolution?: {
    skippedNoShowIds: string[];
    exceptionReason: string | null;
    exceptionCount: number;
  };
  controls?: { blockers: AuditControlException[]; warnings: AuditControlException[] };
}

export interface LegacyNightAuditSnapshot {
  version?: undefined;
  date?: string;
  occupancy?: Record<string, number>;
  revenue?: Record<string, number>;
  operations?: Record<string, unknown>;
  auditPreflight?: PreflightCheck;
  auditResolution?: { exceptionReason?: string | null; exceptionCount?: number };
}

export function isBusinessDaySnapshot(snapshot: BusinessDaySnapshot | LegacyNightAuditSnapshot): snapshot is BusinessDaySnapshot {
  return snapshot.version === 2 || snapshot.version === 3;
}

export interface NightAuditBusinessDateContext {
  businessDate: string;
  closesAt: string;
  canClose: boolean;
}

export const nightAuditService = {
  getBusinessDate: async (): Promise<NightAuditBusinessDateContext> => {
    const res = await api.get("/api/night-audit/business-date");
    return res.data.data;
  },

  getPreflightCheck: async (date: string): Promise<PreflightCheck> => {
    const res = await api.get("/api/night-audit/preflight", { params: { date } });
    return res.data.data;
  },

  getSnapshot: async (date: string): Promise<BusinessDaySnapshot> => {
    const res = await api.get("/api/night-audit/snapshot", { params: { date } });
    return res.data.data;
  },

  convertToNoShow: async (reservationId: string): Promise<void> => {
    await api.post(`/api/night-audit/no-show/${reservationId}`);
  },

  runNightAudit: async (
    businessDate: string,
    skippedNoShowIds: string[],
    exceptionReason?: string,
  ): Promise<{ id: string; businessDate: string; nextBusinessDate: string }> => {
    const res = await api.post("/api/night-audit/run", {
      businessDate,
      skippedNoShowIds,
      exceptionReason,
    });
    return res.data.data;
  },

  listHistory: async (page = 1, limit = 20): Promise<{ data: NightAuditRecord[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/night-audit/history", { params: { page, limit } });
    return res.data;
  },

  getDetail: async (id: string): Promise<NightAuditRecordDetail> => {
    const res = await api.get(`/api/night-audit/${id}`);
    return res.data.data;
  },

  reverseAudit: async (id: string, reason: string): Promise<{ id: string; businessDate: string; revision: number; reversedAt: string }> => {
    const res = await api.post(`/api/night-audit/${id}/reverse`, { reason });
    return res.data.data;
  },
};
