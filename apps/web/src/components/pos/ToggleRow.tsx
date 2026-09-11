import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type ToggleTone = "pine" | "coral" | "amber";

// Written out rather than interpolated so Tailwind's scanner still finds them.
const TONE_ON: Record<ToggleTone, string> = {
  pine:  "bg-pine",
  coral: "bg-coral",
  amber: "bg-amber",
};

export interface ToggleProps {
  checked:  boolean;
  onChange: () => void;
  tone?:    ToggleTone;
}

/** The bare switch, shared so every toggle in the POS modals matches. */
export function Toggle({ checked, onChange, tone = "pine" }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200",
        checked ? TONE_ON[tone] : "bg-line-soft",
      )}
    >
      <span className={cn(
        "h-5 w-5 rounded-full bg-white shadow transition-transform duration-200",
        checked ? "translate-x-5" : "translate-x-0.5",
      )} />
    </button>
  );
}

export interface ToggleRowProps extends ToggleProps {
  label: string;
  icon?: ReactNode;
}

/** Label left, switch hard right — one row of the settings group. */
export function ToggleRow({ label, icon, ...toggle }: ToggleRowProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
      <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium text-ink-soft">
        {icon}
        <span className="truncate">{label}</span>
      </span>
      <Toggle {...toggle} />
    </div>
  );
}
