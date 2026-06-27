import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { THEMES } from "@/lib/theme";
import type { ThemeKey } from "@/services/settings";

export interface ThemePickerProps {
  value: ThemeKey;
  onChange: (key: ThemeKey) => void;
  className?: string;
}

export function ThemePicker({ value, onChange, className }: ThemePickerProps) {
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {THEMES.map((t) => {
        const selected = value === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={cn(
              "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-left transition-all",
              selected
                ? "border-ink shadow-pop"
                : "border-line hover:border-ink-faint",
            )}
          >
            <span
              className="grid place-items-center h-8 w-8 rounded-lg shrink-0"
              style={{ background: t.swatch }}
            >
              {selected && <Check size={15} className="text-white" strokeWidth={2.5} />}
            </span>
            <span className="text-[13.5px] font-semibold text-ink whitespace-nowrap">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
