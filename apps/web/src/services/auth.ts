import { api } from "@/lib/api";

export interface ChangePasswordResult {
  success: boolean;
  message: string;
}

export const authService = {
  completeOnboarding: async (): Promise<void> => {
    await api.post("/api/auth/complete-onboarding");
  },
  changePassword: async (currentPassword: string, newPassword: string): Promise<ChangePasswordResult> => {
    const res = await api.post<ChangePasswordResult>("/api/auth/change-password", {
      currentPassword,
      newPassword,
    });
    return res.data;
  },
};
