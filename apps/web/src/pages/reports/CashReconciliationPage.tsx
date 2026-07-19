import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, AlertCircle, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportCashReconciliationToExcel } from "@/lib/exportExcel";

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

export default function CashReconciliationPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-cash-reconciliation", startDate, endDate],
    queryFn: () => reportsService.getCashReconciliation(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Cash / Bank Reconciliation</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportCashReconciliationToExcel(report, startDate, endDate)}
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
      ) : !report ? null : !report.available ? (
        <Card>
          <div className="flex items-start gap-4 py-4">
            <span className="grid place-items-center h-12 w-12 rounded-2xl bg-amber-soft text-amber shrink-0">
              <AlertCircle size={22} />
            </span>
            <div>
              <div className="text-[16px] font-bold text-ink mb-1">Balance Book data unavailable</div>
              <div className="text-[13.5px] text-ink-mute">
                {report.error}. Please check your Cash Book setup in the Balance Book section.
              </div>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                  <TrendingUp size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.totals.incoming)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Incoming</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.clay.bg, color: TONE.clay.fg }}>
                  <TrendingDown size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.totals.outgoing)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Outgoing</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span
                  className="grid place-items-center h-10 w-10 rounded-xl"
                  style={
                    report.totals.netFlow >= 0
                      ? { background: TONE.pine.bg, color: TONE.pine.fg }
                      : { background: TONE.clay.bg, color: TONE.clay.fg }
                  }
                >
                  {report.totals.netFlow === 0 ? <Minus size={20} /> : report.totals.netFlow > 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
                </span>
              </div>
              <div className="mt-4">
                <div
                  className="serif text-[28px] leading-none tnum"
                  style={{ color: report.totals.netFlow >= 0 ? TONE.pine.fg : TONE.clay.fg }}
                >
                  {formatPKR(report.totals.netFlow)}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Net Flow</div>
              </div>
            </Card>
          </div>

          {/* Per-account breakdown */}
          {report.accounts.length > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Account Breakdown</h2>
                <p className="text-[12.5px] text-ink-mute mt-0.5">Flows per cash/bank account for the selected period</p>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Account</th>
                      <th className={thCls}>Type</th>
                      <th className={thRightCls}>Incoming</th>
                      <th className={thRightCls}>Outgoing</th>
                      <th className={thRightCls}>Net Flow</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.accounts.map((a) => (
                      <tr key={a.name}>
                        <td className={tdCls}><span className="font-semibold">{a.name}</span></td>
                        <td className={tdCls}>
                          <span className="text-[11.5px] font-semibold text-ink-faint">{a.type.replace(/_/g, " ")}</span>
                        </td>
                        <td className={tdRightCls} style={{ color: TONE.pine.fg }}>{formatPKR(a.incoming)}</td>
                        <td className={tdRightCls} style={{ color: TONE.clay.fg }}>{formatPKR(a.outgoing)}</td>
                        <td className={tdRightCls}>
                          <span style={{ color: a.netFlow >= 0 ? TONE.pine.fg : TONE.clay.fg, fontWeight: 600 }}>
                            {formatPKR(a.netFlow)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-mist">
                      <td className={`${tdCls} font-bold`} colSpan={2}>Total</td>
                      <td className={`${tdRightCls} font-bold`} style={{ color: TONE.pine.fg }}>{formatPKR(report.totals.incoming)}</td>
                      <td className={`${tdRightCls} font-bold`} style={{ color: TONE.clay.fg }}>{formatPKR(report.totals.outgoing)}</td>
                      <td className={`${tdRightCls} font-bold`} style={{ color: report.totals.netFlow >= 0 ? TONE.pine.fg : TONE.clay.fg }}>
                        {formatPKR(report.totals.netFlow)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {report.accounts.length === 0 && (
            <Card>
              <div className="py-8 text-center">
                <div className="text-[14px] font-semibold text-ink-mute">No account activity in this period</div>
                <div className="text-[12.5px] text-ink-faint mt-1">No ledger entries found for the selected date range.</div>
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
