import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, FileSpreadsheet, QrCode, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { DatePicker } from "@/components/ui/DatePicker";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService } from "@/services/reports";
import { exportQROrdersToExcel } from "@/lib/exportExcel";
import type { QROrdersReport } from "@/services/reports";

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

const STATUS_COLORS: Record<string, string> = {
  pending: TONE.amber.fg, confirmed: TONE.pine.fg, preparing: "#5B4B82",
  ready: TONE.coral.fg, delivered: "#2F7256", cancelled: "#9b8f89",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? "#9b8f89";
  return (
    <span className="inline-block text-[12px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}18`, color }}>
      {status}
    </span>
  );
}

export default function QROrdersReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const startDate = searchParams.get("startDate") ?? firstOfMonth();
  const endDate = searchParams.get("endDate") ?? localIso();

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-qr-orders", startDate, endDate],
    queryFn: () => reportsService.getQROrders(startDate, endDate),
  });

  function apply(s: string, e: string) {
    setSearchParams({ startDate: s, endDate: e });
  }

  const available = report?.available === true ? (report as Extract<QROrdersReport, { available: true }>) : null;

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <h1 className="serif text-[20px] text-ink">QR Orders</h1>

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <label className="text-[12px] font-semibold text-ink-faint">From</label>
          <DatePicker value={startDate} onChange={(v) => apply(v, endDate)} className="h-10" />
          <label className="text-[12px] font-semibold text-ink-faint">To</label>
          <DatePicker value={endDate} onChange={(v) => apply(startDate, v)} className="h-10" />
          {available && (
            <button
              onClick={() => exportQROrdersToExcel(available, startDate, endDate)}
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
      ) : report?.available === false ? (
        <Card>
          <div className="flex items-center gap-3 py-4">
            <AlertCircle size={20} className="text-ink-faint shrink-0" />
            <div>
              <p className="text-[14px] font-semibold text-ink">QR Orders data unavailable</p>
              <p className="text-[13px] text-ink-mute mt-0.5">{report.error}</p>
            </div>
          </div>
        </Card>
      ) : !available ? null : (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.pine.bg, color: TONE.pine.fg }}>
                  <QrCode size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{available.summary.totalOrders.toLocaleString("en-PK")}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total QR Orders</div>
              </div>
            </Card>
            <Card>
              <div className="flex items-start">
                <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: TONE.coral.bg, color: TONE.coral.fg }}>
                  <QrCode size={20} />
                </span>
              </div>
              <div className="mt-4">
                <div className="serif text-[28px] leading-none text-ink tnum">{formatPKR(available.summary.totalRevenue)}</div>
                <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">Total Revenue</div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* By status */}
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[17px] text-ink">By Status</h2>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Status</th>
                      <th className={thRightCls}>Orders</th>
                      <th className={thRightCls}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {available.byStatus.map((r) => (
                      <tr key={r.status}>
                        <td className={tdCls}><StatusBadge status={r.status} /></td>
                        <td className={tdRightCls} style={{ fontWeight: 600 }}>{r.orderCount}</td>
                        <td className={tdRightCls}>{formatPKR(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* By delivery type */}
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[17px] text-ink">By Delivery Type</h2>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Type</th>
                      <th className={thRightCls}>Orders</th>
                      <th className={thRightCls}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {available.byDeliveryType.map((r) => (
                      <tr key={r.deliveryType}>
                        <td className={tdCls}><span className="font-semibold capitalize">{r.deliveryType.replace(/_/g, " ")}</span></td>
                        <td className={tdRightCls} style={{ fontWeight: 600 }}>{r.orderCount}</td>
                        <td className={tdRightCls}>{formatPKR(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* By payment preference */}
            <Card pad={false}>
              <div className="p-5 pb-3">
                <h2 className="serif text-[17px] text-ink">By Payment Preference</h2>
              </div>
              <div className="overflow-x-auto px-5 pb-5">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th className={thCls}>Preference</th>
                      <th className={thRightCls}>Orders</th>
                      <th className={thRightCls}>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {available.byPaymentPreference.map((r) => (
                      <tr key={r.paymentPreference}>
                        <td className={tdCls}><span className="font-semibold capitalize">{r.paymentPreference.replace(/_/g, " ")}</span></td>
                        <td className={tdRightCls} style={{ fontWeight: 600 }}>{r.orderCount}</td>
                        <td className={tdRightCls}>{formatPKR(r.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
