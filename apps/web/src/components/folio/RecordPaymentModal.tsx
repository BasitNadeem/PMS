import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Banknote } from "lucide-react";
import { cn } from "@/lib/cn";
import { folioService, type PaymentMethod } from "@/services/folio";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const PAYMENT_METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH",            label: "Cash" },
  { value: "JAZZCASH",        label: "JazzCash" },
  { value: "EASYPAISA",       label: "EasyPaisa" },
  { value: "CREDIT_CARD",     label: "Credit Card" },
  { value: "DEBIT_CARD",      label: "Debit Card" },
  { value: "BANK_TRANSFER",   label: "Bank Transfer" },
  { value: "CHEQUE",          label: "Cheque" },
  { value: "ADVANCE_DEPOSIT", label: "Advance Deposit" },
  { value: "OTA_COLLECT",     label: "OTA Collect" },
  { value: "COMPLIMENTARY",   label: "Complimentary" },
];

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

interface RecordPaymentModalProps {
  reservationId: string;
  balanceDue: number;
  onClose: () => void;
}

export function RecordPaymentModal({ reservationId, balanceDue, onClose }: RecordPaymentModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [amount,         setAmount]         = useState(String(balanceDue / 100));
  const [method,         setMethod]         = useState<PaymentMethod>("CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [notes,          setNotes]          = useState("");
  const [error,          setError]          = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      folioService.addPayment(reservationId, {
        amount:         Math.round(parseFloat(amount) * 100),
        method,
        transactionRef: transactionRef.trim() || undefined,
        notes:          notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folio", reservationId] });
      qc.invalidateQueries({ queryKey: ["billing-folios"] });
      qc.invalidateQueries({ queryKey: ["billing-summary"] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to record payment");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const amountNum = parseFloat(amount);
    if (!amount || amountNum <= 0) return setError("Amount must be greater than 0");
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-pine-soft shrink-0">
            <Banknote size={18} className="text-pine-deep" />
          </div>
          <div className="flex-1">
            <h2 className="serif text-[20px] text-ink leading-tight">Record Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Balance due banner */}
          <div className="rounded-xl bg-mist border border-line-soft px-4 py-3 flex items-center justify-between">
            <span className="text-[13px] text-ink-mute font-medium">Balance due</span>
            <span className={cn(
              "text-[14px] font-semibold tnum",
              balanceDue > 0 ? "text-clay" : "text-pine",
            )}>
              PKR {(balanceDue / 100).toLocaleString("en-PK")}
            </span>
          </div>

          {/* Amount */}
          <div>
            <label className={labelCls}>Amount (PKR) <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
            <input
              type="number" min="0" step="0.01"
              value={amount} onChange={(e) => setAmount(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Payment Method */}
          <div>
            <label className={labelCls}>Payment Method</label>
            <select
              value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              className={cn(inputCls, "cursor-pointer")}
            >
              {PAYMENT_METHOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Reference */}
          <div>
            <label className={labelCls}>Reference Number <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <input
              type="text" value={transactionRef}
              onChange={(e) => setTransactionRef(e.target.value)}
              placeholder="e.g. JazzCash transaction ID"
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <textarea
              value={notes} onChange={(e) => setNotes(e.target.value)}
              rows={2} placeholder="Internal note"
              className={cn(inputCls, "resize-none")}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2.5 pt-1">
            <button
              type="button" onClick={onClose}
              className="flex-1 h-10 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={mutation.isPending}
              className={cn(
                "flex-1 h-10 rounded-full bg-pine text-white text-[13.5px] font-semibold shadow-pop transition-colors",
                mutation.isPending ? "opacity-50 cursor-not-allowed" : "hover:bg-pine-deep",
              )}
            >
              {mutation.isPending ? "Recording…" : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
