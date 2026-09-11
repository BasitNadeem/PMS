import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { InventoryItem } from "@/services/inventory";
import { Toggle } from "./ToggleRow";

export const posInputClass = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
export const posLabelClass = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

// One ingredient per line — item, quantity, remove. A recipe of ten should cost
// ten rows of height, not ten stacked cards.
const rowGrid = "grid grid-cols-[minmax(0,1fr)_84px_30px] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_120px_34px]";
const rowField = "w-full rounded-lg border border-line bg-mist px-3 py-2 text-[13.5px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const rowHeader = "text-[11px] font-semibold uppercase tracking-wide text-ink-faint";

/** A recipe line being edited. Quantity stays a string while it is typed. */
export interface RecipeDraftLine {
  inventoryItemId: string;
  qtyUsed:         string;
}

export interface RecipeEditorProps {
  lines:          RecipeDraftLine[];
  onChange:       (lines: RecipeDraftLine[]) => void;
  inventoryItems: InventoryItem[];
}

/**
 * Edits the list of inventory items a menu item consumes per serving. An empty
 * list means the item is not stock-tracked and sells without a stock check.
 */
export function RecipeEditor({ lines, onChange, inventoryItems }: RecipeEditorProps) {
  const enabled = lines.length > 0;
  const blank   = { inventoryItemId: "", qtyUsed: "" };

  function update(index: number, patch: Partial<RecipeDraftLine>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <Toggle checked={enabled} onChange={() => onChange(enabled ? [] : [blank])} />
        <span className="text-[13.5px] font-medium text-ink-soft">Deduct inventory when sold</span>
      </div>

      {enabled && (
        <div className="space-y-2">
          <div className={rowGrid}>
            <span className={rowHeader}>Inventory item</span>
            <span className={rowHeader}>Qty</span>
            <span />
          </div>

          {lines.map((line, index) => {
            const selected = inventoryItems.find((inv) => inv.id === line.inventoryItemId) ?? null;
            // An inventory item may appear only once per recipe — the server
            // rejects duplicates, so keep them unpickable here.
            const taken = new Set(
              lines.filter((_, i) => i !== index).map((other) => other.inventoryItemId),
            );

            return (
              <div key={index} className={rowGrid}>
                <select
                  value={line.inventoryItemId}
                  onChange={(e) => update(index, { inventoryItemId: e.target.value })}
                  className={rowField}
                >
                  <option value="">Select item…</option>
                  {inventoryItems.map((inv) => (
                    <option key={inv.id} value={inv.id} disabled={taken.has(inv.id)}>
                      {inv.name} ({inv.unit})
                    </option>
                  ))}
                </select>

                <div className="relative">
                  <input
                    type="number"
                    value={line.qtyUsed}
                    onChange={(e) => update(index, { qtyUsed: e.target.value })}
                    placeholder="0.200"
                    min="0"
                    step="0.001"
                    className={cn(rowField, selected && "pr-9")}
                  />
                  {selected && (
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] font-medium text-ink-faint">
                      {selected.unit}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onChange(lines.filter((_, i) => i !== index))}
                  title="Remove ingredient"
                  className="grid h-8 w-8 place-items-center rounded-lg text-ink-mute transition-colors hover:bg-clay-soft hover:text-clay"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => onChange([...lines, blank])}
            className="flex items-center gap-1.5 pt-0.5 text-[13px] font-semibold text-coral transition-colors hover:text-coral-deep"
          >
            <Plus size={14} /> Add ingredient
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Validates a draft recipe and converts it to the API shape.
 * Returns an error message instead when a line is incomplete.
 */
export function toRecipePayload(
  lines: RecipeDraftLine[],
): { ok: true; lines: { inventoryItemId: string; qtyUsed: number }[] } | { ok: false; error: string } {
  const payload: { inventoryItemId: string; qtyUsed: number }[] = [];
  for (const line of lines) {
    if (!line.inventoryItemId) {
      return { ok: false, error: "Pick an inventory item for every ingredient, or remove the empty row." };
    }
    const qtyUsed = parseFloat(line.qtyUsed);
    if (!Number.isFinite(qtyUsed) || qtyUsed <= 0) {
      return { ok: false, error: "Every ingredient needs a quantity greater than zero." };
    }
    payload.push({ inventoryItemId: line.inventoryItemId, qtyUsed });
  }
  return { ok: true, lines: payload };
}
