import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus, Minus, ShoppingCart, UtensilsCrossed, ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  posService,
  type PosCategory,
  type PosItem,
  type PosOrder,
  type CartItem,
  type OrderStatus,
} from "@/services/pos";
import { PostToRoomModal } from "@/components/pos/PostToRoomModal";
import { DirectPaymentModal } from "@/components/pos/DirectPaymentModal";
import { ReceiptView } from "@/components/pos/ReceiptView";
import { AddCategoryModal } from "@/components/pos/AddCategoryModal";
import { EditCategoryModal } from "@/components/pos/EditCategoryModal";
import { AddItemModal } from "@/components/pos/AddItemModal";
import { EditItemModal } from "@/components/pos/EditItemModal";
import { ToastContainer } from "@/components/ui/ToastContainer";
import { useToast } from "@/hooks/useToast";
import { Card } from "@/components/ui/Card";
import { usePermissions } from "@/hooks/usePermissions";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

function timeAgo(iso: string): string {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(mins / 60);
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return "just now";
}

type TabType = "terminal" | "orders" | "menu";

// ── Status badge colours (design-system tokens) ───────────────────────────────

const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  OPEN:            "bg-amber-50 text-amber-700 border border-amber-200",
  POSTED_TO_FOLIO: "bg-[#E7EEF3] text-[#2c455c]",
  PAID:            "bg-[#E6F0EA] text-[#1F4D3A]",
  CANCELLED:       "bg-line-soft text-ink-mute line-through",
};
const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  OPEN:            "Open",
  POSTED_TO_FOLIO: "Posted to Folio",
  PAID:            "Paid",
  CANCELLED:       "Cancelled",
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function PosPage() {
  const qc = useQueryClient();
  const { has } = usePermissions();
  const canCreate = has("pos:create");
  const canUpdate = has("pos:update");
  const { toasts, addToast, removeToast } = useToast();

  const [tab, setTab] = useState<TabType>("terminal");

  const [cart,         setCart]         = useState<CartItem[]>([]);
  const [activeCatId,  setActiveCatId]  = useState<string | null>(null);
  const [showPostRoom, setShowPostRoom] = useState(false);
  const [showDirect,   setShowDirect]   = useState(false);

  const [ordersPage, setOrdersPage] = useState(1);
  const [receiptOrder, setReceiptOrder] = useState<PosOrder | null>(null);

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [showAddCat,    setShowAddCat]    = useState(false);
  const [editCat,       setEditCat]       = useState<PosCategory | null>(null);
  const [showAddItem,   setShowAddItem]   = useState(false);
  const [editItem,      setEditItem]      = useState<PosItem | null>(null);

  const { data: terminalCats = [] } = useQuery<PosCategory[]>({
    queryKey: ["pos-categories"],
    queryFn:  posService.getCategories,
    enabled:  tab === "terminal",
    refetchInterval: 15_000,
  });

  const { data: adminCats = [] } = useQuery<PosCategory[]>({
    queryKey: ["pos-categories-admin"],
    queryFn:  posService.getCategoriesAdmin,
    enabled:  tab === "menu",
    refetchInterval: 15_000,
  });

  const { data: ordersData } = useQuery({
    queryKey: ["pos-orders", ordersPage],
    queryFn:  () => posService.getOrders({ page: ordersPage, limit: 20 }),
    enabled:  tab === "orders",
    refetchInterval: 15_000,
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => posService.updateOrderStatus(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-orders"] });
      addToast("Order cancelled");
    },
    onError: () => addToast("Failed to cancel order", "error"),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => posService.toggleItemAvailability(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-categories-admin"] }),
  });

  const toggleQrMutation = useMutation({
    mutationFn: ({ id, isQrVisible }: { id: string; isQrVisible: boolean }) =>
      posService.updateItem(id, { isQrVisible }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-categories-admin"] }),
  });

  const cartTotal     = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const cartItemCount = cart.reduce((s, i) => s + i.quantity, 0);

  function maxSellableQuantity(item: PosItem): number | null {
    if (!item.inventoryItemId || !item.inventoryQtyUsed) return null;
    if (!item.inventoryIsActive) return 0;
    return Math.max(0, Math.floor((item.inventoryCurrentStock ?? 0) / item.inventoryQtyUsed));
  }

  function addToCart(item: PosItem) {
    const maxQuantity = maxSellableQuantity(item);
    setCart((prev) => {
      const existing = prev.find((c) => c.posItemId === item.id);
      if (maxQuantity !== null && (existing?.quantity ?? 0) >= maxQuantity) return prev;
      if (existing) return prev.map((c) => c.posItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { posItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }
  function setQty(posItemId: string, qty: number) {
    if (qty <= 0) setCart((prev) => prev.filter((c) => c.posItemId !== posItemId));
    else {
      const item = terminalCats.flatMap((category) => category.items).find((candidate) => candidate.id === posItemId);
      const maxQuantity = item ? maxSellableQuantity(item) : null;
      setCart((prev) => prev.map((c) => c.posItemId === posItemId
        ? { ...c, quantity: maxQuantity === null ? qty : Math.min(qty, maxQuantity) }
        : c));
    }
  }
  function clearCart() {
    setCart([]);
    setShowPostRoom(false);
    setShowDirect(false);
  }

  const filteredItems: PosItem[] = activeCatId === null
    ? terminalCats.flatMap((c) => c.items)
    : (terminalCats.find((c) => c.id === activeCatId)?.items ?? []);

  const selectedCat = adminCats.find((c) => c.id === selectedCatId) ?? null;

  const TABS: { key: TabType; label: string }[] = [
    { key: "terminal", label: "Terminal" },
    { key: "orders",   label: "Orders" },
    { key: "menu",     label: "Menu Setup" },
  ];

  return (
    <div className="flex flex-col -mx-5 sm:-mx-7 lg:-mx-9">
      {/* Page header */}
      <div className="px-5 sm:px-7 lg:px-9 pt-2 pb-4">
        <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Restaurant</div>
        <h1 className="serif text-[34px] leading-[1.05] text-ink">Point of Sale</h1>
      </div>

      {/* Tab nav — segmented control so it reads as a mode switcher, not a filter strip */}
      <div className="px-5 sm:px-7 lg:px-9 py-3 border-b border-line flex-shrink-0">
        <div className="inline-flex items-center bg-mist border border-line rounded-xl p-1 gap-0.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "relative px-5 py-2 rounded-lg text-[13px] font-semibold transition-all",
                tab === t.key
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-mute hover:text-ink-soft",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── TERMINAL TAB ─────────────────────────────────────────────────────── */}
      {tab === "terminal" && (
        <div className="flex overflow-hidden" style={{ height: "calc(100vh - 200px)", minHeight: 520 }}>

          {/* ── Left: category pills + item grid ── */}
          <div className="flex flex-col overflow-hidden bg-paper" style={{ flex: "0 0 64%" }}>

            {/* Category pill strip — same responsive padding as the tab nav and page header */}
            <div className="px-5 sm:px-7 lg:px-9 pt-4 pb-3 flex-shrink-0">
              <div className="flex gap-2 overflow-x-auto scrollbar-none">
                <button
                  onClick={() => setActiveCatId(null)}
                  className={cn(
                    "flex-shrink-0 h-10 px-5 rounded-full text-[13px] font-semibold transition-all",
                    activeCatId === null
                      ? "bg-coral text-white shadow-pop"
                      : "bg-white border border-line text-ink-soft shadow-sm hover:border-coral/50 hover:text-ink hover:shadow-md",
                  )}
                >
                  All
                </button>
                {terminalCats.map((cat) => {
                  const active = activeCatId === cat.id;
                  return (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCatId(cat.id)}
                      className={cn(
                        "flex-shrink-0 h-10 px-5 rounded-full text-[13px] font-semibold transition-all",
                        active
                          ? "bg-coral text-white shadow-pop"
                          : "bg-white border border-line text-ink-soft shadow-sm hover:border-coral/50 hover:text-ink hover:shadow-md",
                      )}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 border-b border-line-soft" />
            </div>

            {/* Item grid — left padding matches tab nav; right/top/bottom use smaller value */}
            <div className="flex-1 overflow-y-auto scroll-area px-5 sm:px-7 lg:px-9 py-4">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-ink-faint gap-3">
                  <div className="grid place-items-center h-14 w-14 rounded-2xl bg-line-soft text-ink-faint">
                    <UtensilsCrossed size={26} />
                  </div>
                  <p className="text-[14px] font-medium text-ink-mute">No items in this category</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                  {filteredItems.map((item) => {
                    const qty = cart.find((c) => c.posItemId === item.id)?.quantity ?? 0;
                    const active = qty > 0;
                    const maxQuantity = maxSellableQuantity(item);
                    const soldOut = maxQuantity === 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        disabled={soldOut}
                        className={cn(
                          "relative text-left rounded-2xl p-4 transition-all min-h-[130px] flex flex-col gap-1 active:scale-[0.97]",
                          soldOut && "cursor-not-allowed opacity-60 grayscale-[0.25] active:scale-100",
                          active
                            ? "bg-coral text-white shadow-float ring-0"
                            : "bg-card border border-line hover:border-coral/40 hover:shadow-md",
                        )}
                      >
                        {/* Qty badge */}
                        {active && (
                          <span className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/25 text-white text-[12px] font-bold flex items-center justify-center">
                            {qty}
                          </span>
                        )}

                        {/* Name */}
                        <p className={cn(
                          "font-bold text-[14.5px] leading-snug flex-1",
                          active ? "text-white pr-8" : "text-ink",
                        )}>
                          {item.name}
                        </p>

                        {soldOut && (
                          <span className="absolute right-3 top-3 rounded-full bg-clay-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-clay">
                            Sold out
                          </span>
                        )}

                        {/* Description */}
                        {item.description && (
                          <p className={cn(
                            "text-[12px] line-clamp-1",
                            active ? "text-white/70" : "text-ink-faint",
                          )}>
                            {item.description}
                          </p>
                        )}

                        {/* Footer: price + add indicator */}
                        <div className="mt-2 flex items-center justify-between">
                          <span className={cn(
                            "font-bold text-[16px] tnum",
                            active ? "text-white" : "text-coral",
                          )}>
                            {formatPKR(item.price)}
                          </span>
                          {!active && !soldOut && (
                            <span className="grid place-items-center w-7 h-7 rounded-full bg-coral-soft text-coral">
                              <Plus size={14} />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Right: order panel ── */}
          <div className="flex flex-col flex-shrink-0 overflow-hidden bg-card border-l border-line" style={{ flex: "0 0 36%" }}>

            {/* Cart header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="grid place-items-center w-9 h-9 rounded-xl bg-coral-soft flex-shrink-0">
                  <Receipt size={16} className="text-coral" />
                </div>
                <div>
                  <h2 className="text-[14.5px] font-bold text-ink leading-tight">Current Order</h2>
                  <p className="text-[11px] text-ink-faint">
                    {cartItemCount > 0 ? `${cartItemCount} item${cartItemCount !== 1 ? "s" : ""}` : "Empty"}
                  </p>
                </div>
              </div>
              {cart.length > 0 && (
                <button
                  onClick={clearCart}
                  className="text-[12px] text-clay font-semibold hover:text-clay-deep px-3 py-1 rounded-full hover:bg-clay-soft/40 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto scroll-area px-5 py-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-3 py-10">
                  <div className="grid place-items-center w-16 h-16 rounded-2xl bg-mist text-ink-faint">
                    <Receipt size={28} />
                  </div>
                  <p className="text-[13.5px] text-ink-mute text-center font-medium">
                    No items yet
                  </p>
                  <p className="text-[12px] text-ink-faint text-center">
                    Select items from the menu
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-line-soft">
                  {cart.map((item) => (
                    <div key={item.posItemId} className="flex items-center gap-3 py-3.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-[13.5px] font-semibold text-ink truncate">{item.name}</p>
                        <p className="text-[12px] text-ink-faint tnum">{formatPKR(item.price)} each</p>
                      </div>
                      {/* Qty stepper */}
                      <div className="flex items-center gap-1 flex-shrink-0 bg-mist rounded-full px-1 py-1">
                        <button
                          onClick={() => setQty(item.posItemId, item.quantity - 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-ink-mute hover:bg-white hover:text-ink transition-colors"
                        >
                          <Minus size={10} />
                        </button>
                        <span className="w-6 text-center text-[13px] font-bold text-ink">{item.quantity}</span>
                        <button
                          onClick={() => setQty(item.posItemId, item.quantity + 1)}
                          className="w-6 h-6 rounded-full flex items-center justify-center text-ink-mute hover:bg-white hover:text-ink transition-colors"
                        >
                          <Plus size={10} />
                        </button>
                      </div>
                      <span className="text-[13.5px] font-bold text-ink tnum w-20 text-right flex-shrink-0">
                        {formatPKR(item.price * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Total + charge buttons */}
            {cart.length > 0 && (
              <div className="flex-shrink-0 border-t border-line px-5 pt-4 pb-5">
                {/* Total row */}
                <div className="flex items-end justify-between mb-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint">Order Total</p>
                    <p className="text-[12px] text-ink-mute mt-0.5">{cartItemCount} item{cartItemCount !== 1 ? "s" : ""}</p>
                  </div>
                  <span className="serif text-[32px] text-ink tnum leading-none">{formatPKR(cartTotal)}</span>
                </div>

                {/* Charge buttons */}
                {canCreate && (
                  <div className="space-y-2.5">
                    <button
                      onClick={() => setShowPostRoom(true)}
                      className="w-full h-12 bg-coral hover:bg-coral-dark text-white rounded-2xl font-bold text-[14px] transition-all shadow-pop flex items-center justify-center gap-2 active:scale-[0.98]"
                    >
                      <Receipt size={18} />
                      Post to Room
                    </button>
                    <button
                      onClick={() => setShowDirect(true)}
                      className="w-full h-12 border-2 border-line text-ink-soft rounded-2xl font-semibold text-[14px] hover:border-ink/30 hover:bg-mist hover:text-ink transition-all"
                    >
                      Direct Payment
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ORDERS TAB ───────────────────────────────────────────────────────── */}
      {tab === "orders" && (
        <div className="overflow-y-auto scroll-area px-5 sm:px-7 lg:px-9 py-6" style={{ height: "calc(100vh - 200px)" }}>
          <Card pad={false} className="anim-fade-up overflow-hidden">
            {/* Column headers */}
            <div className="hidden md:grid grid-cols-[1fr_2fr_0.8fr_0.9fr_0.9fr_0.7fr_auto] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
              <span>Order #</span>
              <span>Items</span>
              <span className="text-right">Total</span>
              <span>Settlement</span>
              <span>Status</span>
              <span>Time</span>
              <span />
            </div>

            {!ordersData ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4 px-5 py-3.5 border-b border-line-soft animate-pulse">
                  <div className="h-3 bg-line-soft rounded w-20 flex-shrink-0" />
                  <div className="flex-1 h-3 bg-line-soft rounded" />
                  <div className="h-3 bg-line-soft rounded w-16 flex-shrink-0" />
                  <div className="h-5 bg-line-soft rounded-full w-20 flex-shrink-0" />
                </div>
              ))
            ) : ordersData.data.length === 0 ? (
              <div className="flex flex-col items-center py-16">
                <div className="grid place-items-center h-14 w-14 rounded-2xl bg-line-soft text-ink-faint mb-4">
                  <ShoppingCart size={26} />
                </div>
                <p className="text-base font-semibold text-ink-soft">No orders yet</p>
              </div>
            ) : (
              ordersData.data.map((order: PosOrder) => {
                const summary = order.items
                  .slice(0, 2)
                  .map((i) => `${i.name} × ${i.quantity}`)
                  .join(", ") + (order.items.length > 2 ? "…" : "");
                const settlement = order.status === "POSTED_TO_FOLIO"
                  ? `Room ${order.roomNumber ?? "—"}`
                  : order.paymentMethod
                    ? order.paymentMethod.replace("_", " ")
                    : "—";
                return (
                  <div
                    key={order.id}
                    className="grid grid-cols-2 md:grid-cols-[1fr_2fr_0.8fr_0.9fr_0.9fr_0.7fr_auto] gap-3 px-5 py-3.5 items-center border-b border-line-soft last:border-0 hover:bg-mist transition-colors"
                  >
                    <span className="font-mono text-[12px] text-ink-mute whitespace-nowrap">{order.orderNumber}</span>
                    <span className="text-[13px] text-ink-soft truncate hidden md:block">{summary}</span>
                    <span className="text-[13px] font-semibold text-ink text-right whitespace-nowrap tnum hidden md:block">{formatPKR(order.total)}</span>
                    <span className="text-[13px] text-ink-soft whitespace-nowrap hidden md:block">{settlement}</span>
                    <span className="hidden md:inline-flex">
                      <span className={cn("text-[11.5px] px-2.5 py-0.5 rounded-full font-semibold whitespace-nowrap", ORDER_STATUS_STYLE[order.status])}>
                        {ORDER_STATUS_LABEL[order.status]}
                      </span>
                    </span>
                    <span className="text-[12px] text-ink-faint whitespace-nowrap hidden md:block tnum">{timeAgo(order.createdAt)}</span>
                    <div className="flex items-center justify-end gap-2">
                      {(order.status === "PAID" || order.status === "POSTED_TO_FOLIO") && (
                        <button
                          onClick={() => setReceiptOrder(order)}
                          className="grid place-items-center h-7 w-7 rounded-full hover:bg-line-soft text-ink-mute hover:text-ink transition-colors"
                          title="Print receipt"
                        >
                          <Printer size={14} />
                        </button>
                      )}
                      {canUpdate && order.status === "OPEN" && (
                        <button
                          onClick={() => cancelMutation.mutate(order.id)}
                          disabled={cancelMutation.isPending}
                          className="text-[12px] text-clay font-semibold hover:text-clay-deep transition-colors disabled:opacity-40"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </Card>

          {/* Pagination */}
          {ordersData && ordersData.meta.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-[13px] text-ink-mute">Page {ordersData.meta.page} of {ordersData.meta.totalPages}</p>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setOrdersPage((p) => p - 1)}
                  disabled={ordersPage <= 1}
                  className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors", ordersPage <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setOrdersPage((p) => p + 1)}
                  disabled={ordersPage >= ordersData.meta.totalPages}
                  className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors", ordersPage >= ordersData.meta.totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── MENU SETUP TAB ───────────────────────────────────────────────────── */}
      {tab === "menu" && (
        <div className="overflow-hidden flex px-5 sm:px-7 lg:px-9 py-6 gap-5" style={{ height: "calc(100vh - 200px)" }}>
          {/* Categories panel */}
          <div className="w-68 flex-shrink-0 flex flex-col overflow-hidden rounded-xl2 border border-line bg-card shadow-sm" style={{ width: 272 }}>
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-line">
              <span className="text-[13.5px] font-semibold text-ink">Categories</span>
              {canCreate && (
                <button
                  onClick={() => setShowAddCat(true)}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-coral hover:text-coral-dark transition-colors"
                >
                  <Plus size={13} /> Add
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto scroll-area divide-y divide-line-soft">
              {adminCats.length === 0 ? (
                <div className="px-4 py-8 text-center text-[12px] text-ink-faint">No categories yet</div>
              ) : (
                adminCats.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCatId(cat.id)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-center justify-between transition-colors group",
                      selectedCatId === cat.id ? "bg-mist" : "hover:bg-mist/60",
                    )}
                  >
                    <div className="min-w-0">
                      <p className={cn("text-[13.5px] font-medium truncate flex items-center gap-1.5", selectedCatId === cat.id ? "text-coral" : "text-ink")}>
                        {cat.name}
                        {!cat.isActive && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-ink-faint bg-line-soft px-1.5 py-0.5 rounded shrink-0">
                            Hidden from POS
                          </span>
                        )}
                      </p>
                      <p className="text-[12px] text-ink-faint">{cat.items.length} item{cat.items.length !== 1 ? "s" : ""}</p>
                    </div>
                    {canUpdate && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditCat(cat); }}
                        className="text-[12px] font-medium text-ink-faint hover:text-ink-soft opacity-0 group-hover:opacity-100 transition-opacity ml-2 flex-shrink-0"
                      >
                        Edit
                      </button>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Items panel */}
          <div className="flex-1 flex flex-col overflow-hidden rounded-xl2 border border-line bg-card shadow-sm">
            {!selectedCat ? (
              <div className="flex-1 flex flex-col items-center justify-center text-ink-faint gap-3">
                <div className="grid place-items-center h-12 w-12 rounded-xl bg-mist text-ink-faint">
                  <UtensilsCrossed size={22} />
                </div>
                <p className="text-[14px] text-ink-mute">Select a category to manage items</p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-line">
                  <span className="text-[13.5px] font-semibold text-ink">{selectedCat.name}</span>
                  {canCreate && (
                    <button
                      onClick={() => setShowAddItem(true)}
                      className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-white bg-ink hover:bg-ink/90 px-3.5 py-1.5 rounded-full shadow-pop transition-colors"
                    >
                      <Plus size={13} /> Add Item
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-y-auto scroll-area">
                  {selectedCat.items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-ink-mute text-[14px]">
                      No items in this category
                    </div>
                  ) : (
                    <>
                      {/* Table headers */}
                      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
                        <span>Name</span>
                        <span className="text-right">Price</span>
                        <span className="text-center">POS</span>
                        <span className="text-center">QR Menu</span>
                        <span />
                      </div>
                      <div className="divide-y divide-line-soft">
                        {selectedCat.items.map((item) => (
                          <div key={item.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3.5 items-center hover:bg-mist transition-colors">
                            <div>
                              <p className="text-[13.5px] font-medium text-ink">{item.name}</p>
                              {item.description && (
                                <p className="text-[12px] text-ink-faint truncate max-w-[240px]">{item.description}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <span className="text-[13.5px] font-semibold text-ink tnum whitespace-nowrap">
                                {formatPKR(item.price)}
                              </span>
                            </div>
                            <div className="flex justify-center" title="Show on POS terminal">
                              {canUpdate ? (
                                <button
                                  onClick={() => toggleMutation.mutate(item.id)}
                                  disabled={toggleMutation.isPending}
                                  className={cn(
                                    "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
                                    item.isAvailable ? "bg-pine" : "bg-line-soft",
                                  )}
                                >
                                  <span className={cn(
                                    "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                                    item.isAvailable ? "translate-x-5" : "translate-x-0.5",
                                  )} />
                                </button>
                              ) : (
                                <span className={cn(
                                  "w-11 h-6 rounded-full flex items-center flex-shrink-0",
                                  item.isAvailable ? "bg-pine" : "bg-line-soft",
                                )}>
                                  <span className={cn(
                                    "w-5 h-5 bg-white rounded-full shadow",
                                    item.isAvailable ? "translate-x-5" : "translate-x-0.5",
                                  )} />
                                </span>
                              )}
                            </div>
                            <div className="flex justify-center" title="Show on guest QR menu">
                              {canUpdate ? (
                                <button
                                  onClick={() => toggleQrMutation.mutate({ id: item.id, isQrVisible: !item.isQrVisible })}
                                  disabled={toggleQrMutation.isPending}
                                  className={cn(
                                    "w-11 h-6 rounded-full transition-colors duration-200 flex items-center flex-shrink-0",
                                    item.isQrVisible ? "bg-coral" : "bg-line-soft",
                                  )}
                                >
                                  <span className={cn(
                                    "w-5 h-5 bg-white rounded-full shadow transition-transform duration-200",
                                    item.isQrVisible ? "translate-x-5" : "translate-x-0.5",
                                  )} />
                                </button>
                              ) : (
                                <span className={cn(
                                  "w-11 h-6 rounded-full flex items-center flex-shrink-0",
                                  item.isQrVisible ? "bg-coral" : "bg-line-soft",
                                )}>
                                  <span className={cn(
                                    "w-5 h-5 bg-white rounded-full shadow",
                                    item.isQrVisible ? "translate-x-5" : "translate-x-0.5",
                                  )} />
                                </span>
                              )}
                            </div>
                            <div className="flex justify-end">
                              {canUpdate && (
                                <button
                                  onClick={() => setEditItem(item)}
                                  className="text-[12px] font-medium text-ink-soft hover:text-ink border border-line rounded-full px-3 py-1 hover:bg-mist transition-colors"
                                >
                                  Edit
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {showPostRoom && (
        <PostToRoomModal
          cart={cart}
          onClose={() => setShowPostRoom(false)}
          onSuccess={(msg) => { clearCart(); addToast(msg); }}
        />
      )}
      {showDirect && (
        <DirectPaymentModal
          cart={cart}
          onClose={() => setShowDirect(false)}
          onSuccess={(msg) => { clearCart(); addToast(msg); }}
        />
      )}
      {showAddCat  && <AddCategoryModal onClose={() => setShowAddCat(false)} />}
      {editCat     && <EditCategoryModal category={editCat} onClose={() => setEditCat(null)} />}
      {showAddItem && selectedCat && (
        <AddItemModal category={selectedCat} onClose={() => setShowAddItem(false)} />
      )}
      {editItem    && <EditItemModal item={editItem} onClose={() => setEditItem(null)} />}

      {receiptOrder && (
        <ReceiptView
          orderNumber={receiptOrder.orderNumber}
          dateTime={receiptOrder.createdAt}
          roomNumber={receiptOrder.roomNumber ?? undefined}
          items={receiptOrder.items.map((i) => ({
            name:      i.name,
            quantity:  i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          }))}
          subtotal={receiptOrder.subtotal}
          taxAmount={receiptOrder.taxAmount}
          discountAmount={receiptOrder.discountAmount}
          total={receiptOrder.total}
          paymentStatus={
            receiptOrder.status === "POSTED_TO_FOLIO"
              ? { type: "CHARGED_TO_ROOM", roomNumber: receiptOrder.roomNumber ?? "—" }
              : { type: "PAID", method: receiptOrder.paymentMethod ?? "CASH" }
          }
          onClose={() => setReceiptOrder(null)}
        />
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
