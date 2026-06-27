import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { cashbookService, type EntryType } from "@/services/cashbook";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH",          label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "JAZZCASH",      label: "JazzCash" },
  { value: "EASYPAISA",     label: "Easypaisa" },
  { value: "CREDIT_CARD",   label: "Card" },
  { value: "OTHER",         label: "Other" },
];

function todayIso() { return new Date().toISOString().slice(0, 10); }

export interface RecordEntryModalProps {
  onClose:   () => void;
  onSuccess: (msg: string) => void;
}

export function RecordEntryModal({ onClose, onSuccess }: RecordEntryModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [entryType,     setEntryType]     = useState<EntryType>("INCOMING");
  const [amountInput,   setAmountInput]   = useState("");
  const [description,   setDescription]   = useState("");
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [entryDate,     setEntryDate]     = useState(todayIso());
  const [notes,         setNotes]         = useState("");
  const [error,         setError]         = useState<string | null>(null);

  const amountNum     = parseFloat(amountInput) || 0;
  const amountPaisas  = Math.round(amountNum * 100);
  const amountPreview = amountNum > 0 ? `PKR ${Math.floor(amountNum).toLocaleString("en-PK")}` : "";

  const mutation = useMutation({
    mutationFn: () => cashbookService.createEntry({
      entryType,
      amount:        amountPaisas,
      description:   description.trim(),
      paymentMethod,
      entryDate,
      notes:         notes.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cashbook"] });
      const label = `PKR ${Math.floor(amountNum).toLocaleString("en-PK")}`;
      onSuccess(`${label} recorded as ${entryType === "INCOMING" ? "incoming" : "outgoing"}`);
      onClose();
    },
    onError: () => setError("Failed to record entry. Please try again."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (amountNum <= 0)      { setError("Enter a valid amount"); return; }
    if (!description.trim()) { setError("Description is required"); return; }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md flex flex-col max-h-[92vh] anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line flex-shrink-0">
          <div className={cn("grid place-items-center h-10 w-10 rounded-xl shrink-0",
            entryType === "INCOMING" ? "bg-pine-soft" : "bg-clay-soft")}>
            {entryType === "INCOMING"
              ? <ArrowDownLeft size={18} className="text-pine-deep" />
              : <ArrowUpRight  size={18} className="text-clay" />}
          </div>
          <h2 className="flex-1 serif text-[20px] text-ink leading-tight">Record Entry</h2>
          <button onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-4">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Direction toggle */}
          <div>
            <label className={labelCls}>Direction</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setEntryType("INCOMING")}
                className={cn("h-11 rounded-xl text-[14px] font-semibold transition-all flex items-center justify-center gap-2",
                  entryType === "INCOMING" ? "bg-pine text-white shadow-pop" : "border border-line text-ink-mute hover:bg-mist")}>
                <ArrowDownLeft size={16} /> Incoming
              </button>
              <button type="button" onClick={() => setEntryType("OUTGOING")}
                className={cn("h-11 rounded-xl text-[14px] font-semibold transition-all flex items-center justify-center gap-2",
                  entryType === "OUTGOING" ? "bg-clay text-white shadow-pop" : "border border-line text-ink-mute hover:bg-mist")}>
                <ArrowUpRight size={16} /> Outgoing
              </button>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className={labelCls}>
              Amount (PKR) <span className="text-coral normal-case tracking-normal">*</span>
            </label>
            <input type="number" min="1" step="1" value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0" className={inputCls} />
            {amountPreview && (
              <p className={cn("mt-1.5 text-[13px] font-semibold tnum",
                entryType === "INCOMING" ? "text-pine" : "text-clay")}>
                {amountPreview}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>
              Description <span className="text-coral normal-case tracking-normal">*</span>
            </label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder={entryType === "INCOMING"
                ? "e.g. Cash received, Bank deposit..."
                : "e.g. Cash to bank, Petty cash expense..."}
              className={inputCls} />
          </div>

          {/* Payment Method */}
          <div>
            <label className={labelCls}>Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}
              className={cn(inputCls, "cursor-pointer")}>
              {PAYMENT_METHOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Date */}
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
              className={inputCls} />
          </div>

          {/* Notes */}
          <div>
            <label className={labelCls}>
              Notes <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span>
            </label>
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
              className={cn(inputCls, "resize-none")} />
          </div>
        </form>

        <div className="flex justify-end gap-2.5 px-6 pb-6 pt-4 border-t border-line flex-shrink-0">
          <button type="button" onClick={onClose}
            className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
            Cancel
          </button>
          <button onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={mutation.isPending}
            className={cn("h-10 px-5 rounded-full text-white text-[13.5px] font-semibold shadow-pop transition-colors disabled:opacity-50",
              entryType === "INCOMING" ? "bg-pine hover:bg-pine-deep" : "bg-clay hover:bg-clay/90")}>
            {mutation.isPending ? "Saving…" : "Record Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}
