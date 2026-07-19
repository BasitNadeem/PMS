import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface SplitHeadingProps {
  children: string;
  className?: string;
  style?: React.CSSProperties;
  as?: "h1" | "h2" | "h3" | "p" | "span";
  delay?: number;
  /** Wrap specific words in a render fn, e.g. to italicize the last word */
  wordRender?: (word: string, i: number, all: string[]) => ReactNode;
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.055 },
  },
};

const word = {
  hidden: { y: "110%" },
  show: {
    y: "0%",
    transition: { duration: 0.85, ease: [0.16, 1, 0.3, 1] as const },
  },
};

/** Reveals a heading word-by-word, each clipped and sliding up into place. */
export default function SplitHeading({
  children,
  className,
  style,
  as = "h2",
  delay = 0,
  wordRender,
}: SplitHeadingProps) {
  const words = children.split(" ");
  const Tag = motion[as];

  return (
    <Tag
      className={className}
      style={style}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true }}
      transition={{ delayChildren: delay }}
    >
      {words.map((w, i) => (
        <span
          key={`${w}-${i}`}
          style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top" }}
        >
          <motion.span variants={word} style={{ display: "inline-block" }}>
            {wordRender ? wordRender(w, i, words) : w}
            {i < words.length - 1 ? " " : ""}
          </motion.span>
        </span>
      ))}
    </Tag>
  );
}
