import type { TenantTx } from "@pms/db";
import { getShiftWindow, readShiftSchedule } from "../lib/shiftSchedule";
import { getPKTDayRange } from "../lib/timezone";
import { HotelMetricsService } from "./HotelMetricsService";

interface RawMoneyRow {
  total: bigint;
  count: bigint;
}

interface RawLedgerRow {
  entry_type: string;
  payment_method: string | null;
  source_type: string;
  total: bigint;
  count: bigint;
}

interface RawQrRow {
  status: string;
  payment_preference: string;
  total: bigint;
  count: bigint;
}

interface RawQrItemRow {
  item_name: string;
  quantity: bigint;
  revenue: bigint;
}

function roundRate(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round(numerator / denominator) : 0;
}

function roundPercentage(numerator: number, denominator: number): number {
  return denominator > 0 ? Math.round((numerator / denominator) * 1_000) / 10 : 0;
}

function sumValues(values: Iterable<number>): number {
  let total = 0;
  for (const value of values) total += value;
  return total;
}

const NON_CASH_SETTLEMENT_METHODS = new Set([
  "ADVANCE_DEPOSIT",
  "OTA_COLLECT",
  "COMPLIMENTARY",
]);

const COLLECTION_SOURCE_TYPES = new Set([
  "FOLIO_PAYMENT",
  "POS_SALE",
  "QR_ORDER_SALE",
  "COMPANY_PAYMENT",
]);

export const BusinessDaySnapshotService = {
  async build(db: TenantTx, hotelId: string, businessDate: string, settings: unknown) {
    const stayDate = getPKTDayRange(businessDate);
    const schedule = readShiftSchedule(settings);
    const activityWindow = {
      start: getShiftWindow(businessDate, "MORNING", schedule).start,
      end: getShiftWindow(businessDate, "NIGHT", schedule).end,
    };
    const businessDateObj = new Date(`${businessDate}T00:00:00.000Z`);

    const [
      metricReport,
      reservationStatuses,
      actualCheckIns,
      actualCheckOuts,
      folioItems,
      paymentGroups,
      folioSummary,
      posSummary,
      directPosSummary,
      companyLedgerGroups,
      posLineItems,
      inventoryTransactions,
      inventoryItems,
      roomStatuses,
      roomInventoryBlocks,
      housekeepingTasks,
      maintenanceTickets,
      unsignedShiftReports,
    ] = await Promise.all([
      HotelMetricsService.getRangeFromDb(db, businessDate, businessDate),
      db.reservation.groupBy({
        by: ["status"],
        where: {
          hotelId,
          OR: [
            { checkInDate: { gte: stayDate.start, lt: stayDate.end } },
            { cancelledAt: { gte: activityWindow.start, lt: activityWindow.end } },
          ],
        },
        _count: { id: true },
      }),
      db.reservation.count({
        where: { hotelId, actualCheckIn: { gte: activityWindow.start, lt: activityWindow.end } },
      }),
      db.reservation.count({
        where: { hotelId, actualCheckOut: { gte: activityWindow.start, lt: activityWindow.end } },
      }),
      db.folioItem.findMany({
        where: {
          hotelId,
          chargeDate: { gte: stayDate.start, lt: stayDate.end },
          isVoided: false,
        },
        select: {
          type: true,
          description: true,
          amount: true,
          discountAmount: true,
          taxAmount: true,
          netAmount: true,
          payerType: true,
        },
      }),
      db.payment.groupBy({
        by: ["method", "isRefund"],
        where: {
          hotelId,
          postedAt: { gte: activityWindow.start, lt: activityWindow.end },
          status: "COMPLETED",
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.folio.aggregate({
        where: { hotelId, isOpen: true },
        _count: { id: true },
        _sum: {
          balanceDue: true,
          guestBalanceDue: true,
          companyBalanceDue: true,
        },
      }),
      db.posOrder.aggregate({
        where: { hotelId, createdAt: { gte: activityWindow.start, lt: activityWindow.end } },
        _count: { id: true },
        _sum: { subtotal: true, taxAmount: true, discountAmount: true, total: true },
      }),
      db.posOrder.aggregate({
        where: {
          hotelId,
          createdAt: { gte: activityWindow.start, lt: activityWindow.end },
          isPostedToFolio: false,
          tableNumber: { startsWith: "PAID:" },
        },
        _count: { id: true },
        _sum: { total: true },
      }),
      db.companyLedgerEntry.groupBy({
        by: ["type"],
        where: {
          hotelId,
          entryDate: { gte: activityWindow.start, lt: activityWindow.end },
          reversedAt: null,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      db.posOrderItem.findMany({
        where: { order: { hotelId, createdAt: { gte: activityWindow.start, lt: activityWindow.end } } },
        select: {
          name: true,
          quantity: true,
          lineTotal: true,
          posItem: { select: { category: { select: { id: true, name: true } } } },
          order: { select: { isPostedToFolio: true } },
        },
      }),
      db.inventoryTransaction.findMany({
        where: { hotelId, createdAt: { gte: activityWindow.start, lt: activityWindow.end } },
        select: {
          id: true, type: true, quantity: true, totalCost: true, referenceType: true,
          item: { select: { id: true, name: true, unit: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.inventoryItem.findMany({
        where: { hotelId, isActive: true },
        select: { id: true, name: true, unit: true, currentStock: true, reorderLevel: true, parLevel: true },
        orderBy: { name: "asc" },
      }),
      db.room.groupBy({
        by: ["status"],
        where: { hotelId, isActive: true },
        _count: { id: true },
      }),
      db.roomInventoryBlock.findMany({
        where: {
          hotelId,
          cancelledAt: null,
          startDate: { lt: stayDate.end },
          endDate: { gt: stayDate.start },
        },
        select: { id: true, type: true, reason: true, room: { select: { id: true, number: true } } },
        orderBy: { room: { number: "asc" } },
      }),
      db.housekeepingTask.findMany({
        where: {
          hotelId,
          scheduledDate: { gte: stayDate.start, lt: stayDate.end },
          status: { in: ["PENDING", "IN_PROGRESS", "ESCALATED"] },
        },
        select: {
          id: true, taskType: true, status: true, priority: true, isEscalated: true,
          room: { select: { id: true, number: true } },
        },
        orderBy: [{ isEscalated: "desc" }, { priority: "desc" }],
      }),
      db.maintenanceTicket.findMany({
        where: { hotelId, status: { in: ["OPEN", "IN_PROGRESS", "AWAITING_PARTS"] } },
        select: {
          id: true, ticketNumber: true, title: true, status: true, priority: true,
          room: { select: { id: true, number: true } },
        },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
      }),
      db.shiftReport.findMany({
        where: { hotelId, shiftDate: businessDateObj, signedOffAt: null },
        select: { id: true, shiftType: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const safeRaw = async <T>(query: () => Promise<T>, fallback: T): Promise<T> => {
      try {
        return await query();
      } catch (error) {
        console.warn(`[BusinessDaySnapshot] Optional raw-SQL source unavailable for ${businessDate}`, error);
        return fallback;
      }
    };

    const [expenseRows, ledgerRows, reconciliationLedgerRows, qrRows, qrItemRows] = await Promise.all([
      safeRaw(
        () => db.$queryRaw<RawMoneyRow[]>`
          SELECT COALESCE(SUM(amount), 0)::bigint AS total, COUNT(*)::bigint AS count
          FROM expenses
          WHERE hotel_id = ${hotelId}::uuid AND date = ${businessDate}::date
        `,
        [],
      ),
      safeRaw(
        () => db.$queryRaw<RawLedgerRow[]>`
          SELECT entry_type, payment_method, source_type,
                 COALESCE(SUM(amount), 0)::bigint AS total, COUNT(*)::bigint AS count
          FROM ledger_entries
          WHERE hotel_id = ${hotelId}::uuid
            -- entry_date is the canonical accounting/business date. created_at
            -- only records when the row was inserted and may be weeks later for
            -- repaired or backfilled entries; using it would count historical
            -- movements again on the backfill day.
            AND entry_date = ${businessDate}::date
          GROUP BY entry_type, payment_method, source_type
        `,
        [],
      ),
      safeRaw(
        () => db.$queryRaw<RawLedgerRow[]>`
          SELECT le.entry_type, le.payment_method, le.source_type,
                 COALESCE(SUM(le.amount), 0)::bigint AS total, COUNT(*)::bigint AS count
          FROM ledger_entries le
          WHERE le.hotel_id = ${hotelId}::uuid
            AND (
              (
                le.source_type IN ('FOLIO_PAYMENT', 'PAYMENT_REFUND')
                AND EXISTS (
                  SELECT 1 FROM payments p
                  WHERE p.id::text = le.source_id
                    AND p.hotel_id = ${hotelId}::uuid
                    AND p.posted_at >= ${activityWindow.start}
                    AND p.posted_at < ${activityWindow.end}
                )
              )
              OR (
                le.source_type = 'POS_SALE'
                AND EXISTS (
                  SELECT 1 FROM pos_orders po
                  WHERE po.id::text = le.source_id
                    AND po.hotel_id = ${hotelId}::uuid
                    AND po.created_at >= ${activityWindow.start}
                    AND po.created_at < ${activityWindow.end}
                )
              )
              OR (
                le.source_type = 'QR_ORDER_SALE'
                AND EXISTS (
                  SELECT 1 FROM qr_orders qo
                  WHERE qo.id::text = le.source_id
                    AND qo.hotel_id = ${hotelId}::uuid
                    AND qo.created_at >= ${activityWindow.start}
                    AND qo.created_at < ${activityWindow.end}
                )
              )
              OR (
                le.source_type IN ('COMPANY_PAYMENT', 'COMPANY_CREDIT_REFUND')
                AND EXISTS (
                  SELECT 1 FROM company_ledger_entries cle
                  WHERE cle.id::text = le.source_id
                    AND cle.hotel_id = ${hotelId}::uuid
                    AND cle.entry_date >= ${activityWindow.start}
                    AND cle.entry_date < ${activityWindow.end}
                )
              )
            )
          GROUP BY le.entry_type, le.payment_method, le.source_type
        `,
        [],
      ),
      safeRaw(
        () => db.$queryRaw<RawQrRow[]>`
          SELECT status, payment_preference,
                 COALESCE(SUM(total_amount), 0)::bigint AS total,
                 COUNT(*)::bigint AS count
          FROM qr_orders
          WHERE hotel_id = ${hotelId}::uuid
            AND created_at >= ${activityWindow.start}
            AND created_at < ${activityWindow.end}
          GROUP BY status, payment_preference
        `,
        [],
      ),
      safeRaw(
        () => db.$queryRaw<RawQrItemRow[]>`
          SELECT qoi.item_name,
                 COALESCE(SUM(qoi.quantity), 0)::bigint AS quantity,
                 COALESCE(SUM(qoi.subtotal), 0)::bigint AS revenue
          FROM qr_order_items qoi
          JOIN qr_orders qo ON qo.id = qoi.order_id
          WHERE qo.hotel_id = ${hotelId}::uuid
            AND qo.created_at >= ${activityWindow.start}
            AND qo.created_at < ${activityWindow.end}
            AND qo.status <> 'cancelled'
          GROUP BY qoi.item_name
          ORDER BY revenue DESC
        `,
        [],
      ),
    ]);

    const metricDay = metricReport.days[0];
    const statusCounts = new Map(reservationStatuses.map((row) => [row.status, row._count.id]));
    const itemTotals = new Map<string, number>();
    const payerTotals = new Map<string, number>();
    let taxes = 0;
    let discounts = 0;
    let rebates = 0;
    for (const item of folioItems) {
      const signedAmount = item.type === "DISCOUNT" ? -item.amount : item.amount;
      itemTotals.set(item.type, (itemTotals.get(item.type) ?? 0) + signedAmount);
      payerTotals.set(item.payerType, (payerTotals.get(item.payerType) ?? 0) + signedAmount);
      taxes += item.taxAmount;
      discounts += item.discountAmount;
      if (item.type === "DISCOUNT") {
        if (item.description.toLowerCase().includes("rebate")) rebates += item.amount;
        else discounts += item.amount;
      }
    }

    const paymentMethods: Record<string, { received: number; refunded: number; net: number; transactions: number }> = {};
    for (const row of paymentGroups) {
      const method = paymentMethods[row.method] ?? { received: 0, refunded: 0, net: 0, transactions: 0 };
      const amount = row._sum.amount ?? 0;
      if (row.isRefund) method.refunded += amount;
      else method.received += amount;
      method.transactions += row._count.id;
      method.net = method.received - method.refunded;
      paymentMethods[row.method] = method;
    }
    const received = sumValues(Object.values(paymentMethods).map((row) => row.received));
    const refunded = sumValues(Object.values(paymentMethods).map((row) => row.refunded));
    const reconcilableReceived = sumValues(
      Object.entries(paymentMethods)
        .filter(([method]) => !NON_CASH_SETTLEMENT_METHODS.has(method))
        .map(([, row]) => row.received),
    );
    const reconcilableRefunded = sumValues(
      Object.entries(paymentMethods)
        .filter(([method]) => !NON_CASH_SETTLEMENT_METHODS.has(method))
        .map(([, row]) => row.refunded),
    );

    const companyLedger = new Map(companyLedgerGroups.map((row) => [row.type, {
      amount: Number(row._sum.amount ?? 0),
      count: row._count.id,
    }]));
    const cashLedger = new Map<string, { amount: number; count: number }>();
    for (const row of ledgerRows) {
      const current = cashLedger.get(row.entry_type) ?? { amount: 0, count: 0 };
      current.amount += Number(row.total);
      current.count += Number(row.count);
      cashLedger.set(row.entry_type, current);
    }
    const expenseTotal = Number(expenseRows[0]?.total ?? 0);
    const roomRevenue = itemTotals.get("ROOM_CHARGE") ?? 0;
    const soldRooms = metricDay?.roomsSold ?? 0;
    const sellableRooms = metricDay?.sellableRooms ?? 0;
    const posTotal = posSummary._sum.total ?? 0;
    const qrTotal = qrRows
      .filter((row) => row.status !== "cancelled")
      .reduce((sum, row) => sum + Number(row.total), 0);
    const openBalance = folioSummary._sum.balanceDue ?? 0;
    const balanceBookIncoming = cashLedger.get("INCOMING")?.amount ?? 0;
    const balanceBookOutgoing = cashLedger.get("OUTGOING")?.amount ?? 0;
    const expenseLedgerOutgoing = ledgerRows
      .filter((row) => row.entry_type === "OUTGOING" && row.source_type === "EXPENSE")
      .reduce((sum, row) => sum + Number(row.total), 0);
    // Night Audit reconciliation follows the source transaction's business-day
    // timestamp. This keeps after-midnight night-shift payments in the preceding
    // hotel business day, while avoiding created_at-based backfill duplication.
    const postedDirectCollections = reconciliationLedgerRows
      .filter((row) => row.entry_type === "INCOMING" && ["POS_SALE", "QR_ORDER_SALE", "COMPANY_PAYMENT"].includes(row.source_type))
      .reduce((sum, row) => sum + Number(row.total), 0);
    const expectedDirectCollections = (directPosSummary._sum.total ?? 0)
      + qrRows
        .filter((row) => row.status === "delivered" && row.payment_preference === "pay_now")
        .reduce((sum, row) => sum + Number(row.total), 0)
      + (companyLedger.get("PAYMENT")?.amount ?? 0);
    const balanceBookCollectionIncoming = reconciliationLedgerRows
      .filter((row) => row.entry_type === "INCOMING" && COLLECTION_SOURCE_TYPES.has(row.source_type))
      .reduce((sum, row) => sum + Number(row.total), 0);
    const balanceBookCollectionRefunds = reconciliationLedgerRows
      .filter((row) => row.entry_type === "OUTGOING" && row.source_type === "PAYMENT_REFUND")
      .reduce((sum, row) => sum + Number(row.total), 0);
    const reconcilableNetCollected = reconcilableReceived - reconcilableRefunded + expectedDirectCollections;
    const balanceBookCollectionNet = balanceBookCollectionIncoming - balanceBookCollectionRefunds;
    const totalCollected = received - refunded + expectedDirectCollections;

    const posItems = new Map<string, { name: string; quantity: number; revenue: number }>();
    const posCategories = new Map<string, { id: string; name: string; quantity: number; revenue: number }>();
    let posFolioRevenue = 0;
    let posDirectRevenue = 0;
    for (const line of posLineItems) {
      const item = posItems.get(line.name) ?? { name: line.name, quantity: 0, revenue: 0 };
      item.quantity += line.quantity;
      item.revenue += line.lineTotal;
      posItems.set(line.name, item);
      const category = line.posItem.category;
      const categoryRow = posCategories.get(category.id) ?? {
        id: category.id, name: category.name, quantity: 0, revenue: 0,
      };
      categoryRow.quantity += line.quantity;
      categoryRow.revenue += line.lineTotal;
      posCategories.set(category.id, categoryRow);
      if (line.order.isPostedToFolio) posFolioRevenue += line.lineTotal;
      else posDirectRevenue += line.lineTotal;
    }

    const inventoryUsage = new Map<string, {
      itemId: string; name: string; unit: string; consumed: number; wasted: number; cost: number;
    }>();
    for (const transaction of inventoryTransactions) {
      const row = inventoryUsage.get(transaction.item.id) ?? {
        itemId: transaction.item.id,
        name: transaction.item.name,
        unit: transaction.item.unit,
        consumed: 0,
        wasted: 0,
        cost: 0,
      };
      const quantity = Number(transaction.quantity);
      if (transaction.type === "CONSUMPTION") row.consumed += Math.abs(quantity);
      if (transaction.type === "WASTE") row.wasted += Math.abs(quantity);
      if (transaction.type === "CONSUMPTION" || transaction.type === "WASTE") {
        row.cost += Math.abs(transaction.totalCost ?? 0);
      }
      inventoryUsage.set(transaction.item.id, row);
    }
    const lowStock = inventoryItems
      .filter((item) => Number(item.currentStock) <= Number(item.reorderLevel))
      .map((item) => ({
        id: item.id,
        name: item.name,
        unit: item.unit,
        currentStock: Number(item.currentStock),
        reorderLevel: Number(item.reorderLevel),
        parLevel: Number(item.parLevel),
        urgency: Number(item.currentStock) <= 0 ? "CRITICAL" : "LOW",
      }));
    const roomStatusCounts = Object.fromEntries(roomStatuses.map((row) => [row.status, row._count.id]));

    return {
      version: 3,
      date: businessDate,
      generatedAt: new Date().toISOString(),
      boundaries: {
        stayDate: businessDate,
        activityStartsAt: activityWindow.start.toISOString(),
        activityEndsAt: activityWindow.end.toISOString(),
        timezone: "Asia/Karachi",
      },
      occupancy: {
        totalRooms: metricDay?.physicalRooms ?? 0,
        physicalRooms: metricDay?.physicalRooms ?? 0,
        outOfServiceRooms: metricDay?.outOfServiceRooms ?? 0,
        sellableRooms,
        occupied: soldRooms,
        roomsSold: soldRooms,
        availableRooms: metricDay?.availableRooms ?? 0,
        checkIns: actualCheckIns,
        checkOuts: actualCheckOuts,
        occupancyRate: roundPercentage(soldRooms, sellableRooms),
        // Operational ADR/RevPAR must use the same occupied-night revenue basis as
        // the central metrics engine. Folio room charges remain separately exposed
        // below for financial reconciliation, because legacy/backfilled folios may
        // not have one ROOM_CHARGE posted on every occupied business date.
        adr: metricDay?.adr ?? roundRate(roomRevenue, soldRooms),
        revpar: metricDay?.revpar ?? roundRate(roomRevenue, sellableRooms),
      },
      reservations: {
        arrivals: metricDay?.arrivals ?? 0,
        departures: metricDay?.departures ?? 0,
        stayovers: metricDay?.stayovers ?? 0,
        actualCheckIns,
        actualCheckOuts,
        cancellations: statusCounts.get("CANCELLED") ?? 0,
        noShows: statusCounts.get("NO_SHOW") ?? 0,
        confirmedArrivals: statusCounts.get("CONFIRMED") ?? 0,
      },
      revenue: {
        roomRevenue,
        posRevenue: posTotal,
        qrRevenue: qrTotal,
        taxes,
        discounts,
        rebates,
        adjustments: itemTotals.get("ADJUSTMENT") ?? 0,
        totalFolioRevenue: sumValues(itemTotals.values()),
        guestResponsibility: payerTotals.get("GUEST") ?? 0,
        companyResponsibility: payerTotals.get("COMPANY") ?? 0,
        totalCollected,
        outstanding: openBalance,
        expenses: expenseTotal,
      },
      payments: {
        received,
        refunded,
        netCollected: received - refunded,
        byMethod: paymentMethods,
        directCollections: expectedDirectCollections,
        postedDirectCollections,
        reconcilableNetCollected,
        balanceBookIncoming,
        balanceBookCollectionNet,
        balanceBookDifference: balanceBookCollectionNet - reconcilableNetCollected,
      },
      companyCredit: {
        transferred: companyLedger.get("CHARGE")?.amount ?? 0,
        payments: companyLedger.get("PAYMENT")?.amount ?? 0,
        adjustments: companyLedger.get("ADJUSTMENT")?.amount ?? 0,
        writeOffs: companyLedger.get("WRITE_OFF")?.amount ?? 0,
        guestOutstanding: folioSummary._sum.guestBalanceDue ?? 0,
        companyOutstandingOnFolios: folioSummary._sum.companyBalanceDue ?? 0,
      },
      foodAndBeverage: {
        pos: {
          orders: posSummary._count.id,
          subtotal: posSummary._sum.subtotal ?? 0,
          tax: posSummary._sum.taxAmount ?? 0,
          discount: posSummary._sum.discountAmount ?? 0,
          total: posTotal,
          outlets: [
            { name: "Main POS", orders: posSummary._count.id, revenue: posTotal },
          ],
          channels: [
            { name: "Direct payment", revenue: posDirectRevenue },
            { name: "Posted to folio", revenue: posFolioRevenue },
          ],
          categories: [...posCategories.values()].sort((a, b) => b.revenue - a.revenue),
          items: [...posItems.values()].sort((a, b) => b.revenue - a.revenue),
        },
        qr: {
          orders: qrRows.reduce((sum, row) => sum + Number(row.count), 0),
          total: qrTotal,
          groups: qrRows.map((row) => ({
            status: row.status,
            paymentPreference: row.payment_preference,
            orders: Number(row.count),
            total: Number(row.total),
          })),
          items: qrItemRows.map((row) => ({
            name: row.item_name,
            quantity: Number(row.quantity),
            revenue: Number(row.revenue),
          })),
        },
      },
      inventory: {
        transactions: inventoryTransactions.length,
        consumption: [...inventoryUsage.values()]
          .filter((row) => row.consumed > 0 || row.wasted > 0)
          .sort((a, b) => (b.consumed + b.wasted) - (a.consumed + a.wasted)),
        lowStock,
      },
      operationalCoverage: {
        roomStatus: roomStatusCounts,
        dirtyRooms: (roomStatusCounts.VACANT_DIRTY ?? 0),
        outOfServiceRooms: roomInventoryBlocks,
        housekeeping: housekeepingTasks,
        maintenance: maintenanceTickets,
        unsignedShiftReports,
      },
      balanceBook: {
        incoming: balanceBookIncoming,
        outgoing: balanceBookOutgoing,
        net: balanceBookIncoming - balanceBookOutgoing,
        entries: sumValues([...cashLedger.values()].map((row) => row.count)),
        expenses: expenseTotal,
        expenseEntries: Number(expenseRows[0]?.count ?? 0),
        expenseLedgerOutgoing,
        expenseDifference: expenseLedgerOutgoing - expenseTotal,
        byMethod: ledgerRows.map((row) => ({
          direction: row.entry_type,
          paymentMethod: row.payment_method,
          sourceType: row.source_type,
          amount: Number(row.total),
          entries: Number(row.count),
        })),
      },
      reconciliation: {
        openFolios: folioSummary._count.id,
        openBalance,
        guestOutstanding: folioSummary._sum.guestBalanceDue ?? 0,
        companyOutstanding: folioSummary._sum.companyBalanceDue ?? 0,
        unpostedPosOrders: 0,
        unresolvedExceptions: 0,
      },
      contribution: metricReport.contribution,
      roomTypes: metricReport.roomTypes.map((roomType) => roomType.days[0]),
    };
  },
};
