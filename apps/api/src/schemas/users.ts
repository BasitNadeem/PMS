import { z } from "zod";

export const createUserSchema = z.object({
  name:     z.string().trim().min(1, "Name is required"),
  email:    z.string().trim().email("Invalid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  phone:    z.string().trim().optional(),
  roleId:   z.string().uuid("Invalid role"),
});
export type CreateUserDto = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name:     z.string().trim().min(1).optional(),
  roleId:   z.string().uuid().optional(),
  isActive: z.boolean().optional(),
}).refine(
  (d) => d.name !== undefined || d.roleId !== undefined || d.isActive !== undefined,
  { message: "At least one field is required" },
);
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
