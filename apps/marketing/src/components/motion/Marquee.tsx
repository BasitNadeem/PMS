interface MarqueeProps {
  items: string[];
  className?: string;
  speed?: number;
  separator?: string;
}

/** Infinite horizontal ticker — duplicates the list once so the loop is seamless. */
export default function Marquee({ items, className, speed = 32, separator = "·" }: MarqueeProps) {
  const track = (
    <span className="flex items-center shrink-0" style={{ gap: "2.5rem", paddingRight: "2.5rem" }}>
      {items.map((item, i) => (
        <span key={i} className="flex items-center shrink-0" style={{ gap: "2.5rem" }}>
          <span>{item}</span>
          <span aria-hidden style={{ opacity: 0.4 }}>{separator}</span>
        </span>
      ))}
    </span>
  );

  return (
    <div className={`overflow-hidden whitespace-nowrap ${className ?? ""}`}>
      <div
        className="inline-flex w-max"
        style={{ animation: `marquee ${speed}s linear infinite` }}
      >
        {track}
        {track}
      </div>
    </div>
  );
}
