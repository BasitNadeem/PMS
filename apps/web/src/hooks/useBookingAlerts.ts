import { useState, useCallback } from "react";

export interface BookingAlert {
  id: number;
  title: string;
  message: string;
}

// Unlike useToast, alerts here don't auto-dismiss — front desk must
// acknowledge a new booking explicitly rather than risk missing it
// if they glance away for a few seconds.
export function useBookingAlerts() {
  const [alerts, setAlerts] = useState<BookingAlert[]>([]);

  const addAlert = useCallback((title: string, message: string) => {
    setAlerts((prev) => [...prev, { id: Date.now(), title, message }]);
  }, []);

  const removeAlert = useCallback((id: number) => {
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { alerts, addAlert, removeAlert };
}
