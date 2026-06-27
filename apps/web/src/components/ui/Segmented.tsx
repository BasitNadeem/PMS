import { cn } from "@/lib/cn";

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ElementType;
}

export interface SegmentedProps {
  options: (string | SegmentedOption)[];
  value: string;
  onChange: (value: string) => void;
  size?: "sm" | "md";
  className?: string;
}

export function Segmented({ options, value, onChange, size = "md", className }: SegmentedProps) {
  const h = size === "sm" ? "h-8" : "h-10";
  const ts = size === "sm" ? "text-[13px]" : "text-sm";
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-full bg-line-soft p-1", className)}>
      {options.map((o) => {
        const val = typeof o === "string" ? o : o.value;
        const lab = typeof o === "string" ? o : o.label;
        const Icon = typeof o === "object" ? o.icon : undefined;
        const on = val === value;
        return (
          <button
            key={val}
            onClick={() => onChange(val)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3.5 font-semibold whitespace-nowrap transition-all duration-200",
              h, ts,
              on ? "bg-card text-ink shadow-pop" : "text-ink-mute hover:text-ink-soft",
            )}
          >
            {Icon && <Icon size={15} />}
            {lab}
          </button>
        );
      })}
    </div>
  );
}
