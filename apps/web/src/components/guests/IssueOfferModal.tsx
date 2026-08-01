import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Gift, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { guestsService, type PromoIssueReason } from "@/services/guests";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const REASON_OPTIONS: { value: PromoIssueReason; label: string }[] = [
  { value: "VIP_REWARD",  label: "Thank you"   },
  { value: "BIRTHDAY",    label: "Birthday"    },
  { value: "ANNIVERSARY", label: "Anniversary" },
  { value: "WIN_BACK",    label: "Win back"    },
  { value: "MANUAL",      label: "Other"       },
];

const selectCls = "h-10 w-full rounded-xl bg-mist border border-line px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all cursor-pointer";
const labelCls  = "block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5";

export interface IssueOfferModalProps {
  guestId: string;
  guestName: string;
  /** Both are needed for an email to go out; shown as a warning when missing. */
  guestEmail: string | null;
  marketingOptIn: boolean;
  defaultReason?: PromoIssueReason;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/**
 * Compact "issue an offer" dialog, so a code can be sent from wherever the
 * guest already is — the list drawer or the occasions panel — instead of only
 * from a tab three screens deep.
 */
export function IssueOfferModal({
  guestId, guestName, guestEmail, marketingOptIn, defaultReason = "VIP_REWARD", onClose, onSuccess,
}: IssueOfferModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [reason, setReason]          = useState<PromoIssueReason>(defaultReason);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [validForDays, setValidDays] = useState(30);
  const hasEmail = Boolean(guestEmail);
  const canSendNormally = marketingOptIn && hasEmail;
  const [sendEmail, setSendEmail] = useState(canSendNormally);
  const [overrideMarketingConsent, setOverrideMarketingConsent] = useState(false);
  const willSendEmail = hasEmail && (canSendNormally ? sendEmail : overrideMarketingConsent);

  const mutation = useMutation({
    mutationFn: () => guestsService.issuePromoCode(guestId, {
      discountPercent,
      reason,
      validForDays,
      sendEmail: willSendEmail,
      overrideMarketingConsent: !marketingOptIn && overrideMarketingConsent,
    }),
    onSuccess: (code) => {
      qc.invalidateQueries({ queryKey: ["guest-promo-codes", guestId] });
      onSuccess(
        code.emailStatus === "QUEUED"
          ? `Code ${code.code} created. Email queued for delivery.`
          : code.emailStatus === "FAILED"
            ? `Code ${code.code} created, but its email could not be queued.`
            : `Code ${code.code} created. Share it with the guest directly.`,
      );
      onClose();
    },
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-paper shadow-xl anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center gap-3 border-b border-line px-6 pb-5 pt-6">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-coral/10 shrink-0">
            <Gift size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Issue an offer</h2>
            <p className="text-[12px] text-ink-mute mt-0.5 truncate">{guestName}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="scroll-area min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          <>
              <div>
                <label className={labelCls}>Occasion</label>
                <select value={reason} onChange={(e) => setReason(e.target.value as PromoIssueReason)} className={selectCls}>
                  {REASON_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Discount on the best available rate</label>
                <div className="relative">
                  <input type="number" min={1} max={90} value={discountPercent}
                    onChange={(e) => setDiscountPercent(Math.min(90, Math.max(1, Number(e.target.value))))}
                    className={cn(selectCls, "pr-9 tnum")} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-ink-mute">%</span>
                </div>
                <p className="mt-1.5 text-[12px] text-ink-faint">Applies to whichever public rate is best for the guest’s dates. No separate rate plan needed.</p>
              </div>
              <div>
                <label className={labelCls}>Valid for</label>
                <select value={validForDays} onChange={(e) => setValidDays(Number(e.target.value))} className={cn(selectCls, "tnum")}>
                  {[14, 30, 60, 90].map((d) => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>

              {!hasEmail && (
                <div className="flex items-start gap-2 rounded-xl bg-amber-soft border border-amber/30 px-3 py-2.5">
                  <AlertCircle size={14} className="text-amber shrink-0 mt-0.5" />
                  <p className="text-[12.5px] text-ink-soft">
                    No email on file — the code is created but not sent. Hand it to the guest.
                  </p>
                </div>
              )}

              {hasEmail && !marketingOptIn && (
                <div className="space-y-2.5 rounded-xl border border-amber/30 bg-amber-soft px-3 py-3">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber" />
                    <p className="text-[12.5px] text-ink-soft">
                      This guest has not opted in to marketing. Only send this offer if they gave permission for this specific email.
                    </p>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2.5 text-[12.5px] font-semibold text-ink-soft">
                    <input
                      type="checkbox"
                      checked={overrideMarketingConsent}
                      onChange={(e) => setOverrideMarketingConsent(e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--color-coral))]"
                    />
                    Send this offer once — do not change their saved preference
                  </label>
                </div>
              )}

              {canSendNormally && (
                <label className="flex items-center gap-2.5 text-[13px] text-ink-soft cursor-pointer">
                  <input type="checkbox" checked={sendEmail} onChange={(e) => setSendEmail(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--color-coral))]" />
                  Email this offer to {guestEmail}
                </label>
              )}

              {mutation.isError && (
                <p className="text-[12.5px] text-clay">
                  {(mutation.error as { response?: { data?: { error?: string } } })?.response?.data?.error
                    ?? "Could not create this offer. Please try again."}
                </p>
              )}
            </>
        </div>

        <div className="flex shrink-0 justify-end gap-2.5 border-t border-line px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={discountPercent < 1 || discountPercent > 90 || mutation.isPending}
            className="h-10 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {mutation.isPending ? "Creating…" : willSendEmail ? "Create & email" : "Create code"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
