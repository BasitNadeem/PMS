import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Receipt } from "lucide-react";
import { cn } from "@/lib/cn";
import { folioService, type FolioItemType } from "@/services/folio";
import { useEscapeKey } from "@/hooks/useEscapeKey";

const ITEM_TYPE_OPTIONS: { value: FolioItemType; label: string }[] = [
  { value: "ROOM_CHARGE",   label: "Room Charge" },
  { value: "FOOD_BEVERAGE", label: "Food & Beverage" },
  { value: "LAUNDRY",       label: "Laundry" },
  { value: "TRANSPORT",     label: "Transport" },
  { value: "SPA",           label: "Spa" },
  { value: "MINIBAR",       label: "Minibar" },
  { value: "INTERNET",      label: "Internet" },
  { value: "TELEPHONE",     label: "Telephone" },
  { value: "TAX",           label: "Tax" },
  { value: "DISCOUNT",      label: "Discount" },
  { value: "DAMAGE_CHARGE", label: "Damage Charge" },
  { value: "MISCELLANEOUS", label: "Other" },
];

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

interface AddChargeModalProps { reservationId: string; onClose: () => void }

export function AddChargeModal({ reservationId, onClose }: AddChargeModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [type,        setType]        = useState<FolioItemType>("ROOM_CHARGE");
  const [unitPrice,   setUnitPrice]   = useState("");
  const [quantity,    setQuantity]    = useState("1");
  const [notes,       setNotes]       = useState("");
  const [error,       setError]       = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () =>
      folioService.addFolioItem(reservationId, {
        description,
        type,
        unitAmount: Math.round(parseFloat(unitPrice) * 100),
        quantity:   parseInt(quantity, 10),
        notes:      notes.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["folio", reservationId] });
      onClose();
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to add charge");
    },
  });

  const unitPriceNum = parseFloat(unitPrice) || 0;
  const qtyNum       = parseInt(quantity, 10) || 1;
  const total        = unitPriceNum * qtyNum;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!description.trim())                         return setError("Description is required");
    if (!unitPrice || parseFloat(unitPrice) <= 0)    return setError("Unit price must be greater than 0");
    if (!quantity  || parseInt(quantity, 10) < 1)    return setError("Quantity must be at least 1");
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-coral-soft shrink-0">
            <Receipt size={18} className="text-coral" />
          </div>
          <div className="flex-1"><h2 className="serif text-[20px] text-ink leading-tight">Add Charge</h2></div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">{error}</div>
          )}

          <div>
            <label className={labelCls}>Description <span className="text-coral normal-case tracking-normal">*</span></label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Room charge — Night 1" className={inputCls} />
          </div>

          <div>
            <label className={labelCls}>Item Type</label>
            <select value={type} onChange={(e) => setType(e.target.value as FolioItemType)} className={cn(inputCls, "cursor-pointer")}>
              {ITEM_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Unit Price (PKR) <span className="text-coral normal-case tracking-normal">*</span></label>
              <input type="number" min="0" step="0.01" value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Quantity</label>
              <input type="number" min="1" step="1" value={quantity}
                onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
            </div>
          </div>

          {unitPriceNum > 0 && (
            <div className="rounded-xl bg-mist border border-line-soft px-4 py-2.5 flex items-center justify-between">
              <span className="text-[13px] text-ink-soft font-medium">Total</span>
              <span className="serif text-[18px] text-ink tnum">
                PKR {total.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div>
            <label className={labelCls}>Notes <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note" className={inputCls} />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose} className="flex-1 h-10 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className={cn(
              "flex-1 h-10 rounded-full bg-coral text-white text-[13.5px] font-semibold shadow-pop transition-colors",
              mutation.isPending ? "opacity-50 cursor-not-allowed" : "hover:bg-coral-dark",
            )}>
              {mutation.isPending ? "Adding…" : "Add Charge"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
