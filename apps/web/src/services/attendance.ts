import { api } from "@/lib/api";

export type AttendanceStatus = "PRESENT" | "ABSENT" | "LEAVE" | "HALF_DAY";

export interface AttendanceRecord {
  id: string;
  hotelId: string;
  userId: string;
  attendanceDate: string;
  firstLoginAt: string | null;
  lastLoginAt: string | null;
  loginCount: number;
  source: "APP_LOGIN" | "MANUAL";
  status: AttendanceStatus;
  role: string;
  notes: string | null;
  user: { id: string; name: string; email: string } | null;
}

export interface AttendanceQuery {
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface MarkAttendanceDto {
  userId: string;
  attendanceDate: string;
  status: AttendanceStatus;
  notes?: string;
}

export const attendanceService = {
  getRecords: async (params: AttendanceQuery = {}): Promise<{ data: AttendanceRecord[]; meta: { total: number; totalPages: number } }> => {
    const response = await api.get("/api/attendance", { params });
    return response.data;
  },
  markAttendance: async (dto: MarkAttendanceDto): Promise<AttendanceRecord> => {
    const response = await api.post("/api/attendance", dto);
    return response.data.data;
  },
};
