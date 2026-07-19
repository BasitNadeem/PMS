import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, ShoppingCart } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportPOSSalesToExcel } from "@/lib/exportExcel";

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

export default function POSSalesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-pos-sales", startDate, endDate],
    queryFn: () => reportsService.getPOSSales(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">POS Sales</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportPOSSalesToExcel(report, startDate, endDate)}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                  <ShoppingCart size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.totalOrders.toLocaleString("en-PK")}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Orders</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.coral.bg, color: TONE.coral.fg }}>
                  <ShoppingCart size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.summary.totalRevenue)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Revenue</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft">
                  <ShoppingCart size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.summary.avgOrderValue)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Avg Order Value</div>
              </div>
            </Card>
          </div>

          {/* Category chart */}
          {report.byCategory.length > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Revenue by Category</h2>
              </div>
              <div className="px-4 pb-5" style={{ height: Math.max(160, report.byCategory.length * 42 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.byCategory.map((c) => ({ ...c, revPKR: Math.floor(c.revenue / 100) }))} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9b8f89" }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 12, fill: "#4a3f3a" }} width={110} />
                    <Tooltip formatter={(v) => [`PKR ${Number(v).toLocaleString("en-PK")}`, "Revenue"]} cursor={{ fill: "#f5f2ed" }} />
                    <Bar dataKey="revPKR" radius={[0, 4, 4, 0]}>
                      {report.byCategory.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Top items table */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Top 10 Items by Revenue</h2>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls} style={{ width: 32 }}>#</th>
                    <th className={thCls}>Item</th>
                    <th className={thCls}>Category</th>
                    <th className={thRightCls}>Qty Sold</th>
                    <th className={thRightCls}>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {report.topItems.length === 0 ? (
                    <tr><td className={tdCls} colSpan={5}>No POS orders in this period.</td></tr>
                  ) : report.topItems.map((item, i) => (
                    <tr key={item.posItemId}>
                      <td className={tdCls}><span className="text-[12px] font-bold text-ink-faint">{i + 1}</span></td>
                      <td className={tdCls}><span className="font-semibold">{item.itemName}</span></td>
                      <td className={tdCls}>{item.category}</td>
                      <td className={tdRightCls}>{item.quantitySold}</td>
                      <td className={tdRightCls} style={{ color: TONE.pine.fg, fontWeight: 600 }}>{formatPKR(item.revenue)}</td>
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
