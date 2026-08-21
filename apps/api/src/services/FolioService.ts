import type { TenantTx } from "@pms/db";
import { FolioItemType, FolioPayerType } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import type { AddFolioItemDto, AddPaymentDto, AllocateFolioItemsDto, BillingListQuery, RefundPaymentDto } from "../schemas/folio";
import { AppError } from "../utils/AppError";
import { getPKTDayRange, getCurrentPKTDate } from "../lib/timezone";
import { paginationMeta } from "../utils/pagination";
import { recalculateFolioTotals } from "../utils/folioTotals";
import { notifyHotelDataChanged } from "../lib/realtime";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export const FolioService = {
  async get(withTenant: WithTenantFn, reservationId: string) {
    const folio = await withTenant((db) =>
      db.folio.findUnique({
        where: { reservationId },
        include: {
          items: {
            where:   { isVoided: false },
            orderBy: { chargeDate: "desc" },
            include: { payerCompany: { select: { id: true, name: true } } },
          },
          payments: {
            orderBy: { postedAt: "desc" },
          },
          reservation: {
            select: {
              id:                 true,
              confirmationNumber: true,
              checkInDate:        true,
              checkOutDate:       true,
              status:             true,
              groupId:            true,
              companyId:          true,
              billToCompany:      true,
              guest: { select: { fullName: true } },
              rooms: {
                take:   1,
                select: { room: { select: { number: true } }, roomType: { select: { name: true } } },
              },
            },
          },
        },
      })
    );
    if (!folio) throw new AppError(404, "Folio not found");
    return folio;
  },

  async addItem(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    reservationId: string,
    dto: AddFolioItemDto,
  ) {
    return withTenant(async (db) => {
      const folio = await db.folio.findUnique({
        where:  { reservationId },
        select: { id: true, isOpen: true },
      });
      if (!folio) throw new AppError(404, "Folio not found");
      if (!folio.isOpen) throw new AppError(400, "Cannot add charges to a closed folio");

      const amount = dto.unitAmount * dto.quantity;
      const item = await db.folioItem.create({
        data: {
          hotelId:     actor.hotelId,
          folioId:     folio.id,
          type:        dto.type,
          description: dto.description,
          unitAmount:  dto.unitAmount,
          quantity:    dto.quantity,
          amount,
          netAmount:   amount,
          notes:       dto.notes,
        },
      });

      await recalculateFolioTotals(db, folio.id);

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "FOLIO_ITEM_CREATE",
          entity:   "folio_item",
          entityId: item.id,
          after:    JSON.parse(JSON.stringify({ type: dto.type, amount, description: dto.description })),
        },
      });

      return item;
    }).then((item) => {
      notifyHotelDataChanged(actor.hotelId);
      return item;
    });
  },

  async allocateItems(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    reservationId: string,
    dto: AllocateFolioItemsDto,
  ) {
    const result = await withTenant(async (db) => {
      const folio = await db.folio.findUnique({
        where: { reservationId },
        select: {
          id: true,
          isOpen: true,
          invoiceId: true,
          companyLedgerEntries: {
            where: { type: "CHARGE", reversedAt: null },
            select: { id: true },
            take: 1,
          },
        },
      });
      if (!folio) throw new AppError(404, "Folio not found");
      if (!folio.isOpen) throw new AppError(409, "Payer responsibility cannot be changed on a closed folio.");
      if (folio.invoiceId) throw new AppError(409, "Payer responsibility cannot be changed after this folio was invoiced.");
      if (folio.companyLedgerEntries.length > 0) {
        throw new AppError(409, "Reverse the existing Bill to company (BTC) ledger transfer before changing payer responsibility.");
      }

      let companyName: string | null = null;
      if (dto.payerType === FolioPayerType.COMPANY) {
        const company = await db.company.findFirst({
          where: { id: dto.companyId!, isActive: true, deletedAt: null },
          select: { name: true },
        });
        if (!company) throw new AppError(404, "Active company not found for this hotel");
        companyName = company.name;
      }

      const items = await db.folioItem.findMany({
        where: { id: { in: dto.itemIds }, folioId: folio.id, isVoided: false },
        select: { id: true, payerType: true, payerCompanyId: true },
      });
      if (items.length !== new Set(dto.itemIds).size) {
        throw new AppError(400, "One or more selected charges do not belong to this active folio.");
      }

      const newCompanyId = dto.payerType === FolioPayerType.COMPANY ? dto.companyId! : null;
      if (newCompanyId) {
        const otherCompanyItem = await db.folioItem.findFirst({
          where: {
            folioId: folio.id,
            isVoided: false,
            payerType: FolioPayerType.COMPANY,
            id: { notIn: dto.itemIds },
            payerCompanyId: { not: newCompanyId },
          },
          select: { payerCompany: { select: { name: true } } },
        });
        if (otherCompanyItem) {
          throw new AppError(
            409,
            `This folio already has BTC charges assigned to ${otherCompanyItem.payerCompany?.name ?? "another company"}. Move those charges back to Guest before selecting a different company.`,
          );
        }
      }

      const changedItems = items.filter((item) =>
        item.payerType !== dto.payerType || item.payerCompanyId !== newCompanyId
      );
      if (changedItems.length === 0) throw new AppError(409, "The selected charges already have that payer responsibility.");

      for (const item of changedItems) {
        await db.folioItemPayerChange.create({
          data: {
            hotelId: actor.hotelId,
            folioItemId: item.id,
            previousPayerType: item.payerType,
            previousPayerCompanyId: item.payerCompanyId,
            newPayerType: dto.payerType,
            newPayerCompanyId: newCompanyId,
            reason: dto.reason,
            changedBy: actor.userId,
          },
        });
      }

      await db.folioItem.updateMany({
        where: { id: { in: changedItems.map((item) => item.id) }, folioId: folio.id },
        data: {
          payerType: dto.payerType,
          payerCompanyId: newCompanyId,
          allocatedAt: new Date(),
          allocatedBy: actor.userId,
        },
      });
      await recalculateFolioTotals(db, folio.id);

      await db.auditLog.create({
        data: {
          hotelId: actor.hotelId,
          userId: actor.userId,
          action: "FOLIO_PAYER_ALLOCATED",
          entity: "folio",
          entityId: folio.id,
          notes: dto.reason,
          after: {
            itemIds: changedItems.map((item) => item.id),
            payerType: dto.payerType,
            companyId: newCompanyId,
            companyName,
          },
        },
      });

      return { updatedCount: changedItems.length, payerType: dto.payerType, companyId: newCompanyId, companyName };
    });
    notifyHotelDataChanged(actor.hotelId);
    return result;
  },

  async voidItem(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    reservationId: string,
    itemId: string,
  ) {
    return withTenant(async (db) => {
      const folio = await db.folio.findUnique({
        where:  { reservationId },
        select: { id: true, isOpen: true },
      });
      if (!folio) throw new AppError(404, "Folio not found");
      if (!folio.isOpen) throw new AppError(400, "Cannot modify a closed folio");

      const item = await db.folioItem.findFirst({
        where: { id: itemId, folioId: folio.id },
      });
      if (!item) throw new AppError(404, "Folio item not found");
      if (item.isVoided) throw new AppError(400, "Item is already voided");

      await db.folioItem.update({
        where: { id: itemId },
        data:  { isVoided: true, voidedAt: new Date(), voidedBy: actor.userId },
      });

      await recalculateFolioTotals(db, folio.id);

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "FOLIO_ITEM_VOID",
          entity:   "folio_item",
          entityId: itemId,
          before:   JSON.parse(JSON.stringify({ type: item.type, amount: item.amount, description: item.description })),
        },
      });

      return { voided: true };
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },

  async addPayment(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    reservationId: string,
    dto: AddPaymentDto,
  ) {
    const payment = await withTenant(async (db) => {
      const folio = await db.folio.findUnique({
        where:  { reservationId },
        select: {
          id: true, isOpen: true, balanceDue: true,
          guestBalanceDue: true, companyResponsibilityTotal: true,
        },
      });
      if (!folio) throw new AppError(404, "Folio not found");
      if (!folio.isOpen) throw new AppError(409, "Cannot record a payment on a closed folio.");

      const payableByGuest = folio.companyResponsibilityTotal > 0
        ? folio.guestBalanceDue
        : folio.balanceDue;
      if (payableByGuest <= 0) {
        throw new AppError(409, "The guest has no outstanding balance to pay.");
      }
      if (dto.amount > payableByGuest) {
        throw new AppError(
          400,
          `This payment exceeds the guest's outstanding balance of PKR ${(payableByGuest / 100).toLocaleString("en-PK")}.`,
        );
      }

      const payment = await db.payment.create({
        data: {
          hotelId:        actor.hotelId,
          folioId:        folio.id,
          reservationId,
          method:         dto.method,
          status:         "COMPLETED",
          amount:         dto.amount,
          transactionRef: dto.transactionRef,
          notes:          dto.notes,
          postedBy:       actor.userId,
        },
      });

      await recalculateFolioTotals(db, folio.id);

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "PAYMENT_CREATE",
          entity:   "payment",
          entityId: payment.id,
          after:    JSON.parse(JSON.stringify({ method: dto.method, amount: dto.amount })),
        },
      });

      return payment;
    });

    notifyHotelDataChanged(actor.hotelId);
    return payment;
  },

  async refundPayment(
    withTenant: WithTenantFn, actor: JwtPayload, reservationId: string,
    paymentId: string, dto: RefundPaymentDto,
  ) {
    const refund = await withTenant(async (db) => {
      const locked = await db.$queryRaw<{ id: string }[]>`
        SELECT id FROM payments
        WHERE id = ${paymentId}::uuid AND hotel_id = ${actor.hotelId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError(404, "Completed payment not found");
      const original = await db.payment.findFirst({
        where: { id: paymentId, reservationId, status: "COMPLETED", isRefund: false },
      });
      if (!original) throw new AppError(404, "Completed payment not found");

      const refunded = await db.payment.aggregate({
        where: { originalPaymentId: paymentId, status: "COMPLETED", isRefund: true },
        _sum: { amount: true },
      });
      const refundable = original.amount - (refunded._sum.amount ?? 0);
      if (dto.amount > refundable) {
        throw new AppError(400, `Only PKR ${(refundable / 100).toLocaleString("en-PK")} remains refundable`);
      }

      const created = await db.payment.create({
        data: {
          hotelId: actor.hotelId, folioId: original.folioId, reservationId,
          method: original.method, status: "COMPLETED", amount: dto.amount,
          isRefund: true, originalPaymentId: original.id, refundReason: dto.reason,
          postedBy: actor.userId, notes: dto.reason,
        },
      });
      if (original.folioId) {
        // A customer refund is also a credit against the hotel charge. Recording
        // only the cash reversal would reopen the folio and claim the guest owes
        // the refunded amount again.
        await db.folioItem.create({
          data: {
            hotelId: actor.hotelId, folioId: original.folioId,
            type: "DISCOUNT", description: `Refund credit — ${dto.reason}`,
            unitAmount: dto.amount, quantity: 1, amount: dto.amount,
            netAmount: dto.amount, notes: `Refund payment ${created.id}`,
          },
        });
        await recalculateFolioTotals(db, original.folioId);
      }
      await db.auditLog.create({
        data: {
          hotelId: actor.hotelId, userId: actor.userId, action: "PAYMENT_REFUND",
          entity: "payment", entityId: created.id,
          after: { originalPaymentId: original.id, amount: dto.amount, reason: dto.reason },
        },
      });
      return created;
    });
    notifyHotelDataChanged(actor.hotelId);
    return refund;
  },

  async listForBilling(withTenant: WithTenantFn, query: BillingListQuery) {
    const skip = (query.page - 1) * query.limit;

    // Build status where clause
    const statusWhere =
      query.statusFilter === "open"    ? { isOpen: true } :
      query.statusFilter === "settled" ? { isOpen: false } :
      {};

    // Build orderBy
    const dir = query.sortDir === "desc" ? "desc" as const : "asc" as const;
    const orderBy =
      query.sortBy === "balance"   ? { balanceDue: dir } :
      query.sortBy === "guestName" ? { reservation: { guest: { fullName: dir } } } :
      { reservation: { checkOutDate: dir } };

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.folio.findMany({
          where: statusWhere,
          include: {
            reservation: {
              select: {
                id:                 true,
                confirmationNumber: true,
                checkInDate:        true,
                checkOutDate:       true,
                status:             true,
                groupId:            true,
                guest: { select: { id: true, fullName: true } },
                rooms: {
                  take:   1,
                  select: { room: { select: { number: true } } },
                },
              },
            },
          },
          orderBy,
          skip,
          take: query.limit,
        }),
        db.folio.count({ where: statusWhere }),
      ])
    );
    return { data: items, meta: paginationMeta(total, query.page, query.limit) };
  },

  async summary(withTenant: WithTenantFn) {
    return withTenant(async (db) => {
      const { start: today, end: tomorrow } = getPKTDayRange(getCurrentPKTDate());

      const [billedAgg, collectedAgg, outstandingAgg, checkedOutUnpaid] = await Promise.all([
        db.folioItem.aggregate({
          where: {
            chargeDate: { gte: today, lt: tomorrow },
            isVoided:   false,
            type:       { not: FolioItemType.DISCOUNT },
          },
          _sum: { amount: true },
        }),
        db.payment.aggregate({
          where: { postedAt: { gte: today, lt: tomorrow }, status: "COMPLETED", isRefund: false },
          _sum:  { amount: true },
        }),
        db.folio.aggregate({
          where: { isOpen: true, balanceDue: { gt: 0 } },
          _sum:  { balanceDue: true },
        }),
        db.reservation.count({
          where: { status: "CHECKED_OUT", folio: { balanceDue: { gt: 0 } } },
        }),
      ]);

      return {
        billedToday:        billedAgg._sum.amount ?? 0,
        collectedToday:     collectedAgg._sum.amount ?? 0,
        outstandingBalance: outstandingAgg._sum.balanceDue ?? 0,
        checkedOutUnpaid,
      };
    });
  },
};
