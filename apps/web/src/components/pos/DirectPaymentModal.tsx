import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, CheckCircle, Banknote } from "lucide-react";
import { cn } from "@/lib/cn";
import { posService, type CartItem, type PosOrder } from "@/services/pos";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { ReceiptView } from "@/components/pos/ReceiptView";

const PAYMENT_METHODS = [
  { value: "CASH",        label: "Cash" },
  { value: "JAZZCASH",    label: "JazzCash" },
  { value: "EASYPAISA",   label: "Easypaisa" },
  { value: "CREDIT_CARD", label: "Credit Card" },
  { value: "DEBIT_CARD",  label: "Debit Card" },
];

function formatPKR(paisas: number) {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

export interface DirectPaymentModalProps {
  cart: CartItem[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export function DirectPaymentModal({ cart, onClose, onSuccess }: DirectPaymentModalProps) {
  useEscapeKey(onClose);
  const qc = useQueryClient();
  const [method,      setMethod]      = useState("CASH");
  const [succeeded,   setSucceeded]   = useState(false);
  const [completedOrder, setCompletedOrder] = useState<PosOrder | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

  const createMutation = useMutation({
    mutationFn: () =>
      posService.createOrder({
        items:          cart.map((i) => ({ posItemId: i.posItemId, quantity: i.quantity })),
        settlementType: "DIRECT",
        paymentMethod:  method,
      }),
    onSuccess: (order) => {
      qc.invalidateQueries({ queryKey: ["pos-orders"] });
      setCompletedOrder(order);
      setSucceeded(true);
    },
    onError: (err: { response?: { data?: { error?: string } } }) => {
      setError(err.response?.data?.error ?? "Payment failed");
    },
  });


  if (showReceipt && completedOrder) {
    return (
      <ReceiptView
        orderNumber={completedOrder.orderNumber}
        dateTime={completedOrder.createdAt}
        items={completedOrder.items.map((i) => ({
          name:      i.name,
          quantity:  i.quantity,
          unitPrice: i.unitPrice,
          lineTotal: i.lineTotal,
        }))}
        subtotal={completedOrder.subtotal}
        taxAmount={completedOrder.taxAmount}
        discountAmount={completedOrder.discountAmount}
        total={completedOrder.total}
        paymentStatus={{ type: "PAID", method: completedOrder.paymentMethod ?? method }}
        onClose={() => setShowReceipt(false)}
      />
    );
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in">
      <div className="bg-paper rounded-2xl shadow-xl w-full max-w-md anim-scale-in">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-[#E6F0EA] shrink-0">
            <Banknote size={18} className="text-[#1F4D3A]" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Direct Payment</h2>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Success state */}
          {succeeded ? (
            <div className="flex flex-col items-center py-4 gap-4">
              <div className="grid place-items-center h-16 w-16 rounded-2xl bg-[#E6F0EA]">
                <CheckCircle size={36} className="text-[#1F4D3A]" />
              </div>
              <div className="text-center">
                <p className="serif text-[22px] text-ink">Payment Collected</p>
                <p className="text-[13px] text-ink-mute mt-0.5">{PAYMENT_METHODS.find((m) => m.value === method)?.label ?? method}</p>
              </div>
              <div className="w-full rounded-xl border border-line overflow-hidden">
                <div className="divide-y divide-line-soft bg-card">
                  {cart.map((item) => (
                    <div key={item.posItemId} className="px-4 py-2.5 flex justify-between text-[13.5px]">
                      <span className="text-ink-soft">{item.name} × {item.quantity}</span>
                      <span className="font-semibold text-ink tnum">{formatPKR(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-mist flex justify-between border-t border-line-soft">
                  <span className="text-[14px] font-semibold text-ink-soft">Total</span>
                  <span className="serif text-[20px] text-[#1F4D3A] tnum">{formatPKR(total)}</span>
                </div>
              </div>
              <div className="flex gap-2 w-full">
                {completedOrder && (
                  <button
                    onClick={() => setShowReceipt(true)}
                    className="flex-1 h-10 rounded-xl border-2 border-[#1F4D3A] text-[#1F4D3A] text-[13px] font-semibold hover:bg-[#E6F0EA] transition-colors"
                  >
                    Print Receipt →
                  </button>
                )}
                <button
                  onClick={() => { onSuccess("Payment collected"); onClose(); }}
                  className="flex-1 h-10 rounded-xl bg-[#1F4D3A] text-white text-[13px] font-semibold hover:bg-[#173a2c] transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
                <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
                  {error}
                </div>
              )}

              {/* Order summary */}
              <div className="rounded-xl border border-line overflow-hidden">
                <div className="px-4 py-2.5 border-b border-line-soft bg-mist">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Order Summary</span>
                </div>
                <div className="divide-y divide-line-soft bg-card">
                  {cart.map((item) => (
                    <div key={item.posItemId} className="px-4 py-2.5 flex justify-between text-[13.5px]">
                      <span className="text-ink-soft">{item.name} × {item.quantity}</span>
                      <span className="font-semibold text-ink tnum">{formatPKR(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-3 bg-mist flex justify-between border-t border-line-soft">
                  <span className="text-[14px] font-semibold text-ink-soft">Total</span>
                  <span className="serif text-[20px] text-ink tnum">{formatPKR(total)}</span>
                </div>
              </div>

              {/* Payment method */}
              <div>
                <label className="block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5">
                  Payment Method
                </label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                  className="w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>{m.label}</option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                className={cn(
                  "w-full h-11 rounded-xl text-[13.5px] font-semibold transition-colors shadow-pop",
                  createMutation.isPending
                    ? "bg-line-soft text-ink-faint cursor-not-allowed"
                    : "bg-pine text-white hover:bg-pine-deep",
                )}
              >
                {createMutation.isPending ? "Processing…" : `Collect ${formatPKR(total)}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

