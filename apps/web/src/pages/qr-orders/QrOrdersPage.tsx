import { useState } from "react";
import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { Filter, Loader2, ChevronDown, ChevronUp, Receipt, XCircle, Banknote, BedDouble } from "lucide-react";
import { qrOrdersService, type QrOrder } from "../../services/qrOrders";

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
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-pine-soft text-pine-deep",
  ready:     "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
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

export default function QrOrdersPage() {
  const qc = useQueryClient();
  const [status,    setStatus]    = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate,   setEndDate]   = useState("");
  const [page,      setPage]      = useState(1);
  const [expanded,  setExpanded]  = useState<Set<string>>(new Set());

  const params = {
    status:    status || undefined,
    startDate: startDate || undefined,
    endDate:   endDate || undefined,
    page,
    limit: 20,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey:        ["qr-orders", params],
    queryFn:         () => qrOrdersService.list(params),
    placeholderData: keepPreviousData,
    staleTime:       30 * 1000, // 30 s — orders update frequently, but don't re-fetch on every keystroke
  });

  const { mutate: advanceStatus, isPending: advancing } = useMutation({
    mutationFn: ({ id, status: s }: { id: string; status: string }) =>
      qrOrdersService.updateStatus(id, s),
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
    <div className="space-y-5 p-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">QR Orders</h1>
          <p className="text-sm text-dusk mt-1">In-room dining and pickup orders from the guest menu</p>
        </div>
        {isFetching && !isLoading && (
          <Loader2 className="w-4 h-4 animate-spin text-dusk mt-1" />
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end bg-card border border-line rounded-xl p-4">
        <Filter className="w-4 h-4 text-dusk mt-1 flex-shrink-0" />
        <div>
          <label className="text-xs font-medium text-dusk block mb-1">Status</label>
          <select
            className="border border-line rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coral"
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-dusk block mb-1">From</label>
          <input
            type="date"
            className="border border-line rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coral"
            value={startDate}
            onChange={(e) => { setStartDate(e.target.value); setPage(1); }}
          />
        </div>
        <div>
          <label className="text-xs font-medium text-dusk block mb-1">To</label>
          <input
            type="date"
            className="border border-line rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-coral"
            value={endDate}
            onChange={(e) => { setEndDate(e.target.value); setPage(1); }}
          />
        </div>
        {(status || startDate || endDate) && (
          <button
            onClick={() => { setStatus(""); setStartDate(""); setEndDate(""); setPage(1); }}
            className="text-xs text-dusk hover:text-ink mt-4"
          >
            Clear
          </button>
        )}
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-dusk" />
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-dusk">No orders found.</div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <OrderRow
              key={order.id}
              order={order}
              isExpanded={expanded.has(order.id)}
              onToggle={() => toggleExpand(order.id)}
              onAdvance={(s) => advanceStatus({ id: order.id, status: s })}
              onPostFolio={() => postFolio(order.id)}
              onCancel={() => {
                if (confirm(`Cancel order ${order.order_number}?`)) cancelOrder(order.id);
              }}
              mutating={mutating}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-dusk">
          <span>{meta.total} orders</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="px-3 py-1 rounded-lg border border-line disabled:opacity-40 hover:bg-mist"
            >
              Prev
            </button>
            <span className="px-3 py-1">
              {page} / {meta.totalPages}
            </span>
            <button
              disabled={page >= meta.totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="px-3 py-1 rounded-lg border border-line disabled:opacity-40 hover:bg-mist"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderRow({
  order,
  isExpanded,
  onToggle,
  onAdvance,
  onPostFolio,
  onCancel,
  mutating,
}: {
  order:       QrOrder;
  isExpanded:  boolean;
  onToggle:    () => void;
  onAdvance:   (status: string) => void;
  onPostFolio: () => void;
  onCancel:    () => void;
  mutating:    boolean;
}) {
  const next = NEXT_STATUS[order.status];

  return (
    <div className="bg-card border border-line rounded-xl overflow-hidden">
      {/* Summary row */}
      <div
        className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-mist/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <p className="text-xs text-dusk">Order</p>
            <p className="font-bold text-ink">{order.order_number}</p>
          </div>
          <div>
            <p className="text-xs text-dusk">Guest</p>
            <p className="text-sm font-medium text-ink truncate">{order.guest_name}</p>
            <p className="text-xs text-dusk">Room {order.room_number}</p>
          </div>
          <div>
            <p className="text-xs text-dusk">Type</p>
            <p className="text-sm text-ink">{DELIVERY_LABELS[order.delivery_type] ?? order.delivery_type}</p>
          </div>
          <div>
            <p className="text-xs text-dusk">Amount</p>
            <p className="text-sm font-semibold text-ink">
              PKR {Math.floor(order.total_amount / 100).toLocaleString("en-PK")}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {order.requires_folio_review && (
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-soft text-amber border border-amber/30">
              Folio Review
            </span>
          )}
          {order.payment_preference === "pay_now" ? (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-600">
              <Banknote className="w-3 h-3" /> Pay on delivery
            </span>
          ) : order.payment_preference === "charge_to_room" && order.reservation_id ? (
            <span className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700">
              <BedDouble className="w-3 h-3" /> Room charge
            </span>
          ) : null}
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[order.status] ?? "bg-gray-100 text-gray-600"}`}>
            {order.status}
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-dusk" /> : <ChevronDown className="w-4 h-4 text-dusk" />}
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="border-t border-line px-4 py-4 space-y-4">
          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-dusk uppercase tracking-wide mb-2">Items</p>
            <ul className="space-y-1">
              {order.items.map((item) => (
                <li key={item.id} className="flex items-start justify-between gap-2 text-sm">
                  <span className="text-ink">
                    ×{item.quantity} {item.item_name}
                    {item.special_note && (
                      <span className="ml-1 text-xs italic text-amber">({item.special_note})</span>
                    )}
                  </span>
                  <span className="text-dusk flex-shrink-0">
                    PKR {Math.floor(item.subtotal / 100).toLocaleString("en-PK")}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {order.special_instructions && (
            <p className="text-sm italic text-amber bg-amber-soft rounded-lg px-3 py-2">
              {order.special_instructions}
            </p>
          )}

          {/* Folio status */}
          {order.requires_folio_review && (
            <p className="text-xs font-medium text-amber bg-amber-soft border border-amber/20 rounded-lg px-3 py-2">
              Order was edited after folio post — front desk should reconcile the charge manually.
            </p>
          )}
          {order.folio_id && !order.requires_folio_review ? (
            <p className="text-xs text-pine bg-pine-soft rounded-lg px-3 py-2 font-medium">
              Posted to folio
            </p>
          ) : !order.folio_id && order.room_verified ? (
            <p className="text-xs text-dusk bg-mist rounded-lg px-3 py-2">
              Room verified — can post to folio
            </p>
          ) : null}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-1">
            {next && order.status !== "cancelled" && (
              <button
                disabled={mutating}
                onClick={() => onAdvance(next)}
                className="text-sm font-medium px-4 py-2 rounded-lg bg-pine text-white hover:bg-pine-deep disabled:opacity-50"
              >
                → {next.charAt(0).toUpperCase() + next.slice(1)}
              </button>
            )}
            {order.room_verified && !order.folio_id && order.status !== "cancelled" && (
              <button
                disabled={mutating}
                onClick={onPostFolio}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-line bg-white text-ink hover:bg-mist disabled:opacity-50"
              >
                <Receipt className="w-4 h-4" /> Post to Folio
              </button>
            )}
            {order.status !== "cancelled" && order.status !== "delivered" && (
              <button
                disabled={mutating}
                onClick={onCancel}
                className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                <XCircle className="w-4 h-4" /> Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
