import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, AlertCircle, Clock, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService, type OutstandingFolioEntry } from "@/services/reports";
import { exportOutstandingBalancesToExcel } from "@/lib/exportExcel";

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const thRightCls = "text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";
const tdRightCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft text-right tnum";

interface BucketTableProps {
  entries: OutstandingFolioEntry[];
  label: string;
  totalBalance: number;
  accentColor?: string;
}

function BucketTable({ entries, label, totalBalance, accentColor }: BucketTableProps) {
  if (entries.length === 0) return null;

  return (
    <Card pad={false}>
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <span
            className="inline-block text-[11px] font-bold uppercase tracking-wide px-2.5 py-0.5 rounded-full mb-1.5"
            style={{ background: accentColor ? `${accentColor}18` : "#f5f2ed", color: accentColor ?? "#6b6461" }}
          >
            {label}
          </span>
          <div className="text-[13px] font-semibold text-ink-mute">{entries.length} folio{entries.length !== 1 ? "s" : ""}</div>
        </div>
        <div className="text-right">
          <div className="serif text-[22px] text-ink tnum" style={{ color: accentColor ?? undefined }}>
            {formatPKR(totalBalance)}
          </div>
          <div className="text-[11px] text-ink-faint">outstanding</div>
        </div>
      </div>
      <div className="overflow-x-auto px-5 pb-5">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className={thCls}>Guest</th>
              <th className={thCls}>Room</th>
              <th className={thCls}>Confirmation #</th>
              <th className={thCls}>Checkout Date</th>
              <th className={thRightCls}>Days</th>
              <th className={thRightCls}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.confirmationNumber}>
                <td className={tdCls}><span className="font-semibold">{e.guestName}</span></td>
                <td className={tdCls}>{e.roomNumber || "—"}</td>
                <td className={tdCls}><span className="font-mono text-xs text-ink-mute">{e.confirmationNumber}</span></td>
                <td className={tdCls}>{e.checkOutDate}</td>
                <td className={tdRightCls} style={{ color: accentColor ?? undefined }}>{e.daysOutstanding}</td>
                <td className={`${tdRightCls} font-semibold`} style={{ color: accentColor ?? undefined }}>
                  {formatPKR(e.balance)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default function OutstandingBalancesPage() {
  const { data: report, isLoading } = useQuery({
    queryKey: ["report-outstanding-balances"],
    queryFn: () => reportsService.getOutstandingBalances(),
    staleTime: 60_000,
  });

  const generatedAt = new Date().toLocaleString("en-PK");

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">Outstanding Balances</h1>
        <span className="text-[12px] text-ink-faint ml-1">Snapshot as of {generatedAt}</span>
        <div className="ml-auto">
          {report && (
            <button
              onClick={() => exportOutstandingBalancesToExcel(report)}
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
          {/* Summary KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="flex items-start justify-between">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.amber.bg, color: TONE.amber.fg }}>
                  <Clock size={20} />
                </span>
                <span className="text-[11px] font-bold text-ink-faint">0–7 Days</span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.totals.current)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{report.buckets.current.length} folio{report.buckets.current.length !== 1 ? "s" : ""}</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.clay.bg, color: TONE.clay.fg }}>
                  <AlertCircle size={20} />
                </span>
                <span className="text-[11px] font-bold text-ink-faint">8–30 Days</span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none tnum" style={{ color: report.totals.aging30 > 0 ? TONE.clay.fg : undefined }}>
                  {formatPKR(report.totals.aging30)}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{report.buckets.aging30.length} folio{report.buckets.aging30.length !== 1 ? "s" : ""}</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start justify-between">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-red-50" style={{ color: "#c0392b" }}>
                  <AlertTriangle size={20} />
                </span>
                <span className="text-[11px] font-bold text-ink-faint">30+ Days</span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none tnum" style={{ color: report.totals.aging30plus > 0 ? "#c0392b" : undefined }}>
                  {formatPKR(report.totals.aging30plus)}
                </div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{report.buckets.aging30plus.length} folio{report.buckets.aging30plus.length !== 1 ? "s" : ""}</div>
              </div>
            </Card>
          </div>

          {/* Grand total banner */}
          {report.grandTotal > 0 && (
            <div
              className="flex items-center justify-between rounded-2xl px-6 py-4 border"
              style={{
                background: report.totals.aging30plus > 0 ? "#fef2f2" : "#fff9f0",
                borderColor: report.totals.aging30plus > 0 ? "#fecaca" : "#fde68a",
              }}
            >
              <div className="flex items-center gap-2">
                <AlertCircle size={16} style={{ color: report.totals.aging30plus > 0 ? "#c0392b" : TONE.amber.fg }} />
                <span className="text-[14px] font-bold" style={{ color: report.totals.aging30plus > 0 ? "#c0392b" : TONE.amber.fg }}>
                  Total Outstanding
                </span>
              </div>
              <span className="serif text-[24px] tnum" style={{ color: report.totals.aging30plus > 0 ? "#c0392b" : TONE.amber.fg }}>
                {formatPKR(report.grandTotal)}
              </span>
            </div>
          )}

          {report.grandTotal === 0 && (
            <Card>
              <div className="py-8 text-center">
                <div className="text-[32px] mb-2">✓</div>
                <div className="text-[16px] font-semibold text-pine mb-1">No outstanding balances</div>
                <div className="text-[13px] text-ink-mute">All folios are settled.</div>
              </div>
            </Card>
          )}

          {/* Bucket tables */}
          <BucketTable
            entries={report.buckets.aging30plus}
            label="30+ Days"
            totalBalance={report.totals.aging30plus}
            accentColor="#c0392b"
          />
          <BucketTable
            entries={report.buckets.aging30}
            label="8–30 Days"
            totalBalance={report.totals.aging30}
            accentColor={TONE.clay.fg}
          />
          <BucketTable
            entries={report.buckets.current}
            label="0–7 Days"
            totalBalance={report.totals.current}
            accentColor={TONE.amber.fg}
          />
        </div>
      )}
    </>
  );
}
