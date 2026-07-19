import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet } from "lucide-react";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportSourceOfBusinessToExcel } from "@/lib/exportExcel";

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

const SOURCE_LABELS: Record<string, string> = {
  WALK_IN: "Walk-In", PHONE: "Phone", WHATSAPP: "WhatsApp",
  DIRECT_WEBSITE: "Direct Website", BOOKING_COM: "Booking.com",
  AGODA: "Agoda", EXPEDIA: "Expedia", AIRBNB: "Airbnb",
  BOOKME_PK: "Bookme.pk", SASTATICKET_PK: "SastaTicket.pk",
  TRAVEL_AGENT: "Travel Agent", OTA_OTHER: "Other OTA",
};

const PIE_COLORS = [
  TONE.pine.fg, TONE.coral.fg, TONE.amber.fg, TONE.clay.fg,
  "#5B4B82", "#2c455c", "#86600F", "#aa4432", "#2F7256", "#e04b22", "#6b6461", "#9b8f89",
];

export default function SourceOfBusinessPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: rows, isLoading } = useQuery({
    queryKey: ["report-source-of-business", startDate, endDate],
    queryFn: () => reportsService.getSourceOfBusiness(startDate, endDate),
  });

  function apply(s: string, e: string) {
    setSearchParams({ startDate: s, endDate: e });
  }

  const totalRevenue = rows?.reduce((s, r) => s + r.revenue, 0) ?? 0;
  const totalBookings = rows?.reduce((s, r) => s + r.count, 0) ?? 0;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">Source of Business</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {rows && (
            <button
              onClick={() => exportSourceOfBusinessToExcel(rows, startDate, endDate)}
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
      ) : !rows ? null : (
        <div className="space-y-6">
          {/* Summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="mt-0">
                <div className="serif text-[28px] leading-none text-ink tnum">{totalBookings.toLocaleString("en-PK")}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Bookings · {rows.length} sources</div>
              </div>
            </Card>
            <Card>
              <div className="mt-0">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(totalRevenue)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Revenue</div>
              </div>
            </Card>
          </div>

          {/* Donut chart + table */}
          {rows.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2">
                <Card pad={false}>
                  <div className="p-5 pb-2">
                    <h2 className="serif text-[17px] text-ink">Revenue Mix</h2>
                  </div>
                  <div style={{ height: 280 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={rows.map((r) => ({ name: SOURCE_LABELS[r.source] ?? r.source, value: r.revenue }))}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          dataKey="value"
                        >
                          {rows.map((_, i) => (
                            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(v) => [formatPKR(Number(v)), "Revenue"]} />
                        <Legend iconType="circle" iconSize={8} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </div>

              <div className="lg:col-span-3">
                <Card pad={false}>
                  <div className="p-5 pb-3">
                    <h2 className="serif text-[17px] text-ink">Breakdown by Source</h2>
                  </div>
                  <div className="overflow-x-auto px-5 pb-5">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className={thCls}>Source</th>
                          <th className={thRightCls}>Bookings</th>
                          <th className={thRightCls}>Revenue</th>
                          <th className={thRightCls}>%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r, i) => (
                          <tr key={r.source}>
                            <td className={tdCls}>
                              <div className="flex items-center gap-2">
                                <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="font-semibold">{SOURCE_LABELS[r.source] ?? r.source}</span>
                              </div>
                            </td>
                            <td className={tdRightCls}>{r.count}</td>
                            <td className={tdRightCls}>{formatPKR(r.revenue)}</td>
                            <td className={tdRightCls}>
                              <span style={{ color: TONE.pine.fg, fontWeight: 600 }}>{r.percentageOfTotal}%</span>
                            </td>
                          </tr>
                        ))}
                        <tr className="bg-mist">
                          <td className={`${tdCls} font-bold`}>Total</td>
                          <td className={`${tdRightCls} font-bold`}>{totalBookings}</td>
                          <td className={`${tdRightCls} font-bold`}>{formatPKR(totalRevenue)}</td>
                          <td className={`${tdRightCls} font-bold`}>100%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* Extended table */}
          {rows.length > 0 && (
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[18px] text-ink leading-tight">Full Breakdown</h2>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Source</th>
                      <th className={thRightCls}>Bookings</th>
                      <th className={thRightCls}>Room-Nights</th>
                      <th className={thRightCls}>Revenue</th>
                      <th className={thRightCls}>Avg Booking Value</th>
                      <th className={thRightCls}>% of Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.source}>
                        <td className={tdCls}><span className="font-semibold">{SOURCE_LABELS[r.source] ?? r.source}</span></td>
                        <td className={tdRightCls}>{r.count}</td>
                        <td className={tdRightCls}>{r.roomNights}</td>
                        <td className={tdRightCls}>{formatPKR(r.revenue)}</td>
                        <td className={tdRightCls}>{formatPKR(r.avgBookingValue)}</td>
                        <td className={tdRightCls}>{r.percentageOfTotal}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {rows.length === 0 && (
            <Card>
              <div className="py-8 text-center text-[14px] text-ink-mute">No bookings found for this period.</div>
            </Card>
          )}
        </div>
      )}
    </>
  );
}
