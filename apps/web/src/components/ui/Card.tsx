import { cn } from "@/lib/cn";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  pad?: boolean;
  hover?: boolean;
}

export function Card({ className, children, pad = true, hover = false, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "bg-card rounded-xl2 border border-line shadow-card",
        hover && "lift hover:shadow-float hover:border-line",
        pad && "p-5",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
