import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  ChevronDown, ChevronUp, Receipt, XCircle, Banknote, BedDouble,
  ClipboardList, ChevronLeft, ChevronRight, AlertTriangle, Printer,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/Card";
import { qrOrdersService, type QrOrder } from "../../services/qrOrders";
import { ReceiptView } from "@/components/pos/ReceiptView";
import { DatePicker } from "@/components/ui/DatePicker";
import { useRealtimeSync } from "@/hooks/useRealtimeSync";

// ── Status / badge config ─────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "",          label: "All statuses" },
  { value: "pending",   label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "preparing", label: "Preparing" },
  { value: "ready",     label: "Ready" },
  { value: "delivered", label: "Delivered" },
  { value: "cancelled", label: "Cancelled" },
];

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-soft text-amber",
  confirmed: "bg-dusk-soft text-dusk",
  preparing: "bg-pine-soft text-pine-deep",
  ready:     "bg-pine text-white",
  delivered: "bg-line-soft text-ink-mute",
  cancelled: "bg-clay-soft text-clay",
};

const STATUS_LABEL: Record<string, string> = {
  pending:   "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready:     "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const NEXT_STATUS: Record<string, string> = {
  pending:   "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready:     "delivered",
};

const DELIVERY_LABELS: Record<string, string> = {
  room_delivery: "Room Delivery",
  pickup:        "Pick Up",
  dine_in:       "Dine In",
};

const PAYMENT_METHOD_OPTIONS = [
  { value: "CASH",        label: "Cash" },
  { value: "JAZZCASH",    label: "JazzCash" },
  { value: "EASYPAISA",   label: "Easypaisa" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD",  label: "Debit Card" },
];

const inputCls = "h-9 rounded-xl border border-line bg-mist px-3.5 text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[11px] font-bold uppercase tracking-wide text-ink-faint mb-1.5";

// ── Main page ─────────────────────────────────────────────────────────────────

export default function QrOrdersPage() {
  const qc = useQueryClient();
  useRealtimeSync();
  const [status,       setStatus]       = useState("");
  const [startDate,    setStartDate]    = useState("");
  const [endDate,      setEndDate]      = useState("");
  const [page,         setPage]         = useState(1);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [receiptOrder, setReceiptOrder] = useState<QrOrder | null>(null);

  const params = {
    status:    status || undefined,
    startDate: startDate || undefined,
    endDate:   endDate || undefined,
    page,
    limit: 20,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey:        ["qr-orders", params],
    queryFn:         () => qrOrdersService.list(params),
    placeholderData: keepPreviousData,
    staleTime:       30_000,
    retry:           1, // fail fast — don't spin for 30+ seconds on API errors
    refetchInterval: 60_000,
  });

  const { mutate: advanceStatus, isPending: advancing } = useMutation({
    mutationFn: ({ id, status: s, paymentMethod }: { id: string; status: string; paymentMethod?: string }) =>
      qrOrdersService.updateStatus(id, s, paymentMethod),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qr-orders"] }),
  });

  const { mutate: postFolio, isPending: posting } = useMutation({
    mutationFn: (id: string) => qrOrdersService.postToFolio(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qr-orders"] }),
  });

  const { mutate: cancelOrder, isPending: cancelling } = useMutation({
    mutationFn: (id: string) => qrOrdersService.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["qr-orders"] }),
  });

  const orders   = data?.data   ?? [];
  const meta     = data?.meta;
  const mutating = advancing || posting || cancelling;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Restaurant</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">QR Orders</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">In-room dining and pickup orders from the guest menu</p>
        </div>
      </div>

      {/* Filters */}
      <Card pad={false} className="mb-5">
        <div className="flex flex-wrap items-end gap-4 px-5 py-4">
          <div>
            <label className={labelCls}>Status</label>
            <select
              className={cn(inputCls, "cursor-pointer pr-8 appearance-none")}
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>From</label>
            <DatePicker
              className="h-9"
              value={startDate}
              onChange={(v) => { setStartDate(v); setPage(1); }}
            />
          </div>
          <div>
            <label className={labelCls}>To</label>
            <DatePicker
              className="h-9"
              value={endDate}
              onChange={(v) => { setEndDate(v); setPage(1); }}
            />
          </div>
          {(status || startDate || endDate) && (
            <button
              onClick={() => { setStatus(""); setStartDate(""); setEndDate(""); setPage(1); }}
              className="text-[12.5px] font-semibold text-ink-faint hover:text-ink-soft underline underline-offset-2 transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </Card>

      {/* Content */}
      {isLoading ? (
        <Card pad={false} className="anim-fade-up overflow-hidden">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-line-soft last:border-0 animate-pulse">
              <div className="h-3 bg-line-soft rounded w-20 flex-shrink-0" />
              <div className="flex-1 h-3 bg-line-soft rounded" />
              <div className="h-6 bg-line-soft rounded-full w-20 flex-shrink-0" />
            </div>
          ))}
        </Card>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-clay-soft text-clay">
            <AlertTriangle size={26} />
          </div>
          <p className="text-[14px] font-semibold text-ink-soft">Failed to load orders</p>
          <p className="text-[13px] text-ink-faint">Check your connection and try again</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="grid place-items-center h-14 w-14 rounded-2xl bg-mist text-ink-faint">
            <ClipboardList size={26} />
          </div>
          <p className="text-[14px] font-semibold text-ink-soft">No orders found</p>
          <p className="text-[13px] text-ink-faint">Guest QR orders will appear here when placed</p>
        </div>
      ) : (
        <Card pad={false} className="anim-fade-up overflow-hidden">
          {/* Column headers */}
          <div className="hidden md:grid grid-cols-[0.7fr_1.2fr_0.8fr_0.7fr_1fr] gap-3 px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-ink-faint border-b border-line-soft">
            <span>Order #</span><span>Guest / Room</span><span>Type</span><span>Amount</span><span />
          </div>
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              isExpanded={expanded.has(order.id)}
              onToggle={() => toggleExpand(order.id)}
              onAdvance={(s, paymentMethod) => advanceStatus({ id: order.id, status: s, paymentMethod })}
              onPostFolio={() => postFolio(order.id)}
              onCancel={() => {
                if (confirm(`Cancel order ${order.order_number}?`)) cancelOrder(order.id);
              }}
              onPrint={() => setReceiptOrder(order)}
              mutating={mutating}
            />
          ))}
        </Card>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-[13px] text-ink-mute">{meta.total} orders</p>
          <div className="flex items-center gap-1.5">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors", page <= 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-[13px] text-ink-mute px-1">{page} / {meta.totalPages}</span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className={cn("grid place-items-center h-9 w-9 rounded-full border border-line text-ink-mute transition-colors", page >= meta.totalPages ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft")}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {receiptOrder && (
        <ReceiptView
          orderNumber={receiptOrder.order_number}
          dateTime={receiptOrder.created_at}
          guestName={receiptOrder.guest_name}
          roomNumber={receiptOrder.room_number ?? undefined}
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
            receiptOrder.payment_preference === "charge_to_room" && receiptOrder.room_number
              ? { type: "CHARGED_TO_ROOM", roomNumber: receiptOrder.room_number }
              : { type: "PENDING_PAYMENT" }
          }
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
}

// ── Order row ─────────────────────────────────────────────────────────────────

function OrderRow({
  order, isExpanded, onToggle, onAdvance, onPostFolio, onCancel, onPrint, mutating,
}: {
  order:       QrOrder;
  isExpanded:  boolean;
  onToggle:    () => void;
  onAdvance:   (status: string, paymentMethod?: string) => void;
  onPostFolio: () => void;
  onCancel:    () => void;
  onPrint:     () => void;
  mutating:    boolean;
}) {
  const next = NEXT_STATUS[order.status];
  const needsPaymentMethod = next === "delivered" && order.payment_preference === "pay_now";
  const [paymentMethod, setPaymentMethod] = useState("");

  return (
    <div className="border-b border-line-soft last:border-0">
      {/* Summary row */}
      <div
        className="grid grid-cols-2 md:grid-cols-[0.7fr_1.2fr_0.8fr_0.7fr_1fr] gap-3 px-5 py-3.5 items-center hover:bg-mist cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <div>
          <p className="text-[13.5px] font-bold text-ink">{order.order_number}</p>
          <p className="text-[11.5px] text-ink-faint tnum">
            {new Date(order.created_at ?? "").toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="min-w-0 hidden md:block">
          <p className="text-[13.5px] font-semibold text-ink truncate">{order.guest_name}</p>
          {order.room_number && <p className="text-[12px] text-ink-mute">Room {order.room_number}</p>}
        </div>
        <div className="hidden md:block">
          <p className="text-[13px] text-ink-soft">{DELIVERY_LABELS[order.delivery_type] ?? order.delivery_type}</p>
        </div>
        <div className="hidden md:block">
          <p className="text-[13.5px] font-semibold text-ink tnum">
            PKR {Math.floor(order.total_amount / 100).toLocaleString("en-PK")}
          </p>
        </div>
        <div className="min-w-0 flex items-center gap-2 justify-end">
          {order.requires_folio_review && (
            <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-soft text-amber border border-amber/30">
              Review
            </span>
          )}
          {order.payment_preference === "charge_to_room" && order.reservation_id ? (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-dusk-soft text-dusk">
              <BedDouble className="w-3 h-3" /> Room charge
            </span>
          ) : order.payment_preference === "pay_now" ? (
            <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-line-soft text-ink-mute">
              <Banknote className="w-3 h-3" /> Pay on delivery
            </span>
          ) : null}
          <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", STATUS_BADGE[order.status] ?? "bg-line-soft text-ink-mute")}>
            {STATUS_LABEL[order.status] ?? order.status}
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-ink-faint" /> : <ChevronDown className="w-4 h-4 text-ink-faint" />}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-line-soft px-5 py-4 space-y-4 bg-mist/40">
          {/* Items */}
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">Items</p>
            <ul className="space-y-1.5">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2">
                  <span className="text-[13.5px] text-ink">
                    <span className="font-bold text-ink-mute">×{item.quantity}</span> {item.item_name}
                    {item.special_note && (
                      <span className="ml-1.5 text-[12px] italic text-amber">({item.special_note})</span>
                    )}
                  </span>
                  <span className="text-[13px] text-ink-mute tnum flex-shrink-0">
                    PKR {Math.floor(item.subtotal / 100).toLocaleString("en-PK")}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {order.special_instructions && (
            <p className="text-[13px] italic text-amber bg-amber-soft rounded-xl px-3.5 py-2.5 border border-amber/20">
              {order.special_instructions}
            </p>
          )}

          {/* Folio status */}
          {order.requires_folio_review && (
            <p className="text-[12.5px] font-medium text-amber bg-amber-soft border border-amber/20 rounded-xl px-3.5 py-2.5">
              Order was edited after folio post — reconcile the charge manually at front desk.
            </p>
          )}
          {order.folio_id && !order.requires_folio_review && (
            <p className="text-[12.5px] text-pine-deep bg-pine-soft rounded-xl px-3.5 py-2.5 font-semibold">
              ✓ Posted to folio
            </p>
          )}
          {!order.folio_id && order.room_verified && (
            <p className="text-[12.5px] text-ink-mute bg-mist rounded-xl px-3.5 py-2.5">
              Room verified — ready to post to folio
            </p>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              onClick={(e) => { e.stopPropagation(); onPrint(); }}
              className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-line text-ink-soft text-[13px] font-semibold hover:bg-mist transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Print Receipt
            </button>
            {next && order.status !== "cancelled" && needsPaymentMethod && (
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={cn(inputCls, "cursor-pointer pr-8")}
              >
                <option value="">Payment method received…</option>
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            )}
            {next && order.status !== "cancelled" && (
              <button
                disabled={mutating || (needsPaymentMethod && !paymentMethod)}
                onClick={() => onAdvance(next, needsPaymentMethod ? paymentMethod : undefined)}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full bg-ink text-white text-[13px] font-semibold hover:bg-ink/90 transition-colors shadow-pop disabled:opacity-50"
              >
                Mark {STATUS_LABEL[next] ?? next}
              </button>
            )}
            {order.room_verified && !order.folio_id && order.status !== "cancelled" && (
              <button
                disabled={mutating}
                onClick={onPostFolio}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-line text-ink-soft text-[13px] font-semibold hover:bg-mist transition-colors disabled:opacity-50"
              >
                <Receipt className="w-3.5 h-3.5" /> Post to Folio
              </button>
            )}
            {order.status !== "cancelled" && order.status !== "delivered" && (
              <button
                disabled={mutating}
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full border border-clay/30 text-clay text-[13px] font-semibold hover:bg-clay-soft transition-colors disabled:opacity-50"
              >
                <XCircle className="w-3.5 h-3.5" /> Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
