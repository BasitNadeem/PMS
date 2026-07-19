import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, XCircle, RotateCcw, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportVoidRefundLogToExcel } from "@/lib/exportExcel";

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

function localIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function thirtyDaysAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const thRightCls = "text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";
const tdRightCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft text-right tnum";

const inputCls = "h-10 rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

export default function VoidRefundLogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? thirtyDaysAgo();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-void-refund-log", startDate, endDate],
    queryFn: () => reportsService.getVoidRefundLog(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Void & Refund Log</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportVoidRefundLogToExcel(report, startDate, endDate)}
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
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-start justify-between">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: "#fff3e0", color: "#e65100" }}>
                  <XCircle size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none tnum" style={{ color: report.totalVoids > 0 ? "#e65100" : undefined }}>
                  {formatPKR(report.totalVoids)}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">
                  Total Voids · {report.entries.filter((e) => e.type === "VOID").length} item{report.entries.filter((e) => e.type === "VOID").length !== 1 ? "s" : ""}
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: "#ffeaea", color: "#c0392b" }}>
                  <RotateCcw size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none tnum" style={{ color: report.totalRefunds > 0 ? "#c0392b" : undefined }}>
                  {formatPKR(report.totalRefunds)}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">
                  Total Refunds · {report.entries.filter((e) => e.type === "REFUND").length} item{report.entries.filter((e) => e.type === "REFUND").length !== 1 ? "s" : ""}
                </div>
              </div>
            </Card>
          </div>

          {/* Empty state */}
          {report.entries.length === 0 && (
            <Card>
              <div className="py-10 text-center">
                <CheckCircle className="mx-auto mb-3" size={32} style={{ color: TONE.pine.fg }} />
                <div className="text-[15px] font-semibold" style={{ color: TONE.pine.fg }}>
                  No voids or refunds in this period
                </div>
                <div className="text-[13px] text-ink-mute mt-1">Clean period — no manual adjustments recorded.</div>
              </div>
            </Card>
          )}

          {/* Log table */}
          {report.entries.length > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Audit Log</h2>
                <p className="text-[12.5px] text-ink-mute mt-0.5">{report.entries.length} entr{report.entries.length !== 1 ? "ies" : "y"}, newest first</p>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Date</th>
                      <th className={thCls}>Type</th>
                      <th className={thCls}>Description</th>
                      <th className={thRightCls}>Amount</th>
                      <th className={thCls}>Reservation</th>
                      <th className={thCls}>Performed By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.entries.map((e, i) => (
                      <tr key={i}>
                        <td className={tdCls}>
                          <div className="text-[12.5px] font-semibold text-ink">
                            {new Date(e.date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
                          </div>
                          <div className="text-[11px] text-ink-faint">
                            {new Date(e.date).toLocaleTimeString("en-PK", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </td>
                        <td className={tdCls}>
                          <span
                            className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                            style={
                              e.type === "VOID"
                                ? { background: "#fff3e0", color: "#e65100" }
                                : { background: "#ffeaea", color: "#c0392b" }
                            }
                          >
                            {e.type === "VOID" ? <XCircle size={10} /> : <RotateCcw size={10} />}
                            {e.type}
                          </span>
                        </td>
                        <td className={tdCls}>
                          <div className="font-semibold">{e.description}</div>
                          {e.notes && <div className="text-[11.5px] text-ink-mute mt-0.5">{e.notes}</div>}
                        </td>
                        <td className={tdRightCls}>
                          <span style={{ color: e.type === "VOID" ? "#e65100" : "#c0392b" }}>
                            {formatPKR(e.amount)}
                          </span>
                        </td>
                        <td className={tdCls}>
                          {e.reservationConfirmation
                            ? <span className="font-mono text-xs text-ink-mute">{e.reservationConfirmation}</span>
                            : <span className="text-ink-faint">—</span>}
                        </td>
                        <td className={tdCls}>{e.performedBy}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
