import { api } from "@/lib/api";

export interface LeaveRecord {
  id: string;
  hotelId: string;
  userId: string;
  leaveDate: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  user: { id: string; name: string; email: string } | null;
}

export interface LeavePaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateLeaveDto {
  userId: string;
  startDate: string;
  endDate: string;
  notes?: string;
}

export const leaveService = {
  getRecords: async (params: { startDate?: string; endDate?: string; page?: number; limit?: number }): Promise<{ data: LeaveRecord[]; meta: LeavePaginationMeta }> => {
    const response = await api.get("/api/leaves", { params });
    return response.data;
  },
  create: async (dto: CreateLeaveDto): Promise<LeaveRecord[]> => {
    const response = await api.post("/api/leaves", dto);
    return response.data.data;
  },
  remove: async (id: string): Promise<void> => {
    await api.delete(`/api/leaves/${id}`);
  },
};
