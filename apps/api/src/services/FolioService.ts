import type { TenantTx } from "@pms/db";
import { FolioItemType } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import type { AddFolioItemDto, AddPaymentDto, BillingListQuery } from "../schemas/folio";
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
              guest: { select: { fullName: true } },
              rooms: {
                take:   1,
                select: { room: { select: { number: true } } },
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
    });
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
        select: { id: true },
      });
      if (!folio) throw new AppError(404, "Folio not found");

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
