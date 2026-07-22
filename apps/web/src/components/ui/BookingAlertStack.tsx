import { CalendarPlus, X } from "lucide-react";
import type { BookingAlert } from "@/hooks/useBookingAlerts";

interface BookingAlertStackProps {
  alerts: BookingAlert[];
  onDismiss: (id: number) => void;
}

export function BookingAlertStack({ alerts, onDismiss }: BookingAlertStackProps) {
  if (alerts.length === 0) return null;

  return (
    <div
      className="fixed left-auto right-4 top-4 z-[100] flex w-[calc(100vw-2rem)] max-w-[410px] flex-col gap-3 sm:right-5 sm:top-5"
      role="region"
      aria-label="New booking alerts"
      aria-live="assertive"
    >
      {alerts.map((alert) => (
        <div
          key={alert.id}
          role="alert"
          className="anim-booking-alert relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-ink via-ink to-[#111827] text-white shadow-[0_18px_50px_rgba(15,23,42,0.28),0_4px_14px_rgba(15,23,42,0.18)]"
        >
          <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber via-[#f5b942] to-coral" />
          <div className="flex gap-3.5 px-4 py-4 pl-5">
            <div className="relative mt-0.5 grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl border border-amber/25 bg-amber/15 text-[#f5c563] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
              <CalendarPlus size={19} strokeWidth={2.2} />
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ink bg-pine" />
            </div>

            <div className="min-w-0 flex-1 pr-7">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#f5c563]">
                  Live booking
                </span>
              </div>
              <p className="text-[15px] font-semibold leading-5 text-white">
                {alert.title}
              </p>
              <p className="mt-1 text-[13px] font-normal leading-[1.45] text-white/70">
                {alert.message}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(alert.id)}
              aria-label={`Dismiss ${alert.title} alert`}
              className="absolute right-3 top-3 grid h-8 w-8 place-items-center rounded-full border border-transparent text-white/55 transition-all hover:border-white/10 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber/70"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
