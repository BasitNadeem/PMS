import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import { posService, type PosCategory } from "@/services/pos";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export interface EditCategoryModalProps {
  category: PosCategory;
  onClose:  () => void;
}

const inputClass = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelClass = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

function VisibilityToggle({
  checked, onChange, label, on, off,
}: { checked: boolean; onChange: (v: boolean) => void; label: string; on: string; off: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[13.5px] font-medium text-ink-soft">{label}</span>
      <div className="flex items-center gap-2.5">
        <span className="text-[12px] text-ink-faint w-16 text-right">{checked ? on : off}</span>
        <button
          type="button"
          onClick={() => onChange(!checked)}
          className={cn(
            "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
            checked ? "bg-pine" : "bg-line-soft",
          )}
        >
          <span className={cn(
            "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
            checked ? "translate-x-5" : "translate-x-0.5",
          )} />
        </button>
      </div>
    </div>
  );
}

export function EditCategoryModal({ category, onClose }: EditCategoryModalProps) {
  useEscapeKey(onClose);
  const qc      = useQueryClient();
  const [name,        setName]        = useState(category.name);
  const [sort,         setSort]         = useState(String(category.sortOrder));
  const [isActive,     setIsActive]     = useState(category.isActive);
  const [isQrVisible,  setIsQrVisible]  = useState(category.isQrVisible);
  const [availableFrom,  setAvailableFrom]  = useState(category.availableFrom ?? "");
  const [availableUntil, setAvailableUntil] = useState(category.availableUntil ?? "");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => posService.updateCategory(category.id, {
      name: name.trim(),
      sortOrder: parseInt(sort, 10) || 0,
      isActive,
      isQrVisible,
      availableFrom:  availableFrom || null,
      availableUntil: availableUntil || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-categories-admin"] });
      qc.invalidateQueries({ queryKey: ["pos-categories"] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to update category");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-sm anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-mist shrink-0">
            <LayoutGrid size={18} className="text-ink-soft" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Edit Category</h2>
            <p className="text-[12px] text-ink-mute mt-0.5">{category.name}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form
          onSubmit={(e) => { e.preventDefault(); setError(null); mutation.mutate(); }}
          className="px-6 py-5 space-y-4"
        >
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              {error}
            </div>
          )}
          <div>
            <label className={labelClass}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Sort Order</label>
            <input type="number" value={sort} onChange={(e) => setSort(e.target.value)} min="0" className={inputClass} />
          </div>

          <div className="border-t border-line pt-4 space-y-3">
            <VisibilityToggle
              label="Show on POS terminal"
              checked={isActive}
              onChange={setIsActive}
              on="Visible"
              off="Hidden"
            />
            <VisibilityToggle
              label="Show on QR menu"
              checked={isQrVisible}
              onChange={setIsQrVisible}
              on="Visible"
              off="Hidden"
            />
          </div>

          <div className="border-t border-line pt-4">
            <p className="text-[12px] text-ink-mute mb-2.5">
              Limit when this category appears on the QR menu (e.g. breakfast only). Leave blank for always available.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>From</label>
                <input
                  type="time"
                  value={availableFrom}
                  onChange={(e) => setAvailableFrom(e.target.value)}
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Until</label>
                <input
                  type="time"
                  value={availableUntil}
                  onChange={(e) => setAvailableUntil(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-5 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="h-10 px-5 rounded-full bg-ink text-white text-[13.5px] font-semibold hover:bg-ink/90 shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
