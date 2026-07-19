import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface RevealProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  variant?: "rise" | "scale" | "fade";
  delay?: number;
  duration?: number;
}

const EASE = [0.16, 1, 0.3, 1] as const;

const variants = {
  rise: {
    hidden: { opacity: 0, y: 32 },
    show: { opacity: 1, y: 0 },
  },
  fade: {
    hidden: { opacity: 0 },
    show: { opacity: 1 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.94 },
    show: { opacity: 1, scale: 1 },
  },
};

/** Shared scroll-reveal wrapper — pick a variant instead of copy-pasting a motion object per page. */
export default function Reveal({
  children,
  className,
  style,
  variant = "rise",
  delay = 0,
  duration = 0.8,
}: RevealProps) {
  return (
    <motion.div
      className={className}
      style={style}
      variants={variants[variant]}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
