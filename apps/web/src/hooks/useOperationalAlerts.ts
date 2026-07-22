import { useCallback, useState } from "react";
import type { AppNotification } from "@/services/notifications";

export type OperationalAlertType =
  | "BOOKING_REQUEST"
  | "QR_ORDER"
  | "MAINTENANCE_URGENT"
  | "SHIFT_CASH_DISCREPANCY";

export interface OperationalAlert {
  id: string;
  type: OperationalAlertType;
  title: string;
  message: string;
}

export function useOperationalAlerts() {
  const [alerts, setAlerts] = useState<OperationalAlert[]>([]);

  const addAlert = useCallback((notification: AppNotification) => {
    setAlerts((previous) => previous.some((alert) => alert.id === notification.id)
      ? previous
      : [...previous, {
          id:      notification.id,
          type:    notification.type as OperationalAlertType,
          title:   notification.title,
          message: notification.body,
        }]);
  }, []);

  const removeAlert = useCallback((id: string) => {
    setAlerts((previous) => previous.filter((alert) => alert.id !== id));
  }, []);

  return { alerts, addAlert, removeAlert };
}
