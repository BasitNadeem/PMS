import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Plus, Minus, ShoppingCart, UtensilsCrossed, ChevronLeft, ChevronRight } from "lucide-react";
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

  const [selectedCatId, setSelectedCatId] = useState<string | null>(null);
  const [showAddCat,    setShowAddCat]    = useState(false);
  const [editCat,       setEditCat]       = useState<PosCategory | null>(null);
  const [showAddItem,   setShowAddItem]   = useState(false);
  const [editItem,      setEditItem]      = useState<PosItem | null>(null);

  const { data: terminalCats = [] } = useQuery<PosCategory[]>({
    queryKey: ["pos-categories"],
    queryFn:  posService.getCategories,
    enabled:  tab === "terminal",
  });

  const { data: adminCats = [] } = useQuery<PosCategory[]>({
    queryKey: ["pos-categories-admin"],
    queryFn:  posService.getCategoriesAdmin,
    enabled:  tab === "menu",
  });

  const { data: ordersData } = useQuery({
    queryKey: ["pos-orders", ordersPage],
    queryFn:  () => posService.getOrders({ page: ordersPage, limit: 20 }),
    enabled:  tab === "orders",
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

  function addToCart(item: PosItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.posItemId === item.id);
      if (existing) return prev.map((c) => c.posItemId === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { posItemId: item.id, name: item.name, price: item.price, quantity: 1 }];
    });
  }
  function setQty(posItemId: string, qty: number) {
    if (qty <= 0) setCart((prev) => prev.filter((c) => c.posItemId !== posItemId));
    else          setCart((prev) => prev.map((c) => c.posItemId === posItemId ? { ...c, quantity: qty } : c));
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

      {/* Tab nav */}
      <div className="border-b border-line px-5 sm:px-7 lg:px-9 flex items-center gap-0.5 flex-shrink-0">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-5 py-3.5 text-[13.5px] font-semibold transition-colors border-b-2 -mb-px",
              tab === t.key
                ? "border-coral text-coral"
                : "border-transparent text-ink-mute hover:text-ink-soft",
            )}
          >
            {t.label}
            {t.key === "terminal" && cartItemCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-coral text-white text-[11px] font-bold leading-none">
                {cartItemCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── TERMINAL TAB ─────────────────────────────────────────────────────── */}
      {tab === "terminal" && (
        <div className="flex overflow-hidden" style={{ height: "calc(100vh - 200px)", minHeight: 520 }}>
          {/* Left: menu */}
          <div className="flex flex-col overflow-hidden" style={{ flex: "0 0 64%" }}>
            {/* Category filter pills */}
            <div className="border-b border-line-soft px-5 py-3 flex gap-2 overflow-x-auto flex-shrink-0 scroll-area">
              <button
                onClick={() => setActiveCatId(null)}
                className={cn(
                  "flex-shrink-0 h-8 px-4 rounded-full text-[13px] font-semibold transition-colors",
                  activeCatId === null
                    ? "bg-ink text-white"
                    : "bg-mist text-ink-soft hover:bg-line-soft",
                )}
              >
                All
              </button>
              {terminalCats.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCatId(cat.id)}
                  className={cn(
                    "flex-shrink-0 h-8 px-4 rounded-full text-[13px] font-semibold transition-colors",
                    activeCatId === cat.id
                      ? "bg-ink text-white"
                      : "bg-mist text-ink-soft hover:bg-line-soft",
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>

            {/* Item grid */}
            <div className="flex-1 overflow-y-auto scroll-area p-5">
              {filteredItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-ink-faint">
                  <UtensilsCrossed size={32} className="mb-3 text-line" />
                  <p className="text-[14px] font-medium text-ink-mute">No items in this category</p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-3">
                  {filteredItems.map((item) => {
                    const cartItem = cart.find((c) => c.posItemId === item.id);
                    const qty      = cartItem?.quantity ?? 0;
                    return (
                      <button
                        key={item.id}
                        onClick={() => addToCart(item)}
                        className={cn(
                          "relative text-left rounded-xl2 border p-4 transition-all min-h-[100px]",
                          qty > 0
                            ? "border-coral bg-[#FDF1EC] shadow-pop"
                            : "border-line bg-card hover:border-coral/30 hover:shadow-sm",
                        )}
                      >
                        {qty > 0 && (
                          <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-coral text-white text-[11px] font-bold flex items-center justify-center shadow-pop">
                            {qty}
                          </span>
                        )}
                        <p className="font-semibold text-[13.5px] text-ink leading-snug pr-7">{item.name}</p>
                        {item.description && (
                          <p className="text-[12px] text-ink-mute mt-0.5 truncate">{item.description}</p>
                        )}
                        <p className="text-[13px] font-semibold text-ink-soft mt-2.5 tnum">{formatPKR(item.price)}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Right: cart */}
          <div className="bg-card border-l border-line shadow-[-1px_0_0_0_rgba(33,30,26,0.04)] flex flex-col flex-shrink-0 overflow-hidden" style={{ flex: "0 0 36%" }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-line flex-shrink-0">
              <h2 className="text-[15px] font-semibold text-ink">Current Order</h2>
              {cart.length > 0 && (
                <button onClick={clearCart} className="text-[12px] text-clay font-semibold hover:text-clay-deep transition-colors">
                  Clear
                </button>
              )}
            </div>

            {/* Cart items */}
            <div className="flex-1 overflow-y-auto scroll-area px-4 py-3 space-y-2">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-ink-faint py-10">
                  <Receipt size={32} className="mb-3 text-line" />
                  <p className="text-[13.5px] text-ink-mute text-center">No items added yet —<br />tap from the menu</p>
                </div>
              ) : (
                cart.map((item) => (
                  <div key={item.posItemId} className="bg-mist rounded-xl px-3.5 py-2.5 flex items-center gap-3">
                    <span className="flex-1 text-[13.5px] font-medium text-ink truncate">{item.name}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button
                        onClick={() => setQty(item.posItemId, item.quantity - 1)}
                        className="w-7 h-7 rounded-full border border-line bg-card flex items-center justify-center text-ink-mute hover:bg-line-soft transition-colors"
                      >
                        <Minus size={11} />
                      </button>
                      <span className="w-6 text-center text-[13px] font-bold text-ink">{item.quantity}</span>
                      <button
                        onClick={() => setQty(item.posItemId, item.quantity + 1)}
                        className="w-7 h-7 rounded-full border border-line bg-card flex items-center justify-center text-ink-mute hover:bg-line-soft transition-colors"
                      >
                        <Plus size={11} />
                      </button>
                    </div>
                    <span className="text-[13px] font-semibold text-ink w-20 text-right flex-shrink-0 tnum">
                      {formatPKR(item.price * item.quantity)}
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Total + actions */}
            {cart.length > 0 && (
              <div className="px-4 pb-5 flex-shrink-0 space-y-3 border-t border-line pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-ink-mute">{cartItemCount} item{cartItemCount !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-line-soft">
                  <span className="text-[15px] font-semibold text-ink-soft">Total</span>
                  <span className="serif text-[22px] text-ink tnum">{formatPKR(cartTotal)}</span>
                </div>
                {canCreate && (
                  <button
                    onClick={() => setShowPostRoom(true)}
                    className="w-full h-11 bg-ink hover:bg-ink/90 text-white rounded-xl text-[13.5px] font-semibold transition-colors shadow-pop"
                  >
                    Post to Room
                  </button>
                )}
                {canCreate && (
                  <button
                    onClick={() => setShowDirect(true)}
                    className="w-full h-11 border border-line text-ink-soft rounded-xl text-[13.5px] font-semibold hover:bg-mist transition-colors"
                  >
                    Direct Payment
                  </button>
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
                    <div className="flex justify-end">
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

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
