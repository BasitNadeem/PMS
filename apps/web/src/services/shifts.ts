import { api } from "../lib/api";

export type ShiftType = "MORNING" | "EVENING" | "NIGHT";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ShiftPrefill {
  checkIns: number;
  checkOuts: number;
  newBookings: number;
  posOrders: number;
  cashCollected: number;
  suggestedOpeningBalance: number;
}

// Snapshot items inside the frozen handoverBriefing JSON
export interface BriefingHKItem {
  id: string;
  taskType: string;
  status: string;
  startedAt: string | null;
  roomNumber: string | null;
  flagged?: boolean;
}
export interface BriefingMaintenanceItem {
  id: string;
  title: string;
  priority: string;
  status: string;
  createdAt: string;
  roomNumber: string | null;
  flagged?: boolean;
}
export interface BriefingArrival {
  id: string;
  confirmationNumber: string;
  checkInDate: string;
  guestName: string;
  roomTypeName: string | null;
}
export interface BriefingDeparture {
  id: string;
  checkOutDate: string;
  guestName: string;
  roomNumber: string | null;
}
export interface BriefingNote {
  id: string;
  text: string;
  createdAt: string;
  createdByName: string;
  flagged?: boolean;
}
export interface HandoverBriefing {
  pendingHousekeeping: BriefingHKItem[];
  openMaintenance: BriefingMaintenanceItem[];
  tomorrowArrivals: BriefingArrival[];
  tomorrowDepartures: BriefingDeparture[];
  unresolvedNotes: BriefingNote[];
}

export interface ShiftReport {
  id: string;
  hotelId: string;
  staffId: string;
  shiftDate: string;
  shiftType: ShiftType;
  openingBalance: number;
  cashCollected: number;
  cashExpenses: number;
  closingBalance: number;
  expectedBalance: number;
  variance: number;
  checkIns: number;
  checkOuts: number;
  newBookings: number;
  posOrders: number;
  notes: string | null;
  handoverBriefing: HandoverBriefing | null;
  varianceReason: string | null;
  discrepancyAlerted: boolean;
  signedOffAt: string | null;
  signedOffBy: string | null;
  actualCashCount: number | null;
  createdAt: string;
  updatedAt: string;
  staffName: string;
  signedOffByName: string | null;
}

export interface CreateShiftReportDto {
  shiftDate: string;
  shiftType: ShiftType;
  openingBalance: number;
  cashCollected: number;
  cashExpenses: number;
  checkIns: number;
  checkOuts: number;
  newBookings: number;
  posOrders: number;
  notes?: string;
  handoverBriefing?: HandoverBriefing;
}

export interface SignOffDto {
  actualCashCount: number;
  notes?: string;
  varianceReason?: string;
}

export interface ListShiftsParams {
  startDate?: string;
  endDate?: string;
  shiftType?: ShiftType;
  page?: number;
  limit?: number;
}

export const shiftsService = {
  getPrefill: async (date: string, shiftType: ShiftType): Promise<ShiftPrefill> => {
    const res = await api.get("/api/shifts/prefill", { params: { date, shiftType } });
    return res.data.data;
  },

  getBriefing: async (date: string, shiftType: ShiftType): Promise<HandoverBriefing> => {
    const res = await api.get("/api/shifts/handover-briefing", { params: { date, shiftType } });
    return res.data.data;
  },

  getDiscrepancyCount: async (): Promise<number> => {
    const res = await api.get("/api/shifts/discrepancy-count");
    return res.data.data.count as number;
  },

  list: async (params: ListShiftsParams): Promise<{ data: ShiftReport[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/shifts", { params });
    return res.data;
  },

  get: async (id: string): Promise<ShiftReport> => {
    const res = await api.get(`/api/shifts/${id}`);
    return res.data.data;
  },

  create: async (dto: CreateShiftReportDto): Promise<ShiftReport> => {
    const res = await api.post("/api/shifts", dto);
    return res.data.data;
  },

  signOff: async (id: string, dto: SignOffDto): Promise<ShiftReport> => {
    const res = await api.patch(`/api/shifts/${id}/signoff`, dto);
    return res.data.data;
  },

  acknowledge: async (id: string): Promise<void> => {
    await api.patch(`/api/shifts/${id}/acknowledge`);
  },
};
