import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  X, Receipt, UtensilsCrossed, Waves, GlassWater, Car,
  Sparkles, AlertTriangle, Tag, BedDouble, Wifi, Phone,
  Percent, Package,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { folioService, type FolioItemType } from "@/services/folio";
import { useEscapeKey } from "@/hooks/useEscapeKey";

// ── Type tile config ──────────────────────────────────────────────────────────

interface TypeTile {
  value:       FolioItemType;
  label:       string;
  icon:        React.ElementType;
  defaultDesc: string;
}

const TYPE_TILES: TypeTile[] = [
  { value: "FOOD_BEVERAGE", label: "F&B",       icon: UtensilsCrossed, defaultDesc: "Food & Beverage" },
  { value: "LAUNDRY",       label: "Laundry",   icon: Waves,           defaultDesc: "Laundry service" },
  { value: "MINIBAR",       label: "Minibar",   icon: GlassWater,      defaultDesc: "Minibar items" },
  { value: "TRANSPORT",     label: "Transport", icon: Car,             defaultDesc: "Transport service" },
  { value: "SPA",           label: "Spa",       icon: Sparkles,        defaultDesc: "Spa treatment" },
  { value: "DAMAGE_CHARGE", label: "Damage",    icon: AlertTriangle,   defaultDesc: "Damage charge" },
  { value: "DISCOUNT",      label: "Discount",  icon: Tag,             defaultDesc: "Discount" },
  { value: "ROOM_CHARGE",   label: "Room",      icon: BedDouble,       defaultDesc: "Room charge" },
  { value: "INTERNET",      label: "Internet",  icon: Wifi,            defaultDesc: "Internet service" },
  { value: "TELEPHONE",     label: "Phone",     icon: Phone,           defaultDesc: "Telephone call" },
  { value: "TAX",           label: "Tax",       icon: Percent,         defaultDesc: "Tax" },
  { value: "MISCELLANEOUS", label: "Other",     icon: Package,         defaultDesc: "" },
];

// All auto-fill values — used to detect if description was auto-set (so we can replace it on type change)
const AUTO_DESCS = new Set(TYPE_TILES.map((t) => t.defaultDesc).filter(Boolean));

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

// ── Component ─────────────────────────────────────────────────────────────────

interface AddChargeModalProps { reservationId: string; onClose: () => void }

export function AddChargeModal({ reservationId, onClose }: AddChargeModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  // Default to F&B — the most common manual ancillary charge
  const [type,        setType]        = useState<FolioItemType>("FOOD_BEVERAGE");
  const [description, setDescription] = useState("Food & Beverage");
  const [unitPrice,   setUnitPrice]   = useState("");
  const [quantity,    setQuantity]    = useState("1");
  const [notes,       setNotes]       = useState("");
  const [descTouched, setDescTouched] = useState(false); // true once user manually edited description
  const [error,       setError]       = useState<string | null>(null);

  function handleTypeSelect(tile: TypeTile) {
    setType(tile.value);
    // Auto-fill description only if it's still an auto-generated value (not manually customised)
    if (!descTouched || AUTO_DESCS.has(description)) {
      setDescription(tile.defaultDesc);
      setDescTouched(false); // reset — still auto-filled
    }
  }

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
    if (!description.trim())                       return setError("Description is required");
    if (!unitPrice || parseFloat(unitPrice) <= 0)  return setError("Unit price must be greater than 0");
    if (!quantity  || parseInt(quantity, 10) < 1)  return setError("Quantity must be at least 1");
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
          <div className="flex-1">
            <h2 className="serif text-[20px] text-ink leading-tight">Add Charge</h2>
          </div>
          <button onClick={onClose} className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">{error}</div>
          )}

          {/* Charge type tiles — replaces the dropdown */}
          <div>
            <label className={labelCls}>Charge type</label>
            <div className="grid grid-cols-4 gap-2">
              {TYPE_TILES.map((tile) => {
                const active = type === tile.value;
                return (
                  <button
                    key={tile.value}
                    type="button"
                    onClick={() => handleTypeSelect(tile)}
                    className={cn(
                      "flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all",
                      active
                        ? "border-coral bg-coral-soft text-coral-deep shadow-sm"
                        : "border-line bg-mist text-ink-mute hover:border-coral/40 hover:text-ink hover:bg-white",
                    )}
                  >
                    <tile.icon size={16} className="shrink-0" />
                    <span className="text-[11px] font-semibold leading-tight">{tile.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Description — auto-filled by tile selection, staff can override */}
          <div>
            <label className={labelCls}>
              Description <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => { setDescription(e.target.value); setDescTouched(true); }}
              placeholder="e.g. Room service — Chicken Karahi"
              className={inputCls}
            />
          </div>

          {/* Price + Quantity */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>
                Unit Price (PKR) <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span>
              </label>
              <input type="number" min="0" step="0.01" value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)} placeholder="0.00" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Quantity</label>
              <input type="number" min="1" step="1" value={quantity}
                onChange={(e) => setQuantity(e.target.value)} className={inputCls} />
            </div>
          </div>

          {/* Running total */}
          {unitPriceNum > 0 && (
            <div className="rounded-xl bg-mist border border-line-soft px-4 py-2.5 flex items-center justify-between">
              <span className="text-[13px] text-ink-soft font-medium">Total charge</span>
              <span className="serif text-[18px] text-ink tnum">
                PKR {total.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className={labelCls}>Notes <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal note" className={inputCls} />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 h-10 rounded-full border border-line text-ink-soft text-[13.5px] font-semibold hover:bg-mist transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className={cn(
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
