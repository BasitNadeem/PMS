import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ShieldCheck, AlertCircle } from "lucide-react";
import { cn } from "@/lib/cn";
import { companiesService, pkr } from "@/services/companies";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { bannerMessageFor } from "@/lib/formErrors";
import { Button } from "@/components/ui/Button";
import { RequiredMark } from "@/components/ui/RequiredMark";

const inputCls = "h-10 w-full rounded-xl bg-mist border border-line px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5";

export interface CreditLimitModalProps {
  companyId: string;
  companyName: string;
  /** Paisa. */
  currentLimit: number;
  currentBalance: number;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/**
 * Setting a credit limit is how a hotel decides to lend money, so it lives
 * behind its own permission and its own dialog rather than being one field
 * among many on the edit form.
 */
export function CreditLimitModal({
  companyId, companyName, currentLimit, currentBalance, onClose, onSuccess,
}: CreditLimitModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [limit, setLimit]   = useState(String(currentLimit / 100));
  const [reason, setReason] = useState("");

  const numericLimit = Number(limit) || 0;
  const belowBalance = numericLimit * 100 < currentBalance && currentBalance > 0;

  const mutation = useMutation({
    mutationFn: () => companiesService.setCreditLimit(companyId, numericLimit, reason.trim() || undefined),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      onSuccess(
        numericLimit === 0
          ? "Credit removed. This company's guests must now settle at checkout."
          : `Credit limit set to ${pkr(numericLimit * 100)}.`,
      );
      onClose();
    },
  });

  const errorMessage = bannerMessageFor(mutation.error);

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
            <ShieldCheck size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Credit limit</h2>
            <p className="text-[12px] text-ink-mute mt-0.5 truncate">{companyName}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="scroll-area min-h-0 overflow-y-auto px-6 py-5 space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-mist px-3.5 py-3">
            <span className="text-[13px] text-ink-mute">Currently owes</span>
            <span className="text-[15px] font-semibold text-ink tabular-nums">{pkr(currentBalance)}</span>
          </div>

          <div>
            <label className={labelCls}>Maximum credit (Rs)<RequiredMark /></label>
            <input
              autoFocus type="number" min={0} step="1"
              value={limit}
              onChange={(e) => setLimit(e.target.value)}
              className={cn(inputCls, "tnum")}
            />
            <p className="mt-1.5 text-[12px] text-ink-faint">
              The most this company can owe at any one time. Set to 0 to stop extending credit —
              their guests will then have to settle at checkout.
            </p>
          </div>

          <div>
            <label className={labelCls}>Reason</label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Good payment history, raised for peak season"
              className={inputCls}
            />
            <p className="mt-1.5 text-[12px] text-ink-faint">Recorded in the audit log.</p>
          </div>

          {belowBalance && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-soft border border-amber/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                This is below what the company already owes. Existing debt is unaffected, but no
                new charges can be billed to them until they pay some of it down.
              </p>
            </div>
          )}

          {errorMessage && (
            <div className="flex items-start gap-2 rounded-xl bg-clay/10 border border-clay/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-clay shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">{errorMessage}</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2.5 border-t border-line px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={mutation.isPending} loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save limit
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
