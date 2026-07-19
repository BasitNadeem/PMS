import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, TrendingUp, ShoppingCart, ReceiptText } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { DatePicker } from "@/components/ui/DatePicker";
import { reportsService } from "@/services/reports";
import { exportRevenueSourceToExcel } from "@/lib/exportExcel";

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

function formatKPKR(paisas: number): string {
  const r = Math.floor(paisas / 100);
  return r >= 100_000 ? `${(r / 1000).toFixed(0)}k` : r.toLocaleString("en-PK");
}

function localIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function firstOfMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const thRightCls = "text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";
const tdRightCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft text-right tnum";

interface KpiCardProps {
  icon: React.ElementType;
  toneName: keyof typeof TONE;
  label: string;
  value: string;
  pct?: number;
}

function KpiCard({ icon: Icon, toneName, label, value, pct }: KpiCardProps) {
  const t = TONE[toneName];
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: t.bg, color: t.fg }}>
          <Icon size={20} />
        </span>
        {pct !== undefined && (
          <span className="text-[11px] font-bold text-ink-faint">{pct}%</span>
        )}
      </div>
      <div className="mt-4">
        <div className="serif text-[28px] leading-none text-ink tnum">{value}</div>
        <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{label}</div>
      </div>
    </Card>
  );
}

const inputCls = "h-10 rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

export default function RevenueSourcePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-revenue-source", startDate, endDate],
    queryFn: () => reportsService.getRevenueBySource(startDate, endDate),
  });

  function apply(s: string, e: string) {
    setSearchParams({ startDate: s, endDate: e });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">Revenue by Source</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker
            value={startDate}
            onChange={(v) => apply(v, endDate)}
            className="h-10"
          />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker
            value={endDate}
            onChange={(v) => apply(startDate, v)}
            className="h-10"
          />
          {report && (
            <button
              onClick={() => exportRevenueSourceToExcel(report, startDate, endDate)}
              className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft hover:text-ink border border-line rounded-full px-3.5 py-2 hover:bg-line-soft transition-colors"
            >
              <FileSpreadsheet size={14} /> Export Excel
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 bg-line-soft rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !report ? null : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <KpiCard
              icon={TrendingUp}
              toneName="coral"
              label="Room Revenue"
              value={formatPKR(report.totals.roomRevenue)}
              pct={report.percentageSplit.room}
            />
            <KpiCard
              icon={ShoppingCart}
              toneName="pine"
              label="POS Revenue"
              value={formatPKR(report.totals.posRevenue)}
              pct={report.percentageSplit.pos}
            />
            <KpiCard
              icon={ReceiptText}
              toneName="slate"
              label="Other Revenue"
              value={formatPKR(report.totals.otherRevenue)}
              pct={report.percentageSplit.other}
            />
          </div>

          {/* Stacked bar chart */}
          <Card pad={false}>
            <div className="p-5 pb-0">
              <h2 className="serif text-[18px] text-ink leading-tight">Daily Breakdown</h2>
              <p className="text-[12.5px] text-ink-mute mt-0.5">Revenue by source category per day</p>
            </div>
            <div className="px-5 pb-5">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={report.dailyBreakdown} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E8E3DC" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9b9390" }}
                    tickFormatter={(v: string) => v.slice(5)}
                  />
                  <YAxis
                    tickFormatter={(v: number) => formatKPKR(v)}
                    tick={{ fontSize: 10, fill: "#9b9390" }}
                    width={56}
                  />
                  <Tooltip
                    formatter={(v: unknown, name: unknown) => [formatPKR(Number(v)), String(name)]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E3DC" }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="roomRevenue" name="Room" stackId="a" fill={TONE.coral.dot} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="posRevenue" name="POS" stackId="a" fill={TONE.pine.dot} radius={[0, 0, 0, 0]} />
                  <Bar dataKey="otherRevenue" name="Other" stackId="a" fill={TONE.slate.dot} radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Table */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Daily Detail</h2>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Date</th>
                    <th className={thRightCls}>Room Revenue</th>
                    <th className={thRightCls}>POS Revenue</th>
                    <th className={thRightCls}>Other</th>
                    <th className={thRightCls}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dailyBreakdown.filter((d) => d.total > 0).map((d) => (
                    <tr key={d.date}>
                      <td className={tdCls}>{d.date}</td>
                      <td className={tdRightCls}>{formatPKR(d.roomRevenue)}</td>
                      <td className={tdRightCls}>{formatPKR(d.posRevenue)}</td>
                      <td className={tdRightCls}>{formatPKR(d.otherRevenue)}</td>
                      <td className={`${tdRightCls} font-semibold`}>{formatPKR(d.total)}</td>
                    </tr>
                  ))}
                  <tr className="bg-mist">
                    <td className={`${tdCls} font-bold`}>Period Total</td>
                    <td className={`${tdRightCls} font-bold`}>{formatPKR(report.totals.roomRevenue)}</td>
                    <td className={`${tdRightCls} font-bold`}>{formatPKR(report.totals.posRevenue)}</td>
                    <td className={`${tdRightCls} font-bold`}>{formatPKR(report.totals.otherRevenue)}</td>
                    <td className={`${tdRightCls} font-bold`} style={{ color: TONE.coral.fg }}>{formatPKR(report.totals.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
