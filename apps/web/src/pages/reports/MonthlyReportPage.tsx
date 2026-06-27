import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Printer, ArrowLeft, FileSpreadsheet,
  TrendingUp, TrendingDown, Wallet, Users, BedDouble, Wrench,
} from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService, type OccupancyByRoomType, type TopGuest, type ExpenseCategory, type PaymentMethodBreakdown } from "@/services/reports";
import { exportMonthlyReportExcel } from "@/lib/exportExcel";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

function formatKPKR(paisas: number): string {
  const rupees = Math.floor(paisas / 100);
  return rupees >= 100_000 ? `${(rupees / 1000).toFixed(0)}k` : rupees.toLocaleString("en-PK");
}

function offsetMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  bankTransfer: "Bank Transfer",
  other: "Other",
};

const METHOD_COLORS: Record<string, string> = {
  cash: TONE.pine.dot,
  card: TONE.slate.dot,
  jazzcash: TONE.coral.dot,
  easypaisa: TONE.amber.dot,
  bankTransfer: TONE.dusk.dot,
  other: TONE.ink.dot,
};

// ── shared components ─────────────────────────────────────────────────────────

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="serif text-[20px] text-ink leading-tight">{title}</h2>
      {sub && <p className="text-[12.5px] text-ink-mute mt-0.5">{sub}</p>}
    </div>
  );
}

interface KpiCardProps {
  icon: React.ElementType;
  toneName: keyof typeof TONE;
  label: string;
  value: string;
  sub?: string;
}

function KpiCard({ icon: Icon, toneName, label, value, sub }: KpiCardProps) {
  const t = TONE[toneName];
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: t.bg, color: t.fg }}>
          <Icon size={20} />
        </span>
      </div>
      <div className="mt-4">
        <div className="serif text-[28px] leading-none text-ink tnum">{value}</div>
        <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{label}</div>
        {sub && <div className="text-[12px] text-ink-mute">{sub}</div>}
      </div>
    </Card>
  );
}

function StatTile({ label, value, toneName }: { label: string; value: string; toneName?: keyof typeof TONE }) {
  const t = toneName ? TONE[toneName] : null;
  return (
    <div className="rounded-xl border border-line bg-mist p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-1 text-[18px] font-bold tnum" style={{ color: t ? t.fg : "#2b2722" }}>{value}</div>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-[13px] text-ink-faint italic">{label}</td>
    </tr>
  );
}

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const thRightCls = "text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";
const tdRightCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft text-right tnum";

// ── tables ───────────────────────────────────────────────────────────────────

function ExpensesTable({ rows }: { rows: ExpenseCategory[] }) {
  const total = rows.reduce((s, c) => s + c.amount, 0);
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className={thCls}>Category</th>
          <th className={thRightCls}>Count</th>
          <th className={thRightCls}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <EmptyRow colSpan={3} label="No expenses recorded" />
          : rows.map((c) => (
            <tr key={c.category}>
              <td className={tdCls}>{c.category.replace(/_/g, " ")}</td>
              <td className={tdRightCls}>{c.count}</td>
              <td className={tdRightCls}>{formatPKR(c.amount)}</td>
            </tr>
          ))}
        {rows.length > 0 && (
          <tr>
            <td className={`${tdCls} font-bold`}>Total</td>
            <td className={tdRightCls} />
            <td className={`${tdRightCls} font-bold`}>{formatPKR(total)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

function RoomTypeTable({ rows }: { rows: OccupancyByRoomType[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className={thCls}>Room Type</th>
          <th className={thRightCls}>Rooms</th>
          <th className={thRightCls}>Occupied Nights</th>
          <th className={thRightCls}>Occupancy %</th>
          <th className={thRightCls}>Revenue</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <EmptyRow colSpan={5} label="No room type data available" />
          : rows.map((rt) => (
            <tr key={rt.roomType}>
              <td className={tdCls}><span className="font-semibold">{rt.roomType}</span></td>
              <td className={tdRightCls}>{rt.totalRooms}</td>
              <td className={tdRightCls}>{rt.occupiedNights}</td>
              <td className={tdRightCls}>{rt.occupancyRate}%</td>
              <td className={tdRightCls}>{formatPKR(rt.revenue)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function TopGuestsTable({ rows }: { rows: TopGuest[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className={thCls}>#</th>
          <th className={thCls}>Guest</th>
          <th className={thRightCls}>Visits</th>
          <th className={thRightCls}>Total Spend</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <EmptyRow colSpan={4} label="No guest data this month" />
          : rows.map((g, i) => (
            <tr key={g.name}>
              <td className={tdCls}><span className="font-mono text-ink-faint text-xs">{i + 1}</span></td>
              <td className={tdCls}><span className="font-semibold">{g.name}</span></td>
              <td className={tdRightCls}>{g.visits}</td>
              <td className={tdRightCls}>{formatPKR(g.totalSpend)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

// ── payment donut chart ───────────────────────────────────────────────────────

interface PaymentDonutProps {
  paymentMethods: PaymentMethodBreakdown;
}

function PaymentDonut({ paymentMethods }: PaymentDonutProps) {
  const METHOD_KEYS = ["cash", "card", "jazzcash", "easypaisa", "bankTransfer", "other"] as const;
  const entries = METHOD_KEYS.map((k) => [k, paymentMethods[k]] as const);
  const total = entries.reduce((s, [, v]) => s + v, 0);

  const pieData = entries
    .filter(([, v]) => v > 0)
    .map(([key, value]) => ({
      key,
      name: PAYMENT_METHOD_LABELS[key] ?? key,
      value,
      color: METHOD_COLORS[key] ?? TONE.ink.dot,
      pct: total > 0 ? Math.round((value / total) * 100) : 0,
    }));

  if (total === 0) {
    return <p className="text-[13px] text-ink-faint italic">No payments recorded this month</p>;
  }

  return (
    <div className="flex flex-col md:flex-row items-center gap-8">
      {/* Donut */}
      <div className="shrink-0">
        <PieChart width={200} height={200}>
          <Pie
            data={pieData}
            dataKey="value"
            cx={100}
            cy={100}
            innerRadius={62}
            outerRadius={90}
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
          >
            {pieData.map((entry) => (
              <Cell key={entry.key} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip
            formatter={(v: unknown) => [formatPKR(Number(v)), "Amount"]}
            contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E3DC" }}
          />
        </PieChart>
        {/* Centre label */}
        <div className="text-center -mt-2">
          <div className="serif text-[22px] text-ink leading-none tnum">{formatPKR(total)}</div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint mt-0.5">Total Collected</div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex-1 w-full space-y-2">
        {pieData.map((entry) => (
          <div key={entry.key} className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full shrink-0" style={{ background: entry.color }} />
            <span className="text-[13.5px] font-semibold text-ink flex-1">{entry.name}</span>
            <span className="text-[13.5px] text-ink tnum font-semibold">{formatPKR(entry.value)}</span>
            <span className="text-[12px] text-ink-faint tnum w-10 text-right">{entry.pct}%</span>
          </div>
        ))}
        {/* Zero-value methods in muted style */}
        {entries.filter(([, v]) => v === 0).map(([key]) => (
          <div key={key} className="flex items-center gap-3 opacity-35">
            <span className="h-3 w-3 rounded-full shrink-0 bg-line" />
            <span className="text-[13.5px] text-ink-faint flex-1">{PAYMENT_METHOD_LABELS[key] ?? key}</span>
            <span className="text-[13.5px] text-ink-faint tnum">PKR 0</span>
            <span className="text-[12px] text-ink-faint tnum w-10 text-right">0%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function MonthlyReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const today = new Date();
  const year = parseInt(searchParams.get("year") ?? String(today.getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(today.getMonth() + 1), 10);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-monthly", year, month],
    queryFn: () => reportsService.getMonthlyReport(year, month),
  });

  function navMonth(delta: number) {
    const { year: y, month: m } = offsetMonth(year, month, delta);
    setSearchParams({ year: String(y), month: String(m) });
  }

  const generatedAt = new Date().toLocaleString("en-PK");

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          /* ── page setup ── */
          @page { margin: 14mm 12mm; size: A4 landscape; }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
          }
          body, html { background: #fff !important; }

          /* ── hide chrome ── */
          .no-print { display: none !important; }
          aside { display: none !important; }
          .lg\\:hidden { display: none !important; }

          /* ── layout: full-width content ── */
          .flex.min-h-screen { display: block !important; }
          .flex-1.min-w-0.flex.flex-col { display: block !important; width: 100% !important; }
          main { overflow: visible !important; height: auto !important; display: block !important; }
          main > div { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          .scroll-area { overflow: visible !important; }

          /* ── spacing ── */
          .space-y-7 > * + * { margin-top: 11pt !important; }
          .gap-4 { gap: 7pt !important; }
          .gap-3 { gap: 5pt !important; }
          .gap-2 { gap: 4pt !important; }
          .mb-6 { margin-bottom: 0 !important; }
          .p-5 { padding: 9pt !important; }
          .px-5.pb-5 { padding: 0 8pt 8pt !important; }
          .p-5.pb-0 { padding: 9pt 9pt 0 !important; }

          /* ── cards ── */
          .bg-card { background: #fff !important; border: 0.75pt solid #c8c0b8 !important; border-radius: 5pt !important; }
          .bg-mist { background: #f5f2ed !important; }
          .bg-paper { background: #fff !important; }
          .border-line { border-color: #c8c0b8 !important; }
          .border-line-soft { border-color: #e4ddd6 !important; }

          /* ── typography ── */
          .serif { font-family: Georgia, 'Times New Roman', serif !important; }

          /* ── chart: hide recharts on print (charts don't render in PDF cleanly) ── */
          /* Keep chart visible but allow page break before it */
          .recharts-wrapper { page-break-before: auto; }

          /* ── tables ── */
          table { border-collapse: collapse !important; width: 100%; font-size: 8.5pt; page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
          th { font-size: 7pt !important; padding: 3.5pt 5pt !important; background: #f0ece6 !important; }
          td { font-size: 8.5pt !important; padding: 3pt 5pt !important; }
          .overflow-x-auto { overflow: visible !important; }

          /* ── stat tiles ── */
          .rounded-xl.border.border-line.bg-mist {
            background: #f0ece6 !important;
            border: 0.6pt solid #c8c0b8 !important;
            border-radius: 4pt !important;
            padding: 5pt !important;
          }

          /* ── payment method bars ── */
          .flex-1.h-5.bg-mist.rounded-full { background: #ece8e2 !important; border: 0.5pt solid #d0c8bf !important; }

          /* ── print sections ── */
          .print-section { page-break-inside: avoid !important; margin-bottom: 10pt !important; }

          /* ── animations ── */
          .anim-fade-up { animation: none !important; opacity: 1 !important; }
        }
      `}</style>

      {/* Action bar */}
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <span className="text-[14px] font-semibold text-ink">
          {report?.monthName ?? "—"} {year}
        </span>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => navMonth(-1)} className="flex items-center gap-1 text-[13px] font-semibold text-ink-soft hover:text-ink border border-line rounded-full px-3.5 py-2 hover:bg-line-soft transition-colors">
            <ChevronLeft size={14} /> Previous Month
          </button>
          <button onClick={() => navMonth(1)} className="flex items-center gap-1 text-[13px] font-semibold text-ink-soft hover:text-ink border border-line rounded-full px-3.5 py-2 hover:bg-line-soft transition-colors">
            Next Month <ChevronRight size={14} />
          </button>
          {report && (
            <button
              onClick={() => exportMonthlyReportExcel(report)}
              className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft hover:text-ink border border-line rounded-full px-3.5 py-2 hover:bg-line-soft transition-colors"
            >
              <FileSpreadsheet size={14} /> Export Excel
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-coral hover:bg-coral-dark text-white text-[13px] font-semibold px-4 py-2 rounded-full transition-colors"
          >
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-32 bg-line-soft rounded-xl2 animate-pulse" />
          ))}
        </div>
      ) : !report ? null : (
        <div className="space-y-7">
          {/* Report header */}
          <div className="print-section pb-5 border-b border-line">
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Monthly Summary Report</div>
            <h1 className="serif text-[34px] leading-[1.05] text-ink">{report.hotel.name}</h1>
            <p className="mt-1.5 text-[15px] text-ink-mute">
              {report.monthName} {report.year}
              {report.hotel.city ? ` · ${report.hotel.city}` : ""}
              {report.hotel.phone ? ` · ${report.hotel.phone}` : ""}
            </p>
            <p className="text-[12px] text-ink-faint mt-1">Generated: {generatedAt}</p>
          </div>

          {/* Executive Summary KPI cards */}
          <div className="print-section">
            <SectionHeading title="Executive Summary" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard
                icon={report.summary.netProfit >= 0 ? TrendingUp : TrendingDown}
                toneName={report.summary.netProfit >= 0 ? "pine" : "clay"}
                label={report.summary.netProfit >= 0 ? "Net Profit" : "Net Loss"}
                value={formatPKR(Math.abs(report.summary.netProfit))}
                sub={`Margin: ${report.summary.profitMargin}%`}
              />
              <KpiCard icon={Wallet} toneName="coral" label="Total Revenue" value={formatPKR(report.summary.totalRevenue)} />
              <KpiCard icon={BedDouble} toneName="slate" label="Avg Occupancy" value={`${report.summary.averageOccupancy}%`} sub={`ADR: ${formatPKR(report.summary.adr)}`} />
              <KpiCard icon={Users} toneName="amber" label="Total Guests" value={String(report.summary.totalGuests)} sub={`${report.summary.totalReservations} reservations`} />
            </div>
          </div>

          {/* Summary stats row */}
          <Card className="print-section">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatTile label="Total Revenue" value={formatPKR(report.summary.totalRevenue)} toneName="pine" />
              <StatTile label="Total Expenses" value={formatPKR(report.summary.totalExpenses)} toneName="clay" />
              <StatTile label="RevPAR" value={formatPKR(report.summary.revpar)} />
              <StatTile label="Avg Length of Stay" value={`${report.summary.averageLengthOfStay} nights`} />
            </div>
          </Card>

          {/* Revenue Trend chart */}
          <Card className="print-section" pad={false}>
            <div className="p-5 pb-0">
              <SectionHeading title="Revenue Trend" sub={`${report.monthName} ${report.year} — daily collected revenue & occupancy`} />
            </div>
            <div className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={report.revenueByDay} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E3DC" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9b9390" }}
                    tickFormatter={(v: string) => v.slice(8)}
                  />
                  <YAxis
                    yAxisId="revenue"
                    tickFormatter={(v: number) => formatKPKR(v)}
                    tick={{ fontSize: 10, fill: "#9b9390" }}
                    width={56}
                  />
                  <YAxis
                    yAxisId="occ"
                    orientation="right"
                    domain={[0, 100]}
                    tickFormatter={(v: number) => `${v}%`}
                    tick={{ fontSize: 10, fill: "#9b9390" }}
                    width={36}
                  />
                  <Tooltip
                    formatter={(v: unknown, name: unknown) =>
                      name === "occupancy" ? [`${v}%`, "Occupancy"] : [formatPKR(Number(v)), "Revenue"]
                    }
                    labelFormatter={(l: unknown) => String(l)}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E3DC" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="revenue" dataKey="revenue" name="Revenue" fill={TONE.coral.dot} radius={[3, 3, 0, 0]} />
                  <Line yAxisId="occ" type="monotone" dataKey="occupancy" name="Occupancy %" stroke={TONE.slate.dot} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Revenue Breakdown */}
          <Card className="print-section">
            <SectionHeading title="Revenue Breakdown" />
            <div className="grid grid-cols-3 gap-3">
              <StatTile label="Room Revenue" value={formatPKR(report.revenueBySource.roomRevenue)} />
              <StatTile label="POS Revenue" value={formatPKR(report.revenueBySource.posRevenue)} />
              <StatTile label="Other Charges" value={formatPKR(report.revenueBySource.otherCharges)} />
            </div>
          </Card>

          {/* Payment Methods — donut chart */}
          <Card className="print-section">
            <SectionHeading title="Payment Methods" />
            <PaymentDonut paymentMethods={report.paymentMethods} />
          </Card>

          {/* Expenses */}
          <Card className="print-section" pad={false}>
            <div className="p-5 pb-0">
              <SectionHeading title="Expenses" sub="Actual expenses recorded this month" />
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <ExpensesTable rows={report.expensesByCategory} />
            </div>
          </Card>

          {/* Occupancy by Room Type */}
          <Card className="print-section" pad={false}>
            <div className="p-5 pb-0">
              <SectionHeading title="Occupancy by Room Type" />
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <RoomTypeTable rows={report.occupancyByRoomType} />
            </div>
          </Card>

          {/* Group Bookings & Maintenance side by side */}
          <div className="print-section grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <SectionHeading title="Group Bookings" />
              <div className="grid grid-cols-3 gap-3">
                <StatTile label="Groups" value={String(report.groupBookings.totalGroups)} />
                <StatTile label="Group Rooms" value={String(report.groupBookings.totalGroupRooms)} />
                <StatTile label="Group Revenue" value={formatPKR(report.groupBookings.groupRevenue)} />
              </div>
            </Card>
            <Card>
              <SectionHeading title="Maintenance" />
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Total Tickets" value={String(report.maintenance.totalTickets)} />
                <StatTile label="Resolved" value={String(report.maintenance.resolved)} toneName="pine" />
                <StatTile label="Avg Resolution" value={`${report.maintenance.avgResolutionTime}h`} />
                <StatTile label="Actual Cost" value={formatPKR(report.maintenance.actualCost)} />
              </div>
            </Card>
          </div>

          {/* Housekeeping + Top Guests */}
          <div className="print-section grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <SectionHeading title="Housekeeping" />
              <div className="grid grid-cols-2 gap-3">
                <StatTile label="Tasks Completed" value={String(report.housekeeping.totalTasksCompleted)} toneName="pine" />
                <StatTile label="Avg / Day" value={String(report.housekeeping.averageTasksPerDay)} />
              </div>
            </Card>
            <Card>
              <SectionHeading title="Top Guests by Spend" />
              <div className="space-y-1.5">
                {report.topGuests.length === 0 ? (
                  <p className="text-[13px] text-ink-faint italic">No guest data this month</p>
                ) : report.topGuests.map((g, i) => (
                  <div key={g.name} className="flex items-center justify-between text-[13.5px]">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-ink-faint w-4">{i + 1}</span>
                      <span className="font-semibold text-ink">{g.name}</span>
                    </span>
                    <span className="text-ink tnum font-semibold">{formatPKR(g.totalSpend)}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Top Guests full table (for print / export context) */}
          {report.topGuests.length > 0 && (
            <Card className="print-section" pad={false}>
              <div className="p-5 pb-0">
                <SectionHeading title="Top Guests — Full List" />
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <TopGuestsTable rows={report.topGuests} />
              </div>
            </Card>
          )}

          {/* Footer */}
          <div className="border-t border-line pt-4">
            <p className="text-[11px] text-ink-faint text-center">
              Confidential — {report.hotel.name} · {report.monthName} {report.year} · Generated {generatedAt}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
