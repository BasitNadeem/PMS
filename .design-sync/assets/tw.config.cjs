/** Standalone Tailwind config for the @pms/ui design-system bundle.
 *  Scans packages/ui source so only the utilities Button/Badge use are emitted.
 *  Defines a `brand` scale from the app's WARM_CLAY accent (#E0532B) — the
 *  packages/ui components reference bg-brand-600 etc., which the app's own
 *  tailwind.config.ts does not define (see .design-sync/NOTES.md). */
module.exports = {
  content: ["packages/ui/src/**/*.{ts,tsx}"],
  // Utilities named in .design-sync/conventions.md (brand scale + example
  // layout glue) so the shipped _ds_bundle.css genuinely contains every class
  // the design agent is told to use.
  safelist: [
    "bg-brand-500", "bg-brand-600", "bg-brand-700", "bg-brand-800",
    "text-brand-500", "text-brand-600", "text-brand-700", "text-brand-800",
    "hover:bg-brand-600", "hover:bg-brand-700",
    "flex", "items-center", "justify-between",
    "gap-2", "gap-3", "w-full",
    "rounded-lg", "rounded-xl", "border", "border-gray-200",
    "bg-white", "p-4", "text-sm", "font-medium", "text-gray-700", "text-gray-900",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#FDEEE8",
          100: "#FBD9CC",
          200: "#F6B9A3",
          300: "#F0977A",
          400: "#EA7658",
          500: "#E86A45",
          600: "#E0532B", // app accent (WARM_CLAY)
          700: "#C2431F", // app accent-dark
          800: "#9E3417", // app accent-deep
          900: "#7C2811",
        },
      },
    },
  },
  plugins: [],
};
