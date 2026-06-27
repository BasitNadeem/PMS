import { cn } from "@/lib/cn";

export interface ToneConfig {
  bg: string;
  fg: string;
  dot: string;
}

export const TONE: Record<string, ToneConfig> = {
  ink:   { bg: "#F1ECE4", fg: "#4A453E", dot: "#6b655c" },
  coral: { bg: "#FBEAE1", fg: "#9E3417", dot: "#E0532B" },
  pine:  { bg: "#E6F0EA", fg: "#1F4D3A", dot: "#2F7256" },
  amber: { bg: "#F8EFDA", fg: "#86600F", dot: "#B7791A" },
  clay:  { bg: "#F8E7E1", fg: "#8d3322", dot: "#BB4A33" },
  slate: { bg: "#E7EEF3", fg: "#2c455c", dot: "#3D5A73" },
  dusk:  { bg: "#EDE9F4", fg: "#473869", dot: "#5B4B82" },
};

const STATUS_TONE: Record<string, string> = {
  Pending:       "amber",
  Confirmed:     "slate",
  "Checked In":  "pine",
  "Checked Out": "ink",
  Cancelled:     "clay",
  Available:     "pine",
  Occupied:      "coral",
  "Needs Cleaning": "amber",
  Maintenance:   "dusk",
  "Out of Order":"clay",
  "In Progress": "slate",
  Done:          "pine",
  Paid:          "pine",
  Partial:       "amber",
  Refunded:      "ink",
  High:          "clay",
  Medium:        "amber",
  Low:           "slate",
  Open:          "coral",
  Settled:       "pine",
  Active:        "pine",
  Inactive:      "ink",
  "Awaiting Parts": "amber",
  Resolved:      "pine",
  Closed:        "ink",
  Urgent:        "clay",
};

export function toneOf(status: string): ToneConfig {
  return TONE[STATUS_TONE[status] ?? "ink"];
}

export interface StatusBadgeProps {
  status: string;
  dot?: boolean;
  className?: string;
  size?: "sm" | "md";
}

export function StatusBadge({ status, dot = true, className, size = "md" }: StatusBadgeProps) {
  const t = toneOf(status);
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 rounded-full font-semibold", pad, className)}
      style={{ background: t.bg, color: t.fg }}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.dot }} />}
      {status}
    </span>
  );
}
