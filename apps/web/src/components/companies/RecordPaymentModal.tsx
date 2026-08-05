import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Banknote, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/cn";
import { companiesService, pkr } from "@/services/companies";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { bannerMessageFor } from "@/lib/formErrors";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { RequiredMark } from "@/components/ui/RequiredMark";

const inputCls = "h-10 w-full rounded-xl bg-mist border border-line px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
const labelCls = "block text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1.5";

const METHODS = [
  { value: "BANK_TRANSFER", label: "Bank transfer" },
  { value: "CHEQUE",        label: "Cheque"        },
  { value: "CASH",          label: "Cash"          },
  { value: "JAZZCASH",      label: "JazzCash"      },
  { value: "EASYPAISA",     label: "Easypaisa"     },
];

export interface RecordPaymentModalProps {
  companyId: string;
  companyName: string;
  /** Paisa. Used to pre-fill "settle everything" and to warn about overpayment. */
  outstanding: number;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

/**
 * Records money received from a company. The server allocates it across open
 * charges oldest-first, so this form only asks how much arrived and how —
 * not which folios it covers.
 */
export function RecordPaymentModal({
  companyId, companyName, outstanding, onClose, onSuccess,
}: RecordPaymentModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [amount, setAmount]       = useState(outstanding > 0 ? String(outstanding / 100) : "");
  const [method, setMethod]       = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [paidAt, setPaidAt]       = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes]         = useState("");
  const [idempotencyKey]          = useState(() => crypto.randomUUID());

  const numericAmount = Number(amount) || 0;
  const overpaying = numericAmount * 100 > outstanding && outstanding > 0;

  const mutation = useMutation({
    mutationFn: () => companiesService.recordPayment(companyId, {
      amount: numericAmount,
      method,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
      paidAt,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      idempotencyKey,
    }),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["company", companyId] });
      qc.invalidateQueries({ queryKey: ["company-ledger", companyId] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      qc.invalidateQueries({ queryKey: ["companies-aging-summary"] });
      onSuccess(
        result.unapplied > 0
          ? `Payment recorded. ${result.settledCharges} charge${result.settledCharges === 1 ? "" : "s"} settled, ${pkr(result.unapplied)} left as credit.`
          : `Payment recorded against ${result.settledCharges} charge${result.settledCharges === 1 ? "" : "s"}.`,
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
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-sage/15 shrink-0">
            <Banknote size={18} className="text-sage-deep" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Record payment</h2>
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
            <span className="text-[13px] text-ink-mute">Currently outstanding</span>
            <span className="text-[15px] font-semibold text-ink tabular-nums">{pkr(outstanding)}</span>
          </div>

          <div>
            <label className={labelCls}>Amount received (Rs)<RequiredMark /></label>
            <input
              autoFocus type="number" min={0} step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className={cn(inputCls, "tnum")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Method</label>
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={cn(inputCls, "cursor-pointer")}>
                {METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date received</label>
              <DatePicker value={paidAt} onChange={setPaidAt} max={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Reference</label>
            <input
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cheque no. / transaction ID"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} className={inputCls} />
          </div>

          <div className="flex items-start gap-2 rounded-xl bg-mist border border-line-soft px-3 py-2.5">
            <Info size={14} className="text-ink-mute shrink-0 mt-0.5" />
            <p className="text-[12.5px] text-ink-soft">
              This is applied to the oldest unpaid charges first.
            </p>
          </div>

          {overpaying && (
            <div className="flex items-start gap-2 rounded-xl bg-amber-soft border border-amber/30 px-3 py-2.5">
              <AlertCircle size={14} className="text-amber shrink-0 mt-0.5" />
              <p className="text-[12.5px] text-ink-soft">
                That is more than the company owes. The extra {pkr(numericAmount * 100 - outstanding)} will
                sit as a credit against their future stays.
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
          <Button
            disabled={numericAmount <= 0 || mutation.isPending}
            loading={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            Record payment
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
