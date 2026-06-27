import { api } from "../lib/api";

export interface StaffUser {
  id: string;
  hotelId: string;
  userId: string;
  role: string;
  roleId: string;
  isActive: boolean;
  invitedAt: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    createdAt: string;
  };
  assignedRole: {
    id: string;
    name: string;
    displayName: string;
  };
}

export interface Role {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  color: string;
  sortOrder: number;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
  phone?: string;
  roleId: string;
}

export interface UpdateUserDto {
  name?: string;
  roleId?: string;
  isActive?: boolean;
}

export const usersService = {
  getUsers: async (): Promise<StaffUser[]> => {
    const res = await api.get("/api/users");
    return res.data.data;
  },

  getRoles: async (): Promise<Role[]> => {
    const res = await api.get("/api/users/roles");
    return res.data.data;
  },

  createUser: async (dto: CreateUserDto): Promise<StaffUser> => {
    const res = await api.post("/api/users", dto);
    return res.data.data;
  },

  updateUser: async (id: string, dto: UpdateUserDto): Promise<StaffUser> => {
    const res = await api.patch(`/api/users/${id}`, dto);
    return res.data.data;
  },

  resetPassword: async (id: string, newPassword: string): Promise<void> => {
    await api.patch(`/api/users/${id}/password`, { newPassword });
  },
};
