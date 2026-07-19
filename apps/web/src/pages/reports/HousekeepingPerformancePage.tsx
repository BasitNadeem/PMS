import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, CheckSquare } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportHousekeepingPerformanceToExcel } from "@/lib/exportExcel";

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

const TYPE_COLORS = [TONE.pine.fg, TONE.coral.fg, TONE.amber.fg, TONE.clay.fg, "#5B4B82", "#2c455c"];

export default function HousekeepingPerformancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-hk-performance", startDate, endDate],
    queryFn: () => reportsService.getHousekeepingPerformance(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Housekeeping Performance</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportHousekeepingPerformanceToExcel(report, startDate, endDate)}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                  <CheckSquare size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.totalCompleted.toLocaleString("en-PK")}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Tasks Completed</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.coral.bg, color: TONE.coral.fg }}>
                  <CheckSquare size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">
                  {report.summary.avgCompletionMinutes != null ? `${report.summary.avgCompletionMinutes} min` : "—"}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Avg Completion Time</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft">
                  <CheckSquare size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.staffCount}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Staff Active</div>
              </div>
            </Card>
          </div>

          {/* Task type bar chart */}
          {report.byType.length > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Tasks by Type</h2>
              </div>
              <div className="px-4 pb-5" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.byType} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" />
                    <XAxis dataKey="taskType" tick={{ fontSize: 11, fill: "#9b8f89" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9b8f89" }} />
                    <Tooltip formatter={(v, name) => [v, name === "count" ? "Tasks" : name]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {report.byType.map((_, i) => (
                        <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Staff performance table */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Staff Performance</h2>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Staff Member</th>
                    <th className={thRightCls}>Tasks Completed</th>
                    <th className={thRightCls}>Avg Time (min)</th>
                  </tr>
                </thead>
                <tbody>
                  {report.staffPerformance.length === 0 ? (
                    <tr><td className={tdCls} colSpan={3}>No completed tasks in this period.</td></tr>
                  ) : report.staffPerformance.map((s) => (
                    <tr key={s.staffId ?? s.staffName}>
                      <td className={tdCls}><span className="font-semibold">{s.staffName}</span></td>
                      <td className={tdRightCls} style={{ color: TONE.pine.fg, fontWeight: 600 }}>{s.tasksCompleted}</td>
                      <td className={tdRightCls}>
                        {s.avgCompletionMinutes != null ? (
                          <span style={{ color: s.avgCompletionMinutes > 60 ? TONE.amber.fg : TONE.pine.fg, fontWeight: 600 }}>
                            {s.avgCompletionMinutes}
                          </span>
                        ) : "—"}
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
