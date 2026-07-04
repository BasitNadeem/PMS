// Image storage abstraction.
// V1: Cloudinary. Future: swap CloudinaryProvider for S3Provider below.

import { v2 as cloudinary } from "cloudinary";
import { env } from "./env";
import { AppError } from "../utils/AppError";

export interface UploadResult {
  url: string;
  publicId: string;
  provider: "cloudinary" | "s3";
}

export interface StorageProvider {
  upload(base64Data: string, mimeType: string, folder: string): Promise<UploadResult>;
}

// ── Cloudinary ────────────────────────────────────────────────────────────────

class CloudinaryProvider implements StorageProvider {
  constructor() {
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key:    env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
  }

  async upload(base64Data: string, mimeType: string, folder: string): Promise<UploadResult> {
    const dataUri = `data:${mimeType};base64,${base64Data}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder:        `pms/${folder}`,
      resource_type: "image",
      quality:       "auto:good",
      fetch_format:  "auto",
    });
    return { url: result.secure_url, publicId: result.public_id, provider: "cloudinary" };
  }
}

// ── S3 (future) ───────────────────────────────────────────────────────────────
// class S3Provider implements StorageProvider {
//   async upload(base64Data: string, mimeType: string, folder: string): Promise<UploadResult> {
//     // Install @aws-sdk/client-s3 and implement here.
//     // Use env.AWS_BUCKET, env.AWS_REGION, env.AWS_ACCESS_KEY_ID, env.AWS_SECRET_ACCESS_KEY.
//     throw new Error("S3 provider not yet implemented");
//   }
// }

// ── Factory ───────────────────────────────────────────────────────────────────

function createStorageProvider(): StorageProvider {
  if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
    throw new AppError(
      503,
      "Image storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in your .env file.",
    );
  }
  return new CloudinaryProvider();
}

let _storageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!_storageProvider) _storageProvider = createStorageProvider();
  return _storageProvider;
}
