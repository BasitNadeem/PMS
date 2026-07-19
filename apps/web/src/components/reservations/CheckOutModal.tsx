import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { X, CheckCircle2, AlertTriangle, LogOut } from "lucide-react";
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
  return new Intl.DateTimeFormat("en-PK", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));
}

const inputCls = "w-full rounded-xl border border-line bg-mist px-3.5 py-2.5 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-coral/20 focus:border-coral/40 transition-colors";
const labelCls = "block text-[12.5px] font-semibold uppercase tracking-wide text-ink-mute mb-1.5";

// ── Component ─────────────────────────────────────────────────────────────────

export interface CheckOutModalProps {
  reservation: ReservationDetail;
  onClose:     () => void;
  onSuccess:   (message: string) => void;
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

  const balanceDue = folio?.balanceDue ?? reservation.folio?.balanceDue ?? 0;

  const [amount,         setAmount]         = useState(() => String((reservation.folio?.balanceDue ?? 0) / 100));
  const amountSyncedRef = useRef(false);

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
    if (!amount || isNaN(amountNum) || amountNum <= 0) { setError("Enter a valid payment amount"); return; }
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4 anim-fade-in"
      onMouseDown={onClose}
    >
      <div
        className="bg-paper rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col anim-scale-in"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-6 pt-6 pb-5 border-b border-line flex-shrink-0">
          <div className="grid place-items-center h-10 w-10 rounded-xl bg-coral-soft shrink-0">
            <LogOut size={18} className="text-coral" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="serif text-[20px] text-ink leading-tight">Check Out</h2>
            <p className="text-[13px] text-ink-mute mt-0.5 truncate">
              {reservation.guest.fullName}
              <span className="ml-2 font-mono text-[11px] text-ink-faint">{reservation.confirmationNumber}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="grid place-items-center h-9 w-9 rounded-full hover:bg-mist text-ink-mute transition-colors -mr-1 -mt-1"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto scroll-area px-6 py-5 space-y-5">
          {error && (
            <div className="bg-clay-soft border border-clay/20 text-clay text-[13px] rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          {/* Settlement summary */}
          <div className="rounded-xl border border-line bg-mist overflow-hidden">
            {/* Stay header */}
            <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b border-line-soft">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1">Room</p>
                <p className="text-[14px] font-semibold text-ink">{room?.room.number ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1">Stay</p>
                <p className="text-[13px] font-medium text-ink-soft tnum">
                  {formatDate(reservation.checkInDate)} → {formatDate(reservation.checkOutDate)}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-1">Nights</p>
                <p className="text-[14px] font-semibold text-ink">{nights}</p>
              </div>
            </div>

            {/* Charge items */}
            <div className="px-5 py-4 space-y-3">
              {folioLoading ? (
                <div className="space-y-2 animate-pulse">
                  <div className="h-3 bg-line-soft rounded w-full" />
                  <div className="h-3 bg-line-soft rounded w-3/4" />
                </div>
              ) : folio && folio.items.length > 0 ? (
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint mb-2">Charges</p>
                  <div className="space-y-1.5">
                    {folio.items.map((item: FolioLineItem) => (
                      <div key={item.id} className="flex items-center justify-between gap-2">
                        <span className="text-[13px] text-ink-soft truncate">
                          {ITEM_LABELS[item.type] ?? item.type.replace(/_/g, " ")} — {item.description}
                        </span>
                        <span className={cn(
                          "text-[13px] font-semibold flex-shrink-0 tnum",
                          item.type === "DISCOUNT" ? "text-pine-deep" : "text-ink",
                        )}>
                          {item.type === "DISCOUNT" ? "−" : ""}{formatPkr(item.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-ink-faint italic">No charges recorded</p>
              )}

              {/* Totals */}
              <div className="border-t border-line-soft pt-3 space-y-1.5">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-mute">Total Charges</span>
                  <span className="font-semibold text-ink tnum">{formatPkr(folio?.chargesTotal ?? 0)}</span>
                </div>
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-ink-mute">Payments Received</span>
                  <span className="text-ink tnum">{formatPkr(folio?.paymentsTotal ?? 0)}</span>
                </div>
                <div className="pt-2 border-t border-line-soft flex items-center justify-between">
                  <span className="text-[14px] font-bold text-ink">Balance Due</span>
                  <span className={cn(
                    "serif text-[22px] tnum",
                    balanceDue > 0 ? "text-clay" : "text-pine-deep",
                  )}>
                    {formatPkr(balanceDue)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* STATE A — Balance outstanding */}
          {balanceDue > 0 ? (
            <div className="space-y-4">
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Amount (PKR) <span className="text-coral text-[15px] font-bold leading-none normal-case tracking-normal">*</span></label>
                  <input
                    type="number" min="0" step="0.01"
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); amountSyncedRef.current = true; }}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Payment Method</label>
                  <select
                    value={method}
                    onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                    className={cn(inputCls, "cursor-pointer")}
                  >
                    {PAYMENT_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Reference <span className="normal-case tracking-normal text-ink-faint font-normal">(optional)</span></label>
                  <input
                    type="text"
                    value={transactionRef}
                    onChange={(e) => setTransactionRef(e.target.value)}
                    placeholder="Transaction ID or receipt number"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <button
                  onClick={handleCollectAndCheckOut}
                  disabled={isProcessing}
                  className={cn(
                    "w-full h-12 rounded-full bg-coral text-white font-semibold text-[14px] transition-colors shadow-pop",
                    isProcessing ? "opacity-50 cursor-not-allowed" : "hover:bg-coral-dark",
                  )}
                >
                  {isProcessing ? "Processing…" : "Collect & Check Out"}
                </button>
                <button
                  onClick={handleCheckOutWithoutPayment}
                  disabled={isProcessing}
                  className={cn(
                    "w-full h-11 rounded-full border border-line text-ink-soft font-semibold text-[13.5px] transition-colors",
                    isProcessing ? "opacity-40 cursor-not-allowed" : "hover:bg-line-soft hover:text-ink",
                  )}
                >
                  Check Out Without Payment
                </button>
                <div className="flex items-center gap-2.5 rounded-xl bg-amber-soft border border-amber/25 px-4 py-3">
                  <AlertTriangle size={14} className="text-amber shrink-0" />
                  <span className="text-[12.5px] font-semibold text-amber">
                    Folio will remain open with {formatPkr(balanceDue)} outstanding
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* STATE B — Fully settled */
            <div className="space-y-3">
              <div className="flex items-center gap-3 rounded-xl bg-pine-soft border border-pine/20 px-4 py-3.5">
                <CheckCircle2 size={18} className="text-pine-deep shrink-0" />
                <p className="text-[13.5px] font-semibold text-pine-deep">
                  Account settled — no outstanding balance
                </p>
              </div>
              <button
                onClick={handleCheckOutWithoutPayment}
                disabled={isProcessing}
                className={cn(
                  "w-full h-12 rounded-full bg-coral text-white font-semibold text-[14px] transition-colors shadow-pop",
                  isProcessing ? "opacity-50 cursor-not-allowed" : "hover:bg-coral-dark",
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
