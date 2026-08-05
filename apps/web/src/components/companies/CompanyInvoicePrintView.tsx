import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Printer } from "lucide-react";
import { settingsService } from "@/services/settings";
import { pkrInWords } from "@/lib/numberToWords";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import type { CompanyInvoice, LedgerEntry, Company } from "@/services/companies";

/**
 * A4 invoice document for a company's consolidated stays.
 *
 * A separate component rather than print rules bolted onto the detail modal:
 * `window.print()` on a modal prints the viewport — dialog chrome, backdrop and
 * all — because the modal is styled for a screen, not a page. This renders the
 * document itself, and reuses the existing `body.invoice-mode` /
 * `.invoice-print-paper` rules in index.css that already isolate the folio
 * invoice for A4 (`@page { size: A4; margin: 20mm }`).
 *
 * The audience is an agency's accountant filing a bill, so it leads with who
 * owes what, itemises every stay, and prints the tax numbers of both parties.
 */

export interface CompanyInvoicePrintViewProps {
  invoice: CompanyInvoice & { lines: LedgerEntry[]; company: Company };
  onClose: () => void;
}

function fmt(paisa: number): string {
  return `PKR ${Math.round(Math.abs(paisa) / 100).toLocaleString("en-PK")}`;
}

function fmtDate(value: string | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

function fmtDateTime(value: string): string {
  return new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft", ISSUED: "Issued", PARTIALLY_PAID: "Partially Paid", PAID: "Paid", VOID: "Void",
};

export function CompanyInvoicePrintView({ invoice, onClose }: CompanyInvoicePrintViewProps) {
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

  const company    = invoice.company;
  const balanceDue = Math.max(0, invoice.totalAmount - invoice.paidAmount);
  const lines      = [...invoice.lines].sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  const isVoid     = invoice.status === "VOID";

  return (
    // The print: overrides matter — backdrop-filter and overflow on this element
    // would otherwise make it a containing block for the position:fixed paper,
    // trapping the document inside one viewport-sized box on the page.
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center overflow-y-auto bg-ink/40 p-6 backdrop-blur-sm anim-fade-in print:static print:overflow-visible print:bg-transparent print:p-0 print:backdrop-blur-none"
      onMouseDown={onClose}
    >
      {/* Screen-only controls */}
      <div className="no-print sticky top-0 z-10 mb-5 flex items-center gap-2" onMouseDown={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          className="grid h-10 w-10 place-items-center rounded-full bg-card text-ink-mute shadow-float transition-colors hover:text-ink"
          aria-label="Close"
        >
          <X size={16} />
        </button>
        <button
          onClick={() => window.print()}
          className="inline-flex h-10 items-center gap-2 rounded-full bg-coral px-5 text-[13px] font-semibold text-white shadow-float transition-colors hover:bg-coral-dark"
        >
          <Printer size={15} /> Print Invoice
        </button>
      </div>

      {/* The page. max-w matches A4's printable width at this type scale. */}
      <div
        className="invoice-print-paper mb-10 w-full max-w-[820px] rounded-sm bg-white p-10 shadow-float anim-scale-in sm:p-14 print:mb-0 print:max-w-none print:p-0 print:shadow-none"
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
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-faint">Invoice</p>
            <p className="mt-1 font-mono text-[15px] font-semibold text-ink tnum">{invoice.invoiceNumber}</p>
            <p className="mt-2 text-[11px] text-ink-mute">Printed {fmtDateTime(new Date().toISOString())}</p>
            <span
              className={`mt-2 inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isVoid ? "border-ink-faint text-ink-faint"
                : balanceDue > 0 ? "border-coral text-coral"
                : "border-pine text-pine"
              }`}
            >
              {STATUS_LABEL[invoice.status] ?? invoice.status}
            </span>
          </div>
        </div>

        {/* A voided invoice must never be mistaken for a live demand for payment. */}
        {isVoid && (
          <p className="mt-6 border-2 border-ink-faint py-2 text-center text-[13px] font-bold uppercase tracking-[0.3em] text-ink-faint">
            Void — not payable
          </p>
        )}

        {/* Bill to / invoice meta */}
        <div className="grid grid-cols-2 gap-8 border-b border-line-soft py-6">
          <div>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Billed To</p>
            <p className="text-[15px] font-semibold text-ink">{company.name}</p>
            {company.contactName && <p className="mt-0.5 text-[12.5px] text-ink-mute">Attn: {company.contactName}</p>}
            {(company.address || company.city) && (
              <p className="mt-0.5 max-w-[260px] text-[12.5px] leading-snug text-ink-mute">
                {[company.address, company.city].filter(Boolean).join(", ")}
              </p>
            )}
            {company.contactPhone && <p className="text-[12.5px] text-ink-mute">{company.contactPhone}</p>}
            {/* Printed because a registered agency needs it to claim the expense. */}
            {company.ntn  && <p className="mt-1 text-[12px] text-ink-mute">NTN: {company.ntn}</p>}
            {company.strn && <p className="text-[12px] text-ink-mute">STRN: {company.strn}</p>}
          </div>
          <div>
            <p className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Invoice Details</p>
            <dl className="grid grid-cols-2 gap-y-1 text-[12.5px]">
              <dt className="text-ink-mute">Period</dt>
              <dd className="text-right font-medium text-ink tnum">
                {fmtDate(invoice.periodStart)} – {fmtDate(invoice.periodEnd)}
              </dd>
              <dt className="text-ink-mute">Issued</dt>
              <dd className="text-right font-medium text-ink tnum">{fmtDate(invoice.issuedAt)}</dd>
              <dt className="text-ink-mute">Due</dt>
              <dd className="text-right font-medium text-ink tnum">{fmtDate(invoice.dueDate)}</dd>
              <dt className="text-ink-mute">Stays</dt>
              <dd className="text-right font-medium text-ink tnum">{lines.length}</dd>
            </dl>
          </div>
        </div>

        {/* Stays */}
        <div className="py-6">
          <p className="mb-3 text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Stays Billed</p>
          {lines.length === 0 ? (
            <p className="py-4 text-center text-[12.5px] text-ink-mute">No charges on this invoice</p>
          ) : (
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr className="border-b-2 border-ink">
                  <th className="py-2 pr-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Date</th>
                  <th className="py-2 pr-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Guest</th>
                  <th className="py-2 pr-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Room</th>
                  <th className="py-2 pr-3 text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Stay</th>
                  <th className="py-2 text-right text-[10.5px] font-bold uppercase tracking-wider text-ink-faint">Amount</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  // break-inside-avoid keeps a stay from splitting across pages.
                  <tr key={line.id} className="border-b border-line-soft break-inside-avoid">
                    <td className="py-2.5 pr-3 align-top text-ink-mute tnum">{fmtDate(line.entryDate)}</td>
                    <td className="py-2.5 pr-3 align-top text-ink">
                      {line.guestName ?? line.description}
                      {line.guestName && (
                        <span className="block text-[11px] text-ink-mute">{line.description}</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 align-top text-ink-mute tnum">{line.roomNumber ?? "—"}</td>
                    <td className="py-2.5 pr-3 align-top text-ink-mute tnum">
                      {line.stayFrom && line.stayTo
                        ? `${fmtDate(line.stayFrom)} – ${fmtDate(line.stayTo)}`
                        : "—"}
                    </td>
                    <td className="py-2.5 text-right align-top font-semibold text-ink tnum">{fmt(line.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Totals */}
        <div className="flex justify-end break-inside-avoid">
          <div className="w-full max-w-[300px] space-y-1.5">
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="text-ink-mute">Total</span>
              <span className="font-semibold text-ink tnum">{fmt(invoice.totalAmount)}</span>
            </div>
            {invoice.taxAmount > 0 && (
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="text-ink-mute">Tax</span>
                <span className="font-semibold text-ink tnum">{fmt(invoice.taxAmount)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="text-ink-mute">Paid</span>
              <span className="font-semibold text-pine tnum">−{fmt(invoice.paidAmount)}</span>
            </div>
            <div className="flex items-baseline justify-between border-t-2 border-ink pt-2">
              <span className="text-[13px] font-bold text-ink">Balance Due</span>
              <span className="text-[15px] font-bold text-ink tnum">{fmt(balanceDue)}</span>
            </div>
          </div>
        </div>

        {/* Amount in words — expected on a Pakistani invoice and a cheap guard
            against a figure being altered after printing. */}
        {balanceDue > 0 && (
          <p className="mt-4 border-t border-line-soft pt-3 text-[12px] italic text-ink-mute">
            Amount in words: {pkrInWords(Math.round(balanceDue / 100))} only
          </p>
        )}

        {/* Footer */}
        <div className="mt-8 border-t border-line-soft pt-5 text-[11.5px] leading-relaxed text-ink-mute break-inside-avoid">
          {invoice.notes && <p className="mb-2 whitespace-pre-line text-ink-soft">{invoice.notes}</p>}
          {!isVoid && balanceDue > 0 && invoice.dueDate && (
            <p className="mb-2 font-medium text-ink-soft">
              Payment due by {fmtDate(invoice.dueDate)}.
            </p>
          )}
          <p>
            This invoice consolidates every stay billed to {company.name} during the period shown.
            Queries about a specific stay should quote its folio reference above.
          </p>
          <p className="mt-3 text-[11px] text-ink-faint">
            {hotel?.name ?? ""} · Computer-generated invoice, valid without signature.
          </p>
        </div>
      </div>
    </div>
  );
}
