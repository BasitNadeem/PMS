import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, UtensilsCrossed, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { posService, type PosCategory } from "@/services/pos";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export interface AddItemModalProps {
  category: PosCategory;
  onClose:  () => void;
}

const inputClass = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelClass = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

export function AddItemModal({ category, onClose }: AddItemModalProps) {
  useEscapeKey(onClose);
  const qc           = useQueryClient();
  const [name,  setName]  = useState("");
  const [desc,  setDesc]  = useState("");
  const [price, setPrice] = useState("");
  const [avail, setAvail] = useState(true);
  const [qrVisible, setQrVisible] = useState(true);
  const [featured,  setFeatured]  = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      posService.createItem(category.id, {
        name:        name.trim(),
        description: desc.trim() || undefined,
        price:       Math.round(parseFloat(price) * 100),
        categoryId:  category.id,
        isAvailable: avail,
        isQrVisible: qrVisible,
        isFeatured:  featured,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-categories-admin"] });
      qc.invalidateQueries({ queryKey: ["pos-categories"] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to add item");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim())       { setError("Name is required"); return; }
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) { setError("Enter a valid price"); return; }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-sm anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-coral-soft shrink-0">
            <UtensilsCrossed size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Add Item</h2>
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
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
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
              placeholder="e.g. Chicken Karahi"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Description <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <input
              type="text"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="Short description"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Price (PKR) <span className="text-coral normal-case tracking-normal">*</span></label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0"
              min="0"
              step="1"
              className={inputClass}
            />
          </div>
          {/* Available toggle */}
          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => setAvail((v) => !v)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
                avail ? "bg-pine" : "bg-line-soft",
              )}
            >
              <span className={cn(
                "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                avail ? "translate-x-5" : "translate-x-0.5",
              )} />
            </button>
            <span className="text-[13.5px] font-medium text-ink-soft">{avail ? "Available on POS" : "Unavailable on POS"}</span>
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

          {/* Featured toggle */}
          <div className="flex items-center justify-between rounded-xl border border-line bg-mist px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <Star size={15} className={featured ? "text-amber fill-amber" : "text-ink-faint"} />
              <span className="text-[13.5px] font-medium text-ink-soft">Featured on QR menu</span>
            </div>
            <button
              type="button"
              onClick={() => setFeatured((v) => !v)}
              className={cn(
                "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
                featured ? "bg-amber" : "bg-line-soft",
              )}
            >
              <span className={cn(
                "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                featured ? "translate-x-5" : "translate-x-0.5",
              )} />
            </button>
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
              {mutation.isPending ? "Adding…" : "Add Item"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
