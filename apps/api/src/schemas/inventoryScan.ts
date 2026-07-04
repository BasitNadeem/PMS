import { z } from "zod";

export const scanInventorySchema = z.object({
  imageBase64: z.string().min(100, "Image data is required"),
  mimeType:    z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
});

export type ScanInventoryDto = z.infer<typeof scanInventorySchema>;
