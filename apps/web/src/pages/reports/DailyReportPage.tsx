import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Printer, ArrowLeft, FileSpreadsheet,
  BedDouble, Banknote, LogIn, LogOut, Wallet, AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { reportsService, type DailyArrival, type DailyDeparture, type DailyStayOver, type ExpenseCategory } from "@/services/reports";
import { exportDailyReportExcel } from "@/lib/exportExcel";

// ── helpers ───────────────────────────────────────────────────────────────────

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

function formatLongDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

function offsetDate(dateStr: string, days: number): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: "Cash",
  card: "Card",
  jazzcash: "JazzCash",
  easypaisa: "Easypaisa",
  bankTransfer: "Bank Transfer",
  other: "Other",
};

// ── shared bits ──────────────────────────────────────────────────────────────

function SectionHeading({ title, sub }: { title: string; sub?: string }) {
  return (
    <div className="mb-4">
      <h2 className="serif text-[20px] text-ink leading-tight">{title}</h2>
      {sub && <p className="text-[12.5px] text-ink-mute mt-0.5">{sub}</p>}
    </div>
  );
}

interface KpiCardProps {
  icon: React.ElementType;
  toneName: keyof typeof TONE;
  label: string;
  value: string;
  sub?: string;
}

function KpiCard({ icon: Icon, toneName, label, value, sub }: KpiCardProps) {
  const t = TONE[toneName];
  return (
    <Card>
      <div className="flex items-start justify-between">
        <span className="grid place-items-center h-10 w-10 rounded-xl" style={{ background: t.bg, color: t.fg }}>
          <Icon size={20} />
        </span>
      </div>
      <div className="mt-4">
        <div className="serif text-[32px] leading-none text-ink tnum">{value}</div>
        <div className="mt-1.5 text-[13px] font-semibold text-ink-soft">{label}</div>
        {sub && <div className="text-[12px] text-ink-mute">{sub}</div>}
      </div>
    </Card>
  );
}

function StatTile({ label, value, toneName }: { label: string; value: string; toneName?: keyof typeof TONE }) {
  const t = toneName ? TONE[toneName] : null;
  return (
    <div className="rounded-xl border border-line bg-mist p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-1 text-[20px] font-bold tnum" style={{ color: t ? t.fg : "#2b2722" }}>{value}</div>
    </div>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="py-6 text-center text-[13px] text-ink-faint italic">{label}</td>
    </tr>
  );
}

const thCls = "text-left py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const thRightCls = "text-right py-2.5 px-3 text-[11px] font-bold uppercase tracking-wide text-ink-faint border-b border-line";
const tdCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft";
const tdRightCls = "py-2.5 px-3 text-[13.5px] text-ink border-b border-line-soft text-right tnum";

// ── tables ───────────────────────────────────────────────────────────────────

function ArrivalsTable({ rows }: { rows: DailyArrival[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className={thCls}>Confirmation</th>
          <th className={thCls}>Guest</th>
          <th className={thCls}>Room</th>
          <th className={thCls}>Nights</th>
          <th className={thCls}>Status</th>
          <th className={thRightCls}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <EmptyRow colSpan={6} label="No arrivals today" />
          : rows.map((r) => (
            <tr key={r.confirmationNumber}>
              <td className={tdCls}><span className="font-mono text-xs text-ink-mute">{r.confirmationNumber}</span></td>
              <td className={tdCls}><span className="font-semibold">{r.guestName}</span></td>
              <td className={tdCls}>{r.roomNumber || "—"}</td>
              <td className={tdCls}>{r.nights}</td>
              <td className={tdCls}>{r.status}</td>
              <td className={tdRightCls}>{formatPKR(r.amount)}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function DeparturesTable({ rows }: { rows: DailyDeparture[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className={thCls}>Confirmation</th>
          <th className={thCls}>Guest</th>
          <th className={thCls}>Room</th>
          <th className={thCls}>Nights</th>
          <th className={thRightCls}>Charged</th>
          <th className={thRightCls}>Paid</th>
          <th className={thRightCls}>Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <EmptyRow colSpan={7} label="No departures today" />
          : rows.map((r) => (
            <tr key={r.confirmationNumber}>
              <td className={tdCls}><span className="font-mono text-xs text-ink-mute">{r.confirmationNumber}</span></td>
              <td className={tdCls}><span className="font-semibold">{r.guestName}</span></td>
              <td className={tdCls}>{r.roomNumber || "—"}</td>
              <td className={tdCls}>{r.nights}</td>
              <td className={tdRightCls}>{formatPKR(r.totalCharged)}</td>
              <td className={tdRightCls}>{formatPKR(r.totalPaid)}</td>
              <td className={tdRightCls}>
                <span className={r.balance > 0 ? "font-semibold" : ""} style={r.balance > 0 ? { color: TONE.clay.fg } : undefined}>
                  {formatPKR(r.balance)}
                </span>
              </td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function StayOversTable({ rows }: { rows: DailyStayOver[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className={thCls}>Confirmation</th>
          <th className={thCls}>Guest</th>
          <th className={thCls}>Room</th>
          <th className={thCls}>Check-out Date</th>
          <th className={thRightCls}>Nights Remaining</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <EmptyRow colSpan={5} label="No stay-overs today" />
          : rows.map((r) => (
            <tr key={r.confirmationNumber}>
              <td className={tdCls}><span className="font-mono text-xs text-ink-mute">{r.confirmationNumber}</span></td>
              <td className={tdCls}><span className="font-semibold">{r.guestName}</span></td>
              <td className={tdCls}>{r.roomNumber || "—"}</td>
              <td className={tdCls}>
                {new Intl.DateTimeFormat("en-PK", { dateStyle: "medium" }).format(new Date(r.checkOutDate))}
              </td>
              <td className={tdRightCls}>{r.nightsRemaining}</td>
            </tr>
          ))}
      </tbody>
    </table>
  );
}

function ExpensesTable({ rows, total }: { rows: ExpenseCategory[]; total: number }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr>
          <th className={thCls}>Category</th>
          <th className={thRightCls}>Count</th>
          <th className={thRightCls}>Amount</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0
          ? <EmptyRow colSpan={3} label="No expenses recorded today" />
          : rows.map((c) => (
            <tr key={c.category}>
              <td className={tdCls}>{c.category.replace(/_/g, " ")}</td>
              <td className={tdRightCls}>{c.count}</td>
              <td className={tdRightCls}>{formatPKR(c.amount)}</td>
            </tr>
          ))}
        {rows.length > 0 && (
          <tr>
            <td className={`${tdCls} font-bold`}>Total</td>
            <td className={tdRightCls}></td>
            <td className={`${tdRightCls} font-bold`}>{formatPKR(total)}</td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export default function DailyReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

  const { data: report, isLoading } = useQuery({
    queryKey: ["report-daily", date],
    queryFn: () => reportsService.getDailyReport(date),
  });

  function navDate(delta: number) {
    setSearchParams({ date: offsetDate(date, delta) });
  }

  const generatedAt = new Date().toLocaleString("en-PK");

  return (
    <>
      {/* Print CSS */}
      <style>{`
        @media print {
          /* ── page setup ── */
          @page { margin: 16mm 14mm; size: A4; }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
          }
          body, html { background: #fff !important; }

          /* ── hide chrome ── */
          .no-print { display: none !important; }
          aside { display: none !important; }
          .lg\\:hidden { display: none !important; }

          /* ── layout: full-width content ── */
          .flex.min-h-screen { display: block !important; }
          .flex-1.min-w-0.flex.flex-col { display: block !important; width: 100% !important; }
          main { overflow: visible !important; height: auto !important; display: block !important; }
          main > div { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
          .scroll-area { overflow: visible !important; }

          /* ── spacing ── */
          .space-y-7 > * + * { margin-top: 13pt !important; }
          .gap-4 { gap: 8pt !important; }
          .gap-3 { gap: 6pt !important; }
          .gap-2 { gap: 4pt !important; }
          .mb-6 { margin-bottom: 0 !important; }
          .p-5 { padding: 10pt !important; }
          .px-5.pb-5 { padding: 0 8pt 8pt !important; }
          .p-5.pb-0 { padding: 10pt 10pt 0 !important; }

          /* ── cards → clean bordered boxes ── */
          .bg-card { background: #fff !important; border: 0.75pt solid #c8c0b8 !important; border-radius: 5pt !important; }
          .bg-mist { background: #f5f2ed !important; }
          .bg-paper { background: #fff !important; }
          .border-line { border-color: #c8c0b8 !important; }
          .border-line-soft { border-color: #e4ddd6 !important; }

          /* ── section heading ── */
          .serif { font-family: Georgia, 'Times New Roman', serif !important; }

          /* ── tables ── */
          table { border-collapse: collapse !important; width: 100%; font-size: 9pt; page-break-inside: avoid; }
          tr { page-break-inside: avoid; }
          th { font-size: 7.5pt !important; padding: 4pt 6pt !important; background: #f0ece6 !important; }
          td { font-size: 9pt !important; padding: 3.5pt 6pt !important; }
          .overflow-x-auto { overflow: visible !important; }

          /* ── stat tiles ── */
          .rounded-xl.border.border-line.bg-mist {
            background: #f0ece6 !important;
            border: 0.6pt solid #c8c0b8 !important;
            border-radius: 4pt !important;
            padding: 6pt !important;
          }

          /* ── section breaks ── */
          .print-section { page-break-inside: avoid !important; margin-bottom: 11pt !important; }

          /* ── hide decorative animated elements ── */
          .anim-fade-up { animation: none !important; opacity: 1 !important; }
        }
      `}</style>

      {/* Action bar */}
      <div className="no-print mb-6 flex flex-wrap items-center gap-3">
        <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
          <ArrowLeft size={15} /> Back to Reports
        </Link>
        <span className="text-line">|</span>
        <span className="text-[14px] font-semibold text-ink">{formatLongDate(date)}</span>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={() => navDate(-1)} className="flex items-center gap-1 text-[13px] font-semibold text-ink-soft hover:text-ink border border-line rounded-full px-3.5 py-2 hover:bg-line-soft transition-colors">
            <ChevronLeft size={14} /> Previous Day
          </button>
          <button onClick={() => navDate(1)} className="flex items-center gap-1 text-[13px] font-semibold text-ink-soft hover:text-ink border border-line rounded-full px-3.5 py-2 hover:bg-line-soft transition-colors">
            Next Day <ChevronRight size={14} />
          </button>
          {report && (
            <button
              onClick={() => exportDailyReportExcel(report)}
              className="flex items-center gap-2 text-[13px] font-semibold text-ink-soft hover:text-ink border border-line rounded-full px-3.5 py-2 hover:bg-line-soft transition-colors"
            >
              <FileSpreadsheet size={14} /> Export Excel
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-coral hover:bg-coral-dark text-white text-[13px] font-semibold px-4 py-2 rounded-full transition-colors"
          >
            <Printer size={14} /> Print / PDF
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-line-soft rounded-xl2 animate-pulse" />
          ))}
        </div>
      ) : !report ? null : (
        <div className="space-y-7">
          {/* Report header */}
          <div className="print-section pb-5 border-b border-line">
            <div className="mb-1.5 text-[12px] font-bold uppercase tracking-[0.14em] text-coral">Daily Operations Report</div>
            <h1 className="serif text-[34px] leading-[1.05] text-ink">{report.hotel.name}</h1>
            <p className="mt-1.5 text-[15px] text-ink-mute">
              {formatLongDate(date)}
              {report.hotel.city ? ` · ${report.hotel.city}` : ""}
              {report.hotel.phone ? ` · ${report.hotel.phone}` : ""}
            </p>
            <p className="text-[12px] text-ink-faint mt-1">Generated: {generatedAt}</p>
          </div>

          {/* At a Glance */}
          <div className="print-section">
            <SectionHeading title="At a Glance" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <KpiCard icon={BedDouble} toneName="pine" label="Occupancy Rate" value={`${report.occupancy.occupancyRate}%`} sub={`${report.occupancy.occupied}/${report.occupancy.totalRooms} rooms`} />
              <KpiCard icon={Banknote} toneName="coral" label="Total Collected" value={formatPKR(report.revenue.totalCollected)} />
              <KpiCard icon={LogIn} toneName="slate" label="Check-ins" value={String(report.occupancy.checkIns)} sub={`${report.arrivals.length} arrivals expected`} />
              <KpiCard icon={LogOut} toneName="amber" label="Check-outs" value={String(report.occupancy.checkOuts)} sub={`${report.departures.length} departures expected`} />
            </div>
          </div>

          {/* Occupancy Breakdown */}
          <Card className="print-section">
            <SectionHeading title="Occupancy Breakdown" />
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
              <StatTile label="Total Rooms" value={String(report.occupancy.totalRooms)} />
              <StatTile label="Occupied" value={String(report.occupancy.occupied)} toneName="coral" />
              <StatTile label="Available" value={String(report.occupancy.available)} toneName="pine" />
              <StatTile label="Check-ins" value={String(report.occupancy.checkIns)} />
              <StatTile label="Check-outs" value={String(report.occupancy.checkOuts)} />
              <StatTile label="Stay-overs" value={String(report.occupancy.stayOvers)} />
            </div>
          </Card>

          {/* Revenue & Payments */}
          <Card className="print-section">
            <SectionHeading title="Revenue & Payments" />
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
              <StatTile label="Room Revenue" value={formatPKR(report.revenue.roomRevenue)} />
              <StatTile label="POS Revenue" value={formatPKR(report.revenue.posRevenue)} />
              <StatTile label="Other Charges" value={formatPKR(report.revenue.otherCharges)} />
              <StatTile label="Total Charged" value={formatPKR(report.revenue.totalCharged)} />
              <StatTile label="Total Collected" value={formatPKR(report.revenue.totalCollected)} toneName="pine" />
              <StatTile label="Outstanding" value={formatPKR(report.revenue.outstanding)} toneName="clay" />
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(report.revenue.byMethod).map(([key, amount]) => (
                <span key={key} className="text-[12.5px] font-semibold bg-mist border border-line text-ink-soft px-3 py-1.5 rounded-full">
                  {PAYMENT_METHOD_LABELS[key] ?? key}: {formatPKR(amount)}
                </span>
              ))}
            </div>
          </Card>

          {/* Arrivals */}
          <Card className="print-section" pad={false}>
            <div className="p-5 pb-0">
              <SectionHeading title="Arrivals" sub={`${report.arrivals.length} expected · ${report.occupancy.checkIns} checked in`} />
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <ArrivalsTable rows={report.arrivals} />
            </div>
          </Card>

          {/* Departures */}
          <Card className="print-section" pad={false}>
            <div className="p-5 pb-0">
              <SectionHeading title="Departures" sub={`${report.departures.length} expected · ${report.occupancy.checkOuts} checked out`} />
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <DeparturesTable rows={report.departures} />
            </div>
          </Card>

          {/* Stay-overs */}
          <Card className="print-section" pad={false}>
            <div className="p-5 pb-0">
              <SectionHeading title="Stay-overs" sub={`${report.stayOvers.length} guests continuing their stay`} />
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <StayOversTable rows={report.stayOvers} />
            </div>
          </Card>

          {/* Expenses */}
          <Card className="print-section" pad={false}>
            <div className="p-5 pb-0">
              <SectionHeading title="Expenses" sub="Recorded against today's date" />
            </div>
            <div className="overflow-x-auto px-5 pb-5">
              <ExpensesTable rows={report.expenses.byCategory} total={report.expenses.total} />
            </div>
          </Card>

          {/* Operations Snapshot */}
          <Card className="print-section">
            <SectionHeading title="Operations Snapshot" />
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-faint mb-2">Housekeeping</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile label="Total Tasks" value={String(report.operations.housekeeping.totalTasks)} />
                  <StatTile label="Completed" value={String(report.operations.housekeeping.completed)} toneName="pine" />
                  <StatTile label="Pending" value={String(report.operations.housekeeping.pending)} toneName="amber" />
                  <StatTile label="Checkout Cleans" value={String(report.operations.housekeeping.checkoutCleans)} />
                </div>
              </div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-faint mb-2">Maintenance</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile label="Open Tickets" value={String(report.operations.maintenance.openTickets)} />
                  <StatTile label="Urgent Open" value={String(report.operations.maintenance.urgentOpen)} toneName="clay" />
                  <StatTile label="Resolved Today" value={String(report.operations.maintenance.resolvedToday)} toneName="pine" />
                  <StatTile label="New Today" value={String(report.operations.maintenance.newToday)} />
                </div>
              </div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-faint mb-2">Groups</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile label="Active Groups" value={String(report.operations.groups.activeGroups)} />
                  <StatTile label="Group Check-ins" value={String(report.operations.groups.groupCheckIns)} />
                  <StatTile label="Group Check-outs" value={String(report.operations.groups.groupCheckOuts)} />
                </div>
              </div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-wide text-ink-faint mb-2">POS</div>
                <div className="grid grid-cols-2 gap-2">
                  <StatTile label="Total Orders" value={String(report.operations.pos.totalOrders)} />
                  <StatTile label="Revenue" value={formatPKR(report.operations.pos.totalRevenue)} />
                  <StatTile label="Posted to Room" value={String(report.operations.pos.postedToRoom)} />
                  <StatTile label="Direct Payments" value={String(report.operations.pos.directPayments)} />
                </div>
              </div>
            </div>
          </Card>

          {/* Cash Variance */}
          {report.cashVariance && (
            <Card className="print-section">
              <SectionHeading title="Cash Variance" sub="Cash drawer reconciliation for today" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <StatTile label="Expected Cash" value={formatPKR(report.cashVariance.expectedCash)} />
                <StatTile label="Ledger Balance" value={formatPKR(report.cashVariance.ledgerBalance)} />
                <StatTile
                  label="Variance"
                  value={formatPKR(report.cashVariance.variance)}
                  toneName={report.cashVariance.variance === 0 ? "pine" : "clay"}
                />
              </div>
              {report.cashVariance.variance !== 0 && (
                <div className="mt-3 flex items-center gap-2 text-[12.5px] font-semibold" style={{ color: TONE.clay.fg }}>
                  <AlertCircle size={14} /> Discrepancy detected — please reconcile the cash drawer.
                </div>
              )}
            </Card>
          )}

          {/* Footer */}
          <div className="border-t border-line pt-4">
            <p className="text-[11px] text-ink-faint text-center">
              Confidential — {report.hotel.name} · Generated {generatedAt}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
