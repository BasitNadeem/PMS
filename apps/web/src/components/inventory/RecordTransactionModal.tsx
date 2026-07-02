import { useState } from "react";
import { X, ArrowUp, ArrowDown } from "lucide-react";
import { cn } from "../../lib/cn";
import type { CreateTransactionDto } from "../../services/inventory";
import { useEscapeKey } from "@/hooks/useEscapeKey";

type TransactionType = "PURCHASE" | "CONSUMPTION" | "WASTE" | "ADJUSTMENT";

const TYPE_OPTIONS: { value: TransactionType; label: string; isAddition: boolean }[] = [
  { value: "PURCHASE",    label: "Purchase",    isAddition: true  },
  { value: "CONSUMPTION", label: "Consumption", isAddition: false },
  { value: "WASTE",       label: "Waste",       isAddition: false },
  { value: "ADJUSTMENT",  label: "Adjustment",  isAddition: true  },
];

export interface RecordTransactionModalProps {
  itemId:       string;
  itemName:     string;
  currentStock: number;
  unit:         string;
  initialType:  TransactionType;
  onClose:      () => void;
  onSuccess:    () => void;
  onSubmit:     (itemId: string, data: CreateTransactionDto) => Promise<void>;
}

export function RecordTransactionModal({
  itemId,
  itemName,
  currentStock,
  unit,
  initialType,
  onClose,
  onSuccess,
  onSubmit,
}: RecordTransactionModalProps) {
  useEscapeKey(onClose);
  const [type,      setType]      = useState<TransactionType>(initialType);
  const [quantity,  setQuantity]  = useState("");
  const [unitCost,  setUnitCost]  = useState("");
  const [notes,     setNotes]     = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]     = useState<string | null>(null);

  const typeInfo = TYPE_OPTIONS.find((t) => t.value === type)!;
  const qty      = parseFloat(quantity) || 0;
  const stockAfter = typeInfo.isAddition
    ? currentStock + qty
    : currentStock - qty;

  const wouldGoNegative = !typeInfo.isAddition && stockAfter < 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (qty <= 0) { setError("Quantity must be greater than 0."); return; }

    const dto: CreateTransactionDto = {
      type,
      quantity: qty,
      unitCost: unitCost ? parseFloat(unitCost) : undefined,
      notes:    notes.trim() || undefined,
    };

    try {
      setSubmitting(true);
      await onSubmit(itemId, dto);
      onSuccess();
    } catch {
      setError("Failed to record transaction. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-paper border border-line shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-line shrink-0">
          <div>
            <h2 className="text-[17px] font-bold text-ink">Record Transaction</h2>
            <p className="text-[12px] text-ink-mute truncate max-w-[280px]">{itemName}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-8 w-8 rounded-full text-ink-mute hover:bg-mist transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form
          id="txn-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-6 py-4 space-y-4"
        >
          {/* Current stock context */}
          <div className="rounded-xl bg-mist border border-line px-4 py-3 flex items-center justify-between">
            <span className="text-[13px] text-ink-mute font-semibold">Current Stock</span>
            <span className="text-[15px] font-bold text-ink">
              {currentStock} <span className="text-[12px] text-ink-faint font-normal">{unit}</span>
            </span>
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-[13px] text-red-700">
              {error}
            </div>
          )}

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-ink-mute">Transaction Type</label>
            <div className="grid grid-cols-2 gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={cn(
                    "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors",
                    type === opt.value
                      ? opt.isAddition
                        ? "border-pine bg-pine/10 text-pine"
                        : "border-amber bg-amber/10 text-amber"
                      : "border-line text-ink-mute hover:bg-mist",
                  )}
                >
                  {opt.isAddition
                    ? <ArrowUp size={14} />
                    : <ArrowDown size={14} />
                  }
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quantity */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">
              Quantity ({unit}) <span className="text-clay text-[15px] font-bold leading-none">*</span>
            </label>
            <input
              type="number"
              min="0.001"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              required
            />
          </div>

          {/* Unit cost — only for PURCHASE */}
          {type === "PURCHASE" && (
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-semibold text-ink-mute">Unit Cost (PKR)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={unitCost}
                onChange={(e) => setUnitCost(e.target.value)}
                placeholder="Optional"
                className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              />
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors resize-none"
            />
          </div>

          {/* Live preview */}
          {qty > 0 && (
            <div className={cn(
              "rounded-xl border px-4 py-3",
              wouldGoNegative
                ? "bg-amber/5 border-amber/30"
                : typeInfo.isAddition
                  ? "bg-pine/5 border-pine/20"
                  : "bg-mist border-line",
            )}>
              <div className="flex items-center justify-between">
                <span className="text-[13px] text-ink-mute font-semibold">Stock after</span>
                <span className={cn(
                  "text-[15px] font-bold",
                  wouldGoNegative ? "text-amber" : typeInfo.isAddition ? "text-pine" : "text-ink",
                )}>
                  {stockAfter.toFixed(3)} <span className="text-[12px] font-normal text-ink-faint">{unit}</span>
                </span>
              </div>
              {wouldGoNegative && (
                <p className="mt-1 text-[12px] text-amber font-medium">
                  Warning: This will result in negative stock.
                </p>
              )}
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line shrink-0">
          <button
            type="button" onClick={onClose}
            className="rounded-xl border border-line bg-mist px-5 py-2.5 text-[13.5px] font-semibold text-ink-mute hover:bg-line transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit" form="txn-form" disabled={submitting}
            className="rounded-xl bg-pine px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-pine/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Recording…" : "Record"}
          </button>
        </div>
      </div>
    </div>
  );
}
