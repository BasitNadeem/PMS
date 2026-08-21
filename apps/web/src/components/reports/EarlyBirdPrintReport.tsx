import type { EarlyBirdReport } from "@/services/reports";

const money = (paisas: number) => `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
const date = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const shortDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-PK", { day: "numeric", month: "short" });
const label = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

type Row = { label: string; value: string; warning?: boolean };

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return <section className="early-bird-document-section"><h2>{title}</h2><table><tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th><td className={row.warning ? "early-bird-document-warning" : undefined}>{row.value}</td></tr>)}</tbody></table></section>;
}

export function EarlyBirdPrintReport({ report }: { report: EarlyBirdReport }) {
  const snapshot = report.closedDay.snapshot;
  const paymentRows = Object.entries(snapshot.payments.byMethod).map(([method, totals]) => ({ label: `${label(method)} (${totals.transactions})`, value: money(totals.net), warning: totals.net < 0 }));
  const forecastRows = report.outlook.days.slice(0, 10);

  return <article className="early-bird-document">
    <header className="early-bird-document-header">
      <div><p>INNFLO · MANAGER MORNING REPORT</p><h1>Early Bird Report</h1><span>Prepared for {date(report.reportDate)}</span></div>
      <div className="early-bird-document-meta"><span>{report.hotelName}</span><strong>Closed business day: {date(report.closedDay.businessDate)}</strong><span>Audit revision {report.closedDay.auditRevision}</span></div>
    </header>

    {report.auditReversedAt && <p className="early-bird-document-alert">The source Night Audit was reversed. This archived report is retained for the audit trail.</p>}

    <div className="early-bird-document-metrics">
      <div><span>Occupancy</span><strong>{snapshot.occupancy.occupancyRate.toFixed(1)}%</strong><small>{snapshot.occupancy.roomsSold}/{snapshot.occupancy.sellableRooms} sellable</small></div>
      <div><span>ADR</span><strong>{money(snapshot.occupancy.adr)}</strong><small>Per occupied room</small></div>
      <div><span>RevPAR</span><strong>{money(snapshot.occupancy.revpar)}</strong><small>Per sellable room</small></div>
      <div><span>Revenue</span><strong>{money(snapshot.revenue.totalFolioRevenue)}</strong><small>{money(snapshot.revenue.roomRevenue)} rooms</small></div>
      <div><span>Collected</span><strong>{money(snapshot.revenue.totalCollected)}</strong><small>{money(snapshot.payments.refunded)} refunded</small></div>
      <div><span>Outstanding</span><strong>{money(snapshot.revenue.outstanding)}</strong><small>{snapshot.reconciliation.openFolios} open folios</small></div>
    </div>

    <div className="early-bird-document-grid">
      <Section title={`Revenue · business day ${report.closedDay.businessDate}`} rows={[
        { label: "Rooms", value: money(snapshot.revenue.roomRevenue) },
        { label: "POS", value: money(snapshot.revenue.posRevenue) },
        { label: "QR ordering", value: money(snapshot.revenue.qrRevenue) },
        { label: "Taxes", value: money(snapshot.revenue.taxes) },
        { label: "Discounts / rebates", value: `${money(snapshot.revenue.discounts)} / ${money(snapshot.revenue.rebates)}` },
        { label: "Expenses", value: money(snapshot.revenue.expenses) },
      ]} />
      <Section title="Payments & Balance Book" rows={[
        ...(paymentRows.length ? paymentRows : [{ label: "Payments", value: "None" }]),
        { label: "Balance Book incoming", value: money(snapshot.balanceBook.incoming) },
        { label: "Balance Book outgoing", value: money(snapshot.balanceBook.outgoing) },
        { label: "Balance Book net", value: money(snapshot.balanceBook.net), warning: snapshot.balanceBook.net < 0 },
      ]} />
      <Section title="Closed-day movements" rows={[
        { label: "Arrivals / actual check-ins", value: `${snapshot.reservations.arrivals} / ${snapshot.reservations.actualCheckIns}` },
        { label: "Departures / actual check-outs", value: `${snapshot.reservations.departures} / ${snapshot.reservations.actualCheckOuts}` },
        { label: "Stayovers", value: String(snapshot.reservations.stayovers) },
        { label: "Cancellations / no-shows", value: `${snapshot.reservations.cancellations} / ${snapshot.reservations.noShows}`, warning: snapshot.reservations.noShows > 0 },
      ]} />
      <Section title={`Operating day · ${report.reportDate}`} rows={[
        { label: "Arrivals / departures", value: `${report.today.arrivals.length} / ${report.today.departures.length}` },
        { label: "Stayovers", value: String(report.today.stayovers) },
        { label: "Open housekeeping", value: String(report.today.housekeeping.length), warning: report.today.housekeeping.length > 0 },
        { label: "Open maintenance", value: String(report.today.maintenance.length), warning: report.today.maintenance.length > 0 },
        { label: "Low-stock items", value: String(report.today.lowStock.length), warning: report.today.lowStock.length > 0 },
        { label: "Outstanding follow-up", value: `${report.today.outstandingSummary.count} / ${money(report.today.outstandingSummary.total)}`, warning: report.today.outstandingSummary.total > 0 },
      ]} />
    </div>

    <section className="early-bird-document-forecast"><h2>{forecastRows.length}-day forward outlook</h2><table><thead><tr><th>Date</th><th>Arrivals</th><th>Departures</th><th>Sold</th><th>Available</th><th>Occupancy</th><th>Expected revenue</th></tr></thead><tbody>{forecastRows.map((day) => <tr key={day.date}><td>{shortDate(day.date)}</td><td>{day.arrivals}</td><td>{day.departures}</td><td>{day.roomsSold}</td><td>{day.availableRooms}</td><td>{day.occupancyRate.toFixed(1)}%</td><td>{money(day.expectedRoomRevenue)}</td></tr>)}</tbody></table></section>

    <footer>Frozen Night Audit data plus the morning operating outlook · Generated {new Date(report.generatedAt).toLocaleString("en-PK")}</footer>
  </article>;
}
