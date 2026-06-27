import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BASE_URL } from "@/lib/api";

// Opens an SSE connection scoped to the current hotel and invalidates the
// dashboard-relevant queries the instant any staff member or guest action
// changes data — the existing refetchInterval polling stays in place as a
// fallback for when the connection drops (e.g. laptop sleep, network blip).
export function useRealtimeDashboard(): void {
  const qc = useQueryClient();
  const retryDelay = useRef(2000);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    function connect() {
      if (stopped) return;
      source = new EventSource(`${BASE_URL}/api/realtime/events?token=${encodeURIComponent(token!)}`);

      source.addEventListener("change", () => {
        retryDelay.current = 2000;
        qc.invalidateQueries({ queryKey: ["dashboard"] });
        qc.invalidateQueries({ queryKey: ["front-desk-notes"] });
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
