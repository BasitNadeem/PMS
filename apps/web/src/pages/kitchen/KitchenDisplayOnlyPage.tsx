import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, UtensilsCrossed, ChefHat } from "lucide-react";
import { qrOrdersService, type QrOrder } from "../../services/qrOrders";

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
  ready:     "Ready ✓",
};

const DELIVERY_LABELS: Record<string, string> = {
  room_delivery: "Room Delivery",
  pickup:        "Pick Up",
  dine_in:       "Dine In",
};

export default function KitchenDisplayOnlyPage() {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 8000);
    return () => clearInterval(id);
  }, []);

  const { data: orders = [], isFetching } = useQuery({
    queryKey:  ["kitchen-orders-display", tick],
    queryFn:   qrOrdersService.getKitchenOrders,
    staleTime: 0,
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col select-none">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-gray-800">
        <div className="flex items-center gap-4">
          <ChefHat className="w-9 h-9 text-amber" />
          <div>
            <h1 className="text-2xl font-black tracking-tight">Kitchen Display</h1>
            <p className="text-sm text-gray-400 mt-0.5">Read-only · Refreshes every 8 seconds</p>
          </div>
        </div>
        {isFetching && <Loader2 className="w-5 h-5 animate-spin text-gray-500" />}
      </div>

      {/* Orders grid */}
      <div className="flex-1 p-8">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-5 text-gray-600">
            <UtensilsCrossed className="w-24 h-24" />
            <p className="text-2xl font-semibold">No active orders</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {orders.map((order) => (
              <DisplayCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DisplayCard({ order }: { order: QrOrder }) {
  const elapsed = Math.floor((Date.now() - new Date(order.created_at).getTime()) / 60000);

  return (
    <div
      className={`rounded-2xl border-2 p-5 flex flex-col gap-4 ${STATUS_COLORS[order.status] ?? "bg-gray-800 border-gray-700"}`}
    >
      {/* Top */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-gray-900 font-black text-2xl leading-none">{order.order_number}</p>
          <p className="text-sm text-gray-500 mt-1">Room {order.room_number}</p>
          <p className="text-sm text-gray-600 font-medium">{order.guest_name}</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-black px-3 py-1 rounded-full bg-white/70 text-gray-800">
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
          <p className="text-xs text-gray-500 mt-2">{elapsed}m ago</p>
        </div>
      </div>

      {/* Delivery type */}
      <p className="text-xs text-gray-500 uppercase tracking-widest font-semibold">
        {DELIVERY_LABELS[order.delivery_type] ?? order.delivery_type}
      </p>

      {/* Items */}
      <ul className="space-y-2">
        {order.items.map((item) => (
          <li key={item.id} className="flex items-start gap-3">
            <span className="text-lg font-black text-gray-900 leading-none flex-shrink-0">
              ×{item.quantity}
            </span>
            <div className="min-w-0">
              <span className="text-base font-semibold text-gray-800">{item.item_name}</span>
              {item.special_note && (
                <p className="text-sm text-amber italic mt-0.5">{item.special_note}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {/* Special instructions */}
      {order.special_instructions && (
        <p className="text-sm text-amber bg-amber-soft rounded-xl px-3 py-2 italic">
          {order.special_instructions}
        </p>
      )}
    </div>
  );
}
