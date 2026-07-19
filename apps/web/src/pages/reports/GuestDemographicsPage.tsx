import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Globe } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportGuestDemographicsToExcel } from "@/lib/exportExcel";

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

const NAT_COLORS = [
  TONE.pine.fg, TONE.coral.fg, TONE.amber.fg, TONE.clay.fg,
  "#5B4B82", "#2c455c", "#86600F", "#aa4432", "#2F7256", "#e04b22", "#9b8f89",
];

const TYPE_COLORS = [TONE.pine.fg, TONE.coral.fg, TONE.amber.fg, TONE.clay.fg];

const GUEST_TYPE_LABELS: Record<string, string> = {
  INDIVIDUAL: "Individual", GROUP: "Group",
  CORPORATE: "Corporate", TOUR_OPERATOR: "Tour Operator",
};

export default function GuestDemographicsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-guest-demographics", startDate, endDate],
    queryFn: () => reportsService.getGuestDemographics(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Nationality / Guest Type Mix</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportGuestDemographicsToExcel(report, startDate, endDate)}
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
            <div key={i} className="h-32 bg-line-soft rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !report ? null : (
        <div className="space-y-6">
          {/* Summary card */}
          <Card>
            <div className="flex items-start gap-3">
              <span className="grid place-items-center h-10 w-10 rounded-xl shrink-0" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                <Globe size={20} />
              </span>
              <div>
                <div className="serif text-[28px] leading-none text-ink tnum">{report.total.toLocaleString("en-PK")}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">
                  Total Reservations ·&nbsp;
                  <span style={{ color: TONE.pine.fg }}>{report.localVsForeign.localCount} local</span>
                  &nbsp;·&nbsp;
                  <span style={{ color: TONE.coral.fg }}>{report.localVsForeign.foreignCount} foreign</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Two donut charts side by side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Nationality donut */}
            <Card pad={false}>
              <div className="p-5 pb-2">
                <h2 className="serif text-[17px] text-ink">Nationality Mix</h2>
              </div>
              {report.byNationality.length === 0 ? (
                <div className="px-5 pb-5 text-[13px] text-ink-mute">No nationality data for this period.</div>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.byNationality.map((n) => ({ name: n.nationality, value: n.count }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        dataKey="value"
                      >
                        {report.byNationality.map((_, i) => (
                          <Cell key={i} fill={NAT_COLORS[i % NAT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [v, "Guests"]} />
                      <Legend iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>

            {/* Guest type donut */}
            <Card pad={false}>
              <div className="p-5 pb-2">
                <h2 className="serif text-[17px] text-ink">Guest Type Mix</h2>
              </div>
              {report.byGuestType.length === 0 ? (
                <div className="px-5 pb-5 text-[13px] text-ink-mute">No guest type data for this period.</div>
              ) : (
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={report.byGuestType.map((t) => ({
                          name: GUEST_TYPE_LABELS[t.type] ?? t.type,
                          value: t.count,
                        }))}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        dataKey="value"
                      >
                        {report.byGuestType.map((_, i) => (
                          <Cell key={i} fill={TYPE_COLORS[i % TYPE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => [v, "Reservations"]} />
                      <Legend iconType="circle" iconSize={8} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </Card>
          </div>

          {/* Nationality table */}
          {report.byNationality.length > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Nationality Breakdown</h2>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Nationality</th>
                      <th className={thRightCls}>Guests</th>
                      <th className={thRightCls}>%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.byNationality.map((n, i) => (
                      <tr key={n.nationality}>
                        <td className={tdCls}>
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: NAT_COLORS[i % NAT_COLORS.length] }} />
                            <span className="font-semibold">{n.nationality}</span>
                          </div>
                        </td>
                        <td className={tdRightCls}>{n.count}</td>
                        <td className={tdRightCls}>{n.percentage}%</td>
                      </tr>
                    ))}
                    <tr className="bg-mist">
                      <td className={`${tdCls} font-bold`}>Total</td>
                      <td className={`${tdRightCls} font-bold`}>{report.total}</td>
                      <td className={`${tdRightCls} font-bold`}>100%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {report.total === 0 && (
            <Card>
              <div className="py-8 text-center text-[14px] text-ink-mute">No reservations found for this period.</div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
