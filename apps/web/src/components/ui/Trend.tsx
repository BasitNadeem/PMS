import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { TONE, type ToneConfig } from "./StatusBadge";

export interface TrendProps {
  dir?: "up" | "down";
  value: string;
  tone?: ToneConfig;
}

export function Trend({ dir = "up", value, tone }: TrendProps) {
  const up = dir === "up";
  const t = tone ?? (up ? TONE.pine : TONE.clay);
  const Arrow = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ background: t.bg, color: t.fg }}
    >
      <Arrow size={12} strokeWidth={2.6} />
      {value}
    </span>
  );
}
