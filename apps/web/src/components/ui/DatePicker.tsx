import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "react-date-range";
import "react-date-range/dist/styles.css";
import "react-date-range/dist/theme/default.css";
import { cn } from "@/lib/cn";

export interface DatePickerProps {
  value: string; // "yyyy-mm-dd" or ""
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Renders as a square icon-only button — for use next to a date label shown elsewhere. */
  iconOnly?: boolean;
}

function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseLocalDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function DatePicker({ value, onChange, min, max, placeholder = "Select date", className, disabled, iconOnly }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const popoverWidth = 320; // approx react-date-range Calendar width
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

  const displayValue = value
    ? new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", year: "numeric" }).format(parseLocalDate(value))
    : "";

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-label={iconOnly ? (displayValue || placeholder) : undefined}
        className={cn(
          iconOnly
            ? "h-9 w-9 shrink-0 flex items-center justify-center rounded-xl border border-line bg-mist outline-none transition-colors"
            : "w-full flex items-center justify-between gap-2 rounded-xl border border-line bg-mist px-3.5 py-2.5 text-sm text-left outline-none transition-colors whitespace-nowrap",
          "hover:border-coral/30 focus:border-coral focus:ring-2 focus:ring-coral/15",
          disabled && "opacity-50 cursor-not-allowed",
          className,
        )}
      >
        {!iconOnly && (
          <span className={cn("truncate", displayValue ? "text-ink" : "text-ink-faint")}>{displayValue || placeholder}</span>
        )}
        <CalendarIcon size={15} className="text-ink-faint shrink-0" />
      </button>

      {open && !disabled && createPortal(
        <div
          ref={popoverRef}
          style={{ position: "fixed", top: coords.top, left: coords.left }}
          className="z-[100] rounded-xl border border-line bg-paper shadow-float overflow-hidden anim-scale-in"
        >
          <Calendar
            date={value ? parseLocalDate(value) : new Date()}
            onChange={(d: Date) => { onChange(toLocalDateString(d)); setOpen(false); }}
            minDate={min ? parseLocalDate(min) : undefined}
            maxDate={max ? parseLocalDate(max) : undefined}
            color="rgb(var(--color-accent))"
          />
        </div>,
        document.body,
      )}
    </>
  );
}
