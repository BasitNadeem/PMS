import { useState } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, RotateCcw, X } from "lucide-react";
import { companiesService, pkr } from "@/services/companies";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";

const field = "h-10 w-full rounded-xl border border-line bg-mist px-3 text-[13.5px] text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15";
const label = "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-ink-faint";

export function RefundCompanyCreditModal({ companyId, companyName, available, onClose, onSuccess }: {
  companyId: string; companyName: string; available: number;
  onClose: () => void; onSuccess: (message: string) => void;
}) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [amount, setAmount] = useState(String(available / 100));
  const [method, setMethod] = useState("BANK_TRANSFER");
  const [reference, setReference] = useState("");
  const [reason, setReason] = useState("");
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const numeric = Number(amount) || 0;
  const mutation = useMutation({
    mutationFn: () => companiesService.refundCredit(companyId, {
      amount: numeric, method, reason: reason.trim(), paidAt, idempotencyKey,
      ...(reference.trim() ? { reference: reference.trim() } : {}),
    }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["company", companyId] }),
        qc.invalidateQueries({ queryKey: ["company-ledger", companyId] }),
        qc.invalidateQueries({ queryKey: ["companies"] }),
      ]);
      onSuccess(`${pkr(numeric * 100)} refunded from ${companyName}'s account credit.`);
      onClose();
    },
  });
  const error = mutation.error
    ? ((mutation.error as { response?: { data?: { error?: string } } }).response?.data?.error ?? mutation.error.message)
    : null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-paper shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-line px-6 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-coral/10"><RotateCcw size={18} className="text-coral" /></div>
          <div className="min-w-0 flex-1"><h2 className="serif text-[20px] text-ink">Refund account credit</h2><p className="text-[12px] text-ink-mute">{companyName} has {pkr(available)} available</p></div>
          <button onClick={onClose} className="grid h-9 w-9 place-items-center rounded-full text-ink-mute hover:bg-mist"><X size={18} /></button>
        </div>
        <div className="space-y-4 px-6 py-5">
          <div><label className={label}>Amount (Rs)</label><input autoFocus type="number" min="0.01" max={available / 100} step="0.01" value={amount} onChange={(event) => setAmount(event.target.value)} className={field} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={label}>Method</label><select value={method} onChange={(event) => setMethod(event.target.value)} className={field}><option value="BANK_TRANSFER">Bank transfer</option><option value="CHEQUE">Cheque</option><option value="CASH">Cash</option><option value="JAZZCASH">JazzCash</option><option value="EASYPAISA">Easypaisa</option></select></div>
            <div><label className={label}>Refund date</label><DatePicker value={paidAt} onChange={setPaidAt} max={new Date().toISOString().slice(0, 10)} /></div>
          </div>
          <div><label className={label}>Reference</label><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Transaction / cheque number" className={field} /></div>
          <div><label className={label}>Reason *</label><input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Why this credit is being returned" className={field} /></div>
          {error && <div className="flex gap-2 rounded-xl border border-clay/30 bg-clay/10 px-3 py-2.5 text-[12.5px] text-ink-soft"><AlertCircle size={14} className="mt-0.5 shrink-0 text-clay" />{error}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-6 py-4"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={mutation.isPending} disabled={numeric <= 0 || numeric * 100 > available || reason.trim().length < 3} onClick={() => mutation.mutate()}>Refund credit</Button></div>
      </div>
    </div>, document.body,
  );
}
