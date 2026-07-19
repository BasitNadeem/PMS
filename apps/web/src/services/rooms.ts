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
  status: RoomStatus;
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
  guestName: string;
  confirmationNumber: string;
  checkInDate: string;
  checkOutDate: string;
}

export interface AvailabilityResult {
  availableRoomIds: string[];
  totalRooms: number;
  conflicts: RoomConflict[];
}

export const roomsService = {
  getRooms: async (status?: RoomStatus): Promise<{ data: Room[]; meta: PaginationMeta }> => {
    const res = await api.get("/api/rooms", { params: status ? { status } : undefined });
    return res.data;
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
};
