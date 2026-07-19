import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportLowStockReorderToExcel } from "@/lib/exportExcel";

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const thRightCls = "text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";
const tdRightCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft text-right tnum";

const URGENCY_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  critical: { label: "Critical", color: "#c0392b", bg: "#c0392b18" },
  high:     { label: "High",     color: TONE.amber.fg, bg: TONE.amber.bg },
  medium:   { label: "Medium",   color: TONE.clay.fg,  bg: TONE.clay.bg },
};

export default function LowStockReorderPage() {
  const { data: report, isLoading } = useQuery({
    queryKey: ["report-low-stock-reorder"],
    queryFn: () => reportsService.getLowStockReorder(),
    staleTime: 60_000,
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">Low Stock / Reorder</h1>

        <div className="ml-auto">
          {report && (
            <button
              onClick={() => exportLowStockReorderToExcel(report)}
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-9 w-9 rounded-xl" style={{ background: "#c0392b18", color: "#c0392b" }}>
                  <AlertTriangle size={18} />
                </span>
              </div>
              <div className="mt-3">
                <div className="serif text-[24px] leading-none tnum" style={{ color: "#c0392b" }}>{report.summary.critical}</div>
                <div className="mt-1 text-[12px] font-semibold text-ink-soft">Critical (out of stock)</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-9 w-9 rounded-xl" style={{ background: TONE.amber.bg, color: TONE.amber.fg }}>
                  <AlertTriangle size={18} />
                </span>
              </div>
              <div className="mt-3">
                <div className="serif text-[24px] leading-none tnum" style={{ color: TONE.amber.fg }}>{report.summary.high}</div>
                <div className="mt-1 text-[12px] font-semibold text-ink-soft">High Urgency</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-9 w-9 rounded-xl" style={{ background: TONE.clay.bg, color: TONE.clay.fg }}>
                  <AlertTriangle size={18} />
                </span>
              </div>
              <div className="mt-3">
                <div className="serif text-[24px] leading-none tnum" style={{ color: TONE.clay.fg }}>{report.summary.medium}</div>
                <div className="mt-1 text-[12px] font-semibold text-ink-soft">Medium Urgency</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-9 w-9 rounded-xl bg-mist text-ink-soft">
                  <AlertTriangle size={18} />
                </span>
              </div>
              <div className="mt-3">
                <div className="serif text-[24px] leading-none text-ink tnum">{formatPKR(report.summary.estimatedReorderCost)}</div>
                <div className="mt-1 text-[12px] font-semibold text-ink-soft">Est. Reorder Cost</div>
              </div>
            </Card>
          </div>

          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Items Requiring Reorder</h2>
              <p className="text-[12.5px] text-ink-mute mt-0.5">Sorted by urgency. Est. cost = (par level − current stock) × cost per unit.</p>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Item</th>
                    <th className={thCls}>Category</th>
                    <th className={thRightCls}>Current</th>
                    <th className={thRightCls}>Reorder At</th>
                    <th className={thRightCls}>Par Level</th>
                    <th className={thRightCls}>Unit</th>
                    <th className={thCls}>Urgency</th>
                    <th className={thRightCls}>Est. Cost</th>
                    <th className={thCls}>Supplier</th>
                  </tr>
                </thead>
                <tbody>
                  {report.items.length === 0 ? (
                    <tr>
                      <td className={tdCls} colSpan={9}>
                        <div className="py-4 text-center text-ink-mute">All items are sufficiently stocked.</div>
                      </td>
                    </tr>
                  ) : report.items.map((item) => {
                    const urg = URGENCY_STYLE[item.urgency];
                    return (
                      <tr key={item.itemId}>
                        <td className={tdCls}><span className="font-semibold">{item.itemName}</span></td>
                        <td className={tdCls}>{item.category}</td>
                        <td className={tdRightCls}>
                          <span style={{ color: item.currentStock === 0 ? "#c0392b" : TONE.amber.fg, fontWeight: 700 }}>{item.currentStock}</span>
                        </td>
                        <td className={tdRightCls}>{item.reorderLevel}</td>
                        <td className={tdRightCls}>{item.parLevel}</td>
                        <td className={tdRightCls}>{item.unit}</td>
                        <td className={tdCls}>
                          <span className="inline-block text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: urg.bg, color: urg.color }}>
                            {urg.label}
                          </span>
                        </td>
                        <td className={tdRightCls} style={{ color: TONE.clay.fg, fontWeight: 600 }}>{formatPKR(item.estimatedReorderCost)}</td>
                        <td className={tdCls}>{item.supplier ?? <span className="text-ink-mute">—</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
