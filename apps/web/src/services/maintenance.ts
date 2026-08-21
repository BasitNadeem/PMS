import { api } from "../lib/api";
import type { PaginationMeta } from "./rooms";

export type MaintenancePriority = "URGENT" | "HIGH" | "MEDIUM" | "LOW";
export type MaintenanceStatus = "OPEN" | "IN_PROGRESS" | "AWAITING_PARTS" | "RESOLVED" | "CLOSED";
export type MaintenanceCategory =
  | "ELECTRICAL"
  | "PLUMBING"
  | "HVAC"
  | "FURNITURE"
  | "ELECTRONICS"
  | "STRUCTURAL"
  | "OTHER";

export interface MaintenanceTicket {
  id: string;
  hotelId: string;
  roomId: string | null;
  reportedById: string | null;
  assignedToId: string | null;
  ticketNumber: string;
  title: string;
  description: string | null;
  category: MaintenanceCategory;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  photoUrls: string[];
  resolutionNotes: string | null;
  estimatedCost: number | null;
  actualCost: number | null;
  scheduledFor: string | null;
  scheduledEndDate: string | null;
  resolvedAt: string | null;
  isOverdue: boolean;
  createdAt: string;
  updatedAt: string;
  room: { id: string; number: string; floor: number | null } | null;
  assignedTo: { id: string; name: string } | null;
  inventoryBlock: {
    id: string;
    startDate: string;
    endDate: string;
    cancelledAt: string | null;
  } | null;
}

export interface MaintenanceSummary {
  open: number;
  urgent: number;
  overdue: number;
}

export interface CreateTicketDto {
  roomId?: string;
  title: string;
  description?: string;
  category: MaintenanceCategory;
  priority?: MaintenancePriority;
  assignedToId?: string;
  scheduledFor?: string;
  scheduledEndDate?: string;
  roomUnavailable?: boolean;
  unavailableFrom?: string;
  sellableFrom?: string;
  photoUrls?: string[];
}

export interface UpdateTicketStatusDto {
  status: MaintenanceStatus;
  resolutionNotes?: string;
}

export interface UpdateTicketDto {
  assignedToId?: string | null;
  priority?: MaintenancePriority;
  category?: MaintenanceCategory;
  title?: string;
  description?: string | null;
  scheduledFor?: string | null;
  scheduledEndDate?: string | null;
  roomUnavailable?: boolean;
  unavailableFrom?: string;
  sellableFrom?: string;
  estimatedCost?: number | null;
  actualCost?: number | null;
}

export const maintenanceService = {
  getTickets: async (params?: {
    status?: MaintenanceStatus;
    priority?: MaintenancePriority;
    roomId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ data: MaintenanceTicket[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/maintenance", { params });
    return res.data;
  },

  getTicket: async (id: string): Promise<MaintenanceTicket> => {
    const res = await api.get(`/api/maintenance/${id}`);
    return res.data.data;
  },

  createTicket: async (dto: CreateTicketDto): Promise<MaintenanceTicket> => {
    const res = await api.post("/api/maintenance", dto);
    return res.data.data;
  },

  updateTicketStatus: async (id: string, dto: UpdateTicketStatusDto): Promise<MaintenanceTicket> => {
    const res = await api.patch(`/api/maintenance/${id}/status`, dto);
    return res.data.data;
  },

  updateTicket: async (id: string, dto: UpdateTicketDto): Promise<MaintenanceTicket> => {
    const res = await api.patch(`/api/maintenance/${id}`, dto);
    return res.data.data;
  },

  getSummary: async (): Promise<MaintenanceSummary> => {
    const res = await api.get("/api/maintenance/summary");
    return res.data.data;
  },
};
