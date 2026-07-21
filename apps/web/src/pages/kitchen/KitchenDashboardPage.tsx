import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, UtensilsCrossed, Pencil, X, Plus, Minus,
  Trash2, AlertTriangle, Clock,
} from "lucide-react";
import { qrOrdersService, type QrOrder, type QrOrderItem } from "../../services/qrOrders";
import { posService, type PosItem } from "../../services/pos";
import { useEscapeKey } from "../../hooks/useEscapeKey";

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_CARD_STYLES: Record<string, { bg: string; border: string; dot: string; label: string }> = {
  pending:   { bg: "bg-amber-soft",  border: "border-amber/30",  dot: "bg-amber",      label: "Pending" },
  confirmed: { bg: "bg-slate-soft",  border: "border-slate/30",  dot: "bg-slate",      label: "Confirmed" },
  preparing: { bg: "bg-pine-soft",   border: "border-pine/30",   dot: "bg-pine",       label: "Preparing" },
  ready:     { bg: "bg-green-50",    border: "border-green-300", dot: "bg-green-500",  label: "Ready" },
};

const ORDER_CARD_STYLES: Record<string, string> = {
  pending:   "border-amber/40 bg-amber-soft/50",
  confirmed: "border-slate/30 bg-slate-soft/40",
  preparing: "border-pine/30 bg-pine-soft/50",
  ready:     "border-green-300 bg-green-50",
};

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-soft text-amber",
  confirmed: "bg-slate-soft text-slate",
  preparing: "bg-pine-soft text-pine-deep",
  ready:     "bg-green-100 text-green-700",
  delivered: "bg-gray-100 text-gray-500",
  cancelled: "bg-red-100 text-red-600",
};

const NEXT_STATUS: Record<string, string> = {
  pending:   "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready:     "delivered",
};

const NEXT_LABEL: Record<string, string> = {
  pending:   "Confirm",
  confirmed: "Start Cooking",
  preparing: "Mark Ready",
  ready:     "Delivered",
};

const DELIVERY_LABELS: Record<string, string> = {
  room_delivery: "Room Delivery",
  pickup:        "Pick Up",
  dine_in:       "Dine In",
};

const IN_PROGRESS_STATUSES = new Set(["preparing", "ready", "delivered"]);

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH",        label: "Cash" },
  { value: "JAZZCASH",    label: "JazzCash" },
  { value: "EASYPAISA",   label: "Easypaisa" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD",  label: "Debit Card" },
];

// ── types ─────────────────────────────────────────────────────────────────────

interface EditItem {
  menuItemId:  string;
  itemName:    string;
  itemPrice:   number;
  quantity:    number;
  specialNote: string;
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function KitchenDashboardPage() {
  const qc = useQueryClient();
  const [tick, setTick]               = useState(0);
  const [editOrder, setEditOrder]     = useState<QrOrder | null>(null);
  const [cancelOrder, setCancelOrder] = useState<QrOrder | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(id);
  }, []);

  const { data: orders = [], isFetching } = useQuery({
    queryKey:  ["kitchen-orders-dashboard", tick],
    queryFn:   qrOrdersService.getKitchenOrders,
    staleTime: 0,
  });

  const { mutate: advance, isPending: advancing } = useMutation({
    mutationFn: ({ id, status, paymentMethod }: { id: string; status: string; paymentMethod?: string }) =>
      qrOrdersService.updateStatus(id, status, paymentMethod),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitchen-orders-dashboard"] }),
  });

  const { mutate: doCancel, isPending: cancelling } = useMutation({
    mutationFn: (id: string) => qrOrdersService.updateStatus(id, "cancelled"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitchen-orders-dashboard"] });
      setCancelOrder(null);
    },
  });

  const { mutate: doEdit, isPending: editing } = useMutation({
    mutationFn: ({ id, payload }: {
      id:      string;
      payload: Parameters<typeof qrOrdersService.editOrder>[1];
    }) => qrOrdersService.editOrder(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitchen-orders-dashboard"] });
      setEditOrder(null);
    },
  });

  const COLUMNS = ["pending", "confirmed", "preparing", "ready"] as const;

  return (
    <div className="flex flex-col h-full">

      {/* Page header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-ink">Live Orders</h1>
          <div className="flex items-center gap-1.5 mt-0.5">
            <Clock size={12} className="text-ink-faint" />
            <p className="text-xs text-ink-faint">Refreshes every 8 seconds</p>
            {isFetching && <Loader2 size={12} className="animate-spin text-ink-faint" />}
          </div>
        </div>
        <div className="text-sm font-semibold text-ink-mute">
          {orders.length} active order{orders.length !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto px-6 pb-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-ink-faint">
            <UtensilsCrossed size={48} className="opacity-30" />
            <p className="text-base font-medium">No active orders right now</p>
            <p className="text-sm">Orders will appear here automatically</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 min-w-[720px]">
            {COLUMNS.map((s) => {
              const style      = STATUS_CARD_STYLES[s];
              const colOrders  = orders.filter((o) => o.status === s);
              return (
                <div key={s} className="flex flex-col gap-3 min-w-0">
                  {/* Column header */}
                  <div className={`${style.bg} border ${style.border} rounded-2xl px-4 py-3 flex items-center gap-3`}>
                    <div className={`w-2.5 h-2.5 rounded-full ${style.dot} shrink-0`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-ink leading-none">{colOrders.length}</div>
                      <div className="text-xs text-ink-mute mt-0.5">{style.label}</div>
                    </div>
                  </div>

                  {/* Cards in this column */}
                  {colOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      onAdvance={(id, status, paymentMethod) => advance({ id, status, paymentMethod })}
                      onEdit={() => setEditOrder(order)}
                      onCancel={() => setCancelOrder(order)}
                      isAdvancing={advancing}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editOrder && (
        <EditOrderModal
          order={editOrder}
          onClose={() => setEditOrder(null)}
          onSave={(payload) => doEdit({ id: editOrder.id, payload })}
          saving={editing}
        />
      )}

      {/* Cancel confirm */}
      {cancelOrder && (
        <CancelConfirmDialog
          order={cancelOrder}
          onClose={() => setCancelOrder(null)}
          onConfirm={() => doCancel(cancelOrder.id)}
          confirming={cancelling}
        />
      )}
    </div>
  );
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

function OrderCard({
  order, onAdvance, onEdit, onCancel, isAdvancing,
}: {
  order:       QrOrder;
  onAdvance:   (id: string, status: string, paymentMethod?: string) => void;
  onEdit:      () => void;
  onCancel:    () => void;
  isAdvancing: boolean;
}) {
  const next      = NEXT_STATUS[order.status];
  const nextLabel = NEXT_LABEL[order.status];
  const elapsed   = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const canCancel = order.status !== "delivered" && order.status !== "cancelled";
  const cardStyle = ORDER_CARD_STYLES[order.status] ?? "border-line bg-card";
  const needsPaymentMethod = next === "delivered" && order.payment_preference === "pay_now";
  const [paymentMethod, setPaymentMethod] = useState("");

  return (
    <div className={`rounded-2xl border-2 ${cardStyle} p-4 flex flex-col gap-3`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-bold text-lg text-ink leading-none">{order.order_number}</p>
          <p className="text-xs text-ink-mute mt-0.5">{order.room_number ? `Room ${order.room_number} · ` : ""}{order.guest_name}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onEdit}
            className="grid place-items-center h-7 w-7 rounded-lg bg-white border border-line text-ink-mute hover:text-ink hover:border-ink/20 transition-colors"
            title="Edit order"
          >
            <Pencil size={13} />
          </button>
          {canCancel && (
            <button
              onClick={onCancel}
              className="grid place-items-center h-7 w-7 rounded-lg bg-white border border-line text-red-400 hover:text-red-600 hover:border-red-200 transition-colors"
              title="Cancel order"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Status + time */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_BADGE[order.status] ?? "bg-gray-100 text-gray-500"}`}>
          {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
        </span>
        <span className="text-xs text-ink-faint">{elapsed}m ago</span>
      </div>

      {/* Delivery type */}
      <p className="text-xs font-medium text-ink-mute uppercase tracking-wide">
        {DELIVERY_LABELS[order.delivery_type] ?? order.delivery_type}
        {order.payment_preference === "pay_now" && (
          <span className="ml-2 normal-case font-normal text-gray-400">· pay on delivery</span>
        )}
        {order.payment_preference === "charge_to_room" && order.reservation_id && (
          <span className="ml-2 normal-case font-normal text-blue-500">· room charge</span>
        )}
      </p>

      {/* Items */}
      <ul className="space-y-1">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm text-ink">
            <span className="font-bold text-ink shrink-0">×{item.quantity}</span>
            <div className="min-w-0">
              <span>{item.item_name}</span>
              {item.special_note && (
                <p className="text-xs text-amber italic">{item.special_note}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {order.special_instructions && (
        <p className="text-xs text-amber bg-amber-soft rounded-lg px-2 py-1.5 italic">
          {order.special_instructions}
        </p>
      )}

      {/* Advance button */}
      {next && (
        <div className="mt-auto flex flex-col gap-2">
          {needsPaymentMethod && (
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="h-9 rounded-xl border border-line bg-white px-3 text-sm text-ink cursor-pointer"
            >
              <option value="">Payment method received…</option>
              {PAYMENT_METHOD_OPTIONS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          )}
          <button
            onClick={() => onAdvance(order.id, next, needsPaymentMethod ? paymentMethod : undefined)}
            disabled={isAdvancing || (needsPaymentMethod && !paymentMethod)}
            className="w-full py-2.5 rounded-xl bg-ink text-white text-sm font-bold hover:bg-ink/80 disabled:opacity-50 transition-colors"
          >
            {nextLabel}
          </button>
        </div>
      )}
    </div>
  );
}

// ── EditOrderModal (light) ────────────────────────────────────────────────────

function EditOrderModal({
  order, onClose, onSave, saving,
}: {
  order:   QrOrder;
  onClose: () => void;
  onSave:  (payload: Parameters<typeof qrOrdersService.editOrder>[1]) => void;
  saving:  boolean;
}) {
  useEscapeKey(onClose);
  const [items, setItems]             = useState<EditItem[]>(
    order.items.map((i: QrOrderItem) => ({
      menuItemId:  i.menu_item_id ?? "",
      itemName:    i.item_name,
      itemPrice:   i.item_price,
      quantity:    i.quantity,
      specialNote: i.special_note ?? "",
    })),
  );
  const [deliveryType, setDeliveryType] = useState(order.delivery_type);
  const [specialInstr, setSpecialInstr] = useState(order.special_instructions ?? "");
  const [search, setSearch]             = useState("");
  const [error, setError]               = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey:  ["pos-categories-admin"],
    queryFn:   () => posService.getCategoriesAdmin(),
    staleTime: 5 * 60 * 1000,
  });
  const menuItems = categories.flatMap((c) => c.items);

  const availableItems = menuItems.filter(
    (m) => m.isAvailable && m.name.toLowerCase().includes(search.toLowerCase()),
  );

  const showWarning = IN_PROGRESS_STATUSES.has(order.status);
  const total = items.reduce((s, i) => s + i.itemPrice * i.quantity, 0);

  function updateQty(idx: number, delta: number) {
    setItems((prev) => {
      const next = [...prev];
      const newQty = next[idx].quantity + delta;
      if (newQty <= 0) next.splice(idx, 1);
      else next[idx] = { ...next[idx], quantity: newQty };
      return next;
    });
  }

  function addMenuItem(m: PosItem) {
    setItems((prev) => {
      const existing = prev.findIndex((i) => i.menuItemId === m.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
        return next;
      }
      return [...prev, { menuItemId: m.id, itemName: m.name, itemPrice: m.price, quantity: 1, specialNote: "" }];
    });
    setSearch("");
  }

  function handleSave() {
    if (items.length === 0) { setError("At least one item is required"); return; }
    setError(null);
    onSave({
      deliveryType: deliveryType as "room_delivery" | "pickup" | "dine_in",
      specialInstructions: specialInstr || null,
      items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity, specialNote: i.specialNote || undefined })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="bg-paper border border-line rounded-2xl w-full max-w-lg flex flex-col max-h-[92vh] shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-line flex-shrink-0">
          <div>
            <h2 className="text-base font-bold text-ink">Edit Order</h2>
            <p className="text-xs text-ink-mute mt-0.5">{order.order_number}{order.room_number ? ` · Room ${order.room_number}` : ""}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-8 w-8 rounded-full hover:bg-line-soft text-ink-mute transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {showWarning && (
            <div className="flex gap-2 bg-amber-soft border border-amber/30 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-amber flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber leading-relaxed">
                This order may already be in preparation. Editing will flag it for folio review.
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Items */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute mb-3">Items</p>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-mist border border-line rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink font-medium truncate">{item.itemName}</p>
                    <p className="text-xs text-ink-mute">
                      PKR {Math.floor(item.itemPrice / 100).toLocaleString("en-PK")} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(idx, -1)}
                      className="grid place-items-center h-6 w-6 rounded-lg bg-line-soft text-ink-soft hover:bg-line transition-colors"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-ink">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(idx, 1)}
                      className="grid place-items-center h-6 w-6 rounded-lg bg-line-soft text-ink-soft hover:bg-line transition-colors"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  <button
                    onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                    className="grid place-items-center h-6 w-6 rounded-lg text-ink-faint hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add item search */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute mb-2">Add Item</p>
            <input
              className="w-full border border-line bg-white rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber/40"
              placeholder="Search menu items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && availableItems.length > 0 && (
              <div className="mt-1.5 bg-white border border-line rounded-xl overflow-hidden max-h-40 overflow-y-auto shadow-sm">
                {availableItems.slice(0, 8).map((m) => (
                  <button
                    key={m.id}
                    onClick={() => addMenuItem(m)}
                    className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-mist transition-colors text-left"
                  >
                    <span className="text-sm text-ink">{m.name}</span>
                    <span className="text-xs text-ink-mute ml-2 flex-shrink-0">
                      PKR {Math.floor(m.price / 100).toLocaleString("en-PK")}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {search && availableItems.length === 0 && (
              <p className="mt-2 text-xs text-ink-faint">No items found</p>
            )}
          </div>

          {/* Delivery type */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute mb-2">Delivery Type</p>
            <div className="grid grid-cols-3 gap-2">
              {(["room_delivery", "pickup", "dine_in"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDeliveryType(t)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border transition-colors ${
                    deliveryType === t
                      ? "bg-ink text-white border-ink"
                      : "bg-white text-ink-soft border-line hover:border-ink/30"
                  }`}
                >
                  {DELIVERY_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Special instructions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-mute mb-2">Special Instructions</p>
            <textarea
              rows={2}
              className="w-full border border-line bg-white rounded-xl px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber/40 resize-none"
              placeholder="Allergies, preferences…"
              value={specialInstr}
              onChange={(e) => setSpecialInstr(e.target.value)}
            />
          </div>

          {/* Running total */}
          <div className="flex items-center justify-between text-sm font-bold text-ink border-t border-line pt-3">
            <span>Total</span>
            <span className="text-amber">PKR {Math.floor(total / 100).toLocaleString("en-PK")}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 pb-5 pt-4 border-t border-line flex-shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-full border border-line text-ink-soft text-sm font-semibold hover:bg-mist transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-5 rounded-full bg-ink text-white text-sm font-bold hover:bg-ink/80 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {saving && <Loader2 size={13} className="animate-spin" />}
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CancelConfirmDialog ───────────────────────────────────────────────────────

function CancelConfirmDialog({
  order, onClose, onConfirm, confirming,
}: {
  order:      QrOrder;
  onClose:    () => void;
  onConfirm:  () => void;
  confirming: boolean;
}) {
  useEscapeKey(onClose);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4">
      <div className="bg-paper border border-line rounded-2xl w-full max-w-sm p-6 shadow-xl">
        <h2 className="text-base font-bold text-ink mb-2">Cancel {order.order_number}?</h2>
        <p className="text-sm text-ink-mute mb-5">This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-full border border-line text-ink-soft text-sm font-semibold hover:bg-mist transition-colors"
          >
            Keep
          </button>
          <button
            onClick={onConfirm}
            disabled={confirming}
            className="h-9 px-5 rounded-full bg-red-600 text-white text-sm font-bold hover:bg-red-700 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {confirming && <Loader2 size={13} className="animate-spin" />}
            Cancel Order
          </button>
        </div>
      </div>
    </div>
  );
}
