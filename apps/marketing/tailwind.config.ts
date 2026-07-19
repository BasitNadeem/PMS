import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Surfaces — WARM_CLAY, mirrored 1:1 from apps/web
        paper:     "#F5EBE4",
        mist:      "#FAF8F4",
        card:      "#FFFFFF",
        line:      "#EAE4DB",
        "line-soft": "#F1ECE4",

        // Text — theme-invariant ink scale, same as apps/web
        ink: {
          DEFAULT: "#211E1A",
          soft:    "#4A453E",
          mute:    "#938C81",
          faint:   "#B8B1A6",
        },

        // Brand accent — apps/web calls this "coral", it IS the WARM_CLAY accent
        coral: {
          DEFAULT: "#E0532B",
          dark:    "#C2431F",
          deep:    "#9E3417",
          soft:    "#FBEAE1",
          tint:    "#FCF3EE",
        },
      },
      fontFamily: {
        display: ["Fraunces", "Georgia", "serif"],
        body:    ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        "2xs": ["10px", { lineHeight: "1.4" }],
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
      },
      boxShadow: {
        card:  "0 1px 2px rgba(33,30,26,0.04), 0 4px 16px rgba(33,30,26,0.04)",
        float: "0 12px 40px rgba(33,30,26,0.12), 0 2px 8px rgba(33,30,26,0.06)",
        pop:   "0 1px 3px rgba(33,30,26,0.06)",
        hero:  "0 40px 100px -24px rgba(33,30,26,0.22), 0 12px 32px -12px rgba(158,52,23,0.14)",
      },
    },
  },
  plugins: [],
};

export default config;
