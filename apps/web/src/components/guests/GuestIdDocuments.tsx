/**
 * Guest ID documents — thumbnails with a one-click full view.
 *
 * Images are fetched as blobs rather than given to <img src>, because the
 * endpoint requires a Bearer token the browser would never attach to an image
 * request. Every object URL created here is revoked on unmount, so a copy of
 * someone's CNIC does not outlive the screen that showed it.
 */

import { useEffect, useRef, useState } from "react";
import { IdCard, Loader2, X, ZoomIn } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { guestDocumentsService, type GuestDocumentMeta } from "@/services/guestDocuments";
import { cn } from "@/lib/cn";

interface GuestIdDocumentsProps {
  guestId: string;
  /** Limit to one stay's capture. Omit for every document held for the guest. */
  reservationId?: string;
  className?: string;
}

const SIDE_LABEL: Record<string, string> = { FRONT: "Front", BACK: "Back" };

function DocumentThumb({
  guestId,
  doc,
  onOpen,
}: {
  guestId: string;
  doc: GuestDocumentMeta;
  onOpen: (url: string, doc: GuestDocumentMeta) => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    guestDocumentsService
      .fetchImageObjectUrl(guestId, doc.id)
      .then((objectUrl) => {
        if (cancelled) { URL.revokeObjectURL(objectUrl); return; }
        urlRef.current = objectUrl;
        setUrl(objectUrl);
      })
      .catch(() => { /* a broken thumbnail is not worth an error banner */ });

    return () => {
      cancelled = true;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [guestId, doc.id]);

  return (
    <button
      type="button"
      onClick={() => url && onOpen(url, doc)}
      disabled={!url}
      className="group relative aspect-[1.586/1] overflow-hidden rounded-lg border border-line bg-mist transition-all hover:border-coral/50 disabled:cursor-wait"
    >
      {url ? (
        <>
          <img src={url} alt={`${doc.type} ${SIDE_LABEL[doc.side] ?? doc.side}`} className="h-full w-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-ink/0 transition-colors group-hover:bg-ink/35">
            <ZoomIn size={20} className="text-white opacity-0 transition-opacity group-hover:opacity-100" />
          </span>
        </>
      ) : (
        <span className="grid h-full w-full place-items-center">
          <Loader2 size={16} className="animate-spin text-ink-faint" />
        </span>
      )}
      <span className="absolute bottom-0 left-0 rounded-tr-md bg-ink/75 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
        {SIDE_LABEL[doc.side] ?? doc.side}
      </span>
    </button>
  );
}

export function GuestIdDocuments({ guestId, reservationId, className }: GuestIdDocumentsProps) {
  const [viewing, setViewing] = useState<{ url: string; doc: GuestDocumentMeta } | null>(null);

  const { data: docs = [], isLoading } = useQuery({
    queryKey: reservationId ? ["reservation-documents", reservationId] : ["guest-documents", guestId],
    queryFn:  () => reservationId
      ? guestDocumentsService.list(reservationId)
      : guestDocumentsService.listForGuest(guestId),
    enabled: Boolean(guestId),
  });

  if (isLoading) {
    return <div className={cn("flex items-center gap-2 text-[12px] text-ink-mute", className)}><Loader2 size={13} className="animate-spin" /> Loading ID…</div>;
  }

  if (docs.length === 0) {
    return (
      <div className={cn("flex items-center gap-2 rounded-lg border border-dashed border-line px-3 py-2.5 text-[12px] text-ink-mute", className)}>
        <IdCard size={14} className="text-ink-faint" />
        No ID captured yet
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-2 gap-2">
        {docs.map((doc) => (
          <DocumentThumb key={doc.id} guestId={guestId} doc={doc} onOpen={(url, d) => setViewing({ url, doc: d })} />
        ))}
      </div>

      {viewing && (
        <div
          className="fixed inset-0 z-[60] grid place-items-center bg-ink/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          onClick={() => setViewing(null)}
        >
          <div className="relative max-h-full w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-bold text-white">
                {viewing.doc.type} · {SIDE_LABEL[viewing.doc.side] ?? viewing.doc.side}
                <span className="ml-2 font-medium text-white/60">
                  captured {new Date(viewing.doc.capturedAt).toLocaleDateString()}
                </span>
              </p>
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="rounded-lg p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <img src={viewing.url} alt="" className="max-h-[80vh] w-full rounded-xl object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
