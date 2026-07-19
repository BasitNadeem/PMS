import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange, type RangeKeyDict } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { cn } from "@/lib/cn";

export interface DateRangePickerProps {
  checkIn: string;  // "yyyy-mm-dd" or ""
  checkOut: string; // "yyyy-mm-dd" or ""
  onChange: (checkIn: string, checkOut: string) => void;
  min?: string;
  disabled?: boolean;
  className?: string;
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function fmt(s: string): string {
  return s
    ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(parseLocalDate(s))
    : "";
}

export function DateRangePicker({ checkIn, checkOut, onChange, min, disabled, className }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 640; // two-month react-date-range calendar
    const left = Math.min(rect.left, window.innerWidth - popoverWidth - 12);
    setCoords({ top: rect.bottom + 8, left: Math.max(12, left) });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (popoverRef.current?.contains(target)) return;
      setOpen(false);
    };
    const handleScrollOrResize = () => setOpen(false);
    // Capture phase: modals commonly call stopPropagation() on their content
    // wrapper's onMouseDown (to stop the modal itself closing on inside clicks),
    // which would otherwise block this from ever reaching document in the
    // bubble phase — capture fires before that stopPropagation can block it.
    document.addEventListener("mousedown", handleClick, true);
    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", handleClick, true);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  const minDate = min ? parseLocalDate(min) : undefined;

  return (
    <>
      <div
        ref={triggerRef}
        className={cn("grid grid-cols-2 rounded-xl border border-line bg-mist overflow-hidden", className)}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left outline-none transition-colors border-r border-line",
            "hover:bg-line-soft/40 focus:ring-2 focus:ring-coral/15 focus:z-10",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <span className={cn("truncate", checkIn ? "text-ink" : "text-ink-faint")}>{fmt(checkIn) || "Check-in"}</span>
          <CalendarIcon size={15} className="text-ink-faint shrink-0" />
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className={cn(
            "flex items-center justify-between gap-2 px-3.5 py-2.5 text-sm text-left outline-none transition-colors",
            "hover:bg-line-soft/40 focus:ring-2 focus:ring-coral/15 focus:z-10",
            disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          <span className={cn("truncate", checkOut ? "text-ink" : "text-ink-faint")}>{fmt(checkOut) || "Check-out"}</span>
          <CalendarIcon size={15} className="text-ink-faint shrink-0" />
        </button>
      </div>

      {open && !disabled && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          className="z-[100] rounded-xl border border-line bg-paper shadow-float overflow-hidden anim-scale-in"
        >
          <DateRange
            ranges={[{
              startDate: checkIn ? parseLocalDate(checkIn) : new Date(),
              endDate: checkOut ? parseLocalDate(checkOut) : (checkIn ? parseLocalDate(checkIn) : new Date()),
              key: "selection",
            }]}
            onChange={(ranges: RangeKeyDict) => {
              const { selection } = ranges;
              const nextCheckIn  = selection.startDate ? toLocalDateString(selection.startDate) : checkIn;
              const nextCheckOut = selection.endDate ? toLocalDateString(selection.endDate) : checkOut;
              onChange(nextCheckIn, nextCheckOut);
              if (nextCheckIn !== checkIn && nextCheckOut === nextCheckIn) return; // still picking the end date
              if (nextCheckOut !== checkOut) setOpen(false);
            }}
            months={2}
            direction="horizontal"
            showDateDisplay={false}
            moveRangeOnFirstSelection={false}
            minDate={minDate}
            rangeColors={["rgb(var(--color-accent))"]}
          />
        </div>,
        document.body,
      )}
    </>
  );
}
