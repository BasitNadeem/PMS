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
}

export interface SignOffDto {
  actualCashCount: number;
  notes?: string;
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
};
