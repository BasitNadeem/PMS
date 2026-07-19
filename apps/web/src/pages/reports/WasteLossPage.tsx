import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportWasteLossToExcel } from "@/lib/exportExcel";

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

function wasteColor(pct: number): string {
  if (pct >= 20) return "#c0392b";
  if (pct >= 10) return TONE.amber.fg;
  return TONE.pine.fg;
}

export default function WasteLossPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-waste-loss", startDate, endDate],
    queryFn: () => reportsService.getWasteLoss(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Waste & Loss</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportWasteLossToExcel(report, startDate, endDate)}
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
            <div key={i} className="h-28 bg-line-soft rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !report ? null : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.clay.bg, color: TONE.clay.fg }}>
                  <Trash2 size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.summary.totalCostLost)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Cost Lost</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft">
                  <Trash2 size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">
                  {report.summary.totalWasteItems} <span className="text-[18px]">items</span>
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Items with Waste Recorded</div>
              </div>
            </Card>
          </div>

          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Waste Breakdown</h2>
              <p className="text-[12.5px] text-ink-mute mt-0.5">
                Waste % = waste qty ÷ (waste + consumption) for the same period. Red ≥ 20%, amber ≥ 10%.
              </p>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Item</th>
                    <th className={thCls}>Category</th>
                    <th className={thRightCls}>Qty Wasted</th>
                    <th className={thRightCls}>Unit</th>
                    <th className={thRightCls}>Cost Lost</th>
                    <th className={thRightCls}>Waste %</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.length === 0 ? (
                    <tr><td className={tdCls} colSpan={6}>No waste recorded in this period.</td></tr>
                  ) : report.items.map((item) => (
                    <tr key={item.itemId}>
                      <td className={tdCls}><span className="font-semibold">{item.itemName}</span></td>
                      <td className={tdCls}>{item.category}</td>
                      <td className={tdRightCls}>{item.wasteQuantity}</td>
                      <td className={tdRightCls}>{item.unit}</td>
                      <td className={tdRightCls} style={{ color: TONE.clay.fg, fontWeight: 600 }}>{formatPKR(item.costLost)}</td>
                      <td className={tdRightCls}>
                        <span style={{ color: wasteColor(item.wastePercentage), fontWeight: 700 }}>{item.wastePercentage}%</span>
                      </td>
                    </tr>
                  ))}
                  {report.items.length > 0 && (
                    <tr className="bg-mist">
                      <td className={`${tdCls} font-bold`} colSpan={4}>Total</td>
                      <td className={`${tdRightCls} font-bold`}>{formatPKR(report.summary.totalCostLost)}</td>
                      <td className={tdRightCls}></td>
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
