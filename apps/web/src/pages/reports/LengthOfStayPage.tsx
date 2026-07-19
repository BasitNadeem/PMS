import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Clock } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportLengthOfStayToExcel } from "@/lib/exportExcel";

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

const BUCKET_COLORS = [TONE.pine.fg, TONE.coral.fg, TONE.amber.fg, TONE.clay.fg];

export default function LengthOfStayPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-length-of-stay", startDate, endDate],
    queryFn: () => reportsService.getLengthOfStay(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Length of Stay Analysis</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportLengthOfStayToExcel(report, startDate, endDate)}
              className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft hover:text-ink border border-line rounded-full px-3.5 py-2 hover:bg-line-soft transition-colors"
            >
              <FileSpreadsheet size={14} /> Export Excel
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 bg-line-soft rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !report ? null : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                  <Clock size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">
                  {report.summary.avgLengthOfStay} <span className="text-[18px]">nights</span>
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Avg Length of Stay</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft">
                  <Clock size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">
                  {report.summary.totalStays.toLocaleString("en-PK")}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Completed Stays</div>
              </div>
            </Card>
          </div>

          {/* Bar chart */}
          {report.summary.totalStays > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Stay Duration Distribution</h2>
              </div>
              <div className="px-4 pb-5" style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.buckets} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" />
                    <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#4a3f3a" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#9b8f89" }} />
                    <Tooltip formatter={(v, name) => [v, name === "count" ? "Stays" : name]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {report.buckets.map((_, i) => (
                        <Cell key={i} fill={BUCKET_COLORS[i % BUCKET_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Table */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Bucket Breakdown</h2>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Stay Duration</th>
                    <th className={thRightCls}>Stays</th>
                    <th className={thRightCls}>% of Total</th>
                    <th className={thRightCls}>Avg Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.buckets.map((b, i) => (
                    <tr key={b.label}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: BUCKET_COLORS[i % BUCKET_COLORS.length] }} />
                          <span className="font-semibold">{b.label}</span>
                        </div>
                      </td>
                      <td className={tdRightCls}>{b.count}</td>
                      <td className={tdRightCls}>{b.percentage}%</td>
                      <td className={tdRightCls}>{b.count > 0 ? formatPKR(b.avgRevenue) : "—"}</td>
                    </tr>
                  ))}
                  <tr className="bg-mist">
                    <td className={`${tdCls} font-bold`}>Total</td>
                    <td className={`${tdRightCls} font-bold`}>{report.summary.totalStays}</td>
                    <td className={`${tdRightCls} font-bold`}>100%</td>
                    <td className={tdRightCls}></td>
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
