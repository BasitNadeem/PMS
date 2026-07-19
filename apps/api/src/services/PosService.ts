import type { TenantTx } from "@pms/db";
import { FolioItemType } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { recalculateFolioTotals } from "../utils/folioTotals";
import { notifyHotelDataChanged } from "../lib/realtime";
import type { CreateOrderDto, ListOrdersQuery } from "../schemas/pos";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

// ── Status encoding in tableNumber field ──────────────────────────────────────
// null           → OPEN
// "PAID:<METHOD>"→ PAID (direct payment)
// "CANCELLED"    → CANCELLED
// isPostedToFolio → POSTED_TO_FOLIO (tableNumber may be anything else)

type OrderStatus = "OPEN" | "POSTED_TO_FOLIO" | "PAID" | "CANCELLED";

function deriveStatus(order: {
  isPostedToFolio: boolean;
  tableNumber: string | null;
}): OrderStatus {
  if (order.tableNumber === "CANCELLED") return "CANCELLED";
  if (order.isPostedToFolio) return "POSTED_TO_FOLIO";
  if (order.tableNumber?.startsWith("PAID:")) return "PAID";
  return "OPEN";
}

function mapOrder<
  T extends { isPostedToFolio: boolean; tableNumber: string | null },
>(order: T) {
  return {
    ...order,
    status:        deriveStatus(order),
    paymentMethod: order.tableNumber?.startsWith("PAID:")
      ? order.tableNumber.slice(5)
      : null,
  };
}

function buildStatusWhere(
  status?: string,
): Record<string, unknown> {
  if (!status) return {};
  if (status === "CANCELLED")       return { tableNumber: "CANCELLED" };
  if (status === "POSTED_TO_FOLIO") return { isPostedToFolio: true };
  if (status === "PAID")            return { isPostedToFolio: false, tableNumber: { startsWith: "PAID:" } };
  if (status === "OPEN")            return { isPostedToFolio: false, tableNumber: null };
  return {};
}

// ── Service ───────────────────────────────────────────────────────────────────

export const PosService = {
  async listOrders(withTenant: WithTenantFn, query: ListOrdersQuery) {
    const skip        = (query.page - 1) * query.limit;
    const statusWhere = buildStatusWhere(query.status);

    const [rows, total] = await withTenant((db) =>
      Promise.all([
        db.posOrder.findMany({
          where:   statusWhere,
          include: {
            items: {
              select: {
                id:        true,
                name:      true,
                quantity:  true,
                unitPrice: true,
                lineTotal: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: query.limit,
        }),
        db.posOrder.count({ where: statusWhere }),
      ]),
    );

    return {
      data: rows.map(mapOrder),
      meta: paginationMeta(total, query.page, query.limit),
    };
  },

  async createOrder(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateOrderDto) {
    const result = await withTenant(async (db) => {
      // Fetch and validate all requested items
      const posItemIds = dto.items.map((i) => i.posItemId);
      const posItems   = await db.posItem.findMany({
        where: { id: { in: posItemIds }, isAvailable: true },
      });
      if (posItems.length !== posItemIds.length) {
        throw new AppError(400, "One or more items are unavailable or not found");
      }

      // Fetch hotel settings to get global POS tax rate
      const hotel = await db.hotel.findUnique({
        where:  { id: actor.hotelId },
        select: { settings: true },
      });
      const hotelSettings = (hotel?.settings ?? {}) as Record<string, unknown>;
      const posTaxRatePct = typeof hotelSettings.posTaxRate === "number" ? hotelSettings.posTaxRate : 0;
      const posTaxRate    = posTaxRatePct / 100;

      // Calculate totals
      const subtotal = dto.items.reduce((sum, orderItem) => {
        const item = posItems.find((p) => p.id === orderItem.posItemId)!;
        return sum + item.price * orderItem.quantity;
      }, 0);

      const taxAmount = Math.round(subtotal * posTaxRate);

      const orderNumber = `POS-${Date.now()}-${String(Math.floor(Math.random() * 9999)).padStart(4, "0")}`;

      // Initial tableNumber (will be updated for DIRECT)
      const initialTableNumber: string | null =
        dto.settlementType === "DIRECT" ? `PAID:${dto.paymentMethod ?? "CASH"}` : null;

      // Create the order and its items
      const order = await db.posOrder.create({
        data: {
          hotelId:       actor.hotelId,
          orderNumber,
          reservationId: dto.reservationId ?? null,
          subtotal,
          taxAmount,
          total:         subtotal + taxAmount,
          tableNumber:   initialTableNumber,
          notes:         dto.notes ?? null,
          items: {
            create: dto.items.map((orderItem) => {
              const item = posItems.find((p) => p.id === orderItem.posItemId)!;
              return {
                posItemId: item.id,
                name:      item.name,
                quantity:  orderItem.quantity,
                unitPrice: item.price,
                taxRate:   item.taxRate,
                lineTotal: item.price * orderItem.quantity,
              };
            }),
          },
        },
        include: { items: true },
      });

      // FOLIO settlement: post items to guest folio
      if (dto.settlementType === "FOLIO" && dto.reservationId) {
        const reservation = await db.reservation.findUnique({
          where:   { id: dto.reservationId },
          include: {
            folio: { select: { id: true } },
            rooms: {
              take:    1,
              include: { room: { select: { number: true } } },
            },
          },
        });

        if (!reservation) throw new AppError(404, "Reservation not found");
        if (reservation.status !== "CHECKED_IN") {
          throw new AppError(400, "Guest is not checked in");
        }
        if (!reservation.folio) throw new AppError(400, "No folio found for this reservation");

        const roomNumber = reservation.rooms[0]?.room.number ?? null;

        for (const orderItem of order.items) {
          await db.folioItem.create({
            data: {
              hotelId:        actor.hotelId,
              folioId:        reservation.folio.id,
              type:           FolioItemType.FOOD_BEVERAGE,
              description:    `${orderItem.name} (POS)`,
              unitAmount:     orderItem.unitPrice,
              quantity:       orderItem.quantity,
              amount:         orderItem.lineTotal,
              netAmount:      orderItem.lineTotal,
              posOrderItemId: orderItem.id,
            },
          });
        }

        await recalculateFolioTotals(db, reservation.folio.id);

        await db.posOrder.update({
          where: { id: order.id },
          data: {
            isPostedToFolio: true,
            folioId:         reservation.folio.id,
            roomNumber,
            postedAt:        new Date(),
          },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "POS_ORDER_CREATE",
          entity:   "posOrder",
          entityId: order.id,
          after:    JSON.parse(
            JSON.stringify({ orderNumber, settlementType: dto.settlementType, total: subtotal + taxAmount }),
          ),
        },
      });

      const final = await db.posOrder.findUnique({
        where:   { id: order.id },
        include: { items: true },
      });

      return mapOrder(final!);
    });

    notifyHotelDataChanged(actor.hotelId);
    return result;
  },

  async updateOrderStatus(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    orderId: string,
  ) {
    const result = await withTenant(async (db) => {
      const order = await db.posOrder.findUnique({ where: { id: orderId } });
      if (!order) throw new AppError(404, "Order not found");

      const currentStatus = deriveStatus(order);
      if (currentStatus !== "OPEN") {
        throw new AppError(400, `Cannot cancel an order with status ${currentStatus}`);
      }

      const updated = await db.posOrder.update({
        where: { id: orderId },
        data:  { tableNumber: "CANCELLED" },
        include: { items: true },
      });

      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "POS_ORDER_CANCEL",
          entity:   "posOrder",
          entityId: orderId,
          before:   JSON.parse(JSON.stringify({ status: "OPEN" })),
          after:    JSON.parse(JSON.stringify({ status: "CANCELLED" })),
        },
      });

      return mapOrder(updated);
    });

    notifyHotelDataChanged(actor.hotelId);
    return result;
  },
};
