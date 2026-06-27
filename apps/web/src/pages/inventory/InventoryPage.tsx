import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package, AlertTriangle, Search, Plus, LayoutGrid, List, X,
} from "lucide-react";
import { cn } from "../../lib/cn";
import {
  inventoryService,
  type InventoryItem,
  type CreateInventoryItemDto,
} from "../../services/inventory";
import { AddItemModal } from "../../components/inventory/AddItemModal";
import { ItemDetailDrawer } from "../../components/inventory/ItemDetailDrawer";
import { RecordTransactionModal } from "../../components/inventory/RecordTransactionModal";
import type { CreateTransactionDto } from "../../services/inventory";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPKR(paisas: number): string {
  const rupees = Math.floor(paisas / 100);
  if (rupees >= 100_000) return `PKR ${(rupees / 1000).toFixed(0)}k`;
  return `PKR ${rupees.toLocaleString("en-PK")}`;
}

// ── Stock bar ─────────────────────────────────────────────────────────────────

interface StockBarProps {
  current:  number;
  par:      number;
  reorder:  number;
  unit:     string;
}

function StockBar({ current, par, reorder, unit }: StockBarProps) {
  const pct   = par > 0 ? Math.min((current / par) * 100, 100) : 0;
  const isOut = current <= 0;
  const isLow = current <= reorder && !isOut;

  const barColor = isOut ? "bg-red-500" : isLow ? "bg-amber" : current <= par ? "bg-amber/60" : "bg-pine";

  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className={cn(
          "font-bold text-[14px]",
          isOut ? "text-red-600" : isLow ? "text-amber" : "text-ink",
        )}>
          {current}
        </span>
        <span className="text-xs text-ink-faint">{unit}</span>
        {isOut && (
          <span className="text-[10px] font-bold text-red-600 bg-red-50 px-1.5 py-0.5 rounded">OUT</span>
        )}
        {isLow && !isOut && (
          <span className="text-[10px] font-bold text-amber bg-amber/10 px-1.5 py-0.5 rounded">LOW</span>
        )}
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-line overflow-hidden w-20">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({
  icon: Icon, label, value, toneName, delay = 0,
}: {
  icon:     React.ElementType;
  label:    string;
  value:    string | number;
  toneName: string;
  delay?:   number;
}) {
  const bg = toneName === "amber" ? "#F8EFDA" : toneName === "pine" ? "#E6F0EA" : toneName === "red" ? "#FDE8E4" : "#E7EEF3";
  const fg = toneName === "amber" ? "#86600F" : toneName === "pine" ? "#1F4D3A" : toneName === "red" ? "#9E3417" : "#2c455c";

  return (
    <div
      className="rounded-2xl border border-line bg-card p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: bg, color: fg }}>
          <Icon size={20} />
        </span>
      </div>
      <div className="mt-3 text-[30px] font-bold text-ink leading-none">{value}</div>
      <div className="text-[13px] font-semibold text-ink-mute mt-1">{label}</div>
    </div>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, onClick }: { item: InventoryItem; onClick: () => void }) {
  const isOut = item.currentStock <= 0;
  const isLow = item.currentStock <= item.reorderLevel && !isOut;

  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border bg-card p-4 cursor-pointer hover:shadow-md transition-all",
        isOut ? "border-red-200"  : isLow ? "border-amber/30" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-ink truncate">{item.name}</p>
          <p className="text-[12px] text-ink-mute truncate">{item.category}</p>
        </div>
        {(isOut || isLow) && (
          <AlertTriangle size={15} className={isOut ? "text-red-500 shrink-0" : "text-amber shrink-0"} />
        )}
      </div>
      <div className="mt-3">
        <StockBar
          current={item.currentStock}
          par={item.parLevel}
          reorder={item.reorderLevel}
          unit={item.unit}
        />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] text-ink-faint">{formatPKR(item.costPerUnit)}/unit</span>
        {item.supplier && (
          <span className="text-[11px] text-ink-faint truncate max-w-[100px]">{item.supplier}</span>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ViewMode = "table" | "grid";

export default function InventoryPage() {
  const qc = useQueryClient();

  // Filters
  const [search,       setSearch]       = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [view,         setView]         = useState<ViewMode>("table");
  const [page,         setPage]         = useState(1);

  // Modals / drawer
  const [showAdd,       setShowAdd]       = useState(false);
  const [selectedId,    setSelectedId]    = useState<string | null>(null);
  const [quickTxnItem,  setQuickTxnItem]  = useState<InventoryItem | null>(null);

  // Summary
  const { data: summary } = useQuery({
    queryKey:  ["inventory", "summary"],
    queryFn:   inventoryService.getSummary,
    staleTime: 60_000,
  });

  // Items list
  const { data: listData, isLoading } = useQuery({
    queryKey: [
      "inventory",
      "list",
      { search, category: activeCategory, lowStockOnly, page },
    ],
    queryFn: () =>
      inventoryService.getItems({
        search:       search || undefined,
        category:     activeCategory ?? undefined,
        lowStockOnly: lowStockOnly || undefined,
        page,
        limit: 50,
      }),
    staleTime: 30_000,
  });

  const items = listData?.data ?? [];
  const meta  = listData?.meta;

  const totalValuePKR = summary ? summary.totalInventoryValue / 100 : 0;

  function invalidate() {
    void qc.invalidateQueries({ queryKey: ["inventory"] });
  }

  async function handleAddItem(dto: CreateInventoryItemDto) {
    await inventoryService.createItem(dto);
    invalidate();
    setShowAdd(false);
  }

  async function handleDeactivate(id: string) {
    if (!confirm("Deactivate this item? It will no longer appear in inventory.")) return;
    await inventoryService.deactivateItem(id);
    invalidate();
  }

  async function handleQuickTxn(itemId: string, dto: CreateTransactionDto) {
    await inventoryService.recordTransaction(itemId, dto);
  }

  const categories = useMemo(
    () => summary?.categories.map((c) => c.category) ?? [],
    [summary],
  );

  return (
    <div className="min-h-screen bg-paper">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-[28px] font-bold text-ink">Inventory</h1>
            {summary && (
              <p className="text-[13px] text-ink-mute mt-0.5">
                Total value:{" "}
                <span className="font-semibold text-ink">
                  PKR {totalValuePKR.toLocaleString("en-PK", { maximumFractionDigits: 0 })}
                </span>
              </p>
            )}
          </div>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 rounded-xl bg-pine px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-pine/90 transition-colors shadow-sm"
          >
            <Plus size={16} />
            Add Item
          </button>
        </div>

        {/* Summary stat cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard icon={Package}       label="Total Items"    value={summary?.totalItems ?? 0}       toneName="slate" delay={0}   />
          <StatCard icon={AlertTriangle} label="Low Stock"      value={summary?.lowStockCount ?? 0}    toneName="amber" delay={50}  />
          <StatCard icon={X}             label="Out of Stock"   value={summary?.outOfStockCount ?? 0}  toneName="red"   delay={100} />
          <StatCard
            icon={Package}
            label="Inventory Value"
            value={`PKR ${Math.floor(totalValuePKR).toLocaleString("en-PK")}`}
            toneName="pine"
            delay={150}
          />
        </div>

        {/* Low stock alert banner */}
        {summary && summary.lowStockCount > 0 && (
          <div className="flex items-center gap-3 rounded-2xl bg-amber/10 border border-amber/30 px-5 py-3.5">
            <AlertTriangle size={18} className="text-amber shrink-0" />
            <p className="text-[13.5px] font-semibold text-amber">
              {summary.lowStockCount} item{summary.lowStockCount !== 1 ? "s" : ""} at or below reorder level
              {summary.outOfStockCount > 0 && ` · ${summary.outOfStockCount} out of stock`}
            </p>
            <button
              onClick={() => setLowStockOnly(true)}
              className="ml-auto text-[13px] font-bold text-amber underline underline-offset-2 hover:opacity-70 transition-opacity"
            >
              View →
            </button>
          </div>
        )}

        {/* Filter row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Category pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { setActiveCategory(null); setPage(1); }}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                activeCategory === null
                  ? "bg-ink text-white"
                  : "bg-mist text-ink-mute hover:bg-line",
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setPage(1); }}
                className={cn(
                  "rounded-full px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
                  activeCategory === cat
                    ? "bg-ink text-white"
                    : "bg-mist text-ink-mute hover:bg-line",
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
            <input
              type="text"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search items…"
              className="w-full rounded-xl border border-line bg-mist pl-8 pr-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-pine/20 focus:border-pine/40 transition-colors"
            />
          </div>

          {/* Low stock toggle */}
          <button
            onClick={() => { setLowStockOnly((v) => !v); setPage(1); }}
            className={cn(
              "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[12.5px] font-semibold transition-colors",
              lowStockOnly
                ? "border-amber bg-amber/10 text-amber"
                : "border-line text-ink-mute hover:bg-mist",
            )}
          >
            <AlertTriangle size={13} />
            Low Stock
          </button>

          {/* View toggle */}
          <div className="ml-auto flex items-center gap-1 rounded-xl border border-line bg-mist p-1">
            <button
              onClick={() => setView("table")}
              className={cn(
                "grid place-items-center h-7 w-7 rounded-lg transition-colors",
                view === "table" ? "bg-card text-ink shadow-sm" : "text-ink-faint",
              )}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setView("grid")}
              className={cn(
                "grid place-items-center h-7 w-7 rounded-lg transition-colors",
                view === "grid" ? "bg-card text-ink shadow-sm" : "text-ink-faint",
              )}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-ink-faint text-[14px]">
            Loading inventory…
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-ink-faint">
            <Package size={32} className="text-line" />
            <p className="text-[14px] font-semibold text-ink-mute">No items found</p>
            <p className="text-[13px] text-ink-faint">Try adjusting your filters or add a new item</p>
          </div>
        ) : view === "table" ? (
          <div className="rounded-2xl border border-line bg-card overflow-hidden">
            <table className="w-full text-[13.5px]">
              <thead>
                <tr className="border-b border-line bg-mist">
                  <th className="text-left px-4 py-3 text-[12px] font-semibold text-ink-mute uppercase tracking-wide">Item</th>
                  <th className="text-left px-4 py-3 text-[12px] font-semibold text-ink-mute uppercase tracking-wide">Category</th>
                  <th className="text-left px-4 py-3 text-[12px] font-semibold text-ink-mute uppercase tracking-wide">Stock</th>
                  <th className="text-left px-4 py-3 text-[12px] font-semibold text-ink-mute uppercase tracking-wide">Par</th>
                  <th className="text-left px-4 py-3 text-[12px] font-semibold text-ink-mute uppercase tracking-wide">Cost/Unit</th>
                  <th className="text-left px-4 py-3 text-[12px] font-semibold text-ink-mute uppercase tracking-wide">Supplier</th>
                  <th className="text-right px-4 py-3 text-[12px] font-semibold text-ink-mute uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className="border-b border-line last:border-0 hover:bg-mist cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-semibold text-ink">{item.name}</p>
                        {item.sku && <p className="text-[11px] text-ink-faint">{item.sku}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-ink-mute">{item.category}</td>
                    <td className="px-4 py-3">
                      <StockBar
                        current={item.currentStock}
                        par={item.parLevel}
                        reorder={item.reorderLevel}
                        unit={item.unit}
                      />
                    </td>
                    <td className="px-4 py-3 text-ink-mute">{item.parLevel} {item.unit}</td>
                    <td className="px-4 py-3 text-ink-mute">{formatPKR(item.costPerUnit)}</td>
                    <td className="px-4 py-3 text-ink-mute truncate max-w-[120px]">
                      {item.supplier ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setQuickTxnItem(item)}
                          className="rounded-lg bg-pine/10 text-pine px-2.5 py-1 text-[12px] font-semibold hover:bg-pine/20 transition-colors"
                        >
                          + Stock
                        </button>
                        <button
                          onClick={() => handleDeactivate(item.id)}
                          className="rounded-lg text-ink-faint hover:text-red-600 hover:bg-red-50 px-2 py-1 text-[12px] font-semibold transition-colors"
                        >
                          Deactivate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onClick={() => setSelectedId(item.id)}
              />
            ))}
          </div>
        )}

        {/* Pagination */}
        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="rounded-xl border border-line px-3 py-1.5 text-[13px] text-ink-mute hover:bg-mist disabled:opacity-40 transition-colors"
            >
              ← Prev
            </button>
            <span className="text-[13px] text-ink-mute">
              Page {page} of {meta.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className="rounded-xl border border-line px-3 py-1.5 text-[13px] text-ink-mute hover:bg-mist disabled:opacity-40 transition-colors"
            >
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {selectedId && (
        <ItemDetailDrawer
          itemId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}

      {/* Add item modal */}
      {showAdd && (
        <AddItemModal
          onClose={() => setShowAdd(false)}
          onSuccess={handleAddItem}
        />
      )}

      {/* Quick stock transaction modal */}
      {quickTxnItem && (
        <RecordTransactionModal
          itemId={quickTxnItem.id}
          itemName={quickTxnItem.name}
          currentStock={quickTxnItem.currentStock}
          unit={quickTxnItem.unit}
          initialType="PURCHASE"
          onClose={() => setQuickTxnItem(null)}
          onSuccess={() => {
            setQuickTxnItem(null);
            invalidate();
          }}
          onSubmit={handleQuickTxn}
        />
      )}
    </div>
  );
}
