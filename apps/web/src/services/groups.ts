import { api } from "../lib/api";
import type { PaginationMeta } from "./rooms";
import type { ReservationStatus } from "./reservations";
import type { DocumentType } from "./guests";

export type PayerType = "TOUR_AGENCY" | "CORPORATE" | "GOVERNMENT" | "NGO" | "INDIVIDUAL";
export type BillingType = "SINGLE" | "SPLIT";
export type PaymentTerms = "ADVANCE_50" | "ADVANCE_100" | "ADVANCE_CUSTOM" | "CREDIT_30" | "CREDIT_60" | "CASH";
export type GroupStatus = "ENQUIRY" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED";

export interface Group {
  id: string;
  name: string;
  groupRef: string | null;
  payerType: PayerType;
  payerName: string | null;
  payerContact: string | null;
  billingType: BillingType;
  status: GroupStatus;
  checkInDate: string;
  checkOutDate: string;
  totalRooms: number;
  memberCount: number;
  createdAt: string;
}

export interface GroupSummary {
  ENQUIRY: number;
  CONFIRMED: number;
  CHECKED_IN: number;
  CHECKED_OUT: number;
  CANCELLED: number;
  total: number;
}

export interface GroupReservationGuest {
  id: string;
  fullName: string;
  phone: string | null;
}

export interface GroupReservationRoom {
  pending: boolean;
  number: string;
  floor: number | null;
  roomType: { id: string; name: string; typeName: string };
}

export interface GroupReservationFolio {
  id: string;
  chargesTotal: number;
  paymentsTotal: number;
  balanceDue: number;
  isOpen: boolean;
}

export interface GroupReservation {
  id: string;
  confirmationNumber: string;
  status: ReservationStatus;
  checkInDate: string;
  checkOutDate: string;
  subtotalAmount: number;
  taxAmount: number;
  taxInclusive: boolean;
  taxBreakdown: Array<{ key: "GST" | "PST"; label: string; rate: number; amount: number }> | null;
  totalAmount: number;
  guest: GroupReservationGuest;
  room: GroupReservationRoom | null;
  folio: GroupReservationFolio | null;
}

export interface GroupMember {
  id: string;
  isLeader: boolean;
  roomPreference: string | null;
  guest: GroupReservationGuest;
}

export interface GroupDetail {
  id: string;
  name: string;
  groupRef: string | null;
  payerType: PayerType;
  payerName: string | null;
  payerContact: string | null;
  billingType: BillingType;
  paymentTerms: PaymentTerms;
  advancePaid: number;
  negotiatedRate: number;
  status: GroupStatus;
  checkInDate: string;
  checkOutDate: string;
  internalNotes: string;
  createdAt: string;
  reservations: GroupReservation[];
  members: GroupMember[];
  summary: {
    totalRooms: number;
    totalCharged: number;
    totalPaid: number;
    totalBalance: number;
  };
}

export interface CreateGroupRoomDto {
  roomTypeId: string;
  quantity: number;
  ratePerNight?: number;
}

export interface CreateGroupLeaderDto {
  existingGuestId?: string;
  newGuest?: {
    firstName: string;
    lastName: string;
    phone: string;
    documentType: DocumentType;
    documentNumber: string;
    allowDuplicate?: boolean;
  };
}

export interface CreateGroupDto {
  name: string;
  groupRef?: string;
  payerType: PayerType;
  payerName: string;
  payerContact?: string;
  billingType: BillingType;
  paymentTerms: PaymentTerms;
  advancePaid: number;
  negotiatedRate: number;
  checkInDate: string;
  checkOutDate: string;
  totalRooms: number;
  notes?: string;
  rooms: CreateGroupRoomDto[];
  leaderGuest: CreateGroupLeaderDto;
}

export interface UpdateGroupDto {
  name?: string;
  payerType?: PayerType;
  payerName?: string;
  payerContact?: string;
  billingType?: BillingType;
  paymentTerms?: PaymentTerms;
  advancePaid?: number;
  negotiatedRate?: number;
  checkInDate?: string;
  checkOutDate?: string;
  totalRooms?: number;
  notes?: string;
}

export interface ListGroupsParams {
  status?: GroupStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AddGroupMemberDto {
  guestId: string;
  isLeader: boolean;
  roomPreference?: string;
}

export const groupsService = {
  getGroups: async (params: ListGroupsParams): Promise<{ data: Group[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/groups", { params });
    return res.data;
  },

  getSummary: async (): Promise<GroupSummary> => {
    const res = await api.get("/api/groups/summary");
    return res.data.data;
  },

  getGroup: async (id: string): Promise<GroupDetail> => {
    const res = await api.get(`/api/groups/${id}`);
    return res.data.data;
  },

  createGroup: async (dto: CreateGroupDto): Promise<GroupDetail> => {
    const res = await api.post("/api/groups", dto);
    return res.data.data;
  },

  updateGroup: async (id: string, dto: UpdateGroupDto): Promise<GroupDetail> => {
    const res = await api.patch(`/api/groups/${id}`, dto);
    return res.data.data;
  },

  updateGroupStatus: async (id: string, status: GroupStatus): Promise<GroupDetail> => {
    const res = await api.patch(`/api/groups/${id}/status`, { status });
    return res.data.data;
  },

  checkInGroup: async (id: string): Promise<GroupDetail> => {
    const res = await api.post(`/api/groups/${id}/checkin`);
    return res.data.data;
  },

  checkOutGroup: async (id: string): Promise<GroupDetail> => {
    const res = await api.post(`/api/groups/${id}/checkout`);
    return res.data.data;
  },

  addMember: async (id: string, dto: AddGroupMemberDto): Promise<GroupDetail> => {
    const res = await api.post(`/api/groups/${id}/members`, dto);
    return res.data.data;
  },

  assignRoom: async (groupId: string, reservationId: string, roomId: string): Promise<GroupDetail> => {
    const res = await api.patch(`/api/groups/${groupId}/reservations/${reservationId}/room`, { roomId });
    return res.data.data;
  },
};
