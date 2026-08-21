import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowRight, BedDouble, Building2, CalendarDays, CheckCircle2,
  ClipboardCheck, FileSpreadsheet, FileWarning, Loader2, Package, Printer, ShoppingBag, Sparkles,
  TrendingUp, Users, Wrench,
} from "lucide-react";
import { DatePicker } from "@/components/ui/DatePicker";
import { BusinessDaySnapshotView } from "@/components/nightaudit/BusinessDaySnapshotView";
import { ReservationIdLink } from "@/components/reservations/ReservationIdLink";
import { reportsService } from "@/services/reports";
import { nightAuditService } from "@/services/nightAudit";
import { cn } from "@/lib/cn";
import { getErrorMessage } from "@/lib/api";
import { exportEarlyBirdReportToExcel } from "@/lib/exportExcel";
import { EarlyBirdPrintReport } from "@/components/reports/EarlyBirdPrintReport";

function currentPKTDate(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi" }).format(new Date());
}

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

function formatDate(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-PK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function humanize(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-white/45">{label}</p>
      <p className="mt-1 serif text-[25px] leading-none text-white">{value}</p>
      <p className="mt-1.5 text-[11px] text-white/50">{detail}</p>
    </div>
  );
}

function Panel({ title, icon: Icon, children, action }: { title: string; icon: typeof BedDouble; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-card p-5 shadow-card">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-clay-soft text-coral"><Icon size={15} /></span>
        <h2 className="flex-1 text-[14px] font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-mist/45 px-3 py-4 text-center text-[12px] text-ink-mute">{children}</p>;
}

export default function EarlyBirdReportPage() {
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [date, setDate] = useState<string | null>(null);
  const forecastDays = 10;
  const { data: auditHistory, isLoading: isLoadingAuditHistory } = useQuery({
    queryKey: ["night-audit-history", "early-bird-selector"],
    queryFn: () => nightAuditService.listHistory(1, 100),
  });
  const { data: archiveData, isLoading: isLoadingArchive } = useQuery({
    queryKey: ["early-bird-history"],
    queryFn: () => reportsService.getEarlyBirdHistory(1, 100),
  });
  const availableReportDates = useMemo(() => {
    const dates = new Set<string>();
    for (const audit of auditHistory?.data ?? []) {
      if (!audit.reversedAt) dates.add(addDays(audit.businessDate, 1));
    }
    for (const archive of archiveData?.data ?? []) dates.add(archive.reportDate);
    return [...dates].sort((left, right) => right.localeCompare(left));
  }, [archiveData, auditHistory]);

  useEffect(() => {
    if (date !== null || isLoadingAuditHistory || isLoadingArchive) return;
    setDate(availableReportDates[0] ?? currentPKTDate());
  }, [availableReportDates, date, isLoadingArchive, isLoadingAuditHistory]);

  const { data, isLoading, error } = useQuery({
    queryKey: ["early-bird-report", date, forecastDays],
    queryFn: () => reportsService.getEarlyBirdReport(date!, forecastDays),
    enabled: date !== null,
  });

  useEffect(() => {
    document.body.classList.add("early-bird-mode");
    return () => document.body.classList.remove("early-bird-mode");
  }, []);

  const attention = useMemo(() => {
    if (!data) return [];
    const items: Array<{ label: string; detail: string; tone: "warning" | "danger" }> = [];
    const dirtyRooms = (data.today.roomStatus.VACANT_DIRTY ?? 0) + (data.today.roomStatus.INSPECTION ?? 0);
    const urgentMaintenance = data.today.maintenance.filter((ticket) => ticket.priority === "URGENT").length;
    const escalatedCleaning = data.today.housekeeping.filter((task) => task.isEscalated).length;
    const outstanding = data.today.outstandingSummary.total;
    if (dirtyRooms > 0) items.push({ label: `${dirtyRooms} rooms not ready`, detail: "Cleaning or inspection pending", tone: "warning" });
    if (urgentMaintenance > 0) items.push({ label: `${urgentMaintenance} urgent maintenance`, detail: "Needs management attention", tone: "danger" });
    if (escalatedCleaning > 0) items.push({ label: `${escalatedCleaning} escalated cleaning tasks`, detail: "Housekeeping follow-up required", tone: "danger" });
    if (data.today.lowStock.length > 0) items.push({ label: `${data.today.lowStock.length} low-stock items`, detail: "Reorder before service is affected", tone: "warning" });
    if (outstanding > 0) items.push({ label: `${formatPKR(outstanding)} outstanding`, detail: `${data.today.outstandingSummary.count} open folios`, tone: "warning" });
    for (const warning of data.closedDay.snapshot.controls?.warnings ?? []) {
      items.push({ label: warning.title, detail: warning.detail, tone: "warning" });
    }
    return items;
  }, [data]);

  if (isLoading || date === null) return <div className="grid min-h-[55vh] place-items-center"><Loader2 className="animate-spin text-coral" size={28} /></div>;
  if (error || !data) return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header>
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-coral">Manager morning report</p>
        <h1 className="mt-1 serif text-[36px] leading-none text-ink">Early Bird Report</h1>
        <p className="mt-2 text-[13px] text-ink-mute">Choose any morning whose previous business day has a completed Night Audit.</p>
      </header>
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-paper p-4">
        <DatePicker value={date} onChange={setDate} />
        {availableReportDates.length > 0 && <select value={date} onChange={(event) => setDate(event.target.value)} className="h-10 min-w-56 rounded-xl border border-line bg-paper px-3 text-[12px] font-semibold text-ink outline-none">
          {availableReportDates.map((reportDate) => <option key={reportDate} value={reportDate}>{formatDate(reportDate)}</option>)}
        </select>}
      </div>
      <div className="rounded-2xl border border-amber/30 bg-amber-soft/40 p-6 text-center">
        <AlertTriangle className="mx-auto text-amber" size={22} />
        <p className="mt-2 text-[13px] font-semibold text-ink">{getErrorMessage(error, "The morning report could not be loaded. Complete the previous business day’s Night Audit first.")}</p>
        <p className="mt-1 text-[11.5px] text-ink-mute">You do not need to wait for today’s audit to test EBR—select the morning after any already-closed business day.</p>
      </div>
    </div>
  );

  const snapshot = data.closedDay.snapshot;
  const topItemsByName = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const item of [...data.closedDay.topSellingItems.pos, ...data.closedDay.topSellingItems.qr]) {
    const key = item.name.trim().toLocaleLowerCase();
    const existing = topItemsByName.get(key);
    topItemsByName.set(key, {
      name: existing?.name ?? item.name,
      quantity: (existing?.quantity ?? 0) + item.quantity,
      revenue: (existing?.revenue ?? 0) + item.revenue,
    });
  }
  const topItems = [...topItemsByName.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  const nightBriefing = data.today.latestNightShift?.handoverBriefing;

  const printReport = async () => {
    if (!printAreaRef.current) return;
    const frame = document.createElement("iframe");
    frame.setAttribute("title", "Early Bird Report print document");
    Object.assign(frame.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0", visibility: "hidden" });
    document.body.appendChild(frame);
    const printDocument = frame.contentDocument;
    const printWindow = frame.contentWindow;
    if (!printDocument || !printWindow) { frame.remove(); return; }
    const styles = Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style')).map((element) => element.outerHTML).join("\n");
    printDocument.open();
    printDocument.write(`<!doctype html><html><head><meta charset="utf-8"><title>Early Bird Report</title>${styles}</head><body class="early-bird-mode"></body></html>`);
    printDocument.close();
    printDocument.body.appendChild(printAreaRef.current.cloneNode(true));
    await printDocument.fonts?.ready;
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    printWindow.onafterprint = () => setTimeout(() => frame.remove(), 250);
    printWindow.focus();
    printWindow.print();
    setTimeout(() => frame.isConnected && frame.remove(), 60_000);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-4 print:hidden">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-coral">Manager morning report</p>
          <h1 className="mt-1 serif text-[36px] leading-none text-ink">Early Bird Report</h1>
          <p className="mt-2 text-[13px] text-ink-mute">Previous business day closed. Today prepared. The archived outlook is in view.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DatePicker value={date} onChange={setDate} />
          {availableReportDates.length > 0 && <select value={date} onChange={(event) => setDate(event.target.value)} aria-label="Previous Early Bird Reports" className="h-10 max-w-56 rounded-xl border border-line bg-paper px-3 text-[12px] font-semibold text-ink outline-none">
            {availableReportDates.map((reportDate) => <option key={reportDate} value={reportDate}>{formatDate(reportDate)}</option>)}
          </select>}
          <span className="flex h-10 items-center rounded-xl border border-line bg-card px-3 text-[12px] font-semibold text-ink" title="The outlook is frozen with this archived morning report. Open Forecast for a live configurable range.">
            {data.outlook.days.length}-day archived outlook
          </span>
          <button type="button" onClick={() => exportEarlyBirdReportToExcel(data)} className="flex h-10 items-center gap-2 rounded-full border border-line bg-paper px-4 text-[12px] font-semibold text-ink"><FileSpreadsheet size={14} /> Excel</button>
          <button type="button" onClick={printReport} className="flex h-10 items-center gap-2 rounded-full bg-ink px-4 text-[12px] font-semibold text-white"><Printer size={14} /> Print report</button>
        </div>
      </header>

      {data.auditReversedAt && (
        <div className="rounded-2xl border border-clay/25 bg-clay-soft/55 px-4 py-3 text-[12px] text-ink-soft">
          <strong className="text-clay">Historical report from a reversed audit.</strong>{" "}
          This archived report is preserved for the audit trail and is no longer the active closed-day record.
        </div>
      )}

      <section className="overflow-hidden rounded-3xl bg-ink p-6 text-white">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-coral">Night Audit · closed business day {data.closedDay.businessDate}</p>
            <h2 className="mt-1 serif text-[27px]">How {formatDate(data.closedDay.businessDate)} finished</h2>
            <p className="mt-1 text-[11px] text-white/55">This is the previous closed business day. The operating outlook below begins {formatDate(data.reportDate)}.</p>
          </div>
          {data.closedDay.auditId && <Link to="/operations/night-audit#history" className="flex items-center gap-1 text-[11px] font-semibold text-white/65 hover:text-white">Open frozen audit <ArrowRight size={12} /></Link>}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <Stat label="Occupancy" value={`${snapshot.occupancy.occupancyRate.toFixed(1)}%`} detail={`${snapshot.occupancy.roomsSold}/${snapshot.occupancy.sellableRooms} sellable rooms`} />
          <Stat label="ADR" value={formatPKR(snapshot.occupancy.adr)} detail="Average occupied-room rate" />
          <Stat label="RevPAR" value={formatPKR(snapshot.occupancy.revpar)} detail="Revenue per sellable room" />
          <Stat label="Collected" value={formatPKR(snapshot.revenue.totalCollected)} detail={`${snapshot.payments.refunded > 0 ? `${formatPKR(snapshot.payments.refunded)} refunded` : "No refunds"}`} />
          <Stat label="Revenue" value={formatPKR(snapshot.revenue.totalFolioRevenue)} detail={`${formatPKR(snapshot.revenue.roomRevenue)} rooms`} />
          <Stat label="Outstanding" value={formatPKR(snapshot.revenue.outstanding)} detail={`${snapshot.reconciliation.openFolios} open folios`} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel title="Revenue by department" icon={TrendingUp}>
          <div className="divide-y divide-line-soft">
            {[
              ["Rooms", snapshot.revenue.roomRevenue],
              ["POS", snapshot.revenue.posRevenue],
              ["QR ordering", snapshot.revenue.qrRevenue],
              ["Tax collected", snapshot.revenue.taxes],
              ["Discounts & rebates", snapshot.revenue.discounts + snapshot.revenue.rebates],
              ["Expenses", snapshot.revenue.expenses],
            ].map(([label, value]) => (
              <div key={String(label)} className="flex items-center justify-between gap-3 py-2 text-[12px]">
                <span className="text-ink-mute">{label}</span>
                <strong className="text-ink">{formatPKR(Number(value))}</strong>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Payments & cash" icon={ClipboardCheck}>
          <div className="divide-y divide-line-soft">
            {Object.entries(snapshot.payments.byMethod).length === 0 ? <Empty>No payments recorded.</Empty> : Object.entries(snapshot.payments.byMethod).map(([method, totals]) => (
              <div key={method} className="flex items-center justify-between gap-3 py-2 text-[12px]">
                <span className="text-ink-mute">{humanize(method)}</span>
                <span className="text-right"><strong className="block text-ink">{formatPKR(totals.net)}</strong><small className="text-[9.5px] text-ink-faint">{totals.transactions} transaction{totals.transactions === 1 ? "" : "s"}</small></span>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-line-soft pt-3">
            <div className="rounded-xl bg-mist/55 px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-ink-faint">Balance Book net</p><strong className="mt-1 block text-[13px] text-ink">{formatPKR(snapshot.balanceBook.net)}</strong></div>
            <div className="rounded-xl bg-mist/55 px-3 py-2.5"><p className="text-[9px] font-bold uppercase tracking-wide text-ink-faint">Refunded</p><strong className="mt-1 block text-[13px] text-ink">{formatPKR(snapshot.payments.refunded)}</strong></div>
          </div>
        </Panel>

        <Panel title="Closed-day movements" icon={CalendarDays}>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["Arrivals", snapshot.reservations.arrivals],
              ["Departures", snapshot.reservations.departures],
              ["Stayovers", snapshot.reservations.stayovers],
              ["Check-ins", snapshot.reservations.actualCheckIns],
              ["Cancellations", snapshot.reservations.cancellations],
              ["No-shows", snapshot.reservations.noShows],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-xl bg-mist/55 px-3 py-3">
                <p className="text-[9px] font-bold uppercase tracking-wide text-ink-faint">{label}</p>
                <strong className="mt-1 block text-[17px] text-ink">{value}</strong>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <section className="rounded-2xl border border-line bg-card p-4 shadow-card">
        <div className="mb-3 flex items-center gap-2"><FileWarning size={15} className="text-coral" /><h2 className="text-[13px] font-bold text-ink">Manager attention</h2><span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-bold text-ink-mute">{attention.length}</span></div>
        {attention.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-pine-soft/55 px-3 py-3 text-[12px] font-semibold text-pine-deep"><CheckCircle2 size={15} /> No immediate operational exceptions detected.</div>
        ) : (
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {attention.map((item) => <div key={item.label} className={cn("rounded-xl border px-3 py-3", item.tone === "danger" ? "border-clay/20 bg-clay-soft/45" : "border-amber/20 bg-amber-soft/35")}><p className="text-[12px] font-bold text-ink">{item.label}</p><p className="mt-0.5 text-[11px] text-ink-mute">{item.detail}</p></div>)}
          </div>
        )}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <div className="space-y-5">
          <Panel title={`Today's movement · ${formatDate(date)}`} icon={CalendarDays}>
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Arrivals</p><strong className="text-[12px] text-ink">{data.today.arrivals.length}</strong></div>
                {data.today.arrivals.length === 0 ? <Empty>No arrivals scheduled.</Empty> : <div className="divide-y divide-line-soft rounded-xl border border-line-soft">{data.today.arrivals.map((arrival) => <div key={arrival.id} className="flex items-center gap-3 px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-semibold text-ink">{arrival.guestName}{arrival.isVip ? " · VIP" : ""}</p><p className="truncate text-[10.5px] text-ink-mute">Room {arrival.roomNumbers.join(", ") || "TBA"}{arrival.companyName ? ` · ${arrival.companyName}` : arrival.groupName ? ` · ${arrival.groupName}` : ""}</p></div><ReservationIdLink id={arrival.id} confirmationNumber={arrival.confirmationNumber} /></div>)}</div>}
              </div>
              <div>
                <div className="mb-2 flex items-center justify-between"><p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Departures</p><strong className="text-[12px] text-ink">{data.today.departures.length}</strong></div>
                {data.today.departures.length === 0 ? <Empty>No departures scheduled.</Empty> : <div className="divide-y divide-line-soft rounded-xl border border-line-soft">{data.today.departures.map((departure) => <div key={departure.id} className="flex items-center gap-3 px-3 py-2.5"><div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-semibold text-ink">{departure.guestName}</p><p className={cn("text-[10.5px]", departure.totalBalance > 0 ? "font-semibold text-clay" : "text-ink-mute")}>Room {departure.roomNumbers.join(", ")} · {departure.totalBalance > 0 ? `${formatPKR(departure.totalBalance)} due` : "settled"}</p></div><ReservationIdLink id={departure.id} confirmationNumber={departure.confirmationNumber} /></div>)}</div>}
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-ink-mute"><span className="rounded-full bg-mist px-3 py-1.5">{data.today.stayovers} stayovers</span><span className="rounded-full bg-mist px-3 py-1.5">{data.today.metrics.availableRooms} rooms available</span><span className="rounded-full bg-mist px-3 py-1.5">{data.today.metrics.outOfServiceRooms} out of service</span></div>
          </Panel>

          <Panel title={`${data.outlook.days.length}-day forward outlook`} icon={TrendingUp} action={<Link to={`/reports/forecast?startDate=${date}&days=${data.outlook.days.length}`} className="text-[11px] font-semibold text-coral">Live forecast →</Link>}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left">
                <thead><tr className="border-b border-line-soft text-[10px] font-bold uppercase tracking-wider text-ink-faint"><th className="pb-2">Date</th><th className="pb-2 text-right">Arrivals</th><th className="pb-2 text-right">Departures</th><th className="pb-2 text-right">Sold</th><th className="pb-2 text-right">Available</th><th className="pb-2 text-right">Occ.</th><th className="pb-2 text-right">Expected revenue</th></tr></thead>
                <tbody className="divide-y divide-line-soft">{data.outlook.days.map((day) => <tr key={day.date} className="text-[12px] text-ink"><td className="py-2.5 font-semibold">{new Date(`${day.date}T00:00:00`).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}</td><td className="py-2.5 text-right">{day.arrivals}</td><td className="py-2.5 text-right">{day.departures}</td><td className="py-2.5 text-right">{day.roomsSold}</td><td className="py-2.5 text-right">{day.availableRooms}</td><td className="py-2.5 text-right font-semibold">{day.occupancyRate.toFixed(1)}%</td><td className="py-2.5 text-right font-semibold">{formatPKR(day.expectedRoomRevenue)}</td></tr>)}</tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="space-y-5">
          <Panel title="Room readiness" icon={BedDouble}>
            <div className="grid grid-cols-2 gap-2">{Object.entries(data.today.roomStatus).sort((a, b) => b[1] - a[1]).map(([status, count]) => <div key={status} className="rounded-xl bg-mist/55 px-3 py-3"><p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">{humanize(status)}</p><p className="mt-1 text-[19px] font-bold text-ink">{count}</p></div>)}</div>
          </Panel>

          <Panel title="Outstanding follow-up" icon={FileWarning} action={<Link to="/reports/outstanding-balances" className="text-[11px] font-semibold text-coral">All balances →</Link>}>
            {data.today.outstandingSummary.count === 0 ? <Empty>No open balance requires follow-up.</Empty> : <div className="space-y-3"><div className="grid grid-cols-3 gap-2"><div className="rounded-xl bg-mist/55 px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-wide text-ink-faint">Total</p><strong className="mt-1 block text-[14px] text-ink">{formatPKR(data.today.outstandingSummary.total)}</strong></div><div className="rounded-xl bg-mist/55 px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-wide text-ink-faint">Guest</p><strong className="mt-1 block text-[14px] text-ink">{formatPKR(data.today.outstandingSummary.guest)}</strong></div><div className="rounded-xl bg-mist/55 px-3 py-3"><p className="text-[9px] font-bold uppercase tracking-wide text-ink-faint">BTC</p><strong className="mt-1 block text-[14px] text-ink">{formatPKR(data.today.outstandingSummary.company)}</strong></div></div><div className="divide-y divide-line-soft">{data.today.outstandingFolios.slice(0, 5).map((folio) => <div key={folio.id} className="flex items-center gap-3 py-2"><div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-semibold text-ink">{folio.guestName}</p><p className="text-[10px] text-ink-mute">{folio.folioNumber}</p></div><strong className="text-[11.5px] text-clay">{formatPKR(folio.balanceDue)}</strong>{folio.reservationId && folio.reservationNumber && <ReservationIdLink id={folio.reservationId} confirmationNumber={folio.reservationNumber} className="text-[10.5px]" />}</div>)}</div></div>}
          </Panel>

          <Panel title="Housekeeping & maintenance" icon={Wrench}>
            <div className="space-y-3">
              <div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">Housekeeping · {data.today.housekeeping.length} open</p>{data.today.housekeeping.length === 0 ? <Empty>No pending tasks.</Empty> : <div className="space-y-1.5">{data.today.housekeeping.slice(0, 5).map((task) => <div key={task.id} className="flex items-center gap-2 rounded-lg bg-mist/50 px-3 py-2 text-[11.5px]"><Sparkles size={13} className={task.isEscalated ? "text-clay" : "text-pine-deep"} /><span className="flex-1 font-semibold text-ink">Room {task.room.number} · {humanize(task.taskType)}</span><span className="text-ink-mute">{humanize(task.status)}</span></div>)}</div>}</div>
              <div><p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">Maintenance · {data.today.maintenance.length} open</p>{data.today.maintenance.length === 0 ? <Empty>No open tickets.</Empty> : <div className="space-y-1.5">{data.today.maintenance.slice(0, 5).map((ticket) => <div key={ticket.id} className="flex items-center gap-2 rounded-lg bg-mist/50 px-3 py-2 text-[11.5px]"><Wrench size={13} className={ticket.priority === "URGENT" ? "text-clay" : "text-amber"} /><span className="min-w-0 flex-1 truncate font-semibold text-ink">{ticket.room ? `Room ${ticket.room.number} · ` : ""}{ticket.title}</span><span className="text-ink-mute">{humanize(ticket.priority)}</span></div>)}</div>}</div>
            </div>
          </Panel>

          <Panel title="Stock watch" icon={Package} action={<Link to="/reports/low-stock-reorder" className="text-[11px] font-semibold text-coral">Open report →</Link>}>
            {data.today.lowStock.length === 0 ? <Empty>Stock is above reorder levels.</Empty> : <div className="divide-y divide-line-soft">{data.today.lowStock.slice(0, 8).map((item) => <div key={item.id} className="flex items-center gap-3 py-2"><span className={cn("h-2 w-2 rounded-full", item.urgency === "CRITICAL" ? "bg-clay" : "bg-amber")} /><span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{item.name}</span><span className="text-[11px] text-ink-mute">{item.currentStock} {item.unit} · reorder at {item.reorderLevel}</span></div>)}</div>}
          </Panel>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Top-selling items from the closed day" icon={ShoppingBag}>
          {topItems.length === 0 ? <Empty>No POS or QR item sales recorded.</Empty> : <div className="divide-y divide-line-soft">{topItems.map((item, index) => <div key={`${item.name}:${index}`} className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-3 py-2.5 text-[12px]"><span className="text-ink-faint">{index + 1}</span><span className="font-semibold text-ink">{item.name}</span><span className="text-ink-mute">{item.quantity} sold</span><strong className="text-ink">{formatPKR(item.revenue)}</strong></div>)}</div>}
        </Panel>

        <Panel title="Night shift handover" icon={ClipboardCheck} action={<Link to="/operations/shift-handover?tab=reports" className="text-[11px] font-semibold text-coral">Shift reports →</Link>}>
          {!data.today.latestNightShift ? <Empty>No signed night-shift report is available.</Empty> : <div className="space-y-3"><div className="flex items-center justify-between rounded-xl bg-mist/50 px-3 py-3 text-[12px]"><span className="text-ink-mute">Cash variance</span><strong className={data.today.latestNightShift.variance === 0 ? "text-pine-deep" : "text-clay"}>{formatPKR(data.today.latestNightShift.variance)}</strong></div>{data.today.latestNightShift.notes && <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Notes</p><p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink-soft">{data.today.latestNightShift.notes}</p></div>}{data.today.latestNightShift.varianceReason && <div><p className="text-[10px] font-bold uppercase tracking-wide text-ink-faint">Variance reason</p><p className="mt-1 text-[12px] text-ink-soft">{data.today.latestNightShift.varianceReason}</p></div>}{nightBriefing !== null && nightBriefing !== undefined && <details className="rounded-xl border border-line-soft px-3 py-2"><summary className="cursor-pointer text-[11px] font-semibold text-ink">Structured handover briefing</summary><pre className="mt-2 overflow-auto whitespace-pre-wrap text-[10px] text-ink-mute">{JSON.stringify(nightBriefing, null, 2)}</pre></details>}</div>}
        </Panel>
      </div>

      <Panel title="Business contribution in the forward book" icon={Building2}>
        <div className="grid gap-5 lg:grid-cols-3">
          <div><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">Booking mix</p><div className="space-y-2">{data.outlook.contribution.categories.map((row) => <div key={row.category} className="grid grid-cols-[100px_1fr_auto] items-center gap-3 text-[11.5px]"><span className="font-semibold text-ink">{humanize(row.category)}</span><div className="h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-coral" style={{ width: `${Math.min(100, row.percentage)}%` }} /></div><span className="text-ink-mute">{row.roomNights} nights · {formatPKR(row.expectedRoomRevenue)}</span></div>)}</div></div>
          <div><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">Top companies</p>{data.outlook.contribution.companies.length === 0 ? <Empty>No company business in this outlook.</Empty> : <div className="divide-y divide-line-soft">{data.outlook.contribution.companies.slice(0, 6).map((company) => <div key={company.companyId} className="flex items-center gap-3 py-2"><Users size={13} className="text-coral" /><span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-ink">{company.companyName}</span><span className="text-[11px] text-ink-mute">{company.roomNights} nights · {formatPKR(company.expectedRoomRevenue)}</span></div>)}</div>}</div>
          <div><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">Upcoming groups</p>{data.outlook.operational.groups.length === 0 ? <Empty>No group movements in this outlook.</Empty> : <div className="divide-y divide-line-soft">{data.outlook.operational.groups.slice(0, 6).map((group) => <div key={group.groupId} className="py-2"><div className="flex items-center justify-between gap-3"><span className="truncate text-[12px] font-semibold text-ink">{group.groupName}</span><strong className="shrink-0 text-[11px] text-coral">{group.rooms} rooms</strong></div><p className="mt-0.5 text-[10.5px] text-ink-mute">{group.arrivalDate} → {group.departureDate}{group.groupRef ? ` · ${group.groupRef}` : ""}</p></div>)}</div>}</div>
        </div>
        <div className="mt-5 border-t border-line-soft pt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-ink-faint">Room-type pressure</p><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">{data.outlook.roomTypes.map((roomType) => { const tightest = [...roomType.days].sort((a, b) => a.availableRooms - b.availableRooms)[0]; return <div key={roomType.id} className="rounded-xl bg-mist/50 px-3 py-3"><p className="truncate text-[11.5px] font-semibold text-ink">{roomType.name}</p><p className={cn("mt-1 text-[11px]", tightest && tightest.availableRooms <= 1 ? "font-semibold text-clay" : "text-ink-mute")}>{tightest ? `${tightest.availableRooms} minimum available · ${tightest.date}` : "No forecast data"}</p></div>; })}</div></div>
      </Panel>

      <details className="rounded-2xl border border-line-soft bg-paper p-5 print:hidden">
        <summary className="cursor-pointer text-[13px] font-bold text-ink">Detailed closed-day operating snapshot</summary>
        <div className="mt-4"><BusinessDaySnapshotView snapshot={snapshot} /></div>
      </details>

      <details className="rounded-2xl border border-line-soft bg-paper p-5 print:hidden">
        <summary className="cursor-pointer text-[13px] font-bold text-ink">Early Bird Report archive</summary>
        <div className="mt-4 divide-y divide-line-soft">
          {(archiveData?.data ?? []).length === 0 ? <Empty>No archived morning reports yet.</Empty> : archiveData?.data.map((archive) => (
            <button type="button" key={archive.id} onClick={() => setDate(archive.reportDate)} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:text-coral">
              <span><strong className="block text-[12.5px]">{formatDate(archive.reportDate)}</strong><span className="text-[10.5px] text-ink-mute">Audit revision {archive.auditRevision} · generated {new Date(archive.generatedAt).toLocaleString("en-PK")}</span></span>
              <span className={cn("rounded-full px-2 py-1 text-[10px] font-bold", archive.auditReversedAt ? "bg-clay-soft text-clay" : "bg-pine-soft text-pine-deep")}>{archive.auditReversedAt ? "Audit reversed" : "Final"}</span>
            </button>
          ))}
        </div>
      </details>

      <footer className="hidden border-t border-line pt-3 text-[10px] text-ink-mute print:flex print:justify-between"><span>{data.hotelName} · Early Bird Report</span><span>Generated {new Date(data.generatedAt).toLocaleString("en-PK")}</span></footer>
      <div className="pointer-events-none fixed left-[-10000px] top-0 w-[190mm]" aria-hidden="true"><div ref={printAreaRef} className="early-bird-print-area"><EarlyBirdPrintReport report={data} /></div></div>
    </div>
  );
}
