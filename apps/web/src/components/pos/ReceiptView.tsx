import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Printer, X, Check, Building2, CreditCard } from "lucide-react";
import { cn } from "@/lib/cn";
import { api } from "@/lib/api";

export interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export type PaymentStatus =
  | { type: "PAID"; method: string }
  | { type: "CHARGED_TO_ROOM"; roomNumber: string }
  | { type: "PENDING_PAYMENT" };

export interface ReceiptViewProps {
  hotelName?: string;
  orderNumber: string;
  dateTime: string;
  guestName?: string;
  roomNumber?: string;
  items: ReceiptItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentStatus: PaymentStatus;
  servedByName?: string;
  onClose: () => void;
}

type PaperWidth = "80mm" | "58mm";

function fmt(paisas: number) {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

export function ReceiptView({
  hotelName: hotelNameProp, orderNumber, dateTime, guestName, roomNumber, items,
  subtotal, taxAmount, discountAmount, total,
  paymentStatus, servedByName, onClose,
}: ReceiptViewProps) {
  const [width, setWidth] = useState<PaperWidth>("80mm");

  const { data: hotelData } = useQuery({
    queryKey: ["hotel"],
    queryFn: () => api.get("/api/hotels/me").then((r) => r.data.data as { name: string }),
    staleTime: 300_000,
  });
  const hotelName = hotelNameProp ?? hotelData?.name;

  useEffect(() => {
    document.body.classList.add("receipt-mode");
    return () => document.body.classList.remove("receipt-mode");
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
    style.id = "__receipt_page_style";
    style.textContent = `@media print { @page { margin: 0; size: ${width} auto; } }`;
    document.head.appendChild(style);
    return () => document.getElementById("__receipt_page_style")?.remove();
  }, [width]);

  const formattedDate = new Date(dateTime).toLocaleString("en-PK", {
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-start pt-20 bg-black/60 backdrop-blur-sm p-4 anim-fade-in overflow-y-auto">

      {/* Controls — hidden on print */}
      <div className="no-print fixed top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2">
        <div className="flex items-center bg-white rounded-full px-1 py-1 shadow-xl gap-0.5">
          {(["80mm", "58mm"] as PaperWidth[]).map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              className={cn(
                "px-3.5 py-1.5 rounded-full text-[12px] font-semibold transition-all",
                width === w ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800",
              )}
            >
              {w}
            </button>
          ))}
        </div>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 h-9 px-5 bg-gray-900 text-white rounded-full text-[13px] font-semibold shadow-xl hover:bg-gray-700 transition-colors"
        >
          <Printer size={14} />
          Print
        </button>
        <button
          onClick={onClose}
          className="grid place-items-center h-9 w-9 bg-white rounded-full shadow-xl text-gray-500 hover:text-gray-800 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Receipt card */}
      <div
        className={cn(
          "receipt-print-paper bg-white shadow-2xl anim-scale-in mt-2 mb-10 overflow-hidden",
          width === "80mm" ? "w-[80mm]" : "w-[58mm]",
        )}
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}
      >
        {/* ── Header ───────────────────────────────── */}
        <div className="bg-gray-900 px-5 pt-6 pb-5 text-center">
          {hotelName && (
            <p className="text-white font-bold text-[17px] tracking-wide uppercase leading-tight">
              {hotelName}
            </p>
          )}
          {(guestName || roomNumber) && (
            <p className="text-gray-400 text-[11.5px] mt-2 tracking-wide">
              {[guestName, roomNumber ? `Room ${roomNumber}` : null].filter(Boolean).join("  ·  ")}
            </p>
          )}
        </div>

        {/* ── Order meta ────────────────────────────── */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-gray-50 border-b border-gray-100">
          <span className="text-[9.5px] font-mono text-gray-400 tracking-[0.12em] uppercase">
            {orderNumber}
          </span>
          <span className="text-[11px] text-gray-500">{formattedDate}</span>
        </div>

        {/* ── Items ────────────────────────────────── */}
        <div className="px-5 py-1">
          {items.map((item, i) => (
            <div key={i} className="py-3 border-b border-gray-100 last:border-0">
              <div className="flex items-start justify-between gap-3">
                <span className="text-[13px] font-semibold text-gray-900 flex-1 leading-snug">
                  {item.name}
                </span>
                <span className="text-[13px] font-bold text-gray-900 shrink-0 tabular-nums">
                  {fmt(item.lineTotal)}
                </span>
              </div>
              <span className="text-[11px] text-gray-400 tabular-nums mt-0.5 block">
                {item.quantity} × {fmt(item.unitPrice)}
              </span>
            </div>
          ))}
        </div>

        {/* ── Totals ───────────────────────────────── */}
        <div className="bg-gray-50 border-t border-gray-200 px-5 pt-3.5 pb-4">
          <div className="space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span className="text-gray-500">Subtotal</span>
              <span className="text-gray-700 tabular-nums">{fmt(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-500">Tax</span>
                <span className="text-gray-700 tabular-nums">{fmt(taxAmount)}</span>
              </div>
            )}
            {discountAmount > 0 && (
              <div className="flex justify-between text-[12px]">
                <span className="text-gray-500">Discount</span>
                <span className="text-green-600 tabular-nums">−{fmt(discountAmount)}</span>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t-2 border-gray-800 flex items-baseline justify-between">
            <span className="text-[14px] font-bold text-gray-900 uppercase tracking-wide">Total</span>
            <span className="text-[22px] font-bold text-gray-900 tabular-nums leading-none">
              {fmt(total)}
            </span>
          </div>
        </div>

        {/* ── Payment status ───────────────────────── */}
        <div className="px-5 py-4 border-t border-gray-100">
          {paymentStatus.type === "PAID" && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                <Check size={14} className="text-green-600" strokeWidth={3} />
              </div>
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">Payment received</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  {paymentStatus.method.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          )}
          {paymentStatus.type === "CHARGED_TO_ROOM" && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                <Building2 size={13} className="text-blue-500" />
              </div>
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">
                  Charged to Room {paymentStatus.roomNumber}
                </p>
                <p className="text-[11px] text-gray-400 mt-0.5">Settle at checkout</p>
              </div>
            </div>
          )}
          {paymentStatus.type === "PENDING_PAYMENT" && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-amber-50 flex items-center justify-center shrink-0">
                <CreditCard size={13} className="text-amber-500" />
              </div>
              <div>
                <p className="text-[12.5px] font-semibold text-gray-800">Payment pending</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Collect at counter</p>
              </div>
            </div>
          )}
          {servedByName && (
            <p className="text-[11px] text-gray-400 mt-3">Served by {servedByName}</p>
          )}
        </div>

        {/* ── Footer ───────────────────────────────── */}
        <div className="bg-gray-900 px-5 py-4 text-center">
          <p className="text-white font-bold text-[14px] tracking-wide">Thank you!</p>
          <p className="text-gray-500 text-[11px] mt-1">We hope to see you again</p>
        </div>
      </div>
    </div>
  );
}
