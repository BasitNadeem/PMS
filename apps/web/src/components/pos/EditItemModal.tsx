import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, UtensilsCrossed, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { posService, type PosItem } from "@/services/pos";
import { inventoryService } from "@/services/inventory";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export interface EditItemModalProps {
  item:    PosItem;
  onClose: () => void;
}

const inputClass = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelClass = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

export function EditItemModal({ item, onClose }: EditItemModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();

  const [name,  setName]  = useState(item.name);
  const [desc,  setDesc]  = useState(item.description ?? "");
  const [price, setPrice] = useState(String(item.price / 100));
  const [avail, setAvail] = useState(item.isAvailable);
  const [qrVisible, setQrVisible] = useState(item.isQrVisible);
  const [featured,  setFeatured]  = useState(item.isFeatured);
  const [error, setError] = useState<string | null>(null);

  // Inventory link state
  const [linkInventory,    setLinkInventory]    = useState(item.inventoryItemId !== null);
  const [inventoryItemId,  setInventoryItemId]  = useState<string>(item.inventoryItemId ?? "");
  const [inventoryQtyUsed, setInventoryQtyUsed] = useState<string>(
    item.inventoryQtyUsed !== null ? String(item.inventoryQtyUsed) : "",
  );

  // Fetch all inventory items for the dropdown (limit 200 — enough for a hotel menu)
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-all"],
    queryFn:  () => inventoryService.getItems({ limit: 200 }),
    staleTime: 60_000,
  });
  const inventoryItems = inventoryData?.data ?? [];

  // Find the currently selected inventory item to show its unit
  const selectedInvItem = inventoryItems.find((i) => i.id === inventoryItemId) ?? null;

  function handleToggleLink() {
    const next = !linkInventory;
    setLinkInventory(next);
    if (!next) {
      // Clear fields when toggled off
      setInventoryItemId("");
      setInventoryQtyUsed("");
    }
  }

  const mutation = useMutation({
    mutationFn: () => {
      const dto: Parameters<typeof posService.updateItem>[1] = {
        name:        name.trim(),
        description: desc.trim() || null,
        price:       Math.round(parseFloat(price) * 100),
        isAvailable: avail,
        isQrVisible: qrVisible,
        isFeatured:  featured,
      };

      if (linkInventory && inventoryItemId) {
        dto.inventoryItemId  = inventoryItemId;
        dto.inventoryQtyUsed = parseFloat(inventoryQtyUsed) || null;
      } else {
        // Explicitly clear the link
        dto.inventoryItemId  = null;
        dto.inventoryQtyUsed = null;
      }

      return posService.updateItem(item.id, dto);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-categories-admin"] });
      qc.invalidateQueries({ queryKey: ["pos-categories"] });
      onClose();
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Failed to update item");
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const p = parseFloat(price);
    if (isNaN(p) || p <= 0) { setError("Enter a valid price"); return; }
    if (linkInventory && !inventoryItemId) { setError("Select an inventory item or turn off the link"); return; }
    if (linkInventory && inventoryItemId) {
      const qty = parseFloat(inventoryQtyUsed);
      if (isNaN(qty) || qty <= 0) { setError("Enter a valid quantity per serving"); return; }
    }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-sm anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-mist shrink-0">
            <UtensilsCrossed size={18} className="text-ink-soft" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Edit Item</h2>
            <p className="text-[12px] text-ink-mute mt-0.5 truncate">{item.name}</p>
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
            <label className={labelClass}>Name</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Price (PKR)</label>
            <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min="0" step="1" className={inputClass} />
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

          {/* ── Inventory link ──────────────────────────────────────────────── */}
          <div className="border-t border-line pt-4 space-y-3">
            {/* Toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleToggleLink}
                className={cn(
                  "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
                  linkInventory ? "bg-pine" : "bg-line-soft",
                )}
              >
                <span className={cn(
                  "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                  linkInventory ? "translate-x-5" : "translate-x-0.5",
                )} />
              </button>
              <span className="text-[13.5px] font-medium text-ink-soft">Link to inventory item</span>
            </div>

            {linkInventory && (
              <div className="space-y-3">
                {/* Inventory item selector */}
                <div>
                  <label className={labelClass}>Inventory item</label>
                  <select
                    value={inventoryItemId}
                    onChange={(e) => setInventoryItemId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">Select inventory item…</option>
                    {inventoryItems.map((inv) => (
                      <option key={inv.id} value={inv.id}>
                        {inv.name} ({inv.unit})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Qty per serving */}
                <div>
                  <label className={labelClass}>Qty used per serving</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={inventoryQtyUsed}
                      onChange={(e) => setInventoryQtyUsed(e.target.value)}
                      placeholder="e.g. 0.200"
                      min="0"
                      step="0.001"
                      className={cn(inputClass, "flex-1")}
                    />
                    {selectedInvItem && (
                      <span className="text-[13px] text-ink-mute shrink-0 font-medium">
                        {selectedInvItem.unit}
                      </span>
                    )}
                  </div>
                  {selectedInvItem && inventoryQtyUsed && parseFloat(inventoryQtyUsed) > 0 && (
                    <p className="text-[12px] text-ink-faint mt-1.5">
                      {inventoryQtyUsed} {selectedInvItem.unit} of {selectedInvItem.name} deducted per serving
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
          {/* ── end inventory link ────────────────────────────────────────── */}

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
