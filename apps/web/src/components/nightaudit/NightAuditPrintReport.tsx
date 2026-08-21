import type { BusinessDaySnapshot, NightAuditRecordDetail } from "@/services/nightAudit";
import { isBusinessDaySnapshot } from "@/services/nightAudit";

const money = (paisas: number) => `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
const date = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" });
const dateTime = (iso: string) => new Date(iso).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Karachi" });
const label = (value: string) => value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

type ReportRow = { label: string; value: string; warning?: boolean };

function Section({ title, rows }: { title: string; rows: ReportRow[] }) {
  return <section className="night-audit-document-section"><h2>{title}</h2><table><tbody>{rows.map((row) => (
    <tr key={row.label}><th scope="row">{row.label}</th><td className={row.warning ? "night-audit-document-warning" : undefined}>{row.value}</td></tr>
  ))}</tbody></table></section>;
}

function Snapshot({ snapshot }: { snapshot: BusinessDaySnapshot }) {
  const expectedCollections = snapshot.payments.reconcilableNetCollected ?? snapshot.payments.netCollected + snapshot.payments.directCollections;
  const postedCollections = snapshot.payments.balanceBookCollectionNet ?? snapshot.payments.balanceBookIncoming;
  const collectionDifference = snapshot.payments.balanceBookDifference ?? expectedCollections - postedCollections;
  const postedExpenses = snapshot.balanceBook.expenseLedgerOutgoing ?? snapshot.balanceBook.expenses;
  const expenseDifference = snapshot.balanceBook.expenseDifference ?? snapshot.balanceBook.expenses - postedExpenses;
  const exceptionCount = snapshot.auditResolution?.exceptionCount ?? snapshot.reconciliation.unresolvedExceptions ?? 0;
  const paymentRows = Object.entries(snapshot.payments.byMethod).sort((a, b) => b[1].net - a[1].net).map(([method, amount]) => ({ label: `${label(method)} (${amount.transactions})`, value: money(amount.net), warning: amount.net < 0 }));

  return <>
    <div className="night-audit-document-metrics">
      <div><span>Occupancy</span><strong>{snapshot.occupancy.occupancyRate.toFixed(1)}%</strong><small>{snapshot.occupancy.roomsSold} of {snapshot.occupancy.sellableRooms} sellable</small></div>
      <div><span>ADR</span><strong>{money(snapshot.occupancy.adr)}</strong><small>Per occupied room</small></div>
      <div><span>RevPAR</span><strong>{money(snapshot.occupancy.revpar)}</strong><small>Per sellable room</small></div>
      <div><span>Net collected</span><strong>{money(snapshot.payments.netCollected + snapshot.payments.directCollections)}</strong><small>{snapshot.balanceBook.entries} Balance Book entries</small></div>
    </div>
    <div className="night-audit-document-grid">
      <Section title="Rooms & movement" rows={[
        { label: "Physical / out of service", value: `${snapshot.occupancy.physicalRooms} / ${snapshot.occupancy.outOfServiceRooms}` },
        { label: "Sellable / occupied / available", value: `${snapshot.occupancy.sellableRooms} / ${snapshot.occupancy.roomsSold} / ${snapshot.occupancy.availableRooms}` },
        { label: "Arrivals / actual check-ins", value: `${snapshot.reservations.arrivals} / ${snapshot.reservations.actualCheckIns}` },
        { label: "Departures / actual check-outs", value: `${snapshot.reservations.departures} / ${snapshot.reservations.actualCheckOuts}` },
        { label: "Stayovers", value: String(snapshot.reservations.stayovers) },
        { label: "Cancellations / no-shows", value: `${snapshot.reservations.cancellations} / ${snapshot.reservations.noShows}`, warning: snapshot.reservations.noShows > 0 },
      ]} />
      <Section title="Revenue" rows={[
        { label: "Room revenue", value: money(snapshot.revenue.roomRevenue) },
        { label: "POS / QR sales", value: `${money(snapshot.revenue.posRevenue)} / ${money(snapshot.revenue.qrRevenue)}` },
        { label: "Taxes", value: money(snapshot.revenue.taxes) },
        { label: "Discounts / rebates", value: `${money(snapshot.revenue.discounts)} / ${money(snapshot.revenue.rebates)}` },
        { label: "Adjustments", value: money(snapshot.revenue.adjustments) },
        { label: "Total folio revenue", value: money(snapshot.revenue.totalFolioRevenue) },
      ]} />
      <Section title="Collections by payment method" rows={[
        ...(paymentRows.length ? paymentRows : [{ label: "Folio payments", value: "None" }]),
        { label: "Direct POS / QR / company", value: money(snapshot.payments.directCollections) },
        { label: "Refunds", value: `−${money(snapshot.payments.refunded)}`, warning: snapshot.payments.refunded > 0 },
      ]} />
      <Section title="Guest & company (BTC)" rows={[
        { label: "Guest responsibility", value: money(snapshot.revenue.guestResponsibility) },
        { label: "Company responsibility", value: money(snapshot.revenue.companyResponsibility) },
        { label: "Transferred to company ledger", value: money(snapshot.companyCredit.transferred) },
        { label: "Company payments", value: money(snapshot.companyCredit.payments) },
        { label: "Guest outstanding", value: money(snapshot.reconciliation.guestOutstanding), warning: snapshot.reconciliation.guestOutstanding > 0 },
        { label: "BTC outstanding on folios", value: money(snapshot.reconciliation.companyOutstanding), warning: snapshot.reconciliation.companyOutstanding > 0 },
      ]} />
      <Section title="Balance Book" rows={[
        { label: "Incoming / outgoing", value: `${money(snapshot.balanceBook.incoming)} / ${money(snapshot.balanceBook.outgoing)}` },
        { label: "Net movement", value: money(snapshot.balanceBook.net), warning: snapshot.balanceBook.net < 0 },
        { label: `Expenses (${snapshot.balanceBook.expenseEntries})`, value: money(snapshot.balanceBook.expenses) },
        { label: "Ledger entries", value: String(snapshot.balanceBook.entries) },
      ]} />
      <Section title="Food, beverage & inventory" rows={[
        { label: "POS orders / sales", value: `${snapshot.foodAndBeverage.pos.orders} / ${money(snapshot.foodAndBeverage.pos.total)}` },
        { label: "QR orders / sales", value: `${snapshot.foodAndBeverage.qr.orders} / ${money(snapshot.foodAndBeverage.qr.total)}` },
        { label: "Unposted POS orders", value: String(snapshot.reconciliation.unpostedPosOrders), warning: snapshot.reconciliation.unpostedPosOrders > 0 },
        { label: "Inventory transactions", value: String(snapshot.inventory?.transactions ?? 0) },
        { label: "Low-stock items", value: String(snapshot.inventory?.lowStock.length ?? 0), warning: (snapshot.inventory?.lowStock.length ?? 0) > 0 },
      ]} />
      <Section title="Operational exceptions" rows={[
        { label: "Dirty rooms", value: String(snapshot.operationalCoverage?.dirtyRooms ?? 0), warning: (snapshot.operationalCoverage?.dirtyRooms ?? 0) > 0 },
        { label: "Out-of-service blocks", value: String(snapshot.operationalCoverage?.outOfServiceRooms.length ?? 0), warning: (snapshot.operationalCoverage?.outOfServiceRooms.length ?? 0) > 0 },
        { label: "Incomplete housekeeping", value: String(snapshot.operationalCoverage?.housekeeping.length ?? 0), warning: (snapshot.operationalCoverage?.housekeeping.length ?? 0) > 0 },
        { label: "Open maintenance", value: String(snapshot.operationalCoverage?.maintenance.length ?? 0), warning: (snapshot.operationalCoverage?.maintenance.length ?? 0) > 0 },
        { label: "Unsigned handovers", value: String(snapshot.operationalCoverage?.unsignedShiftReports.length ?? 0), warning: (snapshot.operationalCoverage?.unsignedShiftReports.length ?? 0) > 0 },
      ]} />
      <Section title="Reconciliation" rows={[
        { label: "Collections → Balance Book", value: collectionDifference === 0 ? "Reconciled" : `${money(Math.abs(collectionDifference))} difference`, warning: collectionDifference !== 0 },
        { label: "Expected / posted collections", value: `${money(expectedCollections)} / ${money(postedCollections)}` },
        { label: "Expenses → Balance Book", value: expenseDifference === 0 ? "Reconciled" : `${money(Math.abs(expenseDifference))} difference`, warning: expenseDifference !== 0 },
        { label: "Open folios / balance", value: `${snapshot.reconciliation.openFolios} / ${money(snapshot.reconciliation.openBalance)}`, warning: snapshot.reconciliation.openFolios > 0 },
        { label: "Audit exceptions", value: String(exceptionCount), warning: exceptionCount > 0 },
      ]} />
    </div>
    {snapshot.auditResolution?.exceptionReason && <section className="night-audit-document-note"><h2>Approved exception note</h2><p>{snapshot.auditResolution.exceptionReason}</p></section>}
  </>;
}

export function NightAuditPrintReport({ record }: { record: NightAuditRecordDetail }) {
  return <article className="night-audit-document">
    <header className="night-audit-document-header"><div><p>INNFLO · NIGHT AUDIT REPORT</p><h1>Closed business day</h1><span>{date(record.businessDate)} · Revision {record.revision}</span></div><div className="night-audit-document-meta"><span>Closed by <strong>{record.runByName}</strong></span><span>{dateTime(record.runAt)}</span></div></header>
    {record.reversedAt && <section className="night-audit-document-reversed"><strong>REVERSED AUDIT</strong><span>{record.reversalReason}</span><small>{dateTime(record.reversedAt)}{record.reversedByName ? ` · ${record.reversedByName}` : ""}</small></section>}
    {isBusinessDaySnapshot(record.snapshot) ? <Snapshot snapshot={record.snapshot} /> : <><p className="night-audit-document-legacy">This legacy audit predates the detailed business-day snapshot.</p><div className="night-audit-document-grid"><Section title="Frozen summary" rows={[
      { label: "Occupancy", value: `${record.occupancyRate.toFixed(1)}%` }, { label: "Room revenue", value: money(record.roomRevenue) }, { label: "POS revenue", value: money(record.posRevenue) }, { label: "Collected", value: money(record.totalCollected) }, { label: "Outstanding", value: money(record.totalOutstanding) }, { label: "No-shows / open balances", value: `${record.noShowsFlagged} / ${record.openBalanceCount}` },
    ]} /></div></>}
    <footer>Immutable Night Audit snapshot · Innflo Hotel PMS</footer>
  </article>;
}
