import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationsService, type AppNotification } from "@/services/notifications";
import type { OperationalAlertType } from "@/hooks/useOperationalAlerts";

const ALERT_TYPES = new Set<OperationalAlertType>([
  "BOOKING_REQUEST",
  "QR_ORDER",
  "MAINTENANCE_URGENT",
  "SHIFT_CASH_DISCREPANCY",
]);

function shouldAlert(notification: AppNotification): boolean {
  return ALERT_TYPES.has(notification.type as OperationalAlertType);
}

// The durable notification table is the source of truth. SSE invalidates this
// query immediately; polling covers sleeping tabs and temporary disconnects.
// Existing unread records establish the session baseline, so opening the app
// never plays a backlog of old alerts.
export function useOperationalNotificationAlerts(
  onNotification: (notification: AppNotification) => void,
  onResolved: (notificationId: string) => void,
): void {
  const seenIds = useRef<Set<string> | null>(null);
  const displayedIds = useRef(new Set<string>());
  const onNotificationRef = useRef(onNotification);
  const onResolvedRef = useRef(onResolved);
  onNotificationRef.current = onNotification;
  onResolvedRef.current = onResolved;

  const { data: notifications } = useQuery({
    queryKey:             ["notifications"],
    queryFn:              notificationsService.getNotifications,
    staleTime:            0,
    refetchInterval:      5_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!notifications) return;

    const unreadIds = new Set(notifications.map((notification) => notification.id));
    displayedIds.current.forEach((id) => {
      if (!unreadIds.has(id)) {
        displayedIds.current.delete(id);
        onResolvedRef.current(id);
      }
    });

    if (seenIds.current === null) {
      seenIds.current = unreadIds;
      return;
    }

    const seen = seenIds.current;
    const unseenAlerts = notifications
      .filter((notification) => shouldAlert(notification) && !seen.has(notification.id))
      .reverse();

    notifications.forEach((notification) => seen.add(notification.id));
    unseenAlerts.forEach((notification) => {
      displayedIds.current.add(notification.id);
      onNotificationRef.current(notification);
    });
  }, [notifications]);
}
