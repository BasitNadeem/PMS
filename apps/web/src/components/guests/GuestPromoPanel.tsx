import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Check, Mail, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { guestsService, type GuestDetail } from "@/services/guests";
import { IssueOfferModal } from "./IssueOfferModal";

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export interface GuestPromoPanelProps {
  guest: GuestDetail;
  canIssue: boolean;
  onNotify: (message: string) => void;
}

/**
 * Offers history for one guest, with a button to issue another.
 *
 * Issuing itself lives in `IssueOfferModal`, shared with the guest drawer and
 * the upcoming-occasions list, so the same offer can be sent from wherever the
 * guest already is.
 */
export function GuestPromoPanel({ guest, canIssue, onNotify }: GuestPromoPanelProps) {
  const [showIssue, setShowIssue] = useState(false);
  const qc = useQueryClient();

  const { data: codes = [] } = useQuery({
    queryKey: ["guest-promo-codes", guest.id],
    queryFn:  () => guestsService.getPromoCodes(guest.id),
    refetchInterval: (query) => query.state.data?.some((code) => code.emailStatus === "QUEUED") ? 5_000 : false,
  });

  const retryEmail = useMutation({
    mutationFn: (codeId: string) => guestsService.retryPromoEmail(guest.id, codeId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["guest-promo-codes", guest.id] });
      onNotify("Offer email queued again.");
    },
    onError: (error) => onNotify((error as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Could not retry the email."),
  });

  return (
    <div className="space-y-4">
      {canIssue && (
        <button
          onClick={() => setShowIssue(true)}
          disabled={guest.isBlacklisted}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Gift size={16} />
          Issue an offer
        </button>
      )}

      <div>
        <div className="mb-2 text-[11px] font-bold uppercase tracking-wider text-ink-faint">
          Codes issued ({codes.length})
        </div>
        {codes.length === 0 ? (
          <p className="text-[13px] text-ink-mute">None yet.</p>
        ) : (
          <div className="rounded-xl2 border border-line bg-card divide-y divide-line-soft">
            {codes.map((code) => {
              const used    = code.usedCount > 0;
              const expired = code.validTo ? new Date(code.validTo) < new Date() : false;
              return (
                <div key={code.id} className="flex items-center gap-3 px-4 py-3 flex-wrap">
                  <span className={cn(
                    "text-[13.5px] font-bold tnum tracking-wide",
                    used ? "text-ink-faint line-through" : expired ? "text-ink-faint" : "text-coral",
                  )}>
                    {code.code}
                  </span>
                  <span className="text-[12.5px] text-ink-mute">
                    {code.discountPercent ? `${code.discountPercent}% off best rate` : code.ratePlan?.name ?? "Offer"}
                  </span>
                  <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", code.emailStatus === "SENT" ? "text-pine-deep" : code.emailStatus === "FAILED" ? "text-clay" : "text-ink-faint")}>
                    <Mail size={11} /> {code.emailStatus === "NOT_REQUESTED" ? "Not emailed" : code.emailStatus.toLowerCase()}
                  </span>
                  {canIssue && code.emailStatus === "FAILED" && (
                    <button type="button" onClick={() => retryEmail.mutate(code.id)} disabled={retryEmail.isPending} className="inline-flex items-center gap-1 text-[11px] font-semibold text-coral hover:underline disabled:opacity-50"><RotateCcw size={11} /> Retry</button>
                  )}
                  <span className="ml-auto flex items-center gap-2 text-[12px]">
                    {used ? (
                      <span className="inline-flex items-center gap-1 text-pine-deep font-semibold">
                        <Check size={12} /> Redeemed {fmtDate(code.lastUsedAt)}
                      </span>
                    ) : expired ? (
                      <span className="text-ink-faint">Expired {fmtDate(code.validTo)}</span>
                    ) : (
                      <span className="text-ink-mute">Valid until {fmtDate(code.validTo)}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showIssue && (
        <IssueOfferModal
          guestId={guest.id}
          guestName={guest.fullName}
          guestEmail={guest.email}
          marketingOptIn={guest.marketingOptIn}
          onClose={() => setShowIssue(false)}
          onSuccess={onNotify}
        />
      )}
    </div>
  );
}
