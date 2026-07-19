import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, Star, Users } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportRepeatGuestsToExcel } from "@/lib/exportExcel";

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const thRightCls = "text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";
const tdRightCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft text-right tnum";
const inputCls = "h-10 rounded-xl bg-mist border border-line px-3.5 text-sm text-ink outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 transition-all";

const TROPHY_COLORS = ["#B8860B", "#888888", "#C05A28"];

export default function RepeatGuestsPage() {
  const [minStays, setMinStays] = useState(2);
  const [committed, setCommitted] = useState(2);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-repeat-guests", committed],
    queryFn: () => reportsService.getRepeatGuests(committed),
  });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">Repeat Guests / VIP Report</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">Min stays</label>
          <input
            type="number"
            min={1}
            max={99}
            value={minStays}
            onChange={(e) => setMinStays(Math.max(1, Number(e.target.value)))}
            onKeyDown={(e) => e.key === "Enter" && setCommitted(minStays)}
            className={`${inputCls} w-20 text-center`}
          />
          <button
            onClick={() => setCommitted(minStays)}
            className="h-10 px-4 rounded-xl bg-coral text-white text-[13px] font-semibold hover:bg-coral-deep transition-colors"
          >
            Apply
          </button>
          {report && (
            <button
              onClick={() => exportRepeatGuestsToExcel(report, committed)}
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
            <div key={i} className="h-32 bg-line-soft rounded-xl animate-pulse" />
          ))}
        </div>
      ) : !report ? null : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.amber.bg, color: TONE.amber.fg }}>
                  <Users size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{report.total.toLocaleString("en-PK")}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">
                  Repeat Guests with {committed}+ stays
                  {report.total > 50 && <span className="text-ink-faint"> (showing top 50)</span>}
                </div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                  <Star size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(report.totalRevenue)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Revenue from Repeat Guests</div>
              </div>
            </Card>
          </div>

          {/* Table */}
          <Card pad={false}>
            <div className="p-5 pb-3">
              <h2 className="serif text-[18px] text-ink leading-tight">Top Guests by Spend</h2>
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className={thCls}>Rank</th>
                    <th className={thCls}>Guest Name</th>
                    <th className={thRightCls}>Total Stays</th>
                    <th className={thRightCls}>Total Spend</th>
                    <th className={thRightCls}>Avg / Stay</th>
                    <th className={thCls}>Last Stay</th>
                  </tr>
                </thead>
                <tbody>
                  {report.guests.length === 0 ? (
                    <tr>
                      <td className={tdCls} colSpan={6}>No guests with {committed}+ stays found.</td>
                    </tr>
                  ) : report.guests.map((g, i) => (
                    <tr key={g.id} className={i < 3 ? "bg-amber-soft/30" : undefined}>
                      <td className={tdCls}>
                        {i < 3 ? (
                          <Star size={16} fill={TROPHY_COLORS[i]} color={TROPHY_COLORS[i]} />
                        ) : (
                          <span className="text-[12px] text-ink-faint font-semibold">{i + 1}</span>
                        )}
                      </td>
                      <td className={tdCls}><span className="font-semibold">{g.fullName}</span></td>
                      <td className={tdRightCls}>{g.totalStays}</td>
                      <td className={tdRightCls} style={{ color: TONE.pine.fg, fontWeight: 600 }}>{formatPKR(g.totalSpend)}</td>
                      <td className={tdRightCls}>{formatPKR(g.avgSpendPerStay)}</td>
                      <td className={tdCls}>{g.lastStayDate ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
