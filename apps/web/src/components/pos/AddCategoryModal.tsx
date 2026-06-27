import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/cn";
import { posService } from "@/services/pos";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export interface AddCategoryModalProps {
  onClose: () => void;
}

const inputClass = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelClass = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

export function AddCategoryModal({ onClose }: AddCategoryModalProps) {
  useEscapeKey(onClose);
  const qc      = useQueryClient();
  const [name,  setName]  = useState("");
  const [sort,  setSort]  = useState("0");
  const [qrVisible, setQrVisible] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => posService.createCategory({ name: name.trim(), sortOrder: parseInt(sort, 10) || 0, isQrVisible: qrVisible }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-categories-admin"] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to create category");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-sm anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-coral-soft shrink-0">
            <LayoutGrid size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Add Category</h2>
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
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) { setError("Name is required"); return; }
            setError(null);
            mutation.mutate();
          }}
          className="px-6 py-5 space-y-4"
        >
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              {error}
            </div>
          )}
          <div>
            <label className={labelClass}>Name <span className="text-coral normal-case tracking-normal">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beverages"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Sort Order</label>
            <input
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              min="0"
              className={inputClass}
            />
          </div>

          {/* QR visibility toggle */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQrVisible((v) => !v)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
                qrVisible ? "bg-coral" : "bg-line-soft",
              )}
            >
              <span className={cn(
                "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                qrVisible ? "translate-x-5" : "translate-x-0.5",
              )} />
            </button>
            <span className="text-[13.5px] font-medium text-ink-soft">{qrVisible ? "Shown on QR menu" : "Hidden from QR menu"}</span>
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
              className="h-10 px-5 rounded-full bg-coral text-white text-[13.5px] font-semibold hover:bg-coral-dark shadow-pop transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Adding…" : "Add Category"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
