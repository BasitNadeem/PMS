import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Package } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportStockConsumptionToExcel } from "@/lib/exportExcel";

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

export default function StockConsumptionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-stock-consumption", startDate, endDate],
    queryFn: () => reportsService.getStockConsumption(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Stock Consumption</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportStockConsumptionToExcel(report, startDate, endDate)}
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
                  <Package size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.uniqueItems}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Unique Items · {report.summary.totalTransactions} transactions</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.coral.bg, color: TONE.coral.fg }}>
                  <Package size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.summary.totalCost)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Consumption Cost</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft">
                  <Package size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.byCategory.length}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Categories</div>
              </div>
            </Card>
          </div>

          {/* Category breakdown bar chart */}
          {report.byCategory.length > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Cost by Category (PKR)</h2>
              </div>
              <div className="px-4 pb-5" style={{ height: Math.max(160, report.byCategory.length * 40 + 40) }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={report.byCategory.map((c) => ({ ...c, costPKR: Math.floor(c.totalCost / 100) }))} layout="vertical" margin={{ top: 4, right: 40, left: 4, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e8e4df" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11, fill: "#9b8f89" }} tickFormatter={(v: number) => `${(v / 1000).toFixed(0)}k`} />
                    <YAxis dataKey="category" type="category" tick={{ fontSize: 12, fill: "#4a3f3a" }} width={110} />
                    <Tooltip formatter={(v) => [`PKR ${Number(v).toLocaleString("en-PK")}`, "Cost"]} cursor={{ fill: "#f5f2ed" }} />
                    <Bar dataKey="costPKR" radius={[0, 4, 4, 0]}>
                      {report.byCategory.map((_, i) => (
                        <Cell key={i} fill={BAR_COLORS[i % BAR_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {/* Item table */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Item Breakdown</h2>
              <p className="text-[12.5px] text-ink-mute mt-0.5">Sorted by cost descending</p>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Item Name</th>
                    <th className={thCls}>Category</th>
                    <th className={thRightCls}>Qty Consumed</th>
                    <th className={thRightCls}>Unit</th>
                    <th className={thRightCls}>Total Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.length === 0 ? (
                    <tr><td className={tdCls} colSpan={5}>No consumption data in this period.</td></tr>
                  ) : report.items.map((item) => (
                    <tr key={item.itemId}>
                      <td className={tdCls}><span className="font-semibold">{item.itemName}</span></td>
                      <td className={tdCls}>{item.category}</td>
                      <td className={tdRightCls}>{item.totalQuantity}</td>
                      <td className={tdRightCls}>{item.unit}</td>
                      <td className={tdRightCls} style={{ color: TONE.pine.fg, fontWeight: 600 }}>{formatPKR(item.totalCost)}</td>
                    </tr>
                  ))}
                  {report.items.length > 0 && (
                    <tr className="bg-mist">
                      <td className={`${tdCls} font-bold`} colSpan={4}>Total</td>
                      <td className={`${tdRightCls} font-bold`}>{formatPKR(report.summary.totalCost)}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
