import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";

type Variant = "primary" | "dark" | "ghost" | "outline" | "soft" | "danger";
type Size = "sm" | "md" | "lg";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  leftIcon?: LucideIcon;
  rightIcon?: LucideIcon;
  loading?: boolean;
}

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-5 text-[15px] gap-2",
};

const VARIANTS: Record<Variant, string> = {
  primary: "bg-coral text-white hover:bg-coral-dark shadow-pop",
  dark:    "bg-ink text-white hover:bg-ink-soft shadow-pop",
  ghost:   "bg-transparent text-ink-soft hover:bg-line-soft",
  outline: "bg-card text-ink-soft border border-line hover:border-ink-faint hover:text-ink",
  soft:    "bg-coral-soft text-coral-deep hover:bg-[#f8ddd0]",
  danger:  "bg-clay text-white hover:brightness-95",
};

const ICON_SIZES: Record<Size, number> = { sm: 15, md: 17, lg: 19 };

export function Button({
  variant = "primary",
  size = "md",
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  loading,
  children,
  className,
  disabled,
  ...rest
}: ButtonProps) {
  const iconSize = ICON_SIZES[size];
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center font-semibold rounded-full whitespace-nowrap transition-all duration-200 active:scale-[.97] disabled:opacity-40 disabled:pointer-events-none",
        SIZES[size],
        VARIANTS[variant],
        !children && "!px-0 aspect-square",
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <svg className="animate-spin" width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
      ) : LeftIcon ? (
        <LeftIcon size={iconSize} />
      ) : null}
      {children}
      {RightIcon && <RightIcon size={iconSize} />}
    </button>
  );
}
