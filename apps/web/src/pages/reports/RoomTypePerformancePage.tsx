import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportRoomTypePerformanceToExcel } from "@/lib/exportExcel";

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

const BAR_COLORS = [TONE.pine.fg, TONE.coral.fg, TONE.amber.fg, TONE.clay.fg, "#5B4B82", "#2c455c"];

export default function RoomTypePerformancePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["report-room-type-performance", startDate, endDate],
    queryFn: () => reportsService.getRoomTypePerformance(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Room Type Performance</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {rows && (
            <button
              onClick={() => exportRoomTypePerformanceToExcel(rows, startDate, endDate)}
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
            <div key={i} className="h-40 bg-line-soft rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !rows ? null : (
        <div className="space-y-6">
          {/* Horizontal bar chart */}
          {rows.length > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Revenue by Room Type</h2>
                <p className="text-[12.5px] text-ink-mute mt-0.5">Sorted by total revenue descending</p>
              </div>
              <div className="px-4 pb-5" style={{ height: Math.max(180, rows.length * 48 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={rows.map((r) => ({ ...r, revenuePKR: Math.floor(r.revenue / 100) }))}
                    layout="vertical"
                    margin={{ top: 4, right: 40, left: 4, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9b8f89" }} tickFormatter={(v: number) => `PKR ${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="roomTypeName" type="category" tick={{ fontSize: 12, fill: "#4a3f3a" }} width={120} />
                    <Tooltip
                      formatter={(v) => [`PKR ${Number(v).toLocaleString("en-PK")}`, "Revenue"]}
                      cursor={{ fill: "#f5f2ed" }}
                    />
                    <Bar dataKey="revenuePKR" radius={[0, 4, 4, 0]}>
                      {rows.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
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
              <h2 className="serif text-[18px] text-ink leading-tight">Per Room Type Breakdown</h2>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Room Type</th>
                    <th className={thRightCls}>Rooms</th>
                    <th className={thRightCls}>Occupied Nights</th>
                    <th className={thRightCls}>Occupancy %</th>
                    <th className={thRightCls}>Revenue</th>
                    <th className={thRightCls}>ADR</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td className={tdCls} colSpan={6}>No room type data for this period.</td></tr>
                  ) : rows.map((r, i) => (
                    <tr key={r.roomTypeName}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: BAR_COLORS[i % BAR_COLORS.length] }} />
                          <span className="font-semibold">{r.roomTypeName}</span>
                        </div>
                      </td>
                      <td className={tdRightCls}>{r.totalRooms}</td>
                      <td className={tdRightCls}>{r.occupiedNights}</td>
                      <td className={tdRightCls}>
                        <span style={{ color: r.occupancyRate >= 70 ? TONE.pine.fg : r.occupancyRate >= 40 ? TONE.amber.fg : TONE.clay.fg, fontWeight: 600 }}>
                          {r.occupancyRate}%
                        </span>
                      </td>
                      <td className={tdRightCls}>{formatPKR(r.revenue)}</td>
                      <td className={tdRightCls} style={{ color: TONE.pine.fg, fontWeight: 600 }}>{formatPKR(r.adr)}</td>
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
