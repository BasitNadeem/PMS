import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { X, UtensilsCrossed, Star, ImagePlus, Loader2 } from "lucide-react";
import { posService, type PosItem } from "@/services/pos";
import { inventoryService } from "@/services/inventory";
import { uploadService } from "@/services/upload";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import {
  RecipeEditor,
  toRecipePayload,
  posInputClass as inputClass,
  posLabelClass as labelClass,
  type RecipeDraftLine,
} from "./RecipeEditor";
import { ToggleRow } from "./ToggleRow";

export interface EditItemModalProps {
  item:    PosItem;
  onClose: () => void;
}

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

  // Photo
  const [photoUrl, setPhotoUrl] = useState<string | null>(item.photoUrl);
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

  // Recipe — which inventory items a serving consumes. Empty = not tracked.
  const [recipe, setRecipe] = useState<RecipeDraftLine[]>(() =>
    item.ingredients.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      qtyUsed:         String(line.qtyUsed),
    })),
  );

  // Fetch all inventory items for the dropdown (limit 200 — enough for a hotel menu)
  const { data: inventoryData } = useQuery({
    queryKey: ["inventory-all"],
    queryFn:  () => inventoryService.getItems({ limit: 200 }),
    staleTime: 60_000,
  });
  const inventoryItems = inventoryData?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => {
      const dto: Parameters<typeof posService.updateItem>[1] = {
        name:        name.trim(),
        description: desc.trim() || null,
        price:       Math.round(parseFloat(price) * 100),
        isAvailable: avail,
        isQrVisible: qrVisible,
        isFeatured:  featured,
        photoUrl,
      };

      // Always sent, so clearing the recipe deletes the existing lines.
      const parsed = toRecipePayload(recipe);
      dto.ingredients = parsed.ok ? parsed.lines : [];

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
    const parsed = toRecipePayload(recipe);
    if (!parsed.ok) { setError(parsed.error); return; }
    setError(null);
    mutation.mutate();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-2xl flex max-h-full flex-col anim-scale-in">
        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
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
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Name <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Price (PKR) <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
              <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} min="0" step="1" className={inputClass} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <input type="text" value={desc} onChange={(e) => setDesc(e.target.value)} className={inputClass} />
          </div>

          {/* Photo beside the switches — the panel is wide enough now,
              and stacking them cost ~200px of scroll for very little. */}
          <div className="grid gap-4 sm:grid-cols-2 sm:items-start">
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
            <div>
              <label className={labelClass}>Visibility</label>
              <div className="divide-y divide-line-soft rounded-xl border border-line bg-mist/50">
                <ToggleRow label="Available on POS"    checked={avail}     onChange={() => setAvail((v) => !v)}     tone="pine" />
                <ToggleRow label="Shown on QR menu"    checked={qrVisible} onChange={() => setQrVisible((v) => !v)} tone="coral" />
                <ToggleRow
                  label="Featured on QR menu"
                  checked={featured}
                  onChange={() => setFeatured((v) => !v)}
                  tone="amber"
                  icon={<Star size={15} className={featured ? "text-amber fill-amber" : "text-ink-faint"} />}
                />
              </div>
            </div>
          </div>

          {/* ── Recipe / inventory deduction ────────────────────────────────── */}
          <div className="border-t border-line pt-4">
            <RecipeEditor lines={recipe} onChange={setRecipe} inventoryItems={inventoryItems} />
          </div>
          </div>

          {/* Pinned: the body scrolls, so an error raised from the bottom of a
              long recipe must not scroll out of sight with it. */}
          <div className="shrink-0 border-t border-line px-6 py-4">
            {error && (
              <div className="mb-3 rounded-xl border border-clay/20 bg-clay-soft px-4 py-3 text-[13px] text-clay">
                {error}
              </div>
            )}
            <div className="flex justify-end gap-2.5">
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
          </div>
        </form>
      </div>
    </div>
  );
}
