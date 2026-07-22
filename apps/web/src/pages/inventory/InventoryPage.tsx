import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package, AlertTriangle, Search, Plus, LayoutGrid, List, X,
  ChevronLeft, ChevronRight, TrendingDown, ScanLine,
} from "lucide-react";
import { cn } from "../../lib/cn";
import { Card } from "@/components/ui/Card";
import {
  inventoryService,
  type InventoryItem,
  type CreateInventoryItemDto,
} from "../../services/inventory";
import { AddItemModal } from "../../components/inventory/AddItemModal";
import { ItemDetailDrawer } from "../../components/inventory/ItemDetailDrawer";
import { RecordTransactionModal } from "../../components/inventory/RecordTransactionModal";
import { ScanStockModal } from "../../components/inventory/ScanStockModal";
import type { CreateTransactionDto } from "../../services/inventory";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPKR(paisas: number): string {
  const r = Math.floor(paisas / 100);
  if (r >= 100_000) return `PKR ${(r / 1_000).toFixed(0)}k`;
  return `PKR ${r.toLocaleString("en-PK")}`;
}

// ── Stock bar ─────────────────────────────────────────────────────────────────

function StockBar({ current, par, reorder, unit }: {
  current: number; par: number; reorder: number; unit: string;
}) {
  const pct   = par > 0 ? Math.min((current / par) * 100, 100) : 0;
  const isOut = current <= 0;
  const isLow = current <= reorder && !isOut;
  const barColor = isOut ? "bg-clay" : isLow ? "bg-amber" : current <= par ? "bg-amber/60" : "bg-pine";

  return (
    <div>
      <div className="flex items-baseline gap-1">
        <span className={cn("font-bold text-[14px]", isOut ? "text-clay" : isLow ? "text-amber" : "text-ink")}>
          {current}
        </span>
        <span className="text-xs text-ink-faint">{unit}</span>
        {isOut  && <span className="text-[10px] font-bold text-clay bg-clay-soft px-1.5 py-0.5 rounded">OUT</span>}
        {isLow && !isOut && <span className="text-[10px] font-bold text-amber bg-amber-soft px-1.5 py-0.5 rounded">LOW</span>}
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-line overflow-hidden w-20">
        <div className={cn("h-full rounded-full transition-all", barColor)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// ── Summary stat card ─────────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, bg, fg, delay = 0 }: {
  icon: React.ElementType; label: string; value: string | number;
  bg: string; fg: string; delay?: number;
}) {
  return (
    <Card className="anim-fade-up !p-5" style={{ animationDelay: `${delay}ms` }}>
      <span className="grid place-items-center h-9 w-9 rounded-xl" style={{ background: bg, color: fg }}>
        <Icon size={18} />
      </span>
      <div className="mt-3.5 serif text-[28px] leading-none text-ink tnum">{value}</div>
      <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{label}</div>
    </Card>
  );
}

// ── Grid card ─────────────────────────────────────────────────────────────────

function ItemCard({ item, onClick }: { item: InventoryItem; onClick: () => void }) {
  const isOut = item.currentStock <= 0;
  const isLow = item.currentStock <= item.reorderLevel && !isOut;
  return (
    <Card
      hover
      className={cn("anim-fade-up !p-4 cursor-pointer", isOut ? "border-clay/30" : isLow ? "border-amber/30" : "")}
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-ink truncate">{item.name}</p>
          <p className="text-[12px] text-ink-mute truncate">{item.category}</p>
        </div>
        {(isOut || isLow) && (
          <AlertTriangle size={15} className={isOut ? "text-clay shrink-0" : "text-amber shrink-0"} />
        )}
      </div>
      <div className="mt-3">
        <StockBar current={item.currentStock} par={item.parLevel} reorder={item.reorderLevel} unit={item.unit} />
      </div>
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[12px] text-ink-faint">{formatPKR(item.costPerUnit)}/unit</span>
        {item.supplier && <span className="text-[11px] text-ink-faint truncate max-w-[100px]">{item.supplier}</span>}
      </div>
    </Card>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

type ViewMode = "table" | "grid";

export default function InventoryPage() {
  const qc = useQueryClient();
  useRealtimeSync();

  const [search,          setSearch]         = useState("");
  const [activeCategory,  setActiveCategory] = useState<string | null>(null);
  const [lowStockOnly,    setLowStockOnly]   = useState(false);
  const [view,            setView]           = useState<ViewMode>("table");
  const [page,            setPage]           = useState(1);
  const [showAdd,         setShowAdd]        = useState(false);
  const [showScan,        setShowScan]       = useState(false);
  const [selectedId,      setSelectedId]     = useState<string | null>(null);
  const [quickTxnItem,    setQuickTxnItem]   = useState<InventoryItem | null>(null);

  const { data: summary } = useQuery({
    queryKey: ["inventory", "summary"],
    queryFn:  inventoryService.getSummary,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });

  const { data: listData, isLoading } = useQuery({
    queryKey: ["inventory", "list", { search, category: activeCategory, lowStockOnly, page }],
    queryFn: () => inventoryService.getItems({
      search: search || undefined,
      category: activeCategory ?? undefined,
      lowStockOnly: lowStockOnly || undefined,
      page,
      limit: 50,
    }),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const items = listData?.data ?? [];
  const meta  = listData?.meta;
  const totalValuePKR = summary ? summary.totalInventoryValue / 100 : 0;

  function invalidate() { void qc.invalidateQueries({ queryKey: ["inventory"] }); }

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

  const categories = useMemo(() => summary?.categories.map((c) => c.category) ?? [], [summary]);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Operations</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Inventory</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">
            {summary
              ? <>Total value: <span className="font-semibold text-ink">PKR {Math.floor(totalValuePKR).toLocaleString("en-PK")}</span></>
              : "—"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowScan(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-coral/30 bg-coral/5 text-coral text-sm font-semibold hover:bg-coral/10 transition-colors"
          >
            <ScanLine size={15} /> Scan Stock
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 h-10 px-4 rounded-full bg-coral text-white text-sm font-semibold hover:bg-coral-dark transition-colors shadow-pop"
          >
            <Plus size={15} /> Add Item
          </button>
        </div>
      </div>

      {/* Summary stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
        <StatCard icon={Package}       label="Total Items"      value={summary?.totalItems ?? 0}    bg="#E7EEF3" fg="#2c455c" delay={0}   />
        <StatCard icon={AlertTriangle} label="Low Stock"        value={summary?.lowStockCount ?? 0} bg="#F8EFDA" fg="#86600F" delay={50}  />
        <StatCard icon={X}             label="Out of Stock"     value={summary?.outOfStockCount ?? 0} bg="#FDECEA" fg="#9E3417" delay={100} />
        <StatCard
          icon={TrendingDown}
          label="Inventory Value"
          value={`PKR ${Math.floor(totalValuePKR).toLocaleString("en-PK")}`}
          bg="#E6F0EA" fg="#1F4D3A"
          delay={150}
        />
      </div>

      {/* Low stock alert */}
      {summary && summary.lowStockCount > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber/30 bg-amber-soft px-5 py-3.5 mb-5">
          <AlertTriangle size={16} className="text-amber shrink-0" />
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
      <Card pad={false} className="anim-fade-up overflow-hidden mb-5">
        <div className="flex flex-wrap items-center gap-3 p-4">
          {/* Category pills */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => { setActiveCategory(null); setPage(1); }}
              className={cn(
                "rounded-full px-3.5 h-9 text-[13px] font-semibold transition-all",
                activeCategory === null ? "bg-ink text-white" : "bg-white border border-line text-ink-soft hover:border-coral/30 hover:text-ink",
              )}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setPage(1); }}
                className={cn(
                  "rounded-full px-3.5 h-9 text-[13px] font-semibold transition-all",
                  activeCategory === cat ? "bg-ink text-white" : "bg-white border border-line text-ink-soft hover:border-coral/30 hover:text-ink",
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
              className="w-full h-9 rounded-xl border border-line bg-mist pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors"
            />
          </div>

          {/* Low stock toggle */}
          <button
            onClick={() => { setLowStockOnly((v) => !v); setPage(1); }}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border h-9 px-3.5 text-[13px] font-semibold transition-colors",
              lowStockOnly ? "border-amber bg-amber-soft text-amber" : "border-line bg-white text-ink-soft hover:border-coral/30 hover:text-ink",
            )}
          >
            <AlertTriangle size={13} /> Low Stock
          </button>

          {/* View toggle */}
          <div className="ml-auto inline-flex items-center bg-mist border border-line rounded-xl p-1 gap-0.5">
            <button
              onClick={() => setView("table")}
              className={cn("grid place-items-center h-7 w-7 rounded-lg transition-colors", view === "table" ? "bg-white text-ink shadow-sm" : "text-ink-faint")}
            >
              <List size={14} />
            </button>
            <button
              onClick={() => setView("grid")}
              className={cn("grid place-items-center h-7 w-7 rounded-lg transition-colors", view === "grid" ? "bg-white text-ink shadow-sm" : "text-ink-faint")}
            >
              <LayoutGrid size={14} />
            </button>
          </div>
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft animate-pulse">
            <div className="h-3 bg-line-soft rounded w-1/3" />
            <div className="flex-1 h-3 bg-line-soft rounded" />
          </div>
        ))
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-mist text-ink-faint">
            <Package size={26} />
          </div>
          <p className="text-[14px] font-semibold text-ink-soft">No items found</p>
          <p className="text-[13px] text-ink-faint">Try adjusting your filters or add a new item</p>
        </div>
      ) : view === "table" ? (
        <Card pad={false} className="anim-fade-up overflow-hidden">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1.2fr_0.8fr_0.8fr_1fr_auto] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
            <span>Item</span><span>Category</span><span>Stock</span><span>Par</span><span>Cost/unit</span><span>Supplier</span><span />
          </div>
          <div>
            {items.map((item) => (
              <div
                key={item.id}
                onClick={() => setSelectedId(item.id)}
                className="grid grid-cols-2 md:grid-cols-[2fr_1fr_1.2fr_0.8fr_0.8fr_1fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-mist cursor-pointer transition-colors border-b border-line-soft last:border-0"
              >
                <div>
                  <p className="text-[13.5px] font-semibold text-ink">{item.name}</p>
                  {item.sku && <p className="text-[11px] text-ink-faint">{item.sku}</p>}
                </div>
                <div className="text-[13px] text-ink-mute hidden md:block">{item.category}</div>
                <div className="hidden md:block">
                  <StockBar current={item.currentStock} par={item.parLevel} reorder={item.reorderLevel} unit={item.unit} />
                </div>
                <div className="text-[13px] text-ink-mute hidden md:block">{item.parLevel} {item.unit}</div>
                <div className="text-[13px] text-ink-mute hidden md:block">{formatPKR(item.costPerUnit)}</div>
                <div className="text-[13px] text-ink-mute truncate hidden md:block">{item.supplier ?? "—"}</div>
                <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setQuickTxnItem(item)}
                    className="inline-flex items-center gap-1 rounded-full h-8 px-3 text-[12px] font-semibold bg-pine-soft text-pine-deep hover:bg-pine/15 transition-colors"
                  >
                    + Stock
                  </button>
                  <button
                    onClick={() => handleDeactivate(item.id)}
                    className="h-8 px-3 rounded-full text-[12px] font-semibold text-ink-faint border border-line hover:text-clay hover:border-clay/30 hover:bg-clay-soft transition-colors"
                  >
                    Deactivate
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {items.map((item) => (
            <ItemCard key={item.id} item={item} onClick={() => setSelectedId(item.id)} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <span className="text-[13px] text-ink-mute">Page {page} of {meta.totalPages}</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors", page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
              disabled={page >= meta.totalPages}
              className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors", page >= meta.totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {selectedId && <ItemDetailDrawer itemId={selectedId} onClose={() => setSelectedId(null)} />}

      {showAdd && <AddItemModal onClose={() => setShowAdd(false)} onSuccess={handleAddItem} />}

      {showScan && (
        <ScanStockModal
          onClose={() => setShowScan(false)}
          onComplete={() => { invalidate(); }}
        />
      )}

      {quickTxnItem && (
        <RecordTransactionModal
          itemId={quickTxnItem.id}
          itemName={quickTxnItem.name}
          currentStock={quickTxnItem.currentStock}
          unit={quickTxnItem.unit}
          initialType="PURCHASE"
          onClose={() => setQuickTxnItem(null)}
          onSuccess={() => { setQuickTxnItem(null); invalidate(); }}
          onSubmit={handleQuickTxn}
        />
      )}
    </div>
  );
}
