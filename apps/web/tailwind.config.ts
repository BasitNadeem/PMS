import type { Config } from "tailwindcss";

// Resolves a themed Tailwind color to its CSS variable (stored as an "R G B"
// triplet in index.css) while preserving support for opacity modifiers like
// bg-coral/20 or text-ink/40.
function withOpacity(variable: string) {
  return ({ opacityValue }: { opacityValue?: string }) =>
    opacityValue === undefined
      ? `rgb(var(${variable}))`
      : `rgb(var(${variable}) / ${opacityValue})`;
}

export default {
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper:  withOpacity("--color-paper"),
        mist:   withOpacity("--color-mist"),
        card:   withOpacity("--color-card"),
        line: {
          DEFAULT: withOpacity("--color-line"),
          soft:    withOpacity("--color-line-soft"),
        },
        ink: {
          DEFAULT: withOpacity("--color-ink"),
          soft:    withOpacity("--color-ink-soft"),
          mute:    withOpacity("--color-ink-mute"),
          faint:   withOpacity("--color-ink-faint"),
        },
        coral: {
          DEFAULT: withOpacity("--color-accent"),
          dark:    withOpacity("--color-accent-dark"),
          deep:    withOpacity("--color-accent-deep"),
          soft:    withOpacity("--color-accent-soft"),
          tint:    withOpacity("--color-accent-tint"),
        },
        pine: {
          DEFAULT: "#2F7256",
          soft:    "#E6F0EA",
          deep:    "#1F4D3A",
        },
        amber: {
          DEFAULT: "#B7791A",
          soft:    "#F8EFDA",
        },
        clay: {
          DEFAULT: "#BB4A33",
          soft:    "#F8E7E1",
        },
        slate: {
          DEFAULT: "#3D5A73",
          soft:    "#E7EEF3",
        },
        dusk: {
          DEFAULT: "#5B4B82",
          soft:    "#EDE9F4",
        },
      },
      fontFamily: {
        sans:  ['"Hanken Grotesk"', "system-ui", "sans-serif"],
        serif: ["Newsreader", "Georgia", "serif"],
      },
      boxShadow: {
        card:  "0 1px 2px rgba(33,30,26,0.04), 0 4px 16px rgba(33,30,26,0.04)",
        float: "0 12px 40px rgba(33,30,26,0.12), 0 2px 8px rgba(33,30,26,0.06)",
        pop:   "0 1px 3px rgba(33,30,26,0.06)",
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
