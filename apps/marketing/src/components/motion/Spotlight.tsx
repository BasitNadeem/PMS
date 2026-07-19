import { useRef } from "react";
import type { MouseEvent, ReactNode } from "react";

interface SpotlightProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** CSS color used for the glow, e.g. "rgba(187,74,51,0.14)" */
  color?: string;
}

/** Card wrapper with a soft radial highlight that follows the cursor. */
export default function Spotlight({ children, className, style, color = "rgba(255,255,255,0.08)" }: SpotlightProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleMove(e: MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`);
    el.style.setProperty("--my", `${e.clientY - rect.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      className={`spotlight${className ? ` ${className}` : ""}`}
      style={{
        ...style,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        aria-hidden
        className="spotlight-layer"
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(320px circle at var(--mx, 50%) var(--my, 50%), ${color}, transparent 70%)`,
          pointerEvents: "none",
        }}
      />
      {children}
    </div>
  );
}
