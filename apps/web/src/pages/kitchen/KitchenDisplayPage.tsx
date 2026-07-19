import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, UtensilsCrossed, ChefHat, LogOut, Pencil, X, Plus, Minus,
  Trash2, Monitor, AlertTriangle, Printer,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { qrOrdersService, type QrOrder, type QrOrderItem } from "../../services/qrOrders";
import { posService, type PosItem } from "../../services/pos";
import { ReceiptView } from "../../components/pos/ReceiptView";
import { useEscapeKey } from "../../hooks/useEscapeKey";

// ── constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending:   "bg-amber-soft border-amber/40",
  confirmed: "bg-slate-soft border-slate/40",
  preparing: "bg-pine-soft border-pine/40",
  ready:     "bg-green-50 border-green-400",
};

const STATUS_LABELS: Record<string, string> = {
  pending:   "New",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready:     "Ready",
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

// ── types ─────────────────────────────────────────────────────────────────────

interface EditItem {
  menuItemId:  string;
  itemName:    string;
  itemPrice:   number; // paisas
  quantity:    number;
  specialNote: string;
}

// ── main page ─────────────────────────────────────────────────────────────────

export default function KitchenDisplayPage() {
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const [tick, setTick] = useState(0);
  const [editOrder,    setEditOrder]    = useState<QrOrder | null>(null);
  const [cancelOrder,  setCancelOrder]  = useState<QrOrder | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<QrOrder | null>(null);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(id);
  }, []);

  const { data: orders = [], isFetching } = useQuery({
    queryKey:  ["kitchen-orders", tick],
    queryFn:   qrOrdersService.getKitchenOrders,
    staleTime: 0,
  });

  const { mutate: advance, isPending: advancing } = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      qrOrdersService.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["kitchen-orders"] }),
  });

  const { mutate: doCancel, isPending: cancelling } = useMutation({
    mutationFn: (id: string) => qrOrdersService.updateStatus(id, "cancelled"),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      setCancelOrder(null);
    },
  });

  const { mutate: doEdit, isPending: editing } = useMutation({
    mutationFn: ({ id, payload }: {
      id: string;
      payload: Parameters<typeof qrOrdersService.editOrder>[1];
    }) => qrOrdersService.editOrder(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kitchen-orders"] });
      setEditOrder(null);
    },
  });

  function handleLogout() {
    localStorage.clear();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <ChefHat className="w-7 h-7 text-amber" />
          <div>
            <h1 className="text-xl font-bold">Kitchen Manager</h1>
            <p className="text-xs text-gray-400">Auto-refreshes every 8 seconds</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {isFetching && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
          <button
            onClick={() => window.open("/kitchen/display", "_blank")}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <Monitor className="w-4 h-4" />
            Display Mode
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </div>

      {/* Orders grid */}
      <div className="flex-1 p-6">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-gray-600">
            <UtensilsCrossed className="w-16 h-16" />
            <p className="text-lg font-medium">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {orders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                onAdvance={(id, status) => advance({ id, status })}
                onEdit={() => setEditOrder(order)}
                onCancel={() => setCancelOrder(order)}
                onPrintReceipt={() => setReceiptOrder(order)}
                isAdvancing={advancing}
              />
            ))}
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

      {/* Receipt */}
      {receiptOrder && (
        <ReceiptView
          orderNumber={receiptOrder.order_number}
          dateTime={receiptOrder.created_at}
          guestName={receiptOrder.guest_name}
          roomNumber={receiptOrder.room_number}
          items={receiptOrder.items.map((i) => ({
            name:      i.item_name,
            quantity:  i.quantity,
            unitPrice: i.item_price,
            lineTotal: i.subtotal,
          }))}
          subtotal={receiptOrder.total_amount}
          taxAmount={0}
          discountAmount={0}
          total={receiptOrder.total_amount}
          paymentStatus={
            receiptOrder.payment_preference === "charge_to_room"
              ? { type: "CHARGED_TO_ROOM", roomNumber: receiptOrder.room_number }
              : { type: "PENDING_PAYMENT" }
          }
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
}

// ── OrderCard ─────────────────────────────────────────────────────────────────

function OrderCard({
  order, onAdvance, onEdit, onCancel, onPrintReceipt, isAdvancing,
}: {
  order:            QrOrder;
  onAdvance:        (id: string, status: string) => void;
  onEdit:           () => void;
  onCancel:         () => void;
  onPrintReceipt:   () => void;
  isAdvancing:      boolean;
}) {
  const next      = NEXT_STATUS[order.status];
  const nextLabel = NEXT_LABEL[order.status];
  const elapsed   = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);
  const canCancel = order.status !== "delivered" && order.status !== "cancelled";

  return (
    <div className={`rounded-2xl border-2 p-4 flex flex-col gap-3 ${STATUS_COLORS[order.status] ?? "bg-gray-800 border-gray-700"}`}>
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-gray-900 font-bold text-lg leading-none">{order.order_number}</p>
          <p className="text-xs text-gray-500 mt-0.5">Room {order.room_number} · {order.guest_name}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={onPrintReceipt}
            className="grid place-items-center h-7 w-7 rounded-lg bg-white/60 text-gray-700 hover:bg-white transition-colors"
            title="Print receipt"
          >
            <Printer size={13} />
          </button>
          <button
            onClick={onEdit}
            className="grid place-items-center h-7 w-7 rounded-lg bg-white/60 text-gray-700 hover:bg-white transition-colors"
            title="Edit order"
          >
            <Pencil size={13} />
          </button>
          {canCancel && (
            <button
              onClick={onCancel}
              className="grid place-items-center h-7 w-7 rounded-lg bg-white/60 text-red-600 hover:bg-red-50 transition-colors"
              title="Cancel order"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Status + time */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 text-gray-700">
          {STATUS_LABELS[order.status] ?? order.status}
        </span>
        <p className="text-xs text-gray-500">{elapsed}m ago</p>
      </div>

      {/* Delivery type + payment */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
          {DELIVERY_LABELS[order.delivery_type] ?? order.delivery_type}
        </p>
        {order.payment_preference === "pay_now" && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 text-gray-600">
            Pay on delivery
          </span>
        )}
        {order.payment_preference === "charge_to_room" && order.reservation_id && (
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-white/60 text-blue-700">
            Room charge
          </span>
        )}
      </div>

      {/* Items */}
      <ul className="space-y-1">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2 text-sm text-gray-800">
            <span className="font-bold text-gray-900 flex-shrink-0">×{item.quantity}</span>
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
        <p className="text-xs text-amber bg-amber-soft rounded-lg px-2 py-1 italic">
          {order.special_instructions}
        </p>
      )}

      {/* Advance button */}
      {next && (
        <button
          onClick={() => onAdvance(order.id, next)}
          disabled={isAdvancing}
          className="mt-auto w-full py-2.5 rounded-xl bg-gray-900 text-white text-sm font-bold hover:bg-gray-800 disabled:opacity-50 transition-colors"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}

// ── EditOrderModal ─────────────────────────────────────────────────────────────

function EditOrderModal({
  order, onClose, onSave, saving,
}: {
  order:   QrOrder;
  onClose: () => void;
  onSave:  (payload: Parameters<typeof qrOrdersService.editOrder>[1]) => void;
  saving:  boolean;
}) {
  useEscapeKey(onClose);
  const [items, setItems] = useState<EditItem[]>(
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
  const [search,       setSearch]       = useState("");
  const [error,        setError]        = useState<string | null>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["pos-categories-admin"],
    queryFn:  () => posService.getCategoriesAdmin(),
    staleTime: 5 * 60 * 1000,
  });
  const menuItems = categories.flatMap((c) => c.items);

  const availableItems = menuItems.filter(
    (m: PosItem) =>
      m.isAvailable &&
      m.name.toLowerCase().includes(search.toLowerCase()),
  );

  const showWarning = IN_PROGRESS_STATUSES.has(order.status);
  const total = items.reduce((s, i) => s + i.itemPrice * i.quantity, 0);

  function updateQty(idx: number, delta: number) {
    setItems((prev) => {
      const next = [...prev];
      const newQty = (next[idx].quantity ?? 1) + delta;
      if (newQty <= 0) {
        next.splice(idx, 1);
      } else {
        next[idx] = { ...next[idx], quantity: newQty };
      }
      return next;
    });
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  function addMenuItem(m: PosItem) {
    setItems((prev) => {
      const existing = prev.findIndex((i) => i.menuItemId === m.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = { ...next[existing], quantity: next[existing].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        { menuItemId: m.id, itemName: m.name, itemPrice: m.price, quantity: 1, specialNote: "" },
      ];
    });
    setSearch("");
  }

  function handleSave() {
    if (items.length === 0) { setError("At least one item is required"); return; }
    setError(null);
    onSave({
      deliveryType: deliveryType as "room_delivery" | "pickup" | "dine_in",
      specialInstructions: specialInstr || null,
      items: items.map((i) => ({
        menuItemId:  i.menuItemId,
        quantity:    i.quantity,
        specialNote: i.specialNote || undefined,
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-700 flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white">Edit Order</h2>
            <p className="text-xs text-gray-400 mt-0.5">{order.order_number} · Room {order.room_number}</p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-8 w-8 rounded-full hover:bg-gray-800 text-gray-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">

          {/* Warning banner */}
          {showWarning && (
            <div className="flex gap-2 bg-amber-soft/20 border border-amber/30 rounded-xl px-4 py-3">
              <AlertTriangle size={15} className="text-amber flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber leading-relaxed">
                This order may already be in preparation. Editing will flag it for folio review.
              </p>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400 bg-red-900/30 border border-red-700/30 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          {/* Current items */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Items</p>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 bg-gray-800 rounded-xl px-3 py-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium truncate">{item.itemName}</p>
                    <p className="text-xs text-gray-400">
                      PKR {Math.floor(item.itemPrice / 100).toLocaleString("en-PK")} each
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => updateQty(idx, -1)}
                      className="grid place-items-center h-6 w-6 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    >
                      <Minus size={11} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-white">{item.quantity}</span>
                    <button
                      onClick={() => updateQty(idx, 1)}
                      className="grid place-items-center h-6 w-6 rounded-lg bg-gray-700 text-white hover:bg-gray-600 transition-colors"
                    >
                      <Plus size={11} />
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(idx)}
                    className="grid place-items-center h-6 w-6 rounded-lg text-gray-500 hover:text-red-400 transition-colors"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Add item search */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Add Item</p>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber/40"
              placeholder="Search menu items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && availableItems.length > 0 && (
              <div className="mt-1.5 bg-gray-800 border border-gray-700 rounded-xl overflow-hidden max-h-40 overflow-y-auto">
                {availableItems.slice(0, 8).map((m: PosItem) => (
                  <button
                    key={m.id}
                    onClick={() => addMenuItem(m)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-gray-700 transition-colors text-left"
                  >
                    <span className="text-sm text-white">{m.name}</span>
                    <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                      PKR {Math.floor(m.price / 100).toLocaleString("en-PK")}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {search && availableItems.length === 0 && (
              <p className="mt-2 text-xs text-gray-500">No items found</p>
            )}
          </div>

          {/* Delivery type */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Delivery Type</p>
            <div className="grid grid-cols-3 gap-2">
              {(["room_delivery", "pickup", "dine_in"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDeliveryType(t)}
                  className={`py-2 px-2 rounded-xl text-xs font-medium border transition-colors ${
                    deliveryType === t
                      ? "bg-amber text-gray-900 border-amber"
                      : "bg-gray-800 text-gray-300 border-gray-700 hover:border-gray-500"
                  }`}
                >
                  {DELIVERY_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Special instructions */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Special Instructions</p>
            <textarea
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-amber/30 focus:border-amber/40 resize-none"
              placeholder="Allergies, preferences…"
              value={specialInstr}
              onChange={(e) => setSpecialInstr(e.target.value)}
            />
          </div>

          {/* Running total */}
          <div className="flex items-center justify-between text-sm font-bold text-white border-t border-gray-700 pt-3">
            <span>Total</span>
            <span className="text-amber">PKR {Math.floor(total / 100).toLocaleString("en-PK")}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2.5 px-6 pb-5 pt-4 border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-full border border-gray-600 text-gray-300 text-sm font-semibold hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-9 px-5 rounded-full bg-amber text-gray-900 text-sm font-bold hover:bg-amber-dark disabled:opacity-50 flex items-center gap-2 transition-colors"
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-sm p-6">
        <h2 className="text-base font-bold text-white mb-2">Cancel {order.order_number}?</h2>
        <p className="text-sm text-gray-400 mb-5">This cannot be undone.</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="h-9 px-5 rounded-full border border-gray-600 text-gray-300 text-sm font-semibold hover:bg-gray-800 transition-colors"
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
