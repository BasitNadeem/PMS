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
}

export interface NightAuditRecordDetail extends NightAuditRecord {
  hotelId: string;
  snapshot: unknown;
}

export const nightAuditService = {
  getBusinessDate: async (): Promise<string> => {
    const res = await api.get("/api/night-audit/business-date");
    return res.data.data.businessDate;
  },

  getPreflightCheck: async (date: string): Promise<PreflightCheck> => {
    const res = await api.get("/api/night-audit/preflight", { params: { date } });
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
};
