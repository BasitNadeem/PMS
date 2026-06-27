import { api } from "../lib/api";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AuditUser {
  id: string;
  name: string;
  email: string;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  entity: string;
  entityId: string;
  user: AuditUser | null;
  before: unknown;
  after: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export interface AuditLogParams {
  entity?: string;
  userId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogResponse {
  data: AuditLogEntry[];
  meta: PaginationMeta;
  users: AuditUser[];
}

export const auditService = {
  getAuditLogs: async (params: AuditLogParams): Promise<AuditLogResponse> => {
    const res = await api.get("/api/audit", { params });
    return res.data;
  },
};
