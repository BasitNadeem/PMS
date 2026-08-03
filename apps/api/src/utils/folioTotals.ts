import type { TenantTx } from "@pms/db";
import { FolioItemType } from "@pms/db";

export async function recalculateFolioTotals(db: TenantTx, folioId: string): Promise<void> {
  const items = await db.folioItem.findMany({
    where:  { folioId, isVoided: false },
    select: { type: true, amount: true },
  });

  let chargesTotal = 0;
  let taxTotal     = 0;
  let discountsTotal = 0;

  for (const item of items) {
    if (item.type === FolioItemType.TAX) {
      taxTotal += item.amount;
    } else if (item.type === FolioItemType.DISCOUNT) {
      discountsTotal += item.amount;
    } else {
      chargesTotal += item.amount;
    }
  }

  const [paymentsAgg, refundsAgg] = await Promise.all([
    db.payment.aggregate({ where: { folioId, status: "COMPLETED", isRefund: false }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { folioId, status: "COMPLETED", isRefund: true }, _sum: { amount: true } }),
  ]);

  const paymentsTotal = Math.max(0, (paymentsAgg._sum.amount ?? 0) - (refundsAgg._sum.amount ?? 0));
  const balanceDue    = chargesTotal + taxTotal - discountsTotal - paymentsTotal;

  await db.folio.update({
    where: { id: folioId },
    data:  { chargesTotal, taxTotal, discountsTotal, paymentsTotal, balanceDue: Math.max(0, balanceDue) },
  });
}
