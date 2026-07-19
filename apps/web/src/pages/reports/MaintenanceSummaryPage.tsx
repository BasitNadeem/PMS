import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Wrench } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportMaintenanceSummaryToExcel } from "@/lib/exportExcel";

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
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
const inputCls = "h-10 rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

const STATUS_COLORS: Record<string, string> = {
  OPEN: TONE.amber.fg, IN_PROGRESS: TONE.pine.fg,
  AWAITING_PARTS: "#5B4B82", RESOLVED: TONE.coral.fg, CLOSED: "#9b8f89",
};
const PRIORITY_COLORS: Record<string, string> = {
  URGENT: "#c0392b", HIGH: TONE.clay.fg, MEDIUM: TONE.amber.fg, LOW: TONE.pine.fg,
};
const BAR_COLORS = [TONE.pine.fg, TONE.coral.fg, TONE.amber.fg, TONE.clay.fg, "#5B4B82", "#2c455c"];

export default function MaintenanceSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-maintenance-summary", startDate, endDate],
    queryFn: () => reportsService.getMaintenanceSummary(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Maintenance Summary</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportMaintenanceSummaryToExcel(report, startDate, endDate)}
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
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.amber.bg, color: TONE.amber.fg }}>
                  <Wrench size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.total}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Tickets · {report.summary.resolvedCount} resolved</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                  <Wrench size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">
                  {report.summary.avgResolutionHours != null ? `${report.summary.avgResolutionHours}h` : "—"}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Avg Resolution Time</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft">
                  <Wrench size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.costSummary.totalActual)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">
                  Actual Cost ·{" "}
                  <span style={{ color: report.costSummary.costVariance > 0 ? TONE.clay.fg : TONE.pine.fg }}>
                    {report.costSummary.costVariance > 0 ? "+" : ""}{formatPKR(report.costSummary.costVariance)} vs estimate
                  </span>
                </div>
              </div>
            </Card>
          </div>

          {/* Status + Priority charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[17px] text-ink">By Status</h2>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Status</th>
                      <th className={thRightCls}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byStatus.map((r) => (
                      <tr key={r.status}>
                        <td className={tdCls}>
                          <span className="inline-block text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${STATUS_COLORS[r.status] ?? "#9b8f89"}18`, color: STATUS_COLORS[r.status] ?? "#9b8f89" }}>
                            {r.status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className={tdRightCls} style={{ fontWeight: 600 }}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[17px] text-ink">By Priority</h2>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Priority</th>
                      <th className={thRightCls}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byPriority.map((r) => (
                      <tr key={r.priority}>
                        <td className={tdCls}>
                          <span className="inline-block text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${PRIORITY_COLORS[r.priority] ?? "#9b8f89"}18`, color: PRIORITY_COLORS[r.priority] ?? "#9b8f89" }}>
                            {r.priority}
                          </span>
                        </td>
                        <td className={tdRightCls} style={{ fontWeight: 600 }}>{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* By category bar */}
          {report.byCategory.length > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">By Category</h2>
              </div>
              <div className="px-4 pb-5" style={{ height: Math.max(160, report.byCategory.length * 40 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.byCategory} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9b8f89" }} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 12, fill: "#4a3f3a" }} width={120} />
                    <Tooltip formatter={(v, name) => [v, name === "count" ? "Tickets" : name]} cursor={{ fill: "#f5f2ed" }} />
                    <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                      {report.byCategory.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {report.summary.total === 0 && (
            <Card>
              <div className="py-8 text-center text-[14px] text-ink-mute">No maintenance tickets in this period.</div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
