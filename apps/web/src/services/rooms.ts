import { api } from "../lib/api";

export interface RoomType {
  id: string;
  hotelId: string;
  name: string;
  typeName: string;
  description: string | null;
  maxOccupancy: number;
  defaultRate: number;
  sortOrder: number;
  photoUrls: string[];
  amenities: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: string;
  hotelId: string;
  roomTypeId: string;
  number: string;
  floor: number | null;
  status: RoomStatus;
  notes: string | null;
  isActive: boolean;
  roomType: RoomType;
  currentReservation: {
    id: string;
    confirmationNumber: string;
    checkOutDate: string;
    guest: { id: string; fullName: string };
  } | null;
  inventoryBlocks: RoomInventoryBlock[];
  createdAt: string;
  updatedAt: string;
}

export type RoomStatus =
  | "VACANT_CLEAN"
  | "VACANT_DIRTY"
  | "OCCUPIED"
  | "OUT_OF_ORDER"
  | "UNDER_MAINTENANCE"
  | "BLOCKED";

export type RoomTypeName =
  | "SINGLE"
  | "DOUBLE"
  | "TWIN"
  | "TRIPLE"
  | "FAMILY"
  | "SUITE"
  | "DORMITORY"
  | "COTTAGE"
  | "TENT_GLAMPING";

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CreateRoomDto {
  number: string;
  floor?: number;
  roomTypeId: string;
  notes?: string;
}

export interface UpdateRoomDto extends Partial<CreateRoomDto> {}

export interface CreateRoomTypeDto {
  name: string;
  typeName: RoomTypeName;
  description?: string;
  maxOccupancy: number;
  defaultRate: number;
  sortOrder?: number;
  photoUrls?: string[];
  amenities?: string[];
}

export interface UpdateRoomTypeDto extends Partial<CreateRoomTypeDto> {}

export interface RoomConflict {
  roomId: string;
  roomNumber: string;
  conflictType: "RESERVATION" | "INVENTORY_BLOCK";
  inventoryBlockType: RoomInventoryBlockType | null;
  reason: string | null;
  guestName: string | null;
  confirmationNumber: string | null;
  checkInDate: string;
  checkOutDate: string;
}

export type RoomInventoryBlockType = "OUT_OF_ORDER" | "OUT_OF_SERVICE";

export interface RoomInventoryBlock {
  id: string;
  hotelId: string;
  roomId: string;
  maintenanceTicketId: string | null;
  type: RoomInventoryBlockType;
  startDate: string;
  endDate: string;
  reason: string;
  notes: string | null;
  createdBy: string;
  cancelledAt: string | null;
  cancelledBy: string | null;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AvailabilityResult {
  availableRoomIds: string[];
  totalRooms: number;
  conflicts: RoomConflict[];
}

export const roomsService = {
  getRooms: async (status?: RoomStatus, page = 1, limit = 100): Promise<{ data: Room[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/rooms", { params: { ...(status ? { status } : {}), page, limit } });
    return res.data;
  },

  getAllRooms: async (): Promise<{ data: Room[]; meta: PaginationMeta }> => {
    const first = await roomsService.getRooms(undefined, 1, 100);
    if (first.meta.totalPages <= 1) return first;
    const remaining = await Promise.all(
      Array.from({ length: first.meta.totalPages - 1 }, (_, index) => roomsService.getRooms(undefined, index + 2, 100)),
    );
    return { data: [first, ...remaining].flatMap((response) => response.data), meta: first.meta };
  },

  bulkUpdateReadiness: async (roomIds: string[], status: "VACANT_CLEAN" | "VACANT_DIRTY") => {
    const res = await api.patch("/api/rooms/bulk/readiness", { roomIds, status });
    return res.data.data as { updated: number; roomIds: string[]; status: RoomStatus };
  },

  getRoomById: async (id: string): Promise<Room> => {
    const res = await api.get(`/api/rooms/${id}`);
    return res.data.data;
  },

  createRoom: async (dto: CreateRoomDto): Promise<Room> => {
    const res = await api.post("/api/rooms", dto);
    return res.data.data;
  },

  updateRoom: async (id: string, dto: UpdateRoomDto): Promise<Room> => {
    const res = await api.patch(`/api/rooms/${id}`, dto);
    return res.data.data;
  },

  deleteRoom: async (id: string): Promise<void> => {
    await api.delete(`/api/rooms/${id}`);
  },

  getRoomTypes: async (): Promise<{ data: RoomType[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/room-types");
    return res.data;
  },

  createRoomType: async (dto: CreateRoomTypeDto): Promise<RoomType> => {
    const res = await api.post("/api/room-types", dto);
    return res.data.data;
  },

  updateRoomType: async (id: string, dto: UpdateRoomTypeDto): Promise<RoomType> => {
    const res = await api.patch(`/api/room-types/${id}`, dto);
    return res.data.data;
  },

  checkAvailability: async (params: {
    checkInDate: string;
    checkOutDate: string;
    roomId?: string;
    roomTypeId?: string;
    excludeReservationId?: string;
  }): Promise<AvailabilityResult> => {
    const res = await api.get("/api/rooms/availability", { params });
    return res.data.data;
  },

  getInventoryBlocks: async (roomId: string): Promise<RoomInventoryBlock[]> => {
    const res = await api.get(`/api/rooms/${roomId}/inventory-blocks`);
    return res.data.data;
  },

  createInventoryBlock: async (roomId: string, dto: {
    type: RoomInventoryBlockType;
    startDate: string;
    endDate: string;
    reason: string;
    notes?: string;
  }): Promise<RoomInventoryBlock> => {
    const res = await api.post(`/api/rooms/${roomId}/inventory-blocks`, dto);
    return res.data.data;
  },

  cancelInventoryBlock: async (roomId: string, blockId: string, reason: string): Promise<RoomInventoryBlock> => {
    const res = await api.post(`/api/rooms/${roomId}/inventory-blocks/${blockId}/cancel`, { reason });
    return res.data.data;
  },
};
