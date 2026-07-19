import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, BedDouble, TrendingUp, TrendingDown } from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportOccupancyTrendToExcel } from "@/lib/exportExcel";

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
const inputCls = "h-10 rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

export default function OccupancyTrendPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-occupancy-trend", startDate, endDate],
    queryFn: () => reportsService.getOccupancyTrend(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Occupancy Trend</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportOccupancyTrendToExcel(report, startDate, endDate)}
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
            <div key={i} className="h-32 bg-line-soft rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !report ? null : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                  <BedDouble size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.avgOccupancy}%</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Avg Occupancy</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.coral.bg, color: TONE.coral.fg }}>
                  <TrendingUp size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.peakRate}%</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Peak · {report.summary.peakDate}</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.amber.bg, color: TONE.amber.fg }}>
                  <TrendingDown size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.lowestRate}%</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Lowest · {report.summary.lowestDate}</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft">
                  <BedDouble size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">
                  {report.summary.totalRoomNights.toLocaleString("en-PK")}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Room-Nights</div>
              </div>
            </Card>
          </div>

          {/* Chart */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Occupancy Rate Over Time</h2>
            </div>
            <div className="px-4 pb-5" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={report.dailyBreakdown} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#9b8f89" }}
                    tickFormatter={(v: string) => {
                      const d = new Date(v);
                      return `${d.getDate()}/${d.getMonth() + 1}`;
                    }}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    domain={[0, 100]}
                    tick={{ fontSize: 11, fill: "#9b8f89" }}
                    tickFormatter={(v: number) => `${v}%`}
                    width={40}
                  />
                  <Tooltip
                    formatter={(v) => [`${v}%`, "Occupancy"]}
                    labelFormatter={(l) => new Date(String(l)).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                  />
                  <ReferenceLine y={report.summary.avgOccupancy} stroke="#9b8f89" strokeDasharray="4 2" />
                  <Line
                    type="monotone"
                    dataKey="occupancyRate"
                    stroke={TONE.pine.fg}
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Table */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Daily Breakdown</h2>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Date</th>
                    <th className={thRightCls}>Total Rooms</th>
                    <th className={thRightCls}>Occupied</th>
                    <th className={thRightCls}>Occupancy %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dailyBreakdown.map((d) => (
                    <tr key={d.date}>
                      <td className={tdCls}>{new Date(d.date).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}</td>
                      <td className={tdRightCls}>{d.totalRooms}</td>
                      <td className={tdRightCls}>{d.occupied}</td>
                      <td className={tdRightCls}>
                        <span style={{ color: d.occupancyRate >= 80 ? TONE.pine.fg : d.occupancyRate >= 50 ? TONE.amber.fg : TONE.clay.fg, fontWeight: 600 }}>
                          {d.occupancyRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
