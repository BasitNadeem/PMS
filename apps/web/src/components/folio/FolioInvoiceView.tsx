import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Printer } from "lucide-react";
import { settingsService } from "@/services/settings";
import type { FolioDetail, FolioItemType } from "@/services/folio";
import { useEscapeKey } from "@/hooks/useEscapeKey";

export interface FolioInvoiceViewProps {
  folio: FolioDetail;
  group?: { name: string; payerName: string | null } | null;
  onClose: () => void;
}

const ITEM_TYPE_LABEL: Record<FolioItemType, string> = {
  ROOM_CHARGE:   "Room",
  FOOD_BEVERAGE: "F&B",
  LAUNDRY:       "Laundry",
  TRANSPORT:     "Transport",
  SPA:           "Spa",
  ACTIVITY:      "Activity",
  MINIBAR:       "Minibar",
  TELEPHONE:     "Telephone",
  INTERNET:      "Internet",
  TAX:           "Tax",
  DISCOUNT:      "Discount",
  ADJUSTMENT:    "Adjustment",
  DAMAGE_CHARGE: "Damage",
  MISCELLANEOUS: "Other",
};

function fmt(paisas: number): string {
  return `PKR ${Math.round(Math.abs(paisas) / 100).toLocaleString("en-PK")}`;
}
function fmtDate(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
function fmtDateTime(iso: string): string {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}
function nightsBetween(from: string, to: string): number {
  return Math.max(0, Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000));
}

function TotalRow({ label, value, tone = "ink", bold = false }: { label: string; value: number; tone?: "ink" | "pine"; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className={bold ? "text-[13px] font-bold text-ink" : "text-[12.5px] text-ink-mute"}>{label}</span>
      <span className={`tnum ${bold ? "text-[13.5px] font-bold" : "text-[13px] font-semibold"} ${tone === "pine" ? "text-pine" : "text-ink"}`}>
        {value < 0 ? "−" : ""}{fmt(value)}
      </span>
    </div>
  );
}

export function FolioInvoiceView({ folio, group, onClose }: FolioInvoiceViewProps) {
  useEscapeKey(onClose);

  const { data: hotel } = useQuery({
    queryKey: ["hotel-settings"],
    queryFn: () => settingsService.getSettings(),
    staleTime: 300_000,
  });

  useEffect(() => {
    document.body.classList.add("invoice-mode");
    return () => document.body.classList.remove("invoice-mode");
  }, []);

  const res       = folio.reservation;
  const room      = res.rooms[0];
  const nights    = nightsBetween(res.checkInDate, res.checkOutDate);
  const netCharge = folio.chargesTotal + folio.taxTotal - folio.discountsTotal;
  const items     = [...folio.items].sort((a, b) => a.chargeDate.localeCompare(b.chargeDate));
  const now       = new Date().toISOString();
  const companyLedgerTransferred = Math.max(
    0,
    folio.companyResponsibilityTotal - folio.companyBalanceDue,
  );
  const companyNames = Array.from(
    new Set(
      folio.items
        .filter((item) => item.payerType === "COMPANY" && item.payerCompany?.name)
        .map((item) => item.payerCompany?.name)
        .filter((name): name is string => Boolean(name)),
    ),
  );
  const companyAccountDestination = companyNames.length === 1
    ? `${companyNames[0]}'s company account`
    : "the company account";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center bg-ink/40 backdrop-blur-sm overflow-y-auto p-6 anim-fade-in"
      onMouseDown={onClose}
    >
      {/* Controls — hidden on print */}
      <div className="no-print sticky top-0 z-10 mb-5 flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full bg-card shadow-float text-ink-mute hover:text-ink transition-colors"
        >
          <X size={16} />
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-coral px-5 text-[13px] font-semibold text-white shadow-float hover:bg-coral-dark transition-colors"
        >
          <Printer size={15} /> Print Invoice
        </button>
      </div>

      {/* The paper */}
      <div
        className="invoice-print-paper mb-10 w-full max-w-[820px] rounded-sm bg-white p-10 shadow-float anim-scale-in sm:p-14"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Masthead */}
        <div className="flex items-start justify-between gap-6 border-b-2 border-ink pb-6">
          <div>
            <h1 className="serif text-[26px] leading-tight text-ink">{hotel?.name ?? "—"}</h1>
            {(hotel?.address || hotel?.city) && (
              <p className="mt-1 max-w-[280px] text-[12px] leading-snug text-ink-mute">
                {[hotel?.address, hotel?.city].filter(Boolean).join(", ")}
              </p>
            )}
            {(hotel?.phone || hotel?.email) && (
              <p className="text-[12px] text-ink-mute">{[hotel?.phone, hotel?.email].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">
              {folio.companyResponsibilityTotal > 0 ? "Guest / Company Folio" : "Guest Folio"}
            </p>
            <p className="mt-1 font-mono text-[15px] font-semibold tnum text-ink">{folio.folioNumber}</p>
            <p className="mt-2 text-[11px] text-ink-mute">Issued {fmtDateTime(now)}</p>
            <span
              className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                folio.isOpen ? "border-coral text-coral" : "border-pine text-pine"
              }`}
            >
              {folio.isOpen ? "Open Balance" : "Settled"}
            </span>
          </div>
        </div>

        {/* Bill-to / Stay details */}
        <div className="grid grid-cols-2 gap-8 border-b border-line-soft py-6">
          <div>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Billed To</p>
            <p className="text-[15px] font-semibold text-ink">{res.guest.fullName}</p>
            {group && (
              <p className="mt-0.5 text-[12.5px] text-ink-mute">
                {group.name}{group.payerName ? ` · ${group.payerName}` : ""}
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Stay Details</p>
            <dl className="grid grid-cols-2 gap-y-1 text-[12.5px]">
              <dt className="text-ink-mute">Room</dt>
              <dd className="text-right font-medium text-ink">
                {room ? `${room.room.number} · ${room.roomType.name}` : "—"}
              </dd>
              <dt className="text-ink-mute">Check-in</dt>
              <dd className="text-right font-medium tnum text-ink">{fmtDate(res.checkInDate)}</dd>
              <dt className="text-ink-mute">Check-out</dt>
              <dd className="text-right font-medium tnum text-ink">{fmtDate(res.checkOutDate)}</dd>
              <dt className="text-ink-mute">Nights</dt>
              <dd className="text-right font-medium tnum text-ink">{nights}</dd>
              {res.confirmationNumber && (
                <>
                  <dt className="text-ink-mute">Res ID</dt>
                  <dd className="text-right font-medium tnum text-ink">{res.confirmationNumber}</dd>
                </>
              )}
            </dl>
          </div>
        </div>

        {/* Itemized charges */}
        <div className="py-6">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Itemized Charges</p>
          {items.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] text-ink-mute">No charges recorded</p>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="py-2 pr-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Date</th>
                  <th className="py-2 pr-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Description</th>
                  <th className="py-2 pr-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Payer</th>
                  <th className="py-2 text-right text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Amount</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const isDiscount = item.type === "DISCOUNT";
                  return (
                    <tr key={item.id} className="border-b border-line-soft">
                      <td className="py-2 pr-3 tnum text-ink-mute">{fmtDate(item.chargeDate)}</td>
                      <td className="py-2 pr-3 text-ink">
                        {item.description}
                        <span className="text-ink-faint"> · {ITEM_TYPE_LABEL[item.type] ?? item.type}</span>
                      </td>
                      <td className="py-2 pr-3 text-[11.5px] font-medium text-ink-mute">
                        {item.payerType === "COMPANY" ? `BTC · ${item.payerCompany?.name ?? "Company"}` : "Guest"}
                      </td>
                      <td className={`py-2 text-right tnum font-medium ${isDiscount ? "text-pine" : "text-ink"}`}>
                        {isDiscount ? "−" : ""}{fmt(item.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Payments received */}
        {folio.payments.length > 0 && (
          <div className="border-t border-line-soft py-6">
            <p className="mb-3 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Payments Received</p>
            <table className="w-full border-collapse text-[12.5px]">
              <tbody>
                {folio.payments.map((p) => (
                  <tr key={p.id} className="border-b border-line-soft">
                    <td className="py-2 pr-3 tnum text-ink-mute">{fmtDateTime(p.postedAt)}</td>
                    <td className="py-2 pr-3 text-ink">{p.method.replace(/_/g, " ")}</td>
                    <td className="py-2 text-right tnum font-medium text-pine">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals */}
        <div className="flex justify-end pt-2">
          <div className="w-full max-w-[280px] space-y-1.5">
            <TotalRow label="Subtotal" value={folio.chargesTotal} />
            {folio.taxTotal > 0 && <TotalRow label="Tax" value={folio.taxTotal} />}
            {folio.discountsTotal > 0 && <TotalRow label="Discount" value={-folio.discountsTotal} tone="pine" />}
            <div className="my-1.5 border-t border-ink/25" />
            <TotalRow label="Total Charges" value={netCharge} bold />
            <TotalRow label="Payments Received" value={-folio.paymentsTotal} tone="pine" />
            {folio.companyResponsibilityTotal > 0 && (
              <>
                <div className="my-1.5 border-t border-ink/15" />
                <TotalRow label="Guest Responsibility" value={folio.guestResponsibilityTotal} />
                <TotalRow label="Guest Outstanding" value={folio.guestBalanceDue} bold />
                <div className="my-1.5 border-t border-ink/15" />
                <TotalRow label="Company (BTC) Responsibility" value={folio.companyResponsibilityTotal} />
                {companyLedgerTransferred > 0 && (
                  <TotalRow label="Transferred to Company Account" value={-companyLedgerTransferred} tone="pine" />
                )}
                <TotalRow label="BTC Awaiting Transfer" value={folio.companyBalanceDue} bold />
              </>
            )}
            <div className="mt-1.5 flex items-baseline justify-between border-t-2 border-ink pt-2.5">
              <span className="text-[13.5px] font-bold uppercase tracking-wide text-ink">Folio Balance Due</span>
              <span className={`serif tnum text-[28px] font-bold ${folio.balanceDue > 0 ? "text-coral" : "text-pine"}`}>
                {fmt(folio.balanceDue)}
              </span>
            </div>
          </div>
        </div>

        {companyLedgerTransferred > 0 && (
          <div className="mt-5 rounded-lg border border-line-soft bg-paper px-4 py-3 text-[11.5px] leading-relaxed text-ink-mute">
            <span className="font-semibold text-ink">BTC transfer:</span>{" "}
            {fmt(companyLedgerTransferred)} was transferred to {companyAccountDestination}.
            Its payment status is tracked on the company ledger, so it is no longer due on this folio.
          </div>
        )}

        {/* Signatures */}
        <div className="mt-10 grid grid-cols-2 gap-10">
          <div>
            <div className="mb-1 mt-8 h-px bg-ink-faint/40" />
            <p className="text-[11px] text-ink-mute">Guest Signature</p>
          </div>
          <div>
            <div className="mb-1 mt-8 h-px bg-ink-faint/40" />
            <p className="text-[11px] text-ink-mute">Authorized Signatory{hotel?.name ? ` · ${hotel.name}` : ""}</p>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[11.5px] italic text-ink-faint">
          Thank you for staying with us — we hope to welcome you again.
        </p>
        <p className="mt-1 text-center tnum text-[9.5px] text-ink-faint">
          Generated {fmtDateTime(now)} · {folio.folioNumber}
        </p>
      </div>
    </div>
  );
}
