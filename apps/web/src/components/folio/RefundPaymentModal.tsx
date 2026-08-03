import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, X } from "lucide-react";
import { folioService } from "@/services/folio";
import { useEscapeKey } from "@/hooks/useEscapeKey";

interface Props {
  reservationId: string;
  paymentId: string;
  refundableAmount: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function RefundPaymentModal({ reservationId, paymentId, refundableAmount, onClose, onSuccess }: Props) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(refundableAmount / 100));
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const amountPaisas = Math.round((Number(amount) || 0) * 100);

  const mutation = useMutation({
    mutationFn: () => folioService.refundPayment(reservationId, paymentId, { amount: amountPaisas, reason: reason.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folio"] });
      qc.invalidateQueries({ queryKey: ["billing-folios"] });
      qc.invalidateQueries({ queryKey: ["billing-summary"] });
      qc.invalidateQueries({ queryKey: ["cashbook"] });
      onSuccess();
      onClose();
    },
    onError: (value) => {
      const response = value as { response?: { data?: { error?: string } } };
      setError(response.response?.data?.error ?? "Refund failed. Please try again.");
    },
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (amountPaisas <= 0 || amountPaisas > refundableAmount) {
      setError(`Enter an amount up to PKR ${(refundableAmount / 100).toLocaleString("en-PK")}.`);
      return;
    }
    if (reason.trim().length < 3) { setError("A refund reason is required for the audit trail."); return; }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4 backdrop-blur-sm">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-paper shadow-2xl">
        <div className="flex items-center gap-3 border-b border-line px-6 py-5">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-clay-soft text-clay"><RotateCcw size={18} /></span>
          <div className="flex-1"><h2 className="serif text-xl text-ink">Refund payment</h2><p className="text-xs text-ink-mute">Creates a matching outgoing Balance Book entry.</p></div>
          <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-mist"><X size={17} /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          {error && <div className="rounded-xl border border-clay/20 bg-clay-soft px-4 py-3 text-sm text-clay">{error}</div>}
          <label className="block text-sm font-semibold text-ink">Amount (PKR)
            <input type="number" min="1" step="1" max={refundableAmount / 100} value={amount} onChange={(e) => setAmount(e.target.value)} className="mt-1.5 w-full rounded-xl border border-line bg-mist px-3.5 py-2.5" />
          </label>
          <label className="block text-sm font-semibold text-ink">Reason
            <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this payment being refunded?" className="mt-1.5 w-full resize-none rounded-xl border border-line bg-mist px-3.5 py-2.5" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-full border border-line px-5 text-sm font-semibold">Cancel</button>
          <button disabled={mutation.isPending} className="h-10 rounded-full bg-clay px-5 text-sm font-semibold text-white disabled:opacity-50">{mutation.isPending ? "Refunding…" : "Confirm refund"}</button>
        </div>
      </form>
    </div>
  );
}
