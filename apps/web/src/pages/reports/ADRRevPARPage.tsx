import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, DollarSign, BedDouble } from "lucide-react";
import {
  ResponsiveContainer, ComposedChart, Line, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportADRRevPARToExcel } from "@/lib/exportExcel";

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

export default function ADRRevPARPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-adr-revpar", startDate, endDate],
    queryFn: () => reportsService.getADRRevPAR(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">ADR / RevPAR Analysis</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportADRRevPARToExcel(report, startDate, endDate)}
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
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                  <DollarSign size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.summary.avgADR)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Avg Daily Rate (ADR)</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft"><BedDouble size={20} /></span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.occupancyRate}%</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Sellable occupancy</div>
                <div className="mt-1 text-[11.5px] text-ink-faint">{report.summary.outOfServiceRoomNights} room-nights out of service</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.coral.bg, color: TONE.coral.fg }}>
                  <DollarSign size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.summary.avgRevPAR)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Revenue Per Available Room (RevPAR)</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft">
                  <DollarSign size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.summary.totalRoomRevenue)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Room Revenue · {report.summary.totalRoomsSold} room-nights</div>
              </div>
            </Card>
          </div>

          {/* Dual-line chart */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">ADR vs RevPAR Trend</h2>
              <p className="text-[12.5px] text-ink-mute mt-0.5">Room-night revenue against sellable inventory; taxes and extras excluded.</p>
            </div>
            <div className="px-4 pb-5" style={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={report.dailyBreakdown.map((d) => ({
                    ...d,
                    adrPKR: Math.floor(d.adr / 100),
                    revparPKR: Math.floor(d.revpar / 100),
                    revenuePKR: Math.floor(d.roomRevenue / 100),
                  }))}
                  margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
                >
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
                  <YAxis tick={{ fontSize: 11, fill: "#9b8f89" }} width={50} />
                  <Tooltip
                    formatter={(v, name) => [
                      `PKR ${Number(v).toLocaleString("en-PK")}`,
                      name === "adrPKR" ? "ADR" : name === "revparPKR" ? "RevPAR" : "Revenue",
                    ]}
                    labelFormatter={(l) => new Date(String(l)).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                  />
                  <Legend formatter={(v: string) => v === "adrPKR" ? "ADR" : v === "revparPKR" ? "RevPAR" : "Revenue"} />
                  <Bar dataKey="revenuePKR" fill="#e8e4df" opacity={0.6} />
                  <Line type="monotone" dataKey="adrPKR" stroke={TONE.pine.fg} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="revparPKR" stroke={TONE.coral.fg} strokeWidth={2} dot={false} />
                </ComposedChart>
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
                    <th className={thRightCls}>Rooms Sold</th>
                    <th className={thRightCls}>Sellable</th>
                    <th className={thRightCls}>Occupancy</th>
                    <th className={thRightCls}>Room Revenue</th>
                    <th className={thRightCls}>ADR</th>
                    <th className={thRightCls}>RevPAR</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dailyBreakdown.map((d) => (
                    <tr key={d.date}>
                      <td className={tdCls}>{new Date(d.date).toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short" })}</td>
                      <td className={tdRightCls}>{d.roomsSold}</td>
                      <td className={tdRightCls}>{d.sellableRooms}{d.outOfServiceRooms > 0 ? <span className="ml-1 text-[11px] text-coral">−{d.outOfServiceRooms}</span> : null}</td>
                      <td className={tdRightCls}>{d.occupancyRate}%</td>
                      <td className={tdRightCls}>{formatPKR(d.roomRevenue)}</td>
                      <td className={tdRightCls} style={{ color: TONE.pine.fg, fontWeight: 600 }}>{formatPKR(d.adr)}</td>
                      <td className={tdRightCls} style={{ color: TONE.coral.fg, fontWeight: 600 }}>{formatPKR(d.revpar)}</td>
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
