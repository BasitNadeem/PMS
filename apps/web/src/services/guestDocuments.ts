import { api } from "../lib/api";

export type DocumentSide = "FRONT" | "BACK";

export interface GuestDocumentMeta {
  id:             string;
  type:           string;
  side:           DocumentSide;
  mimeType:       string;
  byteSize:       number;
  capturedAt:     string;
  capturedBy:     string | null;
  reservationId?: string | null;
}

export const guestDocumentsService = {
  async createCaptureSession(reservationId: string): Promise<{ token: string }> {
    const { data } = await api.post<{ data: { token: string } }>(
      `/api/reservations/${reservationId}/id-capture/session`,
    );
    return data.data;
  },

  /** Documents captured for one specific stay. */
  async list(reservationId: string): Promise<GuestDocumentMeta[]> {
    const { data } = await api.get<{ data: GuestDocumentMeta[] }>(
      `/api/reservations/${reservationId}/documents`,
    );
    return data.data;
  },

  /** Everything held for the guest, across every stay. */
  async listForGuest(guestId: string): Promise<GuestDocumentMeta[]> {
    const { data } = await api.get<{ data: GuestDocumentMeta[] }>(
      `/api/guests/${guestId}/documents`,
    );
    return data.data;
  },

  /**
   * Fetch the image itself and hand back an object URL.
   *
   * Deliberately not a plain URL for <img src>: the endpoint requires a Bearer
   * token, which the browser will not attach to an image request, so a direct
   * src would simply 401. Going through axios picks up the auth interceptor,
   * and the resulting blob URL is scoped to this document — it dies with the
   * tab and cannot be pasted to anyone.
   *
   * Callers must URL.revokeObjectURL() when the image is no longer displayed.
   */
  async fetchImageObjectUrl(guestId: string, documentId: string): Promise<string> {
    const { data } = await api.get<Blob>(
      `/api/guests/${guestId}/documents/${documentId}/image`,
      { responseType: "blob" },
    );
    return URL.createObjectURL(data);
  },
};
