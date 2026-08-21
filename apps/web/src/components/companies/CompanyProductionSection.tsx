import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { BedDouble, Building2, CalendarDays, CircleDollarSign, FileSpreadsheet, Printer, ReceiptText, TrendingUp } from "lucide-react";
import { companiesService, pkr } from "@/services/companies";
import { Card } from "@/components/ui/Card";
import { Segmented } from "@/components/ui/Segmented";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DatePicker } from "@/components/ui/DatePicker";
import { exportCompanyProductionToExcel } from "@/lib/exportExcel";

type RangePreset = "month" | "lastMonth" | "90days" | "year" | "custom";

function isoDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function presetRange(preset: Exclude<RangePreset, "custom">): { from: string; to: string } {
  const today = new Date();
  if (preset === "month") return { from: isoDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: isoDate(today) };
  if (preset === "lastMonth") return {
    from: isoDate(new Date(today.getFullYear(), today.getMonth() - 1, 1)),
    to: isoDate(new Date(today.getFullYear(), today.getMonth(), 0)),
  };
  if (preset === "90days") {
    const start = new Date(today); start.setDate(start.getDate() - 89);
    return { from: isoDate(start), to: isoDate(today) };
  }
  return { from: isoDate(new Date(today.getFullYear(), 0, 1)), to: isoDate(today) };
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value));
}

export function CompanyProductionSection({ companyId }: { companyId: string }) {
  const printRef = useRef<HTMLDivElement>(null);
  const initial = presetRange("month");
  const [preset, setPreset] = useState<RangePreset>("month");
  const [custom, setCustom] = useState(initial);
  const range = useMemo(() => preset === "custom" ? custom : presetRange(preset), [preset, custom]);
  const validRange = Boolean(range.from && range.to && range.from <= range.to);
  const { data, isLoading } = useQuery({
    queryKey: ["company-production", companyId, range.from, range.to],
    queryFn: () => companiesService.production(companyId, range.from, range.to),
    enabled: validRange,
  });

  async function printReport() {
    if (!printRef.current) return;
    const frame = document.createElement("iframe");
    frame.setAttribute("title", "Company production print document");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden" });
    document.body.appendChild(frame);
    const printDocument = frame.contentDocument;
    const printWindow = frame.contentWindow;
    if (!printDocument || !printWindow) { frame.remove(); return; }
    const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map((element) => element.outerHTML).join("\n");
    printDocument.open();
    printDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>Company Production</title>${styles}<style>@page{size:A4;margin:14mm}body{background:white!important}</style></head><body></body></html>`);
    printDocument.close();
    const report = printRef.current.cloneNode(true) as HTMLElement;
    report.classList.remove("hidden");
    printDocument.body.appendChild(report);
    await printDocument.fonts?.ready;
    printWindow.onafterprint = () => setTimeout(() => frame.remove(), 250);
    printWindow.focus();
    printWindow.print();
    setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  }

  return (
    <div className="space-y-4">
      <Card className="px-4 py-3.5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <h2 className="serif text-[24px] text-ink">Company production</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-mute">Stay performance is separate from BTC collections and outstanding credit.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Segmented
              options={[
                { value: "month", label: "This month" },
                { value: "lastMonth", label: "Last month" },
                { value: "90days", label: "90 days" },
                { value: "year", label: "This year" },
                { value: "custom", label: "Custom" },
              ]}
              value={preset}
              onChange={(value) => setPreset(value as RangePreset)}
              size="sm"
            />
            {data && <button type="button" onClick={() => exportCompanyProductionToExcel(data)} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-card px-3.5 text-[12px] font-semibold text-ink hover:bg-mist"><FileSpreadsheet size={14} /> Excel</button>}
            {data && <button type="button" onClick={printReport} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12px] font-semibold text-white"><Printer size={14} /> Print</button>}
          </div>
        </div>
        {preset === "custom" && (
          <div className="mt-3 grid max-w-lg grid-cols-2 gap-2">
            <DatePicker value={custom.from} max={custom.to || undefined} onChange={(from) => setCustom((current) => ({ ...current, from }))} placeholder="From" />
            <DatePicker value={custom.to} min={custom.from || undefined} onChange={(to) => setCustom((current) => ({ ...current, to }))} placeholder="To" />
          </div>
        )}
      </Card>

      {isLoading && <Card className="py-12 text-center text-[13px] text-ink-mute">Calculating production…</Card>}
      {!isLoading && data && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Reservations", value: data.summary.reservations.toLocaleString("en-PK"), note: `${data.summary.cancelled} cancelled · ${data.summary.noShows} no-show`, icon: CalendarDays },
              { label: "Room nights", value: data.summary.roomNights.toLocaleString("en-PK"), note: `${data.summary.companyRoomNightShare}% of company-linked nights`, icon: BedDouble },
              { label: "Room revenue", value: pkr(data.summary.roomRevenue), note: `${data.summary.companyRevenueShare}% of company-linked revenue`, icon: TrendingUp },
              { label: "ADR", value: pkr(data.summary.adr), note: "Average rate per occupied room-night", icon: CircleDollarSign },
            ].map((metric) => (
              <Card key={metric.label} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-ink-mute">{metric.label}</div>
                  <metric.icon size={16} className="text-coral" />
                </div>
                <div className="mt-2 text-[22px] font-semibold tabular-nums text-ink">{metric.value}</div>
                <div className="mt-1 text-[11.5px] text-ink-faint">{metric.note}</div>
              </Card>
            ))}
          </div>

          <Card className="p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div><div className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Transferred to BTC</div><div className="mt-1 text-[18px] font-semibold tabular-nums text-ink">{pkr(data.summary.btcTransferred)}</div></div>
              <div><div className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Payments received</div><div className="mt-1 text-[18px] font-semibold tabular-nums text-sage-deep">{pkr(data.summary.paymentsReceived)}</div></div>
              <div><div className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Current outstanding</div><div className="mt-1 text-[18px] font-semibold tabular-nums text-ink">{pkr(data.summary.outstanding)}</div></div>
            </div>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <Card pad={false}>
              <div className="flex items-center gap-2 border-b border-line-soft px-5 py-4"><Building2 size={17} className="text-coral" /><h3 className="text-[14px] font-bold text-ink">Production by room type</h3></div>
              {data.roomTypes.length === 0 ? <div className="px-5 py-10 text-center text-[13px] text-ink-mute">No produced room nights in this period.</div> : data.roomTypes.map((row) => (
                <div key={row.roomTypeId} className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-line-soft px-5 py-3.5 last:border-0">
                  <div><div className="text-[13.5px] font-semibold text-ink">{row.roomTypeName}</div><div className="text-[11.5px] text-ink-mute">{row.roomNights} room nights</div></div>
                  <div className="text-right"><div className="text-[13px] font-semibold tabular-nums text-ink">{pkr(row.roomRevenue)}</div><div className="text-[11.5px] text-ink-mute">revenue</div></div>
                  <div className="min-w-20 text-right"><div className="text-[13px] font-semibold tabular-nums text-ink">{pkr(row.adr)}</div><div className="text-[11.5px] text-ink-mute">ADR</div></div>
                </div>
              ))}
            </Card>

            <Card pad={false}>
              <div className="flex items-center gap-2 border-b border-line-soft px-5 py-4"><TrendingUp size={17} className="text-coral" /><h3 className="text-[14px] font-bold text-ink">Monthly production</h3></div>
              {data.months.length === 0 ? <div className="px-5 py-10 text-center text-[13px] text-ink-mute">No monthly production in this period.</div> : data.months.map((row) => {
                const maximum = Math.max(...data.months.map((month) => month.roomRevenue), 1);
                return <div key={row.month} className="px-5 py-3.5 border-b border-line-soft last:border-0"><div className="flex items-center justify-between gap-3"><div className="text-[13px] font-semibold text-ink">{new Intl.DateTimeFormat("en-PK", { month: "long", year: "numeric" }).format(new Date(`${row.month}-01T00:00:00Z`))}</div><div className="text-right text-[13px] font-semibold tabular-nums text-ink">{pkr(row.roomRevenue)} <span className="font-normal text-ink-mute">· {row.roomNights} nights</span></div></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-coral" style={{ width: `${Math.max(3, (row.roomRevenue / maximum) * 100)}%` }} /></div></div>;
              })}
            </Card>
          </div>

          <Card pad={false}>
            <div className="flex items-center gap-2 border-b border-line-soft px-5 py-4"><ReceiptText size={17} className="text-coral" /><h3 className="text-[14px] font-bold text-ink">Recent stays in this period</h3></div>
            {data.recentReservations.length === 0 ? <div className="px-5 py-10 text-center text-[13px] text-ink-mute">No reservations contributed to this period.</div> : data.recentReservations.map((reservation) => (
              <Link key={reservation.id} to={`/reservations/${reservation.id}`} className="grid gap-3 border-b border-line-soft px-5 py-3.5 last:border-0 hover:bg-mist md:grid-cols-[1.2fr_1fr_1fr_auto] md:items-center">
                <div><div className="text-[13.5px] font-semibold text-ink">{reservation.guest.fullName}</div><div className="text-[11.5px] font-semibold text-coral underline decoration-coral/35 underline-offset-4">{reservation.confirmationNumber}</div></div>
                <div className="text-[12.5px] text-ink-mute">{formatDate(reservation.checkInDate)} – {formatDate(reservation.checkOutDate)}</div>
                <div className="text-[12.5px] text-ink-mute">{reservation.rooms.map((room) => `Room ${room.number}`).join(", ") || "Room not assigned"}</div>
                <StatusBadge status={reservation.status} size="sm" />
              </Link>
            ))}
          </Card>

          <div ref={printRef} className="hidden mx-auto max-w-[190mm] bg-white p-2 text-ink">
            <header className="border-b-2 border-ink pb-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-coral">Innflo · Company production</p>
              <h1 className="mt-1 serif text-[28px]">{data.company.name}</h1>
              <p className="mt-1 text-[12px] text-ink-mute">{formatDate(data.range.from)} – {formatDate(data.range.to)}</p>
            </header>
            <table className="mt-5 w-full border-collapse text-[12px]"><tbody>{[
              ["Reservations", data.summary.reservations.toLocaleString("en-PK")], ["Room nights", data.summary.roomNights.toLocaleString("en-PK")],
              ["Room revenue", pkr(data.summary.roomRevenue)], ["ADR", pkr(data.summary.adr)],
              ["Transferred to BTC", pkr(data.summary.btcTransferred)], ["Payments received", pkr(data.summary.paymentsReceived)],
              ["Current outstanding", pkr(data.summary.outstanding)],
            ].map(([label, value]) => <tr key={label}><th className="border-b border-line py-2 text-left font-medium text-ink-mute">{label}</th><td className="border-b border-line py-2 text-right font-semibold">{value}</td></tr>)}</tbody></table>
            <h2 className="mt-7 text-[14px] font-bold">Production by room type</h2>
            <table className="mt-2 w-full border-collapse text-[11px]"><thead><tr>{["Room type", "Nights", "Revenue", "ADR"].map((label) => <th key={label} className="border-b-2 border-ink py-2 text-left">{label}</th>)}</tr></thead><tbody>{data.roomTypes.map((row) => <tr key={row.roomTypeId}><td className="border-b border-line py-2">{row.roomTypeName}</td><td className="border-b border-line py-2">{row.roomNights}</td><td className="border-b border-line py-2">{pkr(row.roomRevenue)}</td><td className="border-b border-line py-2">{pkr(row.adr)}</td></tr>)}</tbody></table>
            <h2 className="mt-7 text-[14px] font-bold">Monthly production</h2>
            <table className="mt-2 w-full border-collapse text-[11px]"><thead><tr>{["Month", "Nights", "Revenue", "ADR"].map((label) => <th key={label} className="border-b-2 border-ink py-2 text-left">{label}</th>)}</tr></thead><tbody>{data.months.map((row) => <tr key={row.month}><td className="border-b border-line py-2">{row.month}</td><td className="border-b border-line py-2">{row.roomNights}</td><td className="border-b border-line py-2">{pkr(row.roomRevenue)}</td><td className="border-b border-line py-2">{pkr(row.adr)}</td></tr>)}</tbody></table>
          </div>
        </>
      )}
    </div>
  );
}
