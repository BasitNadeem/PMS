import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, BedDouble, CalendarRange, CircleDollarSign, Info, TrendingUp } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { cn } from "@/lib/cn";
import { reportsService } from "@/services/reports";

function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function money(paisas: number): string {
  return `PKR ${Math.round(paisas / 100).toLocaleString("en-PK")}`;
}

function shortDate(value: string): string {
  return new Date(`${value}T00:00:00Z`).toLocaleDateString("en-PK", { day: "numeric", month: "short", timeZone: "UTC" });
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

const LOOKBACKS = [1, 7, 14, 30];
const WINDOWS = [7, 14, 30, 60];

export default function PickupPacePage() {
  const [params, setParams] = useSearchParams();
  const startDate = params.get("startDate") ?? today();
  const days = WINDOWS.includes(Number(params.get("days"))) ? Number(params.get("days")) : 30;
  const lookbackDays = LOOKBACKS.includes(Number(params.get("lookbackDays"))) ? Number(params.get("lookbackDays")) : 7;
  const query = useQuery({
    queryKey: ["pickup-pace", startDate, days, lookbackDays],
    queryFn: () => reportsService.getPickupPace(startDate, days, lookbackDays),
  });
  const report = query.data;
  const update = (next: { startDate?: string; days?: number; lookbackDays?: number }) => setParams({
    startDate: next.startDate ?? startDate,
    days: String(next.days ?? days),
    lookbackDays: String(next.lookbackDays ?? lookbackDays),
  });
  const chart = report?.days.map((day) => ({ ...day, label: shortDate(day.date), revenuePickup: day.pickupRevenue === null ? null : Math.round(day.pickupRevenue / 100) })) ?? [];

  return <div className="space-y-6">
    <header className="flex flex-wrap items-end gap-4">
      <div>
        <Link to="/reports" className="mb-2 inline-flex items-center gap-1.5 text-[12px] font-semibold text-ink-mute hover:text-ink"><ArrowLeft size={14} /> Back to Reports</Link>
        <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-coral">Demand intelligence</div>
        <h1 className="serif text-[32px] leading-tight text-ink">Pickup & pace</h1>
        <p className="mt-1 text-[13px] text-ink-mute">How confirmed rooms and expected revenue changed between real on-the-books snapshots.</p>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <DatePicker value={startDate} min={today()} max={addDays(today(), 90)} onChange={(value) => update({ startDate: value })} className="h-10" />
        <div className="inline-flex rounded-full border border-line bg-card p-1">{WINDOWS.map((value) => <button key={value} onClick={() => update({ days: value })} className={cn("h-8 rounded-full px-3 text-[11.5px] font-semibold", days === value ? "bg-coral-soft font-bold text-coral-deep" : "text-ink hover:text-coral-deep")}>{value} days</button>)}</div>
      </div>
    </header>

    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-card px-4 py-3 shadow-card">
      <div><div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Pickup window</div><div className="text-[12px] text-ink-mute">Compare today’s bookings with the closest collected snapshot.</div></div>
      <div className="inline-flex rounded-full border border-line bg-mist p-1">{LOOKBACKS.map((value) => <button key={value} onClick={() => update({ lookbackDays: value })} className={cn("h-8 rounded-full px-4 text-[11.5px] font-semibold", lookbackDays === value ? "bg-card font-bold text-coral-deep shadow-soft" : "text-ink hover:text-coral-deep")}>{value}d</button>)}</div>
    </div>

    {query.isLoading ? <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-32 animate-pulse rounded-2xl bg-line-soft" />)}</div> : query.isError || !report ? <Card><p className="text-[13px] text-clay">Pickup and pace could not be loaded.</p></Card> : <>
      {!report.collection.pickupAvailable && <div className="flex gap-3 rounded-2xl border border-amber/30 bg-amber/10 px-4 py-3 text-[12px] text-ink-soft"><Info size={17} className="mt-0.5 shrink-0 text-amber" /><div><strong className="text-ink">Snapshot collection has started.</strong> A genuine {lookbackDays}-day pickup comparison becomes available after enough history is collected. Innflo will not reconstruct or guess old pickup.</div></div>}
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{[
        { icon: BedDouble, label: "On the books", value: `${report.current.summary.roomsSold} room-nights`, sub: `${report.current.summary.occupancyRate}% occupancy` },
        { icon: TrendingUp, label: `${lookbackDays}-day pickup`, value: report.pickup ? `${report.pickup.roomNights >= 0 ? "+" : ""}${report.pickup.roomNights} room-nights` : "Collecting", sub: report.pickup ? `${report.pickup.roomNightsPerDay} per day` : "No eligible baseline yet" },
        { icon: CircleDollarSign, label: "Revenue pickup", value: report.pickup ? money(report.pickup.revenue) : "Collecting", sub: report.pickup ? `${money(report.pickup.revenuePerDay)} per day` : "Expected room revenue" },
        { icon: CalendarRange, label: "Same time last year", value: report.lastYearVariance ? `${report.lastYearVariance.roomNights >= 0 ? "+" : ""}${report.lastYearVariance.roomNights} room-nights` : "Not available", sub: report.lastYearVariance ? `${report.lastYearVariance.occupancyPoints >= 0 ? "+" : ""}${report.lastYearVariance.occupancyPoints} occupancy pts` : "Builds automatically over time" },
      ].map(({ icon: Icon, label, value, sub }) => <Card key={label}><span className="grid h-10 w-10 place-items-center rounded-xl bg-coral-soft text-coral-deep"><Icon size={18} /></span><div className="mt-4 text-[10.5px] font-bold uppercase tracking-[0.12em] text-ink-faint">{label}</div><div className="mt-1 serif text-[24px] text-ink tnum">{value}</div><div className="mt-1 text-[11.5px] text-ink-mute">{sub}</div></Card>)}</section>

      <Card pad={false}><div className="border-b border-line-soft p-5"><h2 className="serif text-[20px] text-ink">Daily pickup across the stay window</h2><p className="text-[12px] text-ink-mute">Rooms added or lost since the selected snapshot; negative pickup includes cancellations and reductions.</p></div><div className="h-[300px] p-5"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart}><CartesianGrid vertical={false} stroke="#ebe6df" /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#938981" }} /><YAxis yAxisId="rooms" tick={{ fontSize: 10, fill: "#938981" }} width={35} /><YAxis yAxisId="revenue" orientation="right" tick={{ fontSize: 10, fill: "#938981" }} width={62} /><Tooltip formatter={(value, name) => name === "Revenue pickup" ? [`PKR ${Number(value).toLocaleString("en-PK")}`, name] : [value, name]} /><Legend /><Bar yAxisId="rooms" dataKey="pickupRooms" name="Room-night pickup" fill="#e9522b" radius={[4, 4, 0, 0]} /><Bar yAxisId="revenue" dataKey="revenuePickup" name="Revenue pickup" fill="#2f7256" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></Card>

      <Card pad={false}><div className="border-b border-line-soft p-5"><h2 className="serif text-[20px] text-ink">Pickup by room type</h2><p className="text-[12px] text-ink-mute">Identify which inventory is gaining demand and which needs attention.</p></div><div className="overflow-x-auto"><table className="w-full"><thead><tr className="text-left text-[10.5px] font-bold uppercase tracking-wider text-ink-faint"><th className="px-5 py-3">Room type</th><th className="px-4 py-3 text-right">On books</th><th className="px-4 py-3 text-right">Occupancy</th><th className="px-4 py-3 text-right">Pickup</th><th className="px-5 py-3 text-right">Revenue pickup</th></tr></thead><tbody>{report.roomTypes.map((row) => <tr key={row.id} className="border-t border-line-soft text-[12.5px]"><td className="px-5 py-3.5 font-semibold text-ink">{row.name}</td><td className="px-4 py-3.5 text-right tnum">{row.current.roomsSold}</td><td className="px-4 py-3.5 text-right tnum">{row.current.occupancyRate}%</td><td className="px-4 py-3.5 text-right font-semibold tnum">{row.pickup ? `${row.pickup.roomNights >= 0 ? "+" : ""}${row.pickup.roomNights}` : "—"}</td><td className="px-5 py-3.5 text-right font-semibold tnum">{row.pickup ? money(row.pickup.revenue) : "—"}</td></tr>)}</tbody></table></div></Card>
    </>}
  </div>;
}
