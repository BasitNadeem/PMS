import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays, BarChart3, ClipboardList, BedDouble,
  Banknote, LogIn, LogOut, TrendingUp, ChevronRight,
  Sparkles, Wrench, ShoppingCart, AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { reportsService } from "@/services/reports";

// ── Helpers ───────────────────────────────────────────────────────────────────

function localIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatPKR(paisas: number): string {
  const r = Math.floor(paisas / 100);
  if (r >= 1_000_000) return `PKR ${(r / 1_000_000).toFixed(1)}M`;
  if (r >= 100_000)   return `PKR ${(r / 1_000).toFixed(0)}k`;
  return `PKR ${r.toLocaleString("en-PK")}`;
}

const TODAY = localIso();

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function buildYears(): number[] {
  const y = new Date().getFullYear();
  return [y - 2, y - 1, y, y + 1];
}

const inputCls  = "h-11 w-full rounded-xl bg-mist border border-line px-3.5 text-sm text-ink placeholder:text-ink-faint outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";
// Select-specific: no w-full so flex-1 / fixed widths can size correctly inside a flex container
const selectCls = "h-11 rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all appearance-none cursor-pointer";

// ── Today snapshot tile ───────────────────────────────────────────────────────

function SnapTile({
  icon: Icon, label, value, sub, color,
}: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-line bg-white px-4 py-3.5">
      <span className="grid place-items-center h-9 w-9 rounded-xl shrink-0" style={{ background: `${color}18`, color }}>
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">{label}</p>
        <p className="text-[22px] font-bold text-ink tnum leading-tight">{value}</p>
        {sub && <p className="text-[12px] text-ink-mute">{sub}</p>}
      </div>
    </div>
  );
}

// ── Report card feature list ──────────────────────────────────────────────────

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex items-center gap-2 text-[12.5px] text-ink-soft">
          <span className="h-1.5 w-1.5 rounded-full bg-coral-soft flex-shrink-0" />
          {item}
        </li>
      ))}
    </ul>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const navigate = useNavigate();
  const today = new Date();

  const [dailyDate, setDailyDate] = useState(TODAY);
  const [monthVal,  setMonthVal]  = useState(today.getMonth() + 1);
  const [yearVal,   setYearVal]   = useState(today.getFullYear());

  // Live today snapshot — powers the "at a glance" section at the top.
  // Lightweight: uses the same endpoint as the daily report, no extra API needed.
  const { data: todaySnap, isLoading: snapLoading } = useQuery({
    queryKey: ["report-daily-snap", TODAY],
    queryFn:  () => reportsService.getDailyReport(TODAY),
    staleTime: 2 * 60_000,
    retry: 1,
  });

  const YEARS = buildYears();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Analytics</div>
          <h1 className="serif text-[34px] leading-[1.05] text-ink">Reports</h1>
          <p className="mt-1.5 text-[15px] text-ink-mute">Generate, view, and export operational reports</p>
        </div>
        <Link
          to={`/reports/daily?date=${TODAY}`}
          className="inline-flex items-center gap-2 h-10 px-4 rounded-full border border-line text-ink-soft text-sm font-semibold hover:bg-mist hover:text-ink transition-colors"
        >
          <TrendingUp size={15} /> Today's Full Report
        </Link>
      </div>

      {/* ── Today at a Glance ──────────────────────────────────────────────── */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="serif text-[18px] text-ink leading-tight">Today at a Glance</h2>
            <p className="text-[12.5px] text-ink-mute mt-0.5">
              {new Date().toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          <Link to={`/reports/daily?date=${TODAY}`} className="text-[12px] font-semibold text-coral hover:underline flex items-center gap-1">
            Full report <ChevronRight size={13} />
          </Link>
        </div>

        {snapLoading || !todaySnap ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-mist animate-pulse" />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
              <SnapTile icon={BedDouble}  label="Occupancy"       value={`${todaySnap.occupancy.occupancyRate}%`}          sub={`${todaySnap.occupancy.occupied}/${todaySnap.occupancy.totalRooms} rooms`} color="#2F7256" />
              <SnapTile icon={Banknote}   label="Collected Today" value={formatPKR(todaySnap.revenue.totalCollected)}       sub="Payments received"             color="#e04b22" />
              <SnapTile icon={LogIn}      label="Arrivals"        value={String(todaySnap.arrivals.length)}                 sub={`${todaySnap.occupancy.checkIns} checked in`}   color="#2c455c" />
              <SnapTile icon={LogOut}     label="Departures"      value={String(todaySnap.departures.length)}               sub={`${todaySnap.occupancy.checkOuts} checked out`} color="#86600F" />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <SnapTile icon={TrendingUp}    label="Room Revenue"    value={formatPKR(todaySnap.revenue.roomRevenue)}       sub="Room charges"          color="#5B4B82" />
              <SnapTile icon={ShoppingCart}  label="POS Revenue"     value={formatPKR(todaySnap.revenue.posRevenue)}        sub={`${todaySnap.operations.pos.totalOrders} orders`} color="#2F7256" />
              <SnapTile icon={Sparkles}      label="HK Tasks"        value={`${todaySnap.operations.housekeeping.completed}/${todaySnap.operations.housekeeping.totalTasks}`} sub="Completed today" color="#e04b22" />
              <SnapTile icon={Wrench}        label="Open Tickets"    value={String(todaySnap.operations.maintenance.openTickets)} sub={todaySnap.operations.maintenance.urgentOpen > 0 ? `${todaySnap.operations.maintenance.urgentOpen} urgent` : "No urgent"} color={todaySnap.operations.maintenance.urgentOpen > 0 ? "#aa4432" : "#2F7256"} />
            </div>
            {todaySnap.revenue.outstanding > 0 && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-soft border border-amber/30 px-4 py-2.5">
                <AlertCircle size={14} className="text-amber shrink-0" />
                <p className="text-[12.5px] font-semibold text-amber">
                  {formatPKR(todaySnap.revenue.outstanding)} outstanding across all open folios
                </p>
              </div>
            )}
          </>
        )}
      </Card>

      {/* ── Report generators ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">

        {/* Daily Report */}
        <Card className="anim-fade-up flex flex-col gap-5" style={{ animationDelay: "0ms" }}>
          <div className="flex items-start gap-4">
            <span className="grid place-items-center h-12 w-12 rounded-xl bg-coral-soft text-coral-deep shrink-0">
              <CalendarDays size={22} />
            </span>
            <div>
              <h2 className="serif text-[20px] text-ink leading-tight">Daily Report</h2>
              <p className="text-[12.5px] text-ink-mute mt-0.5">Full operations summary for any single day</p>
            </div>
          </div>

          <FeatureList items={[
            "Occupancy & room status breakdown",
            "Arrivals, departures & stay-overs",
            "Revenue, payments & outstanding",
            "POS sales, housekeeping & maintenance",
            "Expense breakdown & cash variance",
          ]} />

          <div className="space-y-2.5 mt-auto">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Select Date</label>
              <input type="date" value={dailyDate} onChange={(e) => setDailyDate(e.target.value)} className={inputCls} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { const d = new Date(); d.setDate(d.getDate() - 1); const s = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; setDailyDate(s); }}
                className="flex-1 h-9 rounded-full border border-line text-ink-soft text-[12.5px] font-semibold hover:bg-mist transition-colors"
              >
                Yesterday
              </button>
              <button
                onClick={() => setDailyDate(TODAY)}
                className="flex-1 h-9 rounded-full border border-line text-ink-soft text-[12.5px] font-semibold hover:bg-mist transition-colors"
              >
                Today
              </button>
            </div>
            <button
              onClick={() => navigate(`/reports/daily?date=${dailyDate}`)}
              className="w-full h-11 rounded-full bg-coral text-white font-semibold text-sm hover:bg-coral-dark transition-colors shadow-pop"
            >
              Generate Report →
            </button>
          </div>
        </Card>

        {/* Monthly Report */}
        <Card className="anim-fade-up flex flex-col gap-5" style={{ animationDelay: "60ms" }}>
          <div className="flex items-start gap-4">
            <span className="grid place-items-center h-12 w-12 rounded-xl bg-dusk-soft text-dusk shrink-0">
              <BarChart3 size={22} />
            </span>
            <div>
              <h2 className="serif text-[20px] text-ink leading-tight">Monthly Report</h2>
              <p className="text-[12.5px] text-ink-mute mt-0.5">Trends, KPIs and insights for any month</p>
            </div>
          </div>

          <FeatureList items={[
            "Revenue trend chart (daily breakdown)",
            "ADR, RevPAR & avg length of stay",
            "Payment method distribution",
            "Expenses, net profit & margin",
            "Top guests & group booking summary",
            "Occupancy by room type",
          ]} />

          <div className="space-y-2.5 mt-auto">
            <div>
              <label className="mb-1.5 block text-[12px] font-semibold uppercase tracking-wide text-ink-faint">Select Month</label>
              <div className="flex gap-2">
                <select value={monthVal} onChange={(e) => setMonthVal(Number(e.target.value))} className={`${selectCls} flex-1`}>
                  {MONTHS.map((name, i) => <option key={i + 1} value={i + 1}>{name}</option>)}
                </select>
                <select value={yearVal} onChange={(e) => setYearVal(Number(e.target.value))} className={`${selectCls} w-24`}>
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => { const d = new Date(); d.setMonth(d.getMonth() - 1); setMonthVal(d.getMonth() + 1); setYearVal(d.getFullYear()); }}
                className="flex-1 h-9 rounded-full border border-line text-ink-soft text-[12.5px] font-semibold hover:bg-mist transition-colors"
              >
                Last Month
              </button>
              <button
                onClick={() => { setMonthVal(today.getMonth() + 1); setYearVal(today.getFullYear()); }}
                className="flex-1 h-9 rounded-full border border-line text-ink-soft text-[12.5px] font-semibold hover:bg-mist transition-colors"
              >
                This Month
              </button>
            </div>
            <button
              onClick={() => navigate(`/reports/monthly?year=${yearVal}&month=${monthVal}`)}
              className="w-full h-11 rounded-full bg-ink text-white font-semibold text-sm hover:bg-ink/90 transition-colors shadow-pop"
            >
              Generate Report →
            </button>
          </div>
        </Card>

        {/* Shift Handover */}
        <Card className="anim-fade-up flex flex-col gap-5" style={{ animationDelay: "120ms" }}>
          <div className="flex items-start gap-4">
            <span className="grid place-items-center h-12 w-12 rounded-xl bg-pine-soft text-pine-deep shrink-0">
              <ClipboardList size={22} />
            </span>
            <div>
              <h2 className="serif text-[20px] text-ink leading-tight">Shift Handover</h2>
              <p className="text-[12.5px] text-ink-mute mt-0.5">Cash count and shift sign-off reports</p>
            </div>
          </div>

          <FeatureList items={[
            "Opening & closing cash count",
            "Cash collected vs expected variance",
            "Per-shift revenue summary",
            "Sign-off and notes for incoming shift",
            "Historical handover log",
          ]} />

          <div className="space-y-2.5 mt-auto">
            <button
              onClick={() => navigate("/reports/shifts")}
              className="w-full h-11 rounded-full bg-pine text-white font-semibold text-sm hover:bg-pine-deep transition-colors shadow-pop"
            >
              Open Shift Handover →
            </button>
          </div>
        </Card>
      </div>
    </div>
  );
}
