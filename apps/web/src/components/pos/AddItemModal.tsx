import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, UtensilsCrossed, Star, ImagePlus, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { posService, type PosCategory } from "@/services/pos";
import { inventoryService } from "@/services/inventory";
import { uploadService } from "@/services/upload";
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

  // Photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoUploading(true);
    try {
      const url = await uploadService.uploadPhoto(file);
      setPhotoUrl(url);
    } catch { /* non-fatal */ }
    finally { setPhotoUploading(false); e.target.value = ""; }
  }

  // Inventory link state
  const [linkInventory,    setLinkInventory]    = useState(false);
  const [inventoryItemId,  setInventoryItemId]  = useState<string>("");
  const [inventoryQtyUsed, setInventoryQtyUsed] = useState<string>("");

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
    mutationFn: () =>
      posService.createItem(category.id, {
        name:        name.trim(),
        description: desc.trim() || undefined,
        price:       Math.round(parseFloat(price) * 100),
        categoryId:  category.id,
        isAvailable: avail,
        isQrVisible: qrVisible,
        isFeatured:  featured,
        ...(photoUrl ? { photoUrl } : {}),
        inventoryItemId:  linkInventory && inventoryItemId ? inventoryItemId : null,
        inventoryQtyUsed: linkInventory && inventoryItemId ? (parseFloat(inventoryQtyUsed) || null) : null,
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
            <label className={labelClass}>Name <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
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
            <label className={labelClass}>Price (PKR) <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
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

          {/* Photo */}
          <div>
            <label className={labelClass}>Photo <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            {photoUrl ? (
              <div className="relative h-20 w-20 rounded-lg overflow-hidden border border-line">
                <img src={photoUrl} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  disabled={photoUploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 flex items-center justify-center bg-ink/0 hover:bg-ink/50 text-white opacity-0 hover:opacity-100 transition-all disabled:opacity-100 disabled:bg-ink/50"
                >
                  {photoUploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
                </button>
                <button
                  type="button"
                  onClick={() => setPhotoUrl(null)}
                  className="absolute top-0.5 right-0.5 grid place-items-center h-5 w-5 rounded-full bg-ink/70 text-white hover:bg-clay"
                >
                  <X size={10} />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={photoUploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-2 h-9 px-4 rounded-xl border border-dashed border-line text-ink-mute text-[13px] hover:border-coral/40 hover:text-coral transition-colors disabled:opacity-40"
              >
                {photoUploading ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}
                {photoUploading ? "Uploading…" : "Add Photo"}
              </button>
            )}
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
