import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, CheckCircle, AlertTriangle } from "lucide-react";
import { cn } from "../../lib/cn";
import { folioService, type FolioLineItem, type FolioItemType, type PaymentMethod } from "../../services/folio";
import { reservationsService, type ReservationDetail } from "../../services/reservations";
import { useEscapeKey } from "@/hooks/useEscapeKey";

// ── Constants ─────────────────────────────────────────────────────────────────

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH",          label: "Cash" },
  { value: "JAZZCASH",      label: "JazzCash" },
  { value: "EASYPAISA",     label: "EasyPaisa" },
  { value: "CREDIT_CARD",   label: "Credit Card" },
  { value: "DEBIT_CARD",    label: "Debit Card" },
  { value: "BANK_TRANSFER", label: "Bank Transfer" },
];

const ITEM_LABELS: Partial<Record<FolioItemType, string>> = {
  ROOM_CHARGE:   "Room",
  FOOD_BEVERAGE: "F&B",
  LAUNDRY:       "Laundry",
  TRANSPORT:     "Transport",
  SPA:           "Spa",
  MINIBAR:       "Minibar",
  TAX:           "Tax",
  DISCOUNT:      "Discount",
  MISCELLANEOUS: "Other",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatPkr(paise: number): string {
  return `PKR ${(paise / 100).toLocaleString("en-PK")}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", {
    day: "2-digit", month: "short", year: "numeric",
  }).format(new Date(iso));
}

// ── Component ─────────────────────────────────────────────────────────────────

export interface CheckOutModalProps {
  reservation: ReservationDetail;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export function CheckOutModal({ reservation, onClose, onSuccess }: CheckOutModalProps) {
  useEscapeKey(onClose);
  const navigate = useNavigate();
  const qc       = useQueryClient();

  const room   = reservation.rooms[0] ?? null;
  const nights = Math.ceil(
    (new Date(reservation.checkOutDate).getTime() - new Date(reservation.checkInDate).getTime()) /
    (1000 * 60 * 60 * 24),
  );

  const { data: folio, isLoading: folioLoading } = useQuery({
    queryKey: ["folio", reservation.id],
    queryFn:  () => folioService.getFolio(reservation.id),
  });

  // Derive live balance from folio query; fall back to reservation.folio summary while loading
  const balanceDue = folio?.balanceDue ?? reservation.folio?.balanceDue ?? 0;

  // Pre-fill amount once on first render (use summary value; updates when folio loads)
  const [amount,         setAmount]         = useState(() =>
    String((reservation.folio?.balanceDue ?? 0) / 100),
  );
  const amountSyncedRef = useRef(false);

  // Sync amount field when folio loads for the first time (if user hasn't edited it)
  if (!amountSyncedRef.current && folio && folio.balanceDue !== (reservation.folio?.balanceDue ?? 0)) {
    setAmount(String(folio.balanceDue / 100));
    amountSyncedRef.current = true;
  }

  const [method,         setMethod]         = useState<PaymentMethod>("CASH");
  const [transactionRef, setTransactionRef] = useState("");
  const [error,          setError]          = useState<string | null>(null);
  const [isProcessing,   setIsProcessing]   = useState(false);

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: ["reservation", reservation.id] });
    qc.invalidateQueries({ queryKey: ["reservations"] });
    qc.invalidateQueries({ queryKey: ["reservations-counts"] });
    qc.invalidateQueries({ queryKey: ["rooms"] });
    qc.invalidateQueries({ queryKey: ["folio", reservation.id] });
    qc.invalidateQueries({ queryKey: ["billing-folios"] });
    qc.invalidateQueries({ queryKey: ["billing-summary"] });
  }

  async function performCheckOut() {
    await reservationsService.updateReservationStatus(reservation.id, "CHECKED_OUT");
    invalidateAll();
    onClose();
    onSuccess("Guest checked out successfully");
    setTimeout(() => navigate("/reservations"), 1500);
  }

  async function handleCollectAndCheckOut() {
    setError(null);
    const amountNum = parseFloat(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError("Enter a valid payment amount");
      return;
    }
    setIsProcessing(true);
    try {
      await folioService.addPayment(reservation.id, {
        amount:         Math.round(amountNum * 100),
        method,
        transactionRef: transactionRef.trim() || undefined,
      });
      await performCheckOut();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to process checkout");
      setIsProcessing(false);
    }
  }

  async function handleCheckOutWithoutPayment() {
    setError(null);
    setIsProcessing(true);
    try {
      await performCheckOut();
    } catch (err) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setError(msg ?? "Failed to check out");
      setIsProcessing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              Check Out — {reservation.guest.fullName}
            </h2>
            <p className="text-xs font-mono text-gray-400 mt-0.5">{reservation.confirmationNumber}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          {/* Settlement summary card */}
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-5 space-y-4">
            {/* Stay info */}
            <div className="grid grid-cols-3 gap-3 text-sm border-b border-gray-200 pb-4">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Room</p>
                <p className="font-medium text-gray-800">{room?.room.number ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Stay</p>
                <p className="font-medium text-gray-800">
                  {formatDate(reservation.checkInDate)} → {formatDate(reservation.checkOutDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-0.5">Nights</p>
                <p className="font-medium text-gray-800">{nights}</p>
              </div>
            </div>

            {/* Charge items */}
            {folioLoading ? (
              <div className="space-y-2 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-full" />
                <div className="h-3 bg-gray-200 rounded w-3/4" />
              </div>
            ) : folio && folio.items.length > 0 ? (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                  Charges
                </p>
                <div className="space-y-1.5">
                  {folio.items.map((item: FolioLineItem) => (
                    <div key={item.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600 truncate max-w-[60%]">
                        {ITEM_LABELS[item.type] ?? item.type.replace(/_/g, " ")} — {item.description}
                      </span>
                      <span className={cn(
                        "font-medium flex-shrink-0",
                        item.type === "DISCOUNT" ? "text-green-600" : "text-gray-800",
                      )}>
                        {item.type === "DISCOUNT" ? "-" : ""}{formatPkr(item.amount)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm text-gray-400 italic">No charges recorded</p>
            )}

            {/* Totals */}
            <div className="border-t border-gray-200 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Total Charges</span>
                <span className="font-medium text-gray-800">
                  {formatPkr(folio?.chargesTotal ?? 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Payments Received</span>
                <span className="text-gray-800">{formatPkr(folio?.paymentsTotal ?? 0)}</span>
              </div>
              <div className="border-t border-gray-200 my-1" />
              <div className="flex justify-between font-semibold">
                <span className="text-gray-700">Balance Due</span>
                <span className={balanceDue > 0 ? "text-red-600" : "text-green-600"}>
                  {formatPkr(balanceDue)}
                </span>
              </div>
            </div>
          </div>

          {/* STATE A — Balance > 0 */}
          {balanceDue > 0 ? (
            <div className="space-y-4">
              {/* Inline payment form */}
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Amount (PKR)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); amountSyncedRef.current = true; }}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    {PAYMENT_METHODS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reference (optional)
                  </label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="Transaction ID or receipt number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleCollectAndCheckOut}
                  disabled={isProcessing}
                  className={cn(
                    "w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    isProcessing ? "opacity-60 cursor-not-allowed" : "hover:bg-indigo-700",
                  )}
                >
                  {isProcessing ? "Processing…" : "Collect & Check Out"}
                </button>
                <button
                  onClick={handleCheckOutWithoutPayment}
                  disabled={isProcessing}
                  className={cn(
                    "w-full border border-gray-300 text-gray-600 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                    isProcessing ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50",
                  )}
                >
                  Check Out Without Payment
                </button>
                <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2.5">
                  <AlertTriangle size={13} className="flex-shrink-0" />
                  <span>
                    Folio will remain open with {formatPkr(balanceDue)} outstanding
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* STATE B — Balance = 0 */
            <div className="space-y-4">
              <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-xl px-5 py-4">
                <CheckCircle size={20} className="text-green-600 flex-shrink-0" />
                <p className="text-sm font-medium text-green-700">
                  Account settled — no outstanding balance
                </p>
              </div>
              <button
                onClick={handleCheckOutWithoutPayment}
                disabled={isProcessing}
                className={cn(
                  "w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors",
                  isProcessing ? "opacity-60 cursor-not-allowed" : "hover:bg-indigo-700",
                )}
              >
                {isProcessing ? "Processing…" : "Confirm Check Out"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
