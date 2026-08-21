/**
 * Guest identity documents — capture, read back, and removal.
 *
 * Images are held by the storage provider under a key; this service is the only
 * thing that turns a key back into bytes. Nothing here ever returns a URL, so a
 * document cannot leak by way of an API response that happens to include a row.
 *
 * Every query filters on hotelId explicitly, which is belt-and-braces: withTenant
 * only sets the `app.current_hotel_id` session variable, so elsewhere in this
 * codebase RLS is the single thing standing between tenants. That is a fine
 * trade for a folio line. It is not a fine trade for a photograph of someone's
 * national ID, where forgetting `pnpm apply:rls` after a migration would be the
 * difference between isolated and readable across hotels.
 */

import type { TenantTx } from "@pms/db";
import { DocumentSide, type DocumentType } from "@pms/db";
import { getStorageProvider } from "../lib/storage";
import { AppError } from "../utils/AppError";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export interface CaptureInput {
  hotelId:       string;
  reservationId: string;
  guestId:       string;
  capturedBy:    string;
  type:          DocumentType;
  front:         { base64: string; mimeType: string };
  back:          { base64: string; mimeType: string };
}

export const GuestDocumentService = {
  /**
   * Store both sides and record the stay as ID-verified.
   *
   * Uploads happen before the transaction opens. Holding a database
   * transaction across two network round-trips to an image host would pin a
   * connection for seconds at check-in time, which is exactly when the desk is
   * busiest.
   */
  async capture(withTenant: WithTenantFn, input: CaptureInput) {
    const storage = getStorageProvider();
    const folder  = `hotels/${input.hotelId}/guest-documents`;

    const [front, back] = await Promise.all([
      storage.uploadPrivate(input.front.base64, input.front.mimeType, folder),
      storage.uploadPrivate(input.back.base64,  input.back.mimeType,  folder),
    ]);

    try {
      return await withTenant(async (db) => {
        // Supersede any earlier capture for this stay so the reservation shows
        // one current pair rather than a pile of retries.
        await db.guestDocument.updateMany({
          where: { reservationId: input.reservationId, deletedAt: null },
          data:  { deletedAt: new Date() },
        });

        await db.guestDocument.createMany({
          data: [
            {
              hotelId:       input.hotelId,
              guestId:       input.guestId,
              reservationId: input.reservationId,
              type:          input.type,
              side:          DocumentSide.FRONT,
              storageKey:    front.storageKey,
              provider:      front.provider,
              mimeType:      input.front.mimeType,
              byteSize:      front.byteSize,
              capturedBy:    input.capturedBy,
            },
            {
              hotelId:       input.hotelId,
              guestId:       input.guestId,
              reservationId: input.reservationId,
              type:          input.type,
              side:          DocumentSide.BACK,
              storageKey:    back.storageKey,
              provider:      back.provider,
              mimeType:      input.back.mimeType,
              byteSize:      back.byteSize,
              capturedBy:    input.capturedBy,
            },
          ],
        });

        const reservation = await db.reservation.update({
          where: { id: input.reservationId },
          data:  { idVerifiedAt: new Date(), idVerifiedBy: input.capturedBy },
          select: { id: true, idVerifiedAt: true },
        });

        return { reservationId: reservation.id, verifiedAt: reservation.idVerifiedAt };
      });
    } catch (err) {
      // The rows are what make an image findable. If they failed to write, the
      // uploads are unreferenced and would otherwise sit in storage forever.
      await Promise.all([
        storage.destroy(front.storageKey).catch(() => {}),
        storage.destroy(back.storageKey).catch(() => {}),
      ]);
      throw err;
    }
  },

  /** Metadata only — never a key, and never a URL. */
  async listForReservation(withTenant: WithTenantFn, hotelId: string, reservationId: string) {
    return withTenant((db) =>
      db.guestDocument.findMany({
        where:   { hotelId, reservationId, deletedAt: null },
        orderBy: { side: "asc" },
        select:  {
          id: true, type: true, side: true, mimeType: true,
          byteSize: true, capturedAt: true, capturedBy: true,
        },
      }),
    );
  },

  /**
   * Every document held for a guest, newest first, across all their stays.
   * This is the guest-profile view: an ID captured at one visit is the same
   * document the next visit, so it should not have to be recaptured.
   */
  async listForGuest(withTenant: WithTenantFn, hotelId: string, guestId: string) {
    return withTenant((db) =>
      db.guestDocument.findMany({
        where:   { hotelId, guestId, deletedAt: null },
        orderBy: [{ capturedAt: "desc" }, { side: "asc" }],
        select:  {
          id: true, type: true, side: true, mimeType: true, byteSize: true,
          capturedAt: true, capturedBy: true, reservationId: true,
        },
      }),
    );
  },

  /**
   * Read one document's bytes for streaming through an authenticated route.
   *
   * Scoped by guest as well as id. RLS already makes cross-tenant reads
   * impossible, but without this a URL like /guests/A/documents/B/image would
   * happily serve a document belonging to guest C in the same hotel — the path
   * would be describing a scope it never checked.
   */
  async readImage(withTenant: WithTenantFn, hotelId: string, guestId: string, documentId: string) {
    const doc = await withTenant((db) =>
      db.guestDocument.findFirst({
        where:  { id: documentId, hotelId, guestId, deletedAt: null },
        select: { storageKey: true, mimeType: true },
      }),
    );
    if (!doc) throw new AppError(404, "Document not found");

    const bytes = await getStorageProvider().fetchPrivate(doc.storageKey);
    return { bytes, mimeType: doc.mimeType };
  },

  /**
   * Soft-delete the row and destroy the stored image. The row survives so a
   * retention sweep leaves evidence of what was removed and when; the image
   * itself does not, which is the entire point of deleting it.
   */
  async remove(withTenant: WithTenantFn, hotelId: string, documentId: string) {
    const doc = await withTenant((db) =>
      db.guestDocument.findFirst({
        where:  { id: documentId, hotelId, deletedAt: null },
        select: { id: true, storageKey: true },
      }),
    );
    if (!doc) throw new AppError(404, "Document not found");

    await getStorageProvider().destroy(doc.storageKey);
    await withTenant((db) =>
      db.guestDocument.update({ where: { id: doc.id }, data: { deletedAt: new Date() } }),
    );
  },
};
