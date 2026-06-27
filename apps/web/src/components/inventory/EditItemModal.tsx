import { useState } from "react";
import { X, Package } from "lucide-react";
import type { InventoryItem, UpdateInventoryItemDto } from "../../services/inventory";
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

function isKnownCategory(c: string) { return CATEGORY_OPTIONS.includes(c); }
function isKnownUnit(u: string)     { return UNIT_OPTIONS.includes(u); }

export interface EditItemModalProps {
  item:      InventoryItem;
  onClose:   () => void;
  onSuccess: (id: string, data: UpdateInventoryItemDto) => Promise<void>;
}

export function EditItemModal({ item, onClose, onSuccess }: EditItemModalProps) {
  useEscapeKey(onClose);
  const [name,           setName]           = useState(item.name);
  const [sku,            setSku]            = useState(item.sku ?? "");
  const [categorySelect, setCategorySelect] = useState(
    isKnownCategory(item.category) ? item.category : "Other"
  );
  const [categoryCustom, setCategoryCustom] = useState(
    isKnownCategory(item.category) ? "" : item.category
  );
  const [unitSelect, setUnitSelect] = useState(
    isKnownUnit(item.unit) ? item.unit : "Other"
  );
  const [unitCustom, setUnitCustom] = useState(
    isKnownUnit(item.unit) ? "" : item.unit
  );
  const [parLevel,     setParLevel]     = useState(item.parLevel.toString());
  const [reorderLevel, setReorderLevel] = useState(item.reorderLevel.toString());
  const [costPerUnit,  setCostPerUnit]  = useState((item.costPerUnit / 100).toString());
  const [supplier,     setSupplier]     = useState(item.supplier ?? "");
  const [submitting,   setSubmitting]   = useState(false);
  const [error,        setError]        = useState<string | null>(null);

  const category = categorySelect === "Other" ? categoryCustom : categorySelect;
  const unit     = unitSelect     === "Other" ? unitCustom     : unitSelect;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) { setError("Name is required."); return; }
    if (!category)    { setError("Category is required."); return; }
    if (!unit)        { setError("Unit is required."); return; }

    const dto: UpdateInventoryItemDto = {
      name:         name.trim(),
      category,
      unit,
      parLevel:     parseFloat(parLevel)     || 0,
      reorderLevel: parseFloat(reorderLevel) || 0,
      costPerUnit:  parseFloat(costPerUnit)  || 0,
      supplier:     supplier.trim() || undefined,
      sku:          sku.trim() || undefined,
    };

    try {
      setSubmitting(true);
      await onSuccess(item.id, dto);
    } catch {
      setError("Failed to update item. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-paper border border-line shadow-2xl flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-line shrink-0">
          <span className="grid place-items-center h-10 w-10 rounded-xl bg-pine/10 text-pine">
            <Package size={20} />
          </span>
          <div>
            <h2 className="text-[17px] font-bold text-ink">Edit Item</h2>
            <p className="text-[12px] text-ink-mute">{item.name}</p>
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
          id="edit-item-form"
          onSubmit={handleSubmit}
          className="overflow-y-auto flex-1 px-6 py-4 space-y-4"
        >
          {error && (
            <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-[13px] text-red-700">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">Item Name <span className="text-clay">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              required
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">SKU / Code</label>
            <input
              type="text"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">Category <span className="text-clay">*</span></label>
            <select
              value={categorySelect}
              onChange={(e) => setCategorySelect(e.target.value)}
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
            >
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {categorySelect === "Other" && (
              <input
                type="text"
                value={categoryCustom}
                onChange={(e) => setCategoryCustom(e.target.value)}
                placeholder="Enter category name"
                className="mt-1.5 w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
                required
              />
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">Unit <span className="text-clay">*</span></label>
            <select
              value={unitSelect}
              onChange={(e) => setUnitSelect(e.target.value)}
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
            >
              {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u}</option>)}
            </select>
            {unitSelect === "Other" && (
              <input
                type="text"
                value={unitCustom}
                onChange={(e) => setUnitCustom(e.target.value)}
                placeholder="Enter unit name"
                className="mt-1.5 w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
                required
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-semibold text-ink-mute">Par Level</label>
              <input
                type="number" min="0" step="0.001"
                value={parLevel} onChange={(e) => setParLevel(e.target.value)}
                className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[13px] font-semibold text-ink-mute">Reorder Level</label>
              <input
                type="number" min="0" step="0.001"
                value={reorderLevel} onChange={(e) => setReorderLevel(e.target.value)}
                className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">Cost per Unit (PKR)</label>
            <input
              type="number" min="0" step="0.01"
              value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)}
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[13px] font-semibold text-ink-mute">Supplier</label>
            <input
              type="text"
              value={supplier} onChange={(e) => setSupplier(e.target.value)}
              placeholder="Optional"
              className="w-full rounded-xl border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
            />
          </div>
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
            type="submit" form="edit-item-form" disabled={submitting}
            className="rounded-xl bg-pine px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-pine/90 disabled:opacity-50 transition-colors"
          >
            {submitting ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
