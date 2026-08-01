import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { vipLabel } from "@/services/guests";

export interface VipBadgeProps {
  level: number;
  size?: "sm" | "md";
  className?: string;
}

/**
 * Recognition tier earned automatically from completed stays. Renders nothing
 * for level 0 so callers can drop it inline without guarding every usage.
 */
export function VipBadge({ level, size = "md", className }: VipBadgeProps) {
  const label = vipLabel(level);
  if (!label) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-bold whitespace-nowrap",
        "bg-amber/10 text-amber",
        size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-[11px] px-2 py-0.5",
        className,
      )}
      title={`${label} — earned from ${level === 1 ? "repeat" : "frequent"} stays`}
    >
      <Star size={size === "sm" ? 9 : 11} className="fill-amber" />
      {label}
    </span>
  );
}
