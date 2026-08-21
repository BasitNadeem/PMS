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

/**
 * A file uploaded with restricted delivery. Deliberately carries no URL: the
 * caller stores the key and asks for the bytes later, so nothing that can read
 * the database row also gets a link that works in a browser.
 */
export interface PrivateUploadResult {
  storageKey: string;
  provider:   "cloudinary" | "s3";
  byteSize:   number;
}

export interface StorageProvider {
  upload(base64Data: string, mimeType: string, folder: string): Promise<UploadResult>;

  /**
   * Upload something that must never be publicly reachable — identity
   * documents, for example. The stored object is not served by an
   * unauthenticated URL; use fetchPrivate to read it back.
   */
  uploadPrivate(base64Data: string, mimeType: string, folder: string): Promise<PrivateUploadResult>;

  /** Read a restricted object back as bytes, for streaming through our own auth. */
  fetchPrivate(storageKey: string): Promise<Buffer>;

  /** Permanently remove a stored object. Used by the retention sweep. */
  destroy(storageKey: string): Promise<void>;
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

  async uploadPrivate(base64Data: string, mimeType: string, folder: string): Promise<PrivateUploadResult> {
    const dataUri = `data:${mimeType};base64,${base64Data}`;
    const result = await cloudinary.uploader.upload(dataUri, {
      folder:        `pms/${folder}`,
      resource_type: "image",
      // "authenticated" is the whole point: the delivery URL must carry a valid
      // signature, so the plain secure_url that public uploads rely on simply
      // does not resolve for anyone who happens to obtain it.
      type:          "authenticated",
      // No fetch_format/quality juggling here. These are evidentiary images and
      // are read back whole; re-encoding them on delivery only invites a
      // mismatch between what was captured and what a reviewer later sees.
    });
    return {
      storageKey: result.public_id,
      provider:   "cloudinary",
      byteSize:   result.bytes,
    };
  }

  async fetchPrivate(storageKey: string): Promise<Buffer> {
    // Signed on our side, fetched on our side. The signature never reaches a
    // browser, so viewing is gated by our own auth and can be audited per read.
    const signedUrl = cloudinary.url(storageKey, {
      type:          "authenticated",
      resource_type: "image",
      sign_url:      true,
      secure:        true,
    });

    const response = await fetch(signedUrl);
    if (!response.ok) {
      throw new AppError(502, `Stored image could not be retrieved (${response.status}).`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  async destroy(storageKey: string): Promise<void> {
    await cloudinary.uploader.destroy(storageKey, {
      type:          "authenticated",
      resource_type: "image",
      invalidate:    true,
    });
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
