import {
  AlertTriangle, Banknote, BedDouble, Building2, CheckCircle2,
  CircleDollarSign, ReceiptText, ShoppingBag, WalletCards,
} from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/cn";
import type { BusinessDaySnapshot } from "@/services/nightAudit";

function formatPKR(paisas: number): string {
  return `PKR ${Math.floor(paisas / 100).toLocaleString("en-PK")}`;
}

function label(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter: string) => letter.toUpperCase());
}

function Stat({ title, value, detail }: { title: string; value: string; detail?: string }) {
  return (
    <div className="night-audit-stat rounded-xl border border-line bg-card px-4 py-3.5 shadow-card">
      <p className="text-[10px] font-bold uppercase tracking-[0.11em] text-ink-faint">{title}</p>
      <p className="mt-1 text-[18px] font-semibold leading-none text-ink">{value}</p>
      {detail && <p className="mt-1.5 text-[11px] text-ink-mute">{detail}</p>}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof BedDouble;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="night-audit-section rounded-2xl border border-line bg-card p-4 shadow-card">
      <div className="mb-3 flex items-center gap-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg border border-coral/15 bg-coral-soft text-coral"><Icon size={15} /></div>
        <h3 className="text-[13px] font-bold text-ink">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Row({ title, value, warning = false }: { title: string; value: string; warning?: boolean }) {
  return (
    <div className="night-audit-row flex items-center justify-between gap-4 py-2 text-[12.5px]">
      <span className="text-ink-mute">{title}</span>
      <span className={cn("text-right font-semibold", warning ? "text-clay" : "text-ink")}>{value}</span>
    </div>
  );
}

function Check({ title, difference, detail }: { title: string; difference?: number; detail?: string }) {
  if (difference === undefined) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl border border-line bg-mist px-3 py-2.5 shadow-card">
        <ReceiptText size={15} className="mt-0.5 shrink-0 text-ink-mute" />
        <div>
          <p className="text-[12px] font-semibold text-ink">{title}</p>
          <p className="mt-0.5 text-[11px] text-ink-mute">Not captured in this legacy audit</p>
        </div>
      </div>
    );
  }
  const clear = difference === 0;
  return (
    <div className={cn(
      "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
      clear ? "border-pine/40 bg-pine-soft shadow-card" : "border-clay/45 bg-clay-soft shadow-card",
    )}>
      {clear
        ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-pine-deep" />
        : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-clay" />}
      <div>
        <p className="text-[12px] font-semibold text-ink">{title}</p>
        <p className={cn("mt-0.5 text-[11px]", clear ? "text-pine-deep" : "text-clay")}>
          {clear ? "Reconciled" : `${formatPKR(Math.abs(difference))} difference`}
        </p>
        {detail && <p className="mt-1 text-[10.5px] leading-relaxed text-ink-mute">{detail}</p>}
      </div>
    </div>
  );
}

type SnapshotSection = "operations" | "financial" | "reconciliation" | "all";

export function BusinessDaySnapshotView({ snapshot, section = "all" }: { snapshot: BusinessDaySnapshot; section?: SnapshotSection }) {
  const paymentRows = Object.entries(snapshot.payments.byMethod).sort((a, b) => b[1].net - a[1].net);
  const ledgerRows = [...snapshot.balanceBook.byMethod]
    .filter((row) => row.amount !== 0)
    .sort((a, b) => b.amount - a.amount);
  const exceptionCount = snapshot.auditResolution?.exceptionCount
    ?? snapshot.reconciliation.unresolvedExceptions
    ?? 0;
  const reconcilableCollected = snapshot.payments.reconcilableNetCollected
    ?? snapshot.payments.netCollected + snapshot.payments.directCollections;
  const postedCollections = snapshot.payments.balanceBookCollectionNet
    ?? snapshot.payments.balanceBookIncoming;
  const postedExpenses = snapshot.balanceBook.expenseLedgerOutgoing
    ?? snapshot.balanceBook.expenses;

  return (
    <div className="space-y-4">
      {(section === "operations" || section === "all") && <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat title="Occupancy" value={`${snapshot.occupancy.occupancyRate.toFixed(1)}%`} detail={`${snapshot.occupancy.roomsSold} of ${snapshot.occupancy.sellableRooms} sellable`} />
        <Stat title="ADR" value={formatPKR(snapshot.occupancy.adr)} detail="Per occupied room" />
        <Stat title="RevPAR" value={formatPKR(snapshot.occupancy.revpar)} detail="Per sellable room" />
        <Stat title="Net collected" value={formatPKR(snapshot.payments.netCollected + snapshot.payments.directCollections)} detail={`${snapshot.balanceBook.entries} Balance Book entries`} />
      </div>}

      <div className="grid gap-4 lg:grid-cols-2">
        {(section === "operations" || section === "all") && <>
        <Section icon={BedDouble} title="Rooms & movement">
          <div className="grid grid-cols-3 gap-2">
            <Stat title="Physical" value={String(snapshot.occupancy.physicalRooms)} />
            <Stat title="Out of service" value={String(snapshot.occupancy.outOfServiceRooms)} />
            <Stat title="Available" value={String(snapshot.occupancy.availableRooms)} />
          </div>
          <div className="mt-2 divide-y divide-line-soft">
            <Row title="Arrivals / actual check-ins" value={`${snapshot.reservations.arrivals} / ${snapshot.reservations.actualCheckIns}`} />
            <Row title="Departures / actual check-outs" value={`${snapshot.reservations.departures} / ${snapshot.reservations.actualCheckOuts}`} />
            <Row title="Stayovers" value={String(snapshot.reservations.stayovers)} />
            <Row title="Cancellations / no-shows" value={`${snapshot.reservations.cancellations} / ${snapshot.reservations.noShows}`} warning={snapshot.reservations.noShows > 0} />
          </div>
        </Section>
        </>}

        {(section === "financial" || section === "all") && <>
        <Section icon={CircleDollarSign} title="Revenue">
          <div className="divide-y divide-line-soft">
            <Row title="Room revenue" value={formatPKR(snapshot.revenue.roomRevenue)} />
            <Row title="POS sales" value={formatPKR(snapshot.revenue.posRevenue)} />
            <Row title="QR sales" value={formatPKR(snapshot.revenue.qrRevenue)} />
            <Row title="Taxes" value={formatPKR(snapshot.revenue.taxes)} />
            <Row title="Discounts / rebates" value={`${formatPKR(snapshot.revenue.discounts)} / ${formatPKR(snapshot.revenue.rebates)}`} />
            <Row title="Adjustments" value={formatPKR(snapshot.revenue.adjustments)} />
          </div>
        </Section>

        <Section icon={WalletCards} title="Collections by payment method">
          {paymentRows.length === 0 ? (
            <p className="py-3 text-[12px] text-ink-mute">No folio payments recorded in this business day.</p>
          ) : (
            <div className="divide-y divide-line-soft">
              {paymentRows.map(([method, amount]) => (
                <Row
                  key={method}
                  title={`${label(method)} · ${amount.transactions} transaction${amount.transactions === 1 ? "" : "s"}`}
                  value={formatPKR(amount.net)}
                  warning={amount.net < 0}
                />
              ))}
            </div>
          )}
          <div className="mt-2 border-t border-line pt-2">
            <Row title="Direct POS / QR / company collections" value={formatPKR(snapshot.payments.directCollections)} />
            <Row title="Refunds" value={`−${formatPKR(snapshot.payments.refunded)}`} warning={snapshot.payments.refunded > 0} />
          </div>
        </Section>

        <Section icon={Building2} title="Guest & company (BTC)">
          <div className="divide-y divide-line-soft">
            <Row title="Guest responsibility" value={formatPKR(snapshot.revenue.guestResponsibility)} />
            <Row title="Company responsibility" value={formatPKR(snapshot.revenue.companyResponsibility)} />
            <Row title="Transferred to company ledger" value={formatPKR(snapshot.companyCredit.transferred)} />
            <Row title="Company payments" value={formatPKR(snapshot.companyCredit.payments)} />
            <Row title="Guest outstanding" value={formatPKR(snapshot.reconciliation.guestOutstanding)} warning={snapshot.reconciliation.guestOutstanding > 0} />
            <Row title="BTC outstanding on folios" value={formatPKR(snapshot.reconciliation.companyOutstanding)} warning={snapshot.reconciliation.companyOutstanding > 0} />
          </div>
        </Section>

        <Section icon={ShoppingBag} title="Food & beverage">
          <div className="divide-y divide-line-soft">
            <Row title="POS orders" value={`${snapshot.foodAndBeverage.pos.orders} · ${formatPKR(snapshot.foodAndBeverage.pos.total)}`} />
            <Row title="POS tax / discount" value={`${formatPKR(snapshot.foodAndBeverage.pos.tax)} / ${formatPKR(snapshot.foodAndBeverage.pos.discount)}`} />
            <Row title="QR orders" value={`${snapshot.foodAndBeverage.qr.orders} · ${formatPKR(snapshot.foodAndBeverage.qr.total)}`} />
            <Row title="Unposted POS orders" value={String(snapshot.reconciliation.unpostedPosOrders)} warning={snapshot.reconciliation.unpostedPosOrders > 0} />
          </div>
        </Section>

        <Section icon={Banknote} title="Balance Book">
          <div className="divide-y divide-line-soft">
            <Row title="Incoming" value={formatPKR(snapshot.balanceBook.incoming)} />
            <Row title="Outgoing" value={formatPKR(snapshot.balanceBook.outgoing)} />
            <Row title="Net movement" value={formatPKR(snapshot.balanceBook.net)} warning={snapshot.balanceBook.net < 0} />
            <Row title={`Expenses · ${snapshot.balanceBook.expenseEntries} entries`} value={formatPKR(snapshot.balanceBook.expenses)} />
          </div>
          {ledgerRows.length > 0 && (
            <div className="mt-3 border-t border-line pt-2">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.11em] text-ink-faint">Posted movements by source</p>
              <div className="divide-y divide-line-soft">
                {ledgerRows.map((row) => (
                  <Row
                    key={`${row.direction}:${row.sourceType}:${row.paymentMethod ?? "none"}`}
                    title={`${label(row.sourceType)}${row.paymentMethod ? ` · ${label(row.paymentMethod)}` : ""} · ${row.entries}`}
                    value={`${row.direction === "OUTGOING" ? "−" : "+"}${formatPKR(row.amount)}`}
                    warning={row.direction === "OUTGOING"}
                  />
                ))}
              </div>
            </div>
          )}
        </Section>
        </>}
      </div>

      {(section === "reconciliation" || section === "all") &&
      <Section icon={ReceiptText} title="Reconciliation controls">
        <div className="grid gap-2 sm:grid-cols-2">
          <Check
            title="Collections → Balance Book"
            difference={snapshot.payments.balanceBookDifference}
            detail={`Expected ${formatPKR(reconcilableCollected)} · posted ${formatPKR(postedCollections)}`}
          />
          <Check
            title="Expenses → Balance Book"
            difference={snapshot.balanceBook.expenseDifference}
            detail={`Expenses ${formatPKR(snapshot.balanceBook.expenses)} · posted ${formatPKR(postedExpenses)}`}
          />
          <div className={cn(
            "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
            snapshot.reconciliation.openFolios === 0 ? "border-pine/40 bg-pine-soft shadow-card" : "border-amber/45 bg-amber-soft shadow-card",
          )}>
            {snapshot.reconciliation.openFolios === 0
              ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-pine-deep" />
              : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber" />}
            <div>
              <p className="text-[12px] font-semibold text-ink">Open folios</p>
              <p className="mt-0.5 text-[11px] text-ink-mute">{snapshot.reconciliation.openFolios} folios · {formatPKR(snapshot.reconciliation.openBalance)}</p>
            </div>
          </div>
          <div className={cn(
            "flex items-start gap-2.5 rounded-xl border px-3 py-2.5",
            exceptionCount === 0 ? "border-pine/40 bg-pine-soft shadow-card" : "border-amber/45 bg-amber-soft shadow-card",
          )}>
            {exceptionCount === 0
              ? <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-pine-deep" />
              : <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber" />}
            <div>
              <p className="text-[12px] font-semibold text-ink">Audit exceptions</p>
              <p className="mt-0.5 text-[11px] text-ink-mute">{exceptionCount === 0 ? "No unresolved exceptions" : `${exceptionCount} closed with an exception note`}</p>
            </div>
          </div>
        </div>
        {snapshot.auditResolution?.exceptionReason && (
          <div className="mt-3 rounded-xl border border-amber/30 bg-amber-soft/40 px-3 py-2.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-amber">Exception note</p>
            <p className="mt-1 text-[12px] leading-relaxed text-ink-soft">{snapshot.auditResolution.exceptionReason}</p>
          </div>
        )}
      </Section>
      }

      {(section === "operations" || section === "all") && snapshot.operationalCoverage && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Section icon={BedDouble} title="Room readiness & service exceptions">
            <div className="divide-y divide-line-soft">
              <Row title="Dirty rooms" value={String(snapshot.operationalCoverage.dirtyRooms)} warning={snapshot.operationalCoverage.dirtyRooms > 0} />
              <Row title="Out-of-service blocks" value={String(snapshot.operationalCoverage.outOfServiceRooms.length)} warning={snapshot.operationalCoverage.outOfServiceRooms.length > 0} />
              <Row title="Incomplete housekeeping" value={String(snapshot.operationalCoverage.housekeeping.length)} warning={snapshot.operationalCoverage.housekeeping.length > 0} />
              <Row title="Open maintenance" value={String(snapshot.operationalCoverage.maintenance.length)} warning={snapshot.operationalCoverage.maintenance.length > 0} />
              <Row title="Unsigned handovers" value={String(snapshot.operationalCoverage.unsignedShiftReports.length)} warning={snapshot.operationalCoverage.unsignedShiftReports.length > 0} />
            </div>
          </Section>
          <Section icon={ShoppingBag} title="Sales & inventory coverage">
            <div className="divide-y divide-line-soft">
              {(snapshot.foodAndBeverage.pos.categories ?? []).slice(0, 5).map((category) => (
                <Row key={category.id} title={`${category.name} · ${category.quantity} sold`} value={formatPKR(category.revenue)} />
              ))}
              {(snapshot.inventory?.consumption ?? []).slice(0, 4).map((item) => (
                <Row key={item.itemId} title={`${item.name} used`} value={`${item.consumed} ${item.unit}`} />
              ))}
              <Row title="Low-stock items" value={String(snapshot.inventory?.lowStock.length ?? 0)} warning={(snapshot.inventory?.lowStock.length ?? 0) > 0} />
            </div>
          </Section>
        </div>
      )}

      {snapshot.controls && (snapshot.controls.blockers.length > 0 || snapshot.controls.warnings.length > 0) && (
        <Section icon={AlertTriangle} title="Audit control register">
          <div className="space-y-2">
            {[...snapshot.controls.blockers, ...snapshot.controls.warnings].map((item) => {
              const blocker = snapshot.controls?.blockers.includes(item) ?? false;
              const content = <><p className="text-[12px] font-semibold text-ink">{item.title}</p><p className="mt-0.5 text-[10.5px] text-ink-mute">{item.detail}</p></>;
              return item.route ? (
                <Link key={`${item.code}:${item.detail}`} to={item.route} className={cn("block rounded-xl border px-3 py-2.5 shadow-card hover:border-coral/60", blocker ? "border-clay/45 bg-clay-soft" : "border-amber/45 bg-amber-soft")}>{content}</Link>
              ) : (
                <div key={`${item.code}:${item.detail}`} className={cn("rounded-xl border px-3 py-2.5 shadow-card", blocker ? "border-clay/45 bg-clay-soft" : "border-amber/45 bg-amber-soft")}>{content}</div>
              );
            })}
          </div>
        </Section>
      )}
    </div>
  );
}
