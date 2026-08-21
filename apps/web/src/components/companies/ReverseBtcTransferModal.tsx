import { useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, Building2, Check, RotateCcw, UserRound, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { RequiredMark } from "@/components/ui/RequiredMark";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { pkr, type LedgerEntry } from "@/services/companies";

export type BtcReversalPayerAction = "KEEP_COMPANY" | "RETURN_TO_GUEST";

interface ReverseBtcTransferModalProps {
  entry: LedgerEntry;
  companyName: string;
  loading: boolean;
  onClose: () => void;
  onConfirm: (values: { reason: string; payerAction: BtcReversalPayerAction }) => void;
}

export function ReverseBtcTransferModal({
  entry,
  companyName,
  loading,
  onClose,
  onConfirm,
}: ReverseBtcTransferModalProps) {
  useEscapeKey(onClose);
  const [payerAction, setPayerAction] = useState<BtcReversalPayerAction>("KEEP_COMPANY");
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();
  const canSubmit = trimmedReason.length >= 5 && !loading;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/45 p-4 backdrop-blur-sm anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[650px] flex-col overflow-hidden rounded-[24px] border border-white/50 bg-paper shadow-[0_28px_80px_rgba(31,27,23,0.24)] anim-scale-in"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start gap-4 px-8 pb-6 pt-7">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-clay text-white shadow-sm">
            <RotateCcw size={21} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-clay">Correct BTC posting</div>
            <h2 className="serif text-[26px] leading-tight text-ink">Reverse company transfer</h2>
            <p className="mt-1 text-[12.5px] text-ink-mute">
              {pkr(entry.amount)} · {companyName}
            </p>
          </div>
          <button onClick={onClose} className="-mr-1 -mt-1 grid h-9 w-9 place-items-center rounded-full text-ink-mute transition-colors hover:bg-mist hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto border-t border-line-soft px-8 py-6">
          <div>
            <div className="mb-2.5 text-[11px] font-bold uppercase tracking-wider text-ink-faint">After reversing, who should owe these charges?</div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPayerAction("KEEP_COMPANY")}
                className={cn(
                  "relative min-h-[132px] rounded-2xl border p-5 text-left transition-all",
                  payerAction === "KEEP_COMPANY" ? "border-coral bg-coral-soft/55 shadow-sm ring-1 ring-coral/10" : "border-line bg-card hover:border-ink-faint",
                )}
              >
                <Building2 size={19} className={payerAction === "KEEP_COMPANY" ? "text-coral" : "text-ink-mute"} />
                <div className="mt-3 text-[15px] font-bold text-ink">Keep with company (BTC)</div>
                <div className="mt-1 text-[12px] leading-snug text-ink-mute">Use this when the ledger posting was wrong and will be posted again.</div>
                {payerAction === "KEEP_COMPANY" && <Check size={15} className="absolute right-3 top-3 text-coral" />}
              </button>

              <button
                type="button"
                onClick={() => setPayerAction("RETURN_TO_GUEST")}
                className={cn(
                  "relative min-h-[132px] rounded-2xl border p-5 text-left transition-all",
                  payerAction === "RETURN_TO_GUEST" ? "border-dusk bg-dusk-soft/70 shadow-sm ring-1 ring-dusk/10" : "border-line bg-card hover:border-ink-faint",
                )}
              >
                <UserRound size={19} className={payerAction === "RETURN_TO_GUEST" ? "text-dusk" : "text-ink-mute"} />
                <div className="mt-3 text-[15px] font-bold text-ink">Return to guest</div>
                <div className="mt-1 text-[12px] leading-snug text-ink-mute">Remove BTC responsibility and put the affected charges back on the guest folio.</div>
                {payerAction === "RETURN_TO_GUEST" && <Check size={15} className="absolute right-3 top-3 text-dusk" />}
              </button>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-faint">
              Internal reason<RequiredMark />
            </label>
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="For example: Company billing selected by mistake"
              className="w-full resize-none rounded-xl border border-line bg-card px-3.5 py-3 text-[13.5px] text-ink outline-none transition-all focus:border-coral focus:ring-2 focus:ring-coral/15"
            />
            <div className="mt-1.5 flex justify-between gap-3 text-[11.5px]">
              <span className={reason.length > 0 && trimmedReason.length < 5 ? "font-semibold text-clay" : "text-ink-faint"}>
                {reason.length > 0 && trimmedReason.length < 5 ? "Enter at least 5 characters." : "Saved in both the company and folio audit trail."}
              </span>
              <span className="shrink-0 tabular-nums text-ink-faint">{trimmedReason.length}/5 minimum</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3 rounded-b-[24px] border-t border-line bg-mist/45 px-8 py-5">
          <Button variant="ghost" className="flex-1" onClick={onClose}>Cancel</Button>
          <Button variant="danger" className="flex-[1.7]" disabled={!canSubmit} loading={loading} onClick={() => onConfirm({ reason: trimmedReason, payerAction })}>
            Reverse transfer <ArrowRight size={15} />
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
