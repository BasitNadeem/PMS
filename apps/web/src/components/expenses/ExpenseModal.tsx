import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, TrendingDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  expensesService,
  EXPENSE_CATEGORIES,
  CATEGORY_LABELS,
  type Expense,
  type CreateExpenseDto,
  type ExpenseCategory,
} from "@/services/expenses";

const inputCls  = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls  = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";
const selectCls = cn(inputCls, "cursor-pointer");

const PAYMENT_METHODS = [
  { value: "CASH",          label: "Cash" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
  { value: "CHEQUE",        label: "Cheque" },
  { value: "ONLINE",        label: "Online" },
];

interface ExpenseModalProps {
  mode:     "add" | "edit";
  expense?: Expense;
  onClose:  () => void;
  onSuccess: (message: string) => void;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function ExpenseModal({ mode, expense, onClose, onSuccess }: ExpenseModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [date,          setDate]          = useState(expense?.date?.slice(0, 10)      ?? todayIso());
  const [category,      setCategory]      = useState<ExpenseCategory>(
    (expense?.category as ExpenseCategory) ?? "UTILITIES"
  );
  const [description,   setDescription]   = useState(expense?.description  ?? "");
  const [amountInput,   setAmountInput]    = useState(expense ? String(Math.floor(expense.amount / 100)) : "");
  const [paymentMethod, setPaymentMethod]  = useState(expense?.payment_method ?? "CASH");
  const [paidTo,        setPaidTo]         = useState(expense?.paid_to        ?? "");
  const [receiptRef,    setReceiptRef]     = useState(expense?.receipt_ref    ?? "");
  const [notes,         setNotes]          = useState(expense?.notes          ?? "");
  const [error,         setError]          = useState<string | null>(null);

  const amountPaisas   = amountInput ? Math.round(parseFloat(amountInput) * 100) : 0;
  const amountPreview  = amountInput && !isNaN(parseFloat(amountInput))
    ? `= PKR ${Math.floor(parseFloat(amountInput)).toLocaleString("en-PK")}`
    : "";

  const mutation = useMutation({
    mutationFn: () => {
      const dto: CreateExpenseDto = {
        date, category, description: description.trim(),
        amount: amountPaisas,
        paymentMethod, paidTo: paidTo.trim(),
        receiptRef: receiptRef.trim() || undefined,
        notes:      notes.trim()      || undefined,
      };
      return mode === "add"
        ? expensesService.createExpense(dto)
        : expensesService.updateExpense(expense!.id, dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["expenses"] });
      qc.invalidateQueries({ queryKey: ["expenses-summary"] });
      onSuccess(mode === "add" ? "Expense recorded" : "Expense updated");
      onClose();
    },
    onError: () => setError("Failed to save expense. Please try again."),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim())                  { setError("Description is required"); return; }
    if (!paidTo.trim())                        { setError("Paid To is required"); return; }
    const amt = parseFloat(amountInput);
    if (isNaN(amt) || amt <= 0)                { setError("Enter a valid amount"); return; }
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-lg flex flex-col max-h-[92vh] anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line flex-shrink-0">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-clay-soft shrink-0">
            <TrendingDown size={18} className="text-clay" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">
              {mode === "add" ? "Record Expense" : "Edit Expense"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-4">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Date <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Category <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
              <select value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategory)} className={selectCls}>
                {EXPENSE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Description <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
            <input
              type="text" value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Electricity bill for May"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Paid To <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
            <input
              type="text" value={paidTo}
              onChange={(e) => setPaidTo(e.target.value)}
              placeholder="e.g. LESCO, Ali Khan, ABC Suppliers"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Amount (PKR) <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
            <input
              type="number" value={amountInput} min="1" step="1"
              onChange={(e) => setAmountInput(e.target.value)}
              placeholder="0"
              className={inputCls}
            />
            {amountPreview && (
              <p className="mt-1 text-[12px] font-semibold text-coral tnum">{amountPreview}</p>
            )}
          </div>

          <div>
            <label className={labelCls}>Payment Method</label>
            <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={selectCls}>
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>Receipt / Invoice Ref <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <input
              type="text" value={receiptRef}
              onChange={(e) => setReceiptRef(e.target.value)}
              placeholder="e.g. INV-2026-0042"
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Notes <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <textarea
              rows={3} value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(inputCls, "resize-none")}
            />
          </div>
        </form>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 pb-6 pt-4 border-t border-line flex-shrink-0">
          <button
            type="button" onClick={onClose}
            className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit as unknown as React.MouseEventHandler}
            disabled={mutation.isPending}
            className="h-10 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? "Saving…" : mode === "add" ? "Record Expense" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
