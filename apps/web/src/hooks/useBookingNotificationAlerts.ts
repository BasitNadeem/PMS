import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { notificationsService, type AppNotification } from "@/services/notifications";

function shouldAlert(notification: AppNotification): boolean {
  return notification.type === "BOOKING_REQUEST";
}

// The notification table is the durable source of truth for booking alerts.
// SSE invalidates this active query immediately; polling covers a sleeping tab,
// a reconnect race, or a browser/proxy that temporarily drops the SSE stream.
export function useBookingNotificationAlerts(
  onBookingNotification: (notification: AppNotification) => void,
): void {
  const seenIds = useRef<Set<string> | null>(null);
  const onBookingNotificationRef = useRef(onBookingNotification);
  onBookingNotificationRef.current = onBookingNotification;

  const { data: notifications } = useQuery({
    queryKey:             ["notifications"],
    queryFn:              notificationsService.getNotifications,
    staleTime:            0,
    refetchInterval:      5_000,
    refetchOnWindowFocus: true,
  });

  useEffect(() => {
    if (!notifications) return;

    // Existing unread notifications form the baseline when this browser
    // session starts. Only records arriving afterward should make a sound.
    if (seenIds.current === null) {
      seenIds.current = new Set(notifications.map((notification) => notification.id));
      return;
    }

    const seen = seenIds.current;
    const unseenBookings = notifications
      .filter((notification) => shouldAlert(notification) && !seen.has(notification.id))
      .reverse();

    notifications.forEach((notification) => seen.add(notification.id));
    unseenBookings.forEach((notification) => onBookingNotificationRef.current(notification));
  }, [notifications]);
}
