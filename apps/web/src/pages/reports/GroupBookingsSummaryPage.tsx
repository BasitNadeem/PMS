import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportGroupBookingsSummaryToExcel } from "@/lib/exportExcel";

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

export default function GroupBookingsSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-group-bookings-summary", startDate, endDate],
    queryFn: () => reportsService.getGroupBookingsSummary(startDate, endDate),
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
        <h1 className="serif text-[20px] text-ink">Group Bookings Summary</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {report && (
            <button
              onClick={() => exportGroupBookingsSummaryToExcel(report, startDate, endDate)}
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
                  <Users size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.totalGroups}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Groups</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.coral.bg, color: TONE.coral.fg }}>
                  <Users size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.summary.totalRoomNights.toLocaleString("en-PK")}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Room-Nights</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl bg-mist text-ink-soft">
                  <Users size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.summary.totalRevenue)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Revenue</div>
              </div>
            </Card>
          </div>

          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Group Breakdown</h2>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Group Name</th>
                    <th className={thCls}>Operator / Payer</th>
                    <th className={thRightCls}>Reservations</th>
                    <th className={thRightCls}>Room-Nights</th>
                    <th className={thRightCls}>Revenue</th>
                    <th className={thRightCls}>Avg / Room-Night</th>
                  </tr>
                </thead>
                <tbody>
                  {report.groups.length === 0 ? (
                    <tr><td className={tdCls} colSpan={6}>No group bookings in this period.</td></tr>
                  ) : report.groups.map((g) => (
                    <tr key={g.groupId}>
                      <td className={tdCls}><span className="font-semibold">{g.groupName}</span></td>
                      <td className={tdCls}>{g.operatorName}</td>
                      <td className={tdRightCls}>{g.reservationCount}</td>
                      <td className={tdRightCls}>{g.roomNights}</td>
                      <td className={tdRightCls} style={{ color: TONE.pine.fg, fontWeight: 600 }}>{formatPKR(g.totalRevenue)}</td>
                      <td className={tdRightCls}>{formatPKR(g.avgRevenuePerRoom)}</td>
                    </tr>
                  ))}
                  {report.groups.length > 0 && (
                    <tr className="bg-mist">
                      <td className={`${tdCls} font-bold`} colSpan={2}>Total</td>
                      <td className={tdRightCls}></td>
                      <td className={`${tdRightCls} font-bold`}>{report.summary.totalRoomNights}</td>
                      <td className={`${tdRightCls} font-bold`}>{formatPKR(report.summary.totalRevenue)}</td>
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
