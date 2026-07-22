import { CalendarPlus, X } from "lucide-react";
import type { BookingAlert } from "../../hooks/useBookingAlerts";

interface BookingAlertStackProps {
  alerts: BookingAlert[];
  onDismiss: (id: number) => void;
}

export function BookingAlertStack({ alerts, onDismiss }: BookingAlertStackProps) {
  if (alerts.length === 0) return null;

  return (
    <div className="fixed top-5 left-5 z-[100] flex flex-col gap-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium min-w-[280px] max-w-sm bg-coral text-white animate-fade-in"
        >
          <CalendarPlus size={16} className="flex-shrink-0" />
          <span className="flex-1">{alert.message}</span>
          <button
            onClick={() => onDismiss(alert.id)}
            className="flex-shrink-0 opacity-80 hover:opacity-100 transition-opacity"
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
