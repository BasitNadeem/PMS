import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";

interface ReservationIdLinkProps {
  id: string;
  confirmationNumber: string;
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
}

/** Quiet editorial link treatment for the primary reservation identity. */
export function ReservationIdLink({ id, confirmationNumber, className, onClick }: ReservationIdLinkProps) {
  return (
    <Link
      to={`/reservations/${id}`}
      onClick={onClick}
      aria-label={`Open reservation ${confirmationNumber}`}
      className={cn(
        "group/id inline-flex w-fit items-center gap-1 text-[12px] font-bold text-ink-soft tnum",
        "underline decoration-ink/20 underline-offset-4 hover:text-coral hover:decoration-coral/60",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-coral/35 rounded-sm transition-colors",
        className,
      )}
    >
      {confirmationNumber}
      <ArrowUpRight size={11} aria-hidden="true" className="opacity-0 -translate-x-0.5 group-hover/id:opacity-100 group-hover/id:translate-x-0 transition-all" />
    </Link>
  );
}
