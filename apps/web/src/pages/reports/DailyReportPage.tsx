import { useQuery } from "@tanstack/react-query";
import { useSearchParams, Link } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Printer, ArrowLeft, FileSpreadsheet,
  BedDouble, Banknote, LogIn, LogOut, AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { TONE } from "@/components/ui/StatusBadge";
import { DatePicker } from "@/components/ui/DatePicker";
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
  // Use noon local time to safely add/subtract days without DST edge cases.
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

function StatTile({ label, value, toneName, sub }: { label: string; value: string; toneName?: keyof typeof TONE; sub?: string }) {
  const t = toneName ? TONE[toneName] : null;
  return (
    <div className="rounded-xl border border-line bg-mist p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{label}</div>
      <div className="mt-1 text-[20px] font-bold tnum" style={{ color: t ? t.fg : "#2b2722" }}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-faint">{sub}</div>}
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
          <th className={thCls}>Res ID</th>
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
          <th className={thCls}>Res ID</th>
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
          <th className={thCls}>Res ID</th>
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

function todayDateStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyReportPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const date = searchParams.get("date") ?? todayDateStr();

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
          /* ── @page: standardised A4 portrait, 1.5 cm margins ── */
          @page { margin: 1.5cm; size: A4; }

          /* ── root height collapse — kills the dead-space gap ──────────────────
             AppLayout structure:
               div.flex.min-h-screen          ← outer root
                 aside.h-screen.sticky        ← sidebar (hidden below)
                 div.flex-1.min-w-0.flex.flex-col  ← inner column
                   main.flex-1.overflow-y-auto  ← THE CULPRIT
                     div.px-5.py-5            ← content wrapper
             flex-1 on <main> = flex:1 1 0%, making it claim full viewport height.
             Setting flex:none + height:auto collapses it to content size.
          ───────────────────────────────────────────────────────────────────── */
          html, body {
            height: auto !important;
            min-height: 0 !important;
            background: #fff !important;
          }
          #root { height: auto !important; min-height: 0 !important; }

          .flex.min-h-screen,
          .flex-1.min-w-0.flex.flex-col {
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
          }

          main {
            display: block !important;
            flex: none !important;
            height: auto !important;
            min-height: 0 !important;
            overflow: visible !important;
          }
          main > div {
            height: auto !important;
            min-height: 0 !important;
            max-width: 100% !important;
            /* Extra bottom padding keeps last content above the fixed footer */
            padding: 0 0 28pt !important;
            margin: 0 !important;
          }

          /* ── print colour & animation reset ── */
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            box-shadow: none !important;
            animation: none !important;
            transition: none !important;
          }

          /* ── hide UI chrome ── */
          .no-print { display: none !important; }
          aside { display: none !important; }
          /* Mobile topbar */
          .lg\\:hidden { display: none !important; }
          /* Desktop search bar has class="hidden lg:flex …"
             lg:flex overrides hidden in screen @media breakpoints;
             in print we force hidden to win. */
          .hidden { display: none !important; }

          /* ── typography: darken muted text for print legibility ── */
          .text-ink-faint { color: #5a5250 !important; }
          .text-ink-mute  { color: #4a3f3a !important; }
          .text-ink-soft  { color: #3a3230 !important; }
          .serif { font-family: Georgia, 'Times New Roman', serif !important; }

          /* ── colours & surfaces ── */
          .bg-paper, .bg-card { background: #fff !important; }
          .bg-mist  { background: #f5f2ed !important; }
          .border-line      { border-color: #c8c0b8 !important; }
          .border-line-soft { border-color: #e4ddd6 !important; }

          /* ── KPI card icon badges: outlined instead of solid fill (toner-friendly) ── */
          .grid.place-items-center.h-10.w-10.rounded-xl {
            background: transparent !important;
            border: 1pt solid currentColor !important;
            opacity: 0.7;
          }

          /* ── stat tiles ── */
          .rounded-xl.border.border-line.bg-mist {
            background: #f0ece6 !important;
            border: 0.6pt solid #c8c0b8 !important;
            border-radius: 4pt !important;
            padding: 6pt !important;
          }

          /* ── spacing ── */
          .space-y-7 > * + * { margin-top: 12pt !important; }
          .gap-4 { gap: 8pt !important; }
          .gap-3 { gap: 6pt !important; }
          .gap-2 { gap: 4pt !important; }
          .p-5 { padding: 10pt !important; }
          .px-5.pb-5 { padding: 0 8pt 8pt !important; }
          .p-5.pb-0  { padding: 10pt 10pt 0 !important; }

          /* ── tables ── */
          .overflow-x-auto { overflow: visible !important; }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
            font-size: 9pt !important;
            page-break-inside: avoid;
          }
          tr { page-break-inside: avoid; }
          th {
            font-size: 7.5pt !important;
            padding: 4pt 6pt !important;
            background: #f0ece6 !important;
            color: #5a5250 !important;
          }
          td { font-size: 9pt !important; padding: 3.5pt 6pt !important; }

          /* ── section page-break control ── */
          .print-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 12pt !important;
          }

          /* ── report header rule ── */
          .pb-5.border-b.border-line {
            border-bottom-width: 1pt !important;
            padding-bottom: 10pt !important;
          }

          /* ── payment method pills ── */
          .text-ink-soft.px-3.py-1\\.5.rounded-full {
            border-color: #c8c0b8 !important;
            background: #f0ece6 !important;
          }

          /* ── running page footer (position:fixed repeats on every printed page) ── */
          .print-page-footer {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            font-size: 7.5pt;
            color: #6b6461;
            padding: 4pt 1.5cm;
            border-top: 0.5pt solid #c8c0b8;
            background: #fff;
          }
        }
      `}</style>

      {/* Action bar */}
      <div className="no-print mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/reports" className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-mute hover:text-ink">
            <ArrowLeft size={15} /> Back to Reports
          </Link>
          <span className="text-line">|</span>

          {/* Date label + calendar picker */}
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-ink">{formatLongDate(date)}</span>
            <DatePicker
              value={date}
              onChange={(v) => v && setSearchParams({ date: v })}
              iconOnly
            />
          </div>

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
        <p className="text-[11.5px] text-ink-faint pl-0.5">
          Tip: In the browser print dialog, disable <strong>Headers and footers</strong> for cleanest output.
        </p>
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
              <KpiCard icon={Banknote} toneName="coral" label="Collected Today" value={formatPKR(report.revenue.totalCollected)} sub="Cash-basis — includes prior-day balances paid today" />
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
              <StatTile label="Folio Charges" value={formatPKR(report.revenue.totalCharged)} sub="Room charges + folio items (excl. direct POS)" />
              <StatTile label="Collected Today" value={formatPKR(report.revenue.totalCollected)} toneName="pine" sub="Cash-basis — includes prior-day balances paid today" />
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

          {/* On-screen footer (hidden in print — the fixed .print-page-footer takes over) */}
          <div className="no-print border-t border-line pt-4">
            <p className="text-[11px] text-ink-faint text-center">
              Confidential — {report.hotel.name} · Generated {generatedAt}
            </p>
          </div>

          {/* Print-only per-page footer — position:fixed repeats on every printed page */}
          <div className="print-page-footer" style={{ display: "none" }} aria-hidden="true">
            <span>Confidential — {report.hotel.name}</span>
            <span>Generated: {generatedAt}</span>
          </div>
        </div>
      )}
    </>
  );
}
