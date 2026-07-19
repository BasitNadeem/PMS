import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, ShieldAlert, CheckCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportGuestBlacklistToExcel } from "@/lib/exportExcel";

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";

const SEVERITY_CONFIG: Record<number, { label: string; bg: string; color: string }> = {
  1: { label: "Low", bg: TONE.amber.bg, color: TONE.amber.fg },
  2: { label: "Medium", bg: TONE.clay.bg, color: TONE.clay.fg },
};

function severityConfig(s: number) {
  return SEVERITY_CONFIG[s] ?? { label: "High", bg: "#fef2f2", color: "#c0392b" };
}

export default function GuestBlacklistPage() {
  const generatedAt = new Date().toLocaleString("en-PK");

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-guest-blacklist"],
    queryFn: () => reportsService.getGuestBlacklistReport(),
    staleTime: 60_000,
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">Guest Blacklist Report</h1>
        <span className="text-[12px] text-ink-faint ml-1">Snapshot as of {generatedAt}</span>

        <div className="ml-auto">
          {report && report.total > 0 && (
            <button
              onClick={() => exportGuestBlacklistToExcel(report)}
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: "#fef2f2", color: "#c0392b" }}>
                  <ShieldAlert size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.total}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Entries</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.amber.bg, color: TONE.amber.fg }}>
                  <ShieldAlert size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.bySeverity.low}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Low Severity</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.clay.bg, color: TONE.clay.fg }}>
                  <ShieldAlert size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.bySeverity.medium}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Medium Severity</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: "#fef2f2", color: "#c0392b" }}>
                  <ShieldAlert size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.bySeverity.high}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">High Severity</div>
              </div>
            </Card>
          </div>

          {/* Empty state */}
          {report.total === 0 && (
            <Card>
              <div className="py-10 text-center">
                <CheckCircle className="mx-auto mb-3" size={32} style={{ color: TONE.pine.fg }} />
                <div className="text-[15px] font-semibold" style={{ color: TONE.pine.fg }}>No blacklisted guests</div>
                <div className="text-[13px] text-ink-mute mt-1">The blacklist is currently empty.</div>
              </div>
            </Card>
          )}

          {/* Table */}
          {report.total > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Blacklist Entries</h2>
                <p className="text-[12.5px] text-ink-mute mt-0.5">Sorted by severity (highest first)</p>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Guest</th>
                      <th className={thCls}>Phone</th>
                      <th className={thCls}>Document #</th>
                      <th className={thCls}>Severity</th>
                      <th className={thCls}>Reason</th>
                      <th className={thCls}>Blacklisted On</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.entries.map((e, i) => {
                      const cfg = severityConfig(e.severity);
                      return (
                        <tr key={i} style={e.severity >= 3 ? { background: "#fef7f7" } : undefined}>
                          <td className={tdCls}><span className="font-semibold">{e.guestName}</span></td>
                          <td className={tdCls}>{e.phone ?? "—"}</td>
                          <td className={tdCls}>
                            {e.documentNumber ? (
                              <span className="font-mono text-xs text-ink-mute">{e.documentNumber}</span>
                            ) : "—"}
                          </td>
                          <td className={tdCls}>
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: cfg.bg, color: cfg.color }}
                            >
                              <ShieldAlert size={9} /> {cfg.label}
                            </span>
                          </td>
                          <td className={tdCls}>{e.reason}</td>
                          <td className={tdCls}>{e.blacklistedAt}</td>
                        </tr>
                      );
                    })}
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
