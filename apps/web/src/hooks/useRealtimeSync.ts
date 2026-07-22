import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/lib/api";

interface RealtimeChangeEvent {
  ts:   number;
  type: string | null;
}

// Opens an SSE connection scoped to the current hotel and invalidates the
// live-data queries the instant any staff member or guest action changes
// data — each page's own refetchInterval polling (if any) stays in place as
// a fallback for when the connection drops (e.g. laptop sleep, network blip).
//
// `onBookingCreated` fires only for events the server tagged
// type: "reservation_created" (currently just the public Booking Engine
// routes — see bookingPublic.ts) — not on every change event, and not on
// the periodic poll fallback, since those never carry an SSE type at all.
// Most change events (folio updates, housekeeping, POS, etc.) have no type
// and only trigger the silent invalidations below.
export function useRealtimeSync(onBookingCreated?: () => void): void {
  const qc = useQueryClient();
  const retryDelay = useRef(2000);
  const onBookingCreatedRef = useRef(onBookingCreated);
  onBookingCreatedRef.current = onBookingCreated;

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    function connect() {
      if (stopped) return;
      source = new EventSource(`${BASE_URL}/api/realtime/events?token=${encodeURIComponent(token!)}`);

      source.addEventListener("change", (e) => {
        retryDelay.current = 2000;
        // Blanket invalidation rather than a hand-maintained key list: this
        // hook is now mounted on most data pages in the app, and a growing
        // per-page key list here would need editing every time a new page
        // adopts it. invalidateQueries() with no filter only forces an
        // immediate refetch for queries an actively-mounted component is
        // observing — everything else is just marked stale and refetches
        // next time it's read, so this stays cheap even as coverage grows.
        qc.invalidateQueries();

        try {
          const data = JSON.parse((e as MessageEvent).data) as RealtimeChangeEvent;
          if (data.type === "reservation_created") onBookingCreatedRef.current?.();
        } catch { /* malformed payload — invalidations above already ran, safe to ignore */ }
      });

      source.onerror = () => {
        source?.close();
        if (stopped) return;
        retryTimer = setTimeout(connect, retryDelay.current);
        retryDelay.current = Math.min(retryDelay.current * 2, 30_000);
      };
    }

    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [qc]);
}
