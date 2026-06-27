import { useState, useEffect } from "react";
import { X, Package } from "lucide-react";
import { cn } from "../../lib/cn";
import type { CreateInventoryItemDto } from "../../services/inventory";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const CATEGORY_OPTIONS = [
  "Kitchen",
  "Housekeeping Supplies",
  "Minibar",
  "Stationery",
  "Maintenance Supplies",
  "Other",
];

const UNIT_OPTIONS = [
  "kg",
  "grams",
  "liters",
  "ml",
  "units",
  "pieces",
  "bottles",
  "boxes",
  "rolls",
  "pairs",
  "Other",
];

export interface AddItemModalProps {
  onClose:   () => void;
  onSuccess: (data: CreateInventoryItemDto) => Promise<void>;
}

interface FormState {
  name:          string;
  categorySelect: string;
  categoryCustom: string;
  unitSelect:    string;
  unitCustom:    string;
  parLevel:      string;
  reorderLevel:  string;
  costPerUnit:   string;
  supplier:      string;
  openingStock:  string;
  sku:           string;
}

const INITIAL_FORM: FormState = {
  name:           "",
  categorySelect: "",
  categoryCustom: "",
  unitSelect:     "",
  unitCustom:     "",
  parLevel:       "",
  reorderLevel:   "",
  costPerUnit:    "",
  supplier:       "",
  openingStock:   "",
  sku:            "",
};

export function AddItemModal({ onClose, onSuccess }: AddItemModalProps) {
  useEscapeKey(onClose);
  const [form, setForm]         = useState<FormState>(INITIAL_FORM);
  const [reorderTouched, setReorderTouched] = useState(false);
  const [submitting, setSubmitting]         = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const category = form.categorySelect === "Other" ? form.categoryCustom : form.categorySelect;
  const unit     = form.unitSelect     === "Other" ? form.unitCustom     : form.unitSelect;

  // Auto-suggest reorderLevel as 20% of parLevel when parLevel changes,
  // only if user hasn't manually edited reorderLevel yet.
  useEffect(() => {
    if (reorderTouched) return;
    const par = parseFloat(form.parLevel);
    if (!isNaN(par) && par > 0) {
      setForm((prev) => ({
        ...prev,
        reorderLevel: (Math.round(par * 0.2 * 100) / 100).toString(),
      }));
    } else {
      setForm((prev) => ({ ...prev, reorderLevel: "" }));
    }
  }, [form.parLevel, reorderTouched]);

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) { setError("Name is required."); return; }
    if (!category)          { setError("Category is required."); return; }
    if (!unit)              { setError("Unit is required."); return; }

    const dto: CreateInventoryItemDto = {
      name:         form.name.trim(),
      category,
      unit,
      parLevel:     parseFloat(form.parLevel)     || 0,
      reorderLevel: parseFloat(form.reorderLevel) || 0,
      costPerUnit:  parseFloat(form.costPerUnit)  || 0,
      supplier:     form.supplier.trim() || undefined,
      openingStock: parseFloat(form.openingStock) || 0,
      sku:          form.sku.trim() || undefined,
    };

    try {
      setSubmitting(true);
      await onSuccess(dto);
    } catch {
      setError("Failed to create item. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-paper border border-line shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-line shrink-0">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-pine/10 text-pine">
            <Package size={20} />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-ink">Add Inventory Item</h2>
            <p className="text-[12px] text-ink-mute">New item with optional opening stock</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto grid place-items-center h-8 w-8 rounded-full text-ink-mute hover:bg-mist transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form
          id="add-item-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-6 py-4 space-y-4"
        >
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-[13px] text-red-700">
              {error}
            </div>
          )}

          {/* Name */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">
              Item Name <span className="text-clay">*</span>
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Basmati Rice"
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              required
            />
          </div>

          {/* SKU */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">SKU / Code</label>
            <input
              type="text"
              value={form.sku}
              onChange={(e) => set("sku", e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
            />
          </div>

          {/* Category */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">
              Category <span className="text-clay">*</span>
            </label>
            <select
              value={form.categorySelect}
              onChange={(e) => set("categorySelect", e.target.value)}
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              required={form.categorySelect !== "Other"}
            >
              <option value="">Select category…</option>
              {CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            {form.categorySelect === "Other" && (
              <input
                type="text"
                value={form.categoryCustom}
                onChange={(e) => set("categoryCustom", e.target.value)}
                placeholder="Enter category name"
                className="mt-1.5 w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
                required
              />
            )}
          </div>

          {/* Unit */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">
              Unit <span className="text-clay">*</span>
            </label>
            <select
              value={form.unitSelect}
              onChange={(e) => set("unitSelect", e.target.value)}
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              required={form.unitSelect !== "Other"}
            >
              <option value="">Select unit…</option>
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            {form.unitSelect === "Other" && (
              <input
                type="text"
                value={form.unitCustom}
                onChange={(e) => set("unitCustom", e.target.value)}
                placeholder="Enter unit name"
                className="mt-1.5 w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
                required
              />
            )}
          </div>

          {/* Par Level + Reorder Level */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-semibold text-ink-mute">Par Level</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.parLevel}
                onChange={(e) => set("parLevel", e.target.value)}
                placeholder="0"
                className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-semibold text-ink-mute">Reorder Level</label>
              <input
                type="number"
                min="0"
                step="0.001"
                value={form.reorderLevel}
                onChange={(e) => {
                  setReorderTouched(true);
                  set("reorderLevel", e.target.value);
                }}
                placeholder="0"
                className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              />
              {!reorderTouched && form.parLevel && (
                <p className="text-[11px] text-ink-faint">Auto-set to 20% of par level</p>
              )}
            </div>
          </div>

          {/* Cost per unit */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">Cost per Unit (PKR)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.costPerUnit}
              onChange={(e) => set("costPerUnit", e.target.value)}
              placeholder="0.00"
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
            />
          </div>

          {/* Supplier */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">Supplier</label>
            <input
              type="text"
              value={form.supplier}
              onChange={(e) => set("supplier", e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
            />
          </div>

          {/* Opening Stock */}
          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">Opening Stock</label>
            <input
              type="number"
              min="0"
              step="0.001"
              value={form.openingStock}
              onChange={(e) => set("openingStock", e.target.value)}
              placeholder="0"
              className={cn(
                "w-full rounded-xl border bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 transition-colors",
                parseFloat(form.openingStock) > 0
                  ? "border-pine/40 focus:ring-pine/20"
                  : "border-line focus:ring-pine/20 focus:border-pine/40",
              )}
            />
            {parseFloat(form.openingStock) > 0 && (
              <p className="text-[11px] text-pine">
                An Opening Stock transaction will be recorded automatically.
              </p>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-line shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-mist px-5 py-2.5 text-[13.5px] font-semibold text-ink-mute hover:bg-line transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="add-item-form"
            disabled={submitting}
            className="rounded-xl bg-pine px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-pine/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving…" : "Save Item"}
          </button>
        </div>
      </div>
    </div>
  );
}
