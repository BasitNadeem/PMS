import { z } from "zod";
import { DocumentType } from "@pms/db";

/**
 * Payload posted by the phone during an ID capture session.
 *
 * The route this feeds is unauthenticated — the QR token is the only
 * credential — so the size ceiling here is a real defence, not just tidiness.
 * The client compresses to ~1280px JPEG before sending; 4 MB of base64 is
 * roughly 3 MB of image, far above a legitimate capture and far below anything
 * that would strain the request body limit.
 */
const MAX_BASE64 = 4 * 1024 * 1024;

const sideSchema = z.object({
  imageBase64: z.string().min(100, "Image data is required").max(MAX_BASE64, "Image is too large"),
  mimeType:    z.enum(["image/jpeg", "image/png", "image/webp"]).default("image/jpeg"),
});

export const captureGuestDocumentSchema = z.object({
  documentType: z.nativeEnum(DocumentType).default("CNIC"),
  front:        sideSchema,
  back:         sideSchema,
});

export type CaptureGuestDocumentDto = z.infer<typeof captureGuestDocumentSchema>;

/** Reason a manager gave for checking in a guest without ID on file. */
export const idOverrideSchema = z.object({
  reason: z.string().trim().min(10, "Give a specific reason (at least 10 characters)").max(500),
});

export type IdOverrideDto = z.infer<typeof idOverrideSchema>;
