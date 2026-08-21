import type { TenantTx } from "@pms/db";
import { CompanyLedgerEntryType, FolioItemType, FolioPayerType } from "@pms/db";

export interface FolioResponsibilityTotals {
  chargesTotal: number;
  taxTotal: number;
  discountsTotal: number;
  paymentsTotal: number;
  guestResponsibilityTotal: number;
  companyResponsibilityTotal: number;
  guestBalanceDue: number;
  companyBalanceDue: number;
  companyLedgerCovered: number;
  balanceDue: number;
}

function minor(value: bigint | number | null | undefined): number {
  return typeof value === "bigint" ? Number(value) : (value ?? 0);
}

export async function calculateFolioResponsibilityTotals(
  db: TenantTx,
  folioId: string,
): Promise<FolioResponsibilityTotals> {
  const items = await db.folioItem.findMany({
    where: { folioId, isVoided: false },
    select: { type: true, amount: true, payerType: true },
  });

  let chargesTotal = 0;
  let taxTotal = 0;
  let discountsTotal = 0;
  let guestResponsibilityTotal = 0;
  let companyResponsibilityTotal = 0;

  for (const item of items) {
    const signedAmount = item.type === FolioItemType.DISCOUNT ? -item.amount : item.amount;
    if (item.type === FolioItemType.TAX) taxTotal += item.amount;
    else if (item.type === FolioItemType.DISCOUNT) discountsTotal += item.amount;
    else chargesTotal += item.amount;

    if (item.payerType === FolioPayerType.COMPANY) companyResponsibilityTotal += signedAmount;
    else guestResponsibilityTotal += signedAmount;
  }

  guestResponsibilityTotal = Math.max(0, guestResponsibilityTotal);
  companyResponsibilityTotal = Math.max(0, companyResponsibilityTotal);

  const [paymentsAgg, refundsAgg, companyCoverageAgg] = await Promise.all([
    db.payment.aggregate({ where: { folioId, status: "COMPLETED", isRefund: false }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { folioId, status: "COMPLETED", isRefund: true }, _sum: { amount: true } }),
    db.companyLedgerEntry.aggregate({
      where: { folioId, type: CompanyLedgerEntryType.CHARGE, reversedAt: null },
      _sum: { amount: true },
    }),
  ]);

  const paymentsTotal = Math.max(0, (paymentsAgg._sum.amount ?? 0) - (refundsAgg._sum.amount ?? 0));
  const companyLedgerCovered = minor(companyCoverageAgg._sum.amount);

  // New item-level BTC coverage applies to company responsibility first. Any
  // remainder represents a historical whole-folio transfer created before
  // item payer attribution existed and must continue to cover Guest-defaulted
  // legacy items rather than reopening old debt.
  const companyCoverageForAllocatedItems = Math.min(companyResponsibilityTotal, companyLedgerCovered);
  const legacyGuestCoverage = Math.max(0, companyLedgerCovered - companyCoverageForAllocatedItems);
  const companyBalanceDue = Math.max(0, companyResponsibilityTotal - companyCoverageForAllocatedItems);
  const guestBalanceDue = Math.max(0, guestResponsibilityTotal - paymentsTotal - legacyGuestCoverage);
  const balanceDue = guestBalanceDue + companyBalanceDue;

  return {
    chargesTotal,
    taxTotal,
    discountsTotal,
    paymentsTotal,
    guestResponsibilityTotal,
    companyResponsibilityTotal,
    guestBalanceDue,
    companyBalanceDue,
    companyLedgerCovered,
    balanceDue,
  };
}

export async function recalculateFolioTotals(db: TenantTx, folioId: string): Promise<void> {
  const totals = await calculateFolioResponsibilityTotals(db, folioId);

  await db.folio.update({
    where: { id: folioId },
    data: {
      chargesTotal: totals.chargesTotal,
      taxTotal: totals.taxTotal,
      discountsTotal: totals.discountsTotal,
      paymentsTotal: totals.paymentsTotal,
      guestResponsibilityTotal: totals.guestResponsibilityTotal,
      companyResponsibilityTotal: totals.companyResponsibilityTotal,
      guestBalanceDue: totals.guestBalanceDue,
      companyBalanceDue: totals.companyBalanceDue,
      balanceDue: totals.balanceDue,
    },
  });
}
