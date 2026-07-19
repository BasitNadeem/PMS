import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Wallet } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportPaymentMethodsToExcel } from "@/lib/exportExcel";

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

const METHOD_LABELS: Record<string, string> = {
  CASH: "Cash",
  JAZZCASH: "JazzCash",
  EASYPAISA: "Easypaisa",
  BANK_TRANSFER: "Bank Transfer",
  CREDIT_CARD: "Credit Card",
  DEBIT_CARD: "Debit Card",
  CHEQUE: "Cheque",
  ADVANCE_DEPOSIT: "Advance Deposit",
  OTA_COLLECT: "OTA Collect",
  COMPLIMENTARY: "Complimentary",
};

const METHOD_COLORS: string[] = [
  TONE.coral.dot,
  TONE.pine.dot,
  TONE.slate.dot,
  TONE.amber.dot,
  TONE.dusk.dot,
  TONE.clay.dot,
  TONE.ink.dot,
  "#6B9E7A",
  "#A07040",
  "#7B8FA1",
];

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const thRightCls = "text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";
const tdRightCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft text-right tnum";

const inputCls = "h-10 rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

export default function PaymentMethodsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-payment-methods", startDate, endDate],
    queryFn: () => reportsService.getPaymentMethods(startDate, endDate),
  });

  function apply(s: string, e: string) {
    setSearchParams({ startDate: s, endDate: e });
  }

  const activeMethods = report?.methods.filter((m) => m.count > 0) ?? [];

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">Payment Method Breakdown</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportPaymentMethodsToExcel(report, startDate, endDate)}
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
      ) : !report ? null : (
        <div className="space-y-6">
          {/* KPI */}
          <Card>
            <div className="flex items-start gap-3">
              <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.coral.bg, color: TONE.coral.fg }}>
                <Wallet size={20} />
              </span>
            </div>
            <div className="mt-4">
              <div className="serif text-[32px] leading-none text-ink tnum">{formatPKR(report.total)}</div>
              <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Collected</div>
              <div className="text-[12px] text-ink-mute">{activeMethods.reduce((s, m) => s + m.count, 0)} transactions · {activeMethods.length} payment method{activeMethods.length !== 1 ? "s" : ""}</div>
            </div>
          </Card>

          {/* Donut + legend */}
          {activeMethods.length > 0 && (
            <Card>
              <h2 className="serif text-[18px] text-ink leading-tight mb-5">Distribution</h2>
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="shrink-0">
                  <ResponsiveContainer width={200} height={200}>
                    <PieChart>
                      <Pie
                        data={activeMethods}
                        dataKey="amount"
                        cx={100}
                        cy={100}
                        innerRadius={62}
                        outerRadius={90}
                        paddingAngle={2}
                        startAngle={90}
                        endAngle={-270}
                      >
                        {activeMethods.map((_, i) => (
                          <Cell key={i} fill={METHOD_COLORS[i % METHOD_COLORS.length]} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: unknown) => [formatPKR(Number(v)), "Amount"]}
                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E8E3DC" }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="text-center -mt-2">
                    <div className="serif text-[20px] text-ink leading-none tnum">{formatPKR(report.total)}</div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint mt-0.5">Total</div>
                  </div>
                </div>

                <div className="flex-1 w-full space-y-2">
                  {activeMethods.map((m, i) => (
                    <div key={m.method} className="flex items-center gap-3">
                      <span
                        className="h-3 w-3 rounded-full shrink-0"
                        style={{ background: METHOD_COLORS[i % METHOD_COLORS.length] }}
                      />
                      <span className="text-[13.5px] font-semibold text-ink flex-1">{METHOD_LABELS[m.method] ?? m.method}</span>
                      <span className="text-[13px] text-ink-mute tnum">{m.count} txn{m.count !== 1 ? "s" : ""}</span>
                      <span className="text-[13.5px] text-ink tnum font-semibold">{formatPKR(m.amount)}</span>
                      <span className="text-[12px] text-ink-faint tnum w-10 text-right">{m.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          )}

          {/* Table */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Method Detail</h2>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Payment Method</th>
                    <th className={thRightCls}>Transactions</th>
                    <th className={thRightCls}>Amount</th>
                    <th className={thRightCls}>% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {activeMethods.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-[13px] text-ink-faint italic">
                        No payments recorded in this period
                      </td>
                    </tr>
                  ) : activeMethods.map((m, i) => (
                    <tr key={m.method}>
                      <td className={tdCls}>
                        <div className="flex items-center gap-2">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: METHOD_COLORS[i % METHOD_COLORS.length] }} />
                          <span className="font-semibold">{METHOD_LABELS[m.method] ?? m.method}</span>
                        </div>
                      </td>
                      <td className={tdRightCls}>{m.count}</td>
                      <td className={tdRightCls}>{formatPKR(m.amount)}</td>
                      <td className={tdRightCls}>{m.percentage}%</td>
                    </tr>
                  ))}
                  {activeMethods.length > 0 && (
                    <tr className="bg-mist">
                      <td className={`${tdCls} font-bold`}>Total</td>
                      <td className={`${tdRightCls} font-bold`}>{activeMethods.reduce((s, m) => s + m.count, 0)}</td>
                      <td className={`${tdRightCls} font-bold`} style={{ color: TONE.coral.fg }}>{formatPKR(report.total)}</td>
                      <td className={`${tdRightCls} font-bold`}>100%</td>
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
