import { cn } from "@/lib/cn";
import { Crown } from "lucide-react";

function initials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

const PALETTES: [string, string][] = [
  ["#FBEAE1", "#9E3417"],
  ["#E6F0EA", "#1F4D3A"],
  ["#E7EEF3", "#2c455c"],
  ["#F8EFDA", "#86600F"],
  ["#EDE9F4", "#473869"],
  ["#F8E7E1", "#8d3322"],
  ["#F1ECE4", "#4A453E"],
];

function tintFor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTES[Math.abs(hash) % PALETTES.length];
}

export interface AvatarProps {
  name: string;
  size?: number;
  vip?: boolean;
  className?: string;
}

export function Avatar({ name, size = 40, vip = false, className }: AvatarProps) {
  const [bg, fg] = tintFor(name || "?");
  return (
    <div
      className={cn("relative grid place-items-center rounded-full font-bold shrink-0", className)}
      style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }}
    >
      {initials(name || "?")}
      {vip && (
        <span
          className="absolute -bottom-0.5 -right-0.5 grid place-items-center rounded-full bg-amber text-white border-2 border-card"
          style={{ width: size * 0.42, height: size * 0.42 }}
        >
          <Crown size={size * 0.22} strokeWidth={2.4} />
        </span>
      )}
    </div>
  );
}
