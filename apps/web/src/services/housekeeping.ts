import { api } from "../lib/api";
import type { PaginationMeta } from "./rooms";

export type HousekeepingPriority = "URGENT" | "HIGH" | "NORMAL" | "LOW";
export type HousekeepingTaskType =
  | "CHECKOUT_CLEAN"
  | "ROUTINE_CLEAN"
  | "TURNDOWN"
  | "MAINTENANCE_CLEAN"
  | "INSPECTION";
export type HousekeepingStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED";

export interface HousekeepingTask {
  id: string;
  hotelId: string;
  roomId: string;
  assignedToId: string | null;
  taskType: HousekeepingTaskType;
  status: HousekeepingStatus;
  priority: HousekeepingPriority;
  scheduledDate: string;
  startedAt: string | null;
  completedAt: string | null;
  hasIssue: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  room: { number: string; floor: number | null; roomType?: { name: string } };
  assignedTo: { id: string; name: string } | null;
}

export interface HousekeepingSummary {
  pending: number;
  inProgress: number;
  completedToday: number;
}

export interface CreateTaskDto {
  roomId: string;
  taskType: HousekeepingTaskType;
  priority?: HousekeepingPriority;
  assignedToId?: string;
  scheduledDate?: string;
  notes?: string;
}

export interface UpdateTaskStatusDto {
  status: HousekeepingStatus;
}

export interface UpdateTaskDto {
  assignedToId?: string | null;
  priority?: HousekeepingPriority;
  notes?: string | null;
  scheduledDate?: string;
}

export const housekeepingService = {
  getTasks: async (params?: {
    status?: HousekeepingStatus;
    assignedToId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: HousekeepingTask[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/housekeeping", { params });
    return res.data;
  },

  getTask: async (id: string): Promise<HousekeepingTask> => {
    const res = await api.get(`/api/housekeeping/${id}`);
    return res.data.data;
  },

  createTask: async (dto: CreateTaskDto): Promise<HousekeepingTask> => {
    const res = await api.post("/api/housekeeping", dto);
    return res.data.data;
  },

  updateTaskStatus: async (id: string, dto: UpdateTaskStatusDto): Promise<HousekeepingTask> => {
    const res = await api.patch(`/api/housekeeping/${id}/status`, dto);
    return res.data.data;
  },

  updateTask: async (id: string, dto: UpdateTaskDto): Promise<HousekeepingTask> => {
    const res = await api.patch(`/api/housekeeping/${id}`, dto);
    return res.data.data;
  },

  getSummary: async (): Promise<HousekeepingSummary> => {
    const res = await api.get("/api/housekeeping/summary");
    return res.data.data;
  },
};
