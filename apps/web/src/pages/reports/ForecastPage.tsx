import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, BedDouble, CalendarRange, CircleDollarSign, FileSpreadsheet, PlaneLanding, PlaneTakeoff, TrendingUp, Users, Wrench } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { cn } from "@/lib/cn";
import { reportsService } from "@/services/reports";
import { exportForecastToExcel } from "@/lib/exportExcel";

function localIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function formatPKR(paisas: number): string {
  const rupees = Math.round(paisas / 100);
  if (rupees >= 1_000_000) return `PKR ${(rupees / 1_000_000).toFixed(1)}m`;
  if (rupees >= 100_000) return `PKR ${(rupees / 1_000).toFixed(0)}k`;
  return `PKR ${rupees.toLocaleString("en-PK")}`;
}

function shortDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

const RANGE_OPTIONS = [7, 10, 14, 30];
const categoryNames: Record<string, string> = { DIRECT: "Direct", OTA: "OTAs", COMPANY: "Companies", GROUP: "Groups", OTHER: "Walk-in & other" };
const th = "px-3 py-3 text-right text-[10.5px] font-bold uppercase tracking-[0.1em] text-ink-faint border-b border-line whitespace-nowrap";
const td = "px-3 py-3 text-right text-[13px] text-ink border-b border-line-soft tnum whitespace-nowrap";

export default function ForecastPage() {
  const [params, setParams] = useSearchParams();
  const startDate = params.get("startDate") ?? localIso();
  const parsedDays = Number(params.get("days") ?? "10");
  const days = Number.isInteger(parsedDays) && parsedDays >= 1 && parsedDays <= 90 ? parsedDays : 10;

  const { data: report, isLoading, isError } = useQuery({
    queryKey: ["report-forecast", startDate, days],
    queryFn: () => reportsService.getForecast(startDate, days),
  });

  const update = (next: { startDate?: string; days?: number }) => setParams({ startDate: next.startDate ?? startDate, days: String(next.days ?? days) });
  const attentionDays = report?.days.filter((day) => {
    const lowAvailabilityThreshold = Math.max(2, Math.ceil(day.sellableRooms * 0.2));
    const heavyMovementThreshold = Math.max(3, Math.ceil(day.physicalRooms * 0.25));
    const enquiryRooms = report.operational.enquiryDemand.find((entry) => entry.date === day.date)?.rooms ?? 0;
    return day.availableRooms <= lowAvailabilityThreshold
      || day.arrivals >= heavyMovementThreshold
      || day.departures >= heavyMovementThreshold
      || enquiryRooms > 0;
  }) ?? [];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end gap-4">
        <div>
          <Link to="/operations" className="mb-2 inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Back to Operations</Link>
          <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-coral">Forward view</div>
          <h1 className="serif text-[32px] leading-tight text-ink">Hotel forecast</h1>
          <p className="mt-1 text-[13px] text-ink-mute">Confirmed business, sellable inventory, and expected room revenue.</p>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <DatePicker value={startDate} onChange={(value) => update({ startDate: value })} min={localIso()} className="h-10" />
          <div className="flex rounded-full border border-line bg-card p-1">
            {RANGE_OPTIONS.map((option) => <button key={option} onClick={() => update({ days: option })} className={cn("h-8 rounded-full px-3 text-[12px] font-semibold transition-colors", days === option ? "bg-ink text-white" : "text-ink-mute hover:text-ink")}>{option} days</button>)}
          </div>
          <label className="flex h-10 items-center gap-2 rounded-full border border-line bg-card px-3 text-[11px] font-semibold text-ink-mute">
            Custom
            <input
              type="number"
              min={1}
              max={90}
              value={days}
              onChange={(event) => {
                const value = Number(event.target.value);
                if (Number.isInteger(value) && value >= 1 && value <= 90) update({ days: value });
              }}
              className="w-11 bg-transparent text-center text-[12px] font-bold text-ink outline-none"
              aria-label="Custom forecast days"
            />
          </label>
          {report && <button onClick={() => exportForecastToExcel(report)} className="flex h-10 items-center gap-2 rounded-full border border-line bg-card px-4 text-[12px] font-semibold text-ink-soft hover:bg-line-soft hover:text-ink"><FileSpreadsheet size={14} /> Export</button>}
        </div>
      </header>

      {isLoading ? <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-line-soft" />)}</div> : isError || !report ? <Card><p className="text-sm text-clay">Forecast could not be loaded.</p></Card> : <>
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { icon: BedDouble, label: "Forecast occupancy", value: `${report.summary.occupancyRate}%`, sub: `${report.summary.roomsSold} of ${report.summary.sellableRoomNights} sellable room-nights`, tone: TONE.pine },
            { icon: CircleDollarSign, label: "Expected room revenue", value: formatPKR(report.summary.expectedRoomRevenue), sub: "Room rates only · before taxes and extras", tone: TONE.coral },
            { icon: TrendingUp, label: "ADR / RevPAR", value: `${formatPKR(report.summary.adr)} / ${formatPKR(report.summary.revpar)}`, sub: "Per sold room / per sellable room", tone: TONE.slate },
            { icon: Wrench, label: "Out of service", value: String(report.summary.outOfServiceRoomNights), sub: `${report.summary.availableRoomNights} room-nights still available`, tone: TONE.amber },
          ].map(({ icon: Icon, label, value, sub, tone }) => <Card key={label}><span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: tone.bg, color: tone.fg }}><Icon size={19} /></span><div className="mt-4 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</div><div className="mt-1 serif text-[25px] leading-tight text-ink tnum">{value}</div><div className="mt-1.5 text-[11.5px] leading-relaxed text-ink-mute">{sub}</div></Card>)}
        </section>

        <Card pad={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
            <div>
              <h2 className="serif text-[20px] text-ink">Needs attention</h2>
              <p className="text-[12px] text-ink-mute">Dates where availability, guest movement, or pending demand needs a closer look.</p>
            </div>
            <span className={cn("rounded-full px-3 py-1.5 text-[11px] font-bold", attentionDays.length > 0 ? "bg-amber-soft text-amber" : "bg-pine/10 text-pine")}>{attentionDays.length > 0 ? `${attentionDays.length} date${attentionDays.length === 1 ? "" : "s"} flagged` : "No pressure dates"}</span>
          </div>
          {attentionDays.length > 0 ? <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">{attentionDays.map((day) => {
            const enquiryRooms = report.operational.enquiryDemand.find((entry) => entry.date === day.date)?.rooms ?? 0;
            const heavyMovementThreshold = Math.max(3, Math.ceil(day.physicalRooms * 0.25));
            const soldOut = day.sellableRooms > 0 && day.availableRooms === 0;
            return <div key={day.date} className={cn("rounded-2xl border p-4", soldOut ? "border-red-200 bg-red-50" : "border-amber/25 bg-amber/5")}>
              <div className="flex items-start justify-between gap-3"><div><div className="text-[13.5px] font-bold text-ink">{shortDate(day.date)}</div><div className="mt-0.5 text-[11px] text-ink-mute">{day.occupancyRate}% occupied · {day.availableRooms} available</div></div>{soldOut ? <span className="rounded-full bg-red-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-red-700">Sold out</span> : day.availableRooms <= Math.max(2, Math.ceil(day.sellableRooms * 0.2)) ? <span className="rounded-full bg-amber-soft px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-amber">Low availability</span> : null}</div>
              <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-ink-soft">
                {day.arrivals >= heavyMovementThreshold && <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1"><PlaneLanding size={12} />{day.arrivals} arrivals</span>}
                {day.departures >= heavyMovementThreshold && <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1"><PlaneTakeoff size={12} />{day.departures} departures</span>}
                {enquiryRooms > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-card px-2.5 py-1"><AlertTriangle size={12} />{enquiryRooms} enquiry room{enquiryRooms === 1 ? "" : "s"}</span>}
              </div>
            </div>;
          })}</div> : <div className="px-5 py-6 text-[13px] text-ink-mute">No low-availability, sold-out, heavy-movement, or enquiry-pressure dates in this window.</div>}
        </Card>

        <Card pad={false}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5"><div><h2 className="serif text-[20px] text-ink">Occupancy outlook</h2><p className="text-[12px] text-ink-mute">Sellable occupancy after dated maintenance and inventory exclusions.</p></div><span className="rounded-full bg-mist px-3 py-1.5 text-[11px] font-semibold text-ink-mute"><CalendarRange size={13} className="mr-1.5 inline" />{shortDate(report.startDate)} – {shortDate(report.endDate)}</span></div>
          <div className="h-[270px] px-3 pb-4 pt-5"><ResponsiveContainer width="100%" height="100%"><AreaChart data={report.days}><defs><linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TONE.pine.fg} stopOpacity={0.28} /><stop offset="100%" stopColor={TONE.pine.fg} stopOpacity={0.02} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#ebe6df" /><XAxis dataKey="date" tick={{ fontSize: 11, fill: "#938981" }} tickFormatter={(value: string) => shortDate(value).replace(/,.*/, "")} /><YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: "#938981" }} tickFormatter={(value) => `${value}%`} width={42} /><Tooltip labelFormatter={(value) => shortDate(String(value))} formatter={(value) => [`${value}%`, "Occupancy"]} /><Area type="monotone" dataKey="occupancyRate" stroke={TONE.pine.fg} strokeWidth={2.5} fill="url(#forecastFill)" /></AreaChart></ResponsiveContainer></div>
        </Card>

        <Card pad={false}>
          <div className="px-5 pt-5"><h2 className="serif text-[20px] text-ink">Daily operating forecast</h2><p className="text-[12px] text-ink-mute">Arrivals, departures, available rooms, and expected room revenue by stay date.</p></div>
          <div className="overflow-x-auto px-2 pb-3 pt-3"><table className="w-full border-collapse"><thead><tr><th className={cn(th, "text-left")}>Date</th><th className={th}>Arrivals</th><th className={th}>Departures</th><th className={th}>Stayovers</th><th className={th}>Enquiries</th><th className={th}>Sold</th><th className={th}>Out of service</th><th className={th}>Available</th><th className={th}>Occupancy</th><th className={th}>ADR</th><th className={th}>RevPAR</th><th className={th}>Revenue</th></tr></thead><tbody>{report.days.map((day) => { const enquiryRooms = report.operational.enquiryDemand.find((entry) => entry.date === day.date)?.rooms ?? 0; return <tr key={day.date} className="hover:bg-mist/50"><td className={cn(td, "text-left font-semibold")}>{shortDate(day.date)}</td><td className={td}>{day.arrivals}</td><td className={td}>{day.departures}</td><td className={td}>{day.stayovers}</td><td className={cn(td, enquiryRooms > 0 && "font-semibold text-amber")}>{enquiryRooms}</td><td className={td}>{day.roomsSold}</td><td className={cn(td, day.outOfServiceRooms > 0 && "text-coral font-semibold")}>{day.outOfServiceRooms}</td><td className={td}>{day.availableRooms}</td><td className={cn(td, "font-semibold text-pine")}>{day.occupancyRate}%</td><td className={td}>{formatPKR(day.adr)}</td><td className={td}>{formatPKR(day.revpar)}</td><td className={cn(td, "font-semibold")}>{formatPKR(day.expectedRoomRevenue)}</td></tr>; })}</tbody></table></div>
        </Card>

        <section className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
          <Card pad={false}><div className="px-5 pt-5"><h2 className="serif text-[20px] text-ink">Room-type availability</h2><p className="text-[12px] text-ink-mute">Room-night totals across the selected forecast window.</p></div><div className="overflow-x-auto px-2 pb-3 pt-3"><table className="w-full"><thead><tr><th className={cn(th, "text-left")}>Room type</th><th className={th}>Physical nights</th><th className={th}>Out of service</th><th className={th}>Sellable nights</th><th className={th}>Sold</th><th className={th}>Available</th><th className={th}>Occupancy</th><th className={th}>Revenue</th></tr></thead><tbody>{report.roomTypes.map((roomType) => { const physical = roomType.days.reduce((sum, day) => sum + day.physicalRooms, 0); const blocked = roomType.days.reduce((sum, day) => sum + day.outOfServiceRooms, 0); const sellable = roomType.days.reduce((sum, day) => sum + day.sellableRooms, 0); const sold = roomType.days.reduce((sum, day) => sum + day.roomsSold, 0); const revenue = roomType.days.reduce((sum, day) => sum + day.expectedRoomRevenue, 0); const occupancy = sellable > 0 ? Math.round((sold / sellable) * 1000) / 10 : 0; return <tr key={roomType.id}><td className={cn(td, "text-left font-semibold")}>{roomType.name}</td><td className={td}>{physical}</td><td className={td}>{blocked}</td><td className={td}>{sellable}</td><td className={td}>{sold}</td><td className={td}>{Math.max(0, sellable - sold)}</td><td className={td}>{occupancy}%</td><td className={td}>{formatPKR(revenue)}</td></tr>; })}</tbody></table></div></Card>

          <Card><h2 className="serif text-[20px] text-ink">Business contribution</h2><p className="mb-5 text-[12px] text-ink-mute">Expected room revenue by booking relationship.</p><div className="space-y-4">{report.contribution.categories.map((item) => <div key={item.category}><div className="flex items-baseline justify-between gap-3"><span className="text-[13px] font-semibold text-ink">{categoryNames[item.category] ?? item.category}</span><span className="text-[12px] font-semibold text-ink">{formatPKR(item.expectedRoomRevenue)}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-line-soft"><div className="h-full rounded-full bg-coral" style={{ width: `${item.percentage}%` }} /></div><div className="mt-1 flex justify-between text-[10.5px] text-ink-faint"><span>{item.reservations} reservations · {item.roomNights} room-nights</span><span>{item.percentage}%</span></div></div>)}{report.contribution.categories.length === 0 && <p className="text-[12.5px] text-ink-mute">No confirmed business in this window.</p>}</div>{report.contribution.companies.length > 0 && <div className="mt-6 border-t border-line pt-5"><div className="mb-3 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">Top companies</div><div className="space-y-2.5">{report.contribution.companies.slice(0, 5).map((company) => <div key={company.companyId} className="flex items-center justify-between gap-3 text-[12.5px]"><span className="truncate font-medium text-ink">{company.companyName}</span><span className="shrink-0 text-ink-mute">{company.roomNights} nights · {formatPKR(company.expectedRoomRevenue)}</span></div>)}</div></div>}</Card>
        </section>

        {(report.operational.groups.length > 0 || report.operational.maintenanceReturns.length > 0) && <section className="grid gap-6 xl:grid-cols-2">
          <Card><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-mist text-ink-soft"><Users size={17} /></span><div><h2 className="serif text-[20px] text-ink">Upcoming groups</h2><p className="text-[12px] text-ink-mute">Confirmed group movement in this window.</p></div></div><div className="mt-5 space-y-3">{report.operational.groups.slice(0, 8).map((group) => <Link key={group.groupId} to={`/groups/${group.groupId}`} className="flex items-center justify-between gap-4 rounded-xl border border-line-soft px-4 py-3 hover:border-line hover:bg-mist"><div className="min-w-0"><div className="truncate text-[13px] font-bold text-ink">{group.groupName}</div><div className="text-[11px] text-ink-mute">{shortDate(group.arrivalDate)} – {shortDate(group.departureDate)}{group.groupRef ? ` · ${group.groupRef}` : ""}</div></div><span className="shrink-0 rounded-full bg-pine/10 px-2.5 py-1 text-[11px] font-bold text-pine">{group.rooms} room{group.rooms === 1 ? "" : "s"}</span></Link>)}{report.operational.groups.length === 0 && <p className="text-[12.5px] text-ink-mute">No confirmed groups in this window.</p>}</div></Card>
          <Card><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber/10 text-amber"><Wrench size={17} /></span><div><h2 className="serif text-[20px] text-ink">Rooms returning to inventory</h2><p className="text-[12px] text-ink-mute">Scheduled end dates for active room blocks.</p></div></div><div className="mt-5 space-y-3">{report.operational.maintenanceReturns.slice(0, 8).map((item) => <Link key={item.blockId} to="/maintenance" className="flex items-center justify-between gap-4 rounded-xl border border-line-soft px-4 py-3 hover:border-line hover:bg-mist"><div className="min-w-0"><div className="truncate text-[13px] font-bold text-ink">Room {item.roomNumber} · {item.roomTypeName}</div><div className="truncate text-[11px] text-ink-mute">{item.reason}</div></div><span className="shrink-0 text-[11px] font-semibold text-ink-soft">{shortDate(item.date)}</span></Link>)}{report.operational.maintenanceReturns.length === 0 && <p className="text-[12.5px] text-ink-mute">No rooms are scheduled to return in this window.</p>}</div></Card>
        </section>}
      </>}
    </div>
  );
}
