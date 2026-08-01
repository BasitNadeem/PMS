import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Cake, Heart, Star, ChevronRight, MailX, Gift } from "lucide-react";
import { cn } from "@/lib/cn";
import { guestsService, SPECIAL_DATE_LABEL, type SpecialDateKind, type UpcomingOccasion } from "@/services/guests";
import { Card } from "@/components/ui/Card";
import { VipBadge } from "./VipBadge";
import { IssueOfferModal } from "./IssueOfferModal";

const KIND_ICON: Record<SpecialDateKind, typeof Cake> = {
  BIRTHDAY:    Cake,
  ANNIVERSARY: Heart,
  CUSTOM:      Star,
};

function whenLabel(inDays: number): string {
  if (inDays === 0) return "Today";
  if (inDays === 1) return "Tomorrow";
  return `In ${inDays} days`;
}

/**
 * Birthdays and anniversaries coming up, for the front desk.
 *
 * Always shows how many guests actually have a date on file. On most databases
 * that will be a small minority, and "6 birthdays this week" read without that
 * context invites a hotel to draw conclusions from a heavily biased sample.
 */
export interface UpcomingOccasionsProps {
  canIssue?: boolean;
  onNotify?: (message: string) => void;
  className?: string;
}

export function UpcomingOccasions({ canIssue = false, onNotify, className }: UpcomingOccasionsProps) {
  const [withinDays, setWithinDays] = useState(7);
  const [issueTarget, setIssueTarget] = useState<UpcomingOccasion | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["guest-occasions", withinDays],
    queryFn:  () => guestsService.getUpcomingOccasions(withinDays),
    staleTime: 60_000,
  });

  const items = data?.data ?? [];
  const meta  = data?.meta;

  return (
    <Card pad={false} className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-line-soft">
        <div>
          <h2 className="serif text-[19px] text-ink">Upcoming occasions</h2>
          {meta && (
            <p className="mt-0.5 text-[12px] text-ink-mute">
              {items.length} in the next {meta.withinDays} days
              {" · "}
              <span className="text-ink-faint">
                from {meta.guestsWithDates.toLocaleString()} of {meta.guestsTotal.toLocaleString()} guests
                {" "}with a date on file ({meta.coveragePercent}%)
              </span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {[7, 30].map((d) => (
            <button
              key={d}
              onClick={() => setWithinDays(d)}
              className={cn(
                "h-8 px-3 rounded-full text-[12.5px] font-semibold border transition-colors",
                withinDays === d
                  ? "border-coral bg-coral/10 text-coral"
                  : "border-line text-ink-mute hover:text-ink hover:border-ink-faint",
              )}
            >
              {d} days
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-6 space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 bg-line-soft rounded animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-[13.5px] text-ink-mute">Nothing coming up.</p>
          {meta && meta.coveragePercent < 20 && (
            <p className="mt-1 text-[12.5px] text-ink-faint">
              Only {meta.coveragePercent}% of guests have a date recorded, so this will
              stay quiet until more are captured.
            </p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-line-soft">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind];
            return (
              <div key={item.id} className="group flex items-center gap-3 px-5 py-3 hover:bg-mist transition-colors">
                <div className="grid place-items-center h-9 w-9 rounded-xl bg-coral/10 shrink-0">
                  <Icon size={16} className="text-coral" />
                </div>
                <Link to={`/guests/${item.guest.id}`} className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[14px] font-semibold text-ink truncate">{item.guest.fullName}</span>
                    <VipBadge level={item.guest.vipLevel} size="sm" />
                    {/* Without consent nothing is emailed — say so here rather
                        than letting staff assume a greeting went out. */}
                    {!item.guest.marketingOptIn && (
                      <span title="No consent — nothing will be emailed">
                        <MailX size={12} className="text-ink-faint" />
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-ink-mute">
                    {item.label || SPECIAL_DATE_LABEL[item.kind]}
                    {item.occurrence ? ` · ${item.occurrence} years` : ""}
                    {" · "}{item.date}
                    {item.observedOnLeapFallback && " (29 Feb, marked today)"}
                  </p>
                </Link>
                <span className="text-[12.5px] font-semibold text-ink-soft whitespace-nowrap">
                  {whenLabel(item.inDays)}
                </span>
                {/* Sending from here is the whole point — the occasion is in
                    front of you, so the offer should be one click, not a trip
                    through the profile. */}
                {canIssue && (
                  <button
                    onClick={() => setIssueTarget(item)}
                    className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-line text-[12.5px] font-semibold text-ink-mute hover:text-coral hover:border-coral transition-colors whitespace-nowrap"
                  >
                    <Gift size={13} /> Create offer
                  </button>
                )}
                <Link to={`/guests/${item.guest.id}`} className="shrink-0">
                  <ChevronRight size={16} className="text-ink-faint" />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {issueTarget && (
        <IssueOfferModal
          guestId={issueTarget.guest.id}
          guestName={issueTarget.guest.fullName}
          guestEmail={issueTarget.guest.email}
          marketingOptIn={issueTarget.guest.marketingOptIn}
          defaultReason={issueTarget.kind === "ANNIVERSARY" ? "ANNIVERSARY" : "BIRTHDAY"}
          onClose={() => setIssueTarget(null)}
          onSuccess={(message) => onNotify?.(message)}
        />
      )}
    </Card>
  );
}
