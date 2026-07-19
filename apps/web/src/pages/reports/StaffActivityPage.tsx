import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, ChevronDown, ChevronRight, Activity } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportStaffActivityToExcel } from "@/lib/exportExcel";

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

export default function StaffActivityPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-staff-activity", startDate, endDate],
    queryFn: () => reportsService.getStaffActivity(startDate, endDate),
  });

  function apply(s: string, e: string) {
    setSearchParams({ startDate: s, endDate: e });
  }

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">Staff Activity</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportStaffActivityToExcel(report, startDate, endDate)}
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
          {/* Summary */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Actions", value: report.summary.totalActions, tone: TONE.pine },
              { label: "Creates", value: report.summary.creates, tone: TONE.pine },
              { label: "Updates", value: report.summary.updates, tone: TONE.amber },
              { label: "Deletes", value: report.summary.deletes, tone: TONE.clay },
            ].map(({ label, value, tone }) => (
              <Card key={label}>
                <div className="flex items-start">
                  <span className="grid place-items-center h-9 w-9 rounded-xl" style={{ background: tone.bg, color: tone.fg }}>
                    <Activity size={18} />
                  </span>
                </div>
                <div className="mt-3">
                  <div className="serif text-[24px] leading-none text-ink tnum">{value.toLocaleString("en-PK")}</div>
                  <div className="mt-1 text-[12px] font-semibold text-ink-soft">{label}</div>
                </div>
              </Card>
            ))}
          </div>

          {/* Staff table with expandable rows */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Staff Breakdown</h2>
              <p className="text-[12.5px] text-ink-mute mt-0.5">Click a row to see recent entries</p>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls} style={{ width: 28 }}></th>
                    <th className={thCls}>Staff Member</th>
                    <th className={thRightCls}>Total</th>
                    <th className={thRightCls}>Creates</th>
                    <th className={thRightCls}>Updates</th>
                    <th className={thRightCls}>Deletes</th>
                    <th className={thCls}>Top Entity</th>
                  </tr>
                </thead>
                <tbody>
                  {report.staff.length === 0 ? (
                    <tr><td className={tdCls} colSpan={7}>No activity in this period.</td></tr>
                  ) : report.staff.map((s) => {
                    const key = s.staffId ?? s.staffName;
                    const isOpen = expanded.has(key);
                    return (
                      <>
                        <tr
                          key={key}
                          className="cursor-pointer hover:bg-mist transition-colors"
                          onClick={() => toggle(key)}
                        >
                          <td className={tdCls}>
                            {isOpen ? <ChevronDown size={14} className="text-ink-faint" /> : <ChevronRight size={14} className="text-ink-faint" />}
                          </td>
                          <td className={tdCls}><span className="font-semibold">{s.staffName}</span></td>
                          <td className={tdRightCls} style={{ color: TONE.pine.fg, fontWeight: 700 }}>{s.totalActions}</td>
                          <td className={tdRightCls}>{s.creates}</td>
                          <td className={tdRightCls}>{s.updates}</td>
                          <td className={tdRightCls} style={{ color: s.deletes > 0 ? TONE.clay.fg : undefined }}>{s.deletes}</td>
                          <td className={tdCls}>
                            {s.topEntity ? (
                              <span className="text-[12px] font-mono bg-mist px-1.5 py-0.5 rounded">{s.topEntity}</span>
                            ) : "—"}
                          </td>
                        </tr>
                        {isOpen && s.recentEntries.length > 0 && (
                          <tr key={`${key}-detail`}>
                            <td colSpan={7} className="bg-mist px-5 pb-3 pt-1">
                              <p className="text-[11px] font-bold uppercase tracking-wide text-ink-faint mb-2 mt-1">Recent Entries</p>
                              <div className="space-y-1">
                                {s.recentEntries.map((e, i) => (
                                  <div key={i} className="flex items-center gap-3 text-[12.5px]">
                                    <span className="text-ink-faint tnum">{new Date(e.createdAt).toLocaleString("en-PK", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                                    <span className="font-mono text-[11px] bg-line px-1.5 py-0.5 rounded text-ink-soft">{e.action}</span>
                                    <span className="text-ink-mute">{e.entity}</span>
                                  </div>
                                ))}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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
