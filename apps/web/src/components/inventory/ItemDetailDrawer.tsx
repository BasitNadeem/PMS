import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, ShoppingCart, Trash2, RotateCcw, SlidersHorizontal, Edit2, Package } from "lucide-react";
import { cn } from "../../lib/cn";
import { inventoryService, type InventoryTransaction } from "../../services/inventory";
import { RecordTransactionModal } from "./RecordTransactionModal";
import { EditItemModal } from "./EditItemModal";
import type { CreateTransactionDto, UpdateInventoryItemDto } from "../../services/inventory";
import { useEscapeKey } from "@/hooks/useEscapeKey";

type TxnType = "PURCHASE" | "CONSUMPTION" | "WASTE" | "ADJUSTMENT";

function txnColor(type: InventoryTransaction["type"]): string {
  switch (type) {
    case "PURCHASE":     return "bg-pine/10 text-pine";
    case "CONSUMPTION":  return "bg-blue-50 text-blue-700";
    case "WASTE":        return "bg-red-50 text-red-600";
    case "ADJUSTMENT":   return "bg-amber/10 text-amber";
    case "OPENING_STOCK": return "bg-mist text-ink-mute";
    case "TRANSFER":     return "bg-slate-100 text-slate-600";
    default:             return "bg-mist text-ink-mute";
  }
}

function txnSign(type: InventoryTransaction["type"]): string {
  return type === "PURCHASE" || type === "OPENING_STOCK" || type === "ADJUSTMENT"
    ? "+"
    : "-";
}

function formatPKR(paisas: number): string {
  const rupees = paisas / 100;
  return `PKR ${rupees.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  const days  = Math.floor(hours / 24);
  if (days  > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins  > 0) return `${mins}m ago`;
  return "just now";
}

export interface ItemDetailDrawerProps {
  itemId:  string;
  onClose: () => void;
}

export function ItemDetailDrawer({ itemId, onClose }: ItemDetailDrawerProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [txnType,    setTxnType]    = useState<TxnType | null>(null);
  const [showEdit,   setShowEdit]   = useState(false);

  const { data: item, isLoading } = useQuery({
    queryKey: ["inventory", "detail", itemId],
    queryFn:  () => inventoryService.getItem(itemId),
  });

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["inventory"] });
  }

  async function handleTransaction(id: string, dto: CreateTransactionDto) {
    await inventoryService.recordTransaction(id, dto);
    invalidate();
  }

  async function handleEdit(id: string, dto: UpdateInventoryItemDto) {
    await inventoryService.updateItem(id, dto);
    invalidate();
    setShowEdit(false);
  }

  const isOut = item ? item.currentStock <= 0 : false;
  const isLow = item ? item.currentStock <= item.reorderLevel && !isOut : false;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px] bg-paper border-l border-line flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-4 border-b border-line shrink-0">
          <span className={cn(
            "grid place-items-center h-10 w-10 rounded-xl",
            isOut ? "bg-red-50 text-red-500" : isLow ? "bg-amber/10 text-amber" : "bg-pine/10 text-pine",
          )}>
            <Package size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-bold text-ink truncate">{item?.name ?? "Loading…"}</h2>
            {item && (
              <p className="text-[12px] text-ink-mute">
                {item.category} · {item.unit}
                {item.sku ? ` · ${item.sku}` : ""}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {item && (
              <button
                onClick={() => setShowEdit(true)}
                className="grid place-items-center h-8 w-8 rounded-full text-ink-mute hover:bg-mist transition-colors"
                title="Edit item"
              >
                <Edit2 size={15} />
              </button>
            )}
            <button
              onClick={onClose}
              className="grid place-items-center h-8 w-8 rounded-full text-ink-mute hover:bg-mist transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
          {isLoading && (
            <div className="flex items-center justify-center py-20 text-ink-faint text-[14px]">
              Loading…
            </div>
          )}

          {item && (
            <>
              {/* Stock status card */}
              <div className={cn(
                "rounded-2xl border px-5 py-4",
                isOut ? "bg-red-50 border-red-200" : isLow ? "bg-amber/5 border-amber/30" : "bg-pine/5 border-pine/20",
              )}>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-[12px] font-semibold text-ink-mute uppercase tracking-wide">Current Stock</p>
                    <div className={cn(
                      "text-[36px] font-bold leading-none mt-1",
                      isOut ? "text-red-600" : isLow ? "text-amber" : "text-pine",
                    )}>
                      {item.currentStock}
                      <span className="text-[16px] font-normal text-ink-mute ml-1">{item.unit}</span>
                    </div>
                    {isOut && (
                      <span className="inline-flex mt-2 text-[11px] font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded-full">OUT OF STOCK</span>
                    )}
                    {isLow && (
                      <span className="inline-flex mt-2 text-[11px] font-bold text-amber bg-amber/10 px-2 py-0.5 rounded-full">LOW STOCK</span>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <div className="text-[12px] text-ink-mute">Par: <span className="font-semibold text-ink">{item.parLevel} {item.unit}</span></div>
                    <div className="text-[12px] text-ink-mute">Reorder: <span className="font-semibold text-ink">{item.reorderLevel} {item.unit}</span></div>
                    <div className="text-[12px] text-ink-mute">Cost: <span className="font-semibold text-ink">{formatPKR(item.costPerUnit)}</span></div>
                  </div>
                </div>
              </div>

              {/* Quick action buttons */}
              <div>
                <p className="text-[12px] font-semibold text-ink-mute uppercase tracking-wide mb-2">Quick Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { type: "PURCHASE",    label: "Purchase",    Icon: ShoppingCart,      color: "text-pine    bg-pine/10    border-pine/30    hover:bg-pine/20" },
                      { type: "CONSUMPTION", label: "Consumption", Icon: Trash2,            color: "text-blue-600 bg-blue-50   border-blue-200   hover:bg-blue-100" },
                      { type: "WASTE",       label: "Waste",       Icon: RotateCcw,         color: "text-red-600  bg-red-50    border-red-200    hover:bg-red-100" },
                      { type: "ADJUSTMENT",  label: "Adjustment",  Icon: SlidersHorizontal, color: "text-amber   bg-amber/10   border-amber/30   hover:bg-amber/20" },
                    ] as const
                  ).map(({ type, label, Icon, color }) => (
                    <button
                      key={type}
                      onClick={() => setTxnType(type as TxnType)}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors",
                        color,
                      )}
                    >
                      <Icon size={15} />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Supplier info */}
              {item.supplier && (
                <div className="rounded-xl bg-mist border border-line px-4 py-3">
                  <p className="text-[12px] text-ink-mute font-semibold">Supplier</p>
                  <p className="text-[14px] text-ink font-medium mt-0.5">{item.supplier}</p>
                </div>
              )}

              {/* Transaction history */}
              <div>
                <p className="text-[12px] font-semibold text-ink-mute uppercase tracking-wide mb-3">
                  Recent Transactions
                </p>
                {item.transactions.length === 0 ? (
                  <div className="rounded-xl bg-mist border border-line px-4 py-8 text-center">
                    <p className="text-[13px] text-ink-mute">No transactions recorded yet.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {item.transactions.map((txn) => {
                      const sign = txnSign(txn.type);
                      return (
                        <div
                          key={txn.id}
                          className="flex items-start gap-3 rounded-xl border border-line bg-card px-4 py-3"
                        >
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 shrink-0",
                            txnColor(txn.type),
                          )}>
                            {txn.type.replace("_", " ")}
                          </span>
                          <div className="flex-1 min-w-0">
                            {txn.notes && (
                              <p className="text-[12px] text-ink truncate">{txn.notes}</p>
                            )}
                            {txn.performedByName && (
                              <p className="text-[11px] text-ink-faint">by {txn.performedByName}</p>
                            )}
                            <p className="text-[11px] text-ink-faint">{timeAgo(txn.createdAt)}</p>
                          </div>
                          <span className={cn(
                            "text-[14px] font-bold shrink-0",
                            sign === "+" ? "text-pine" : "text-red-600",
                          )}>
                            {sign}{txn.quantity} {item.unit}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* RecordTransaction modal */}
      {txnType && item && (
        <RecordTransactionModal
          itemId={item.id}
          itemName={item.name}
          currentStock={item.currentStock}
          unit={item.unit}
          initialType={txnType}
          onClose={() => setTxnType(null)}
          onSuccess={() => {
            setTxnType(null);
            invalidate();
          }}
          onSubmit={handleTransaction}
        />
      )}

      {/* EditItem modal */}
      {showEdit && item && (
        <EditItemModal
          item={item}
          onClose={() => setShowEdit(false)}
          onSuccess={handleEdit}
        />
      )}
    </>
  );
}
