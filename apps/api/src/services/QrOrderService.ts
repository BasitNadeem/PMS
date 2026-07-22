/**
 * QrOrderService — raw-table service for qr_orders and qr_order_items.
 *
 * Uses adminPrisma throughout — including for folio posting — because public
 * endpoints have no authenticated user and therefore no withTenant context.
 * This mirrors how CashBookService and ExpenseService work.
 *
 * Auto-folio-post is always fire-and-forget (wrapped in .catch) so a folio
 * failure never blocks guest order placement.
 */

import { adminPrisma, Prisma, ReservationStatus, FolioItemType } from "@pms/db";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { QrMenuService } from "./QrMenuService";
import { deductInventoryForQrOrder } from "./InventoryService";
import { createLedgerEntryFromQrOrder } from "./CashBookService";
import { notifyHotelDataChanged } from "../lib/realtime";
import type { PlaceOrderDto, ListQrOrdersQuery, AdvanceStatusDto, EditOrderDto } from "../schemas/qrMenu";

// ── Row types ─────────────────────────────────────────────────────────────────

export interface QrOrderRow {
  id:                   string;
  hotel_id:             string;
  order_number:         string;
  guest_name:           string;
  guest_phone:          string;
  room_number:          string | null;
  room_verified:        boolean;
  reservation_id:       string | null;
  delivery_type:        string;
  special_instructions: string | null;
  status:               string;
  total_amount:         bigint;
  folio_id:                string | null;
  requires_folio_review:   boolean;
  payment_preference:      string; // "charge_to_room" | "pay_now"
  payment_method:          string | null;
  created_at:              Date;
  updated_at:              Date;
}

export interface QrOrderItemRow {
  id:            string;
  order_id:      string;
  menu_item_id:  string | null;
  item_name:     string;
  item_price:    bigint;
  quantity:      number;
  special_note:  string | null;
  subtotal:      bigint;
  created_at:    Date;
}

type SerializedOrder     = Omit<QrOrderRow, "total_amount"> & { total_amount: number };
type SerializedOrderItem = Omit<QrOrderItemRow, "item_price" | "subtotal"> & { item_price: number; subtotal: number };

function serializeOrder(row: QrOrderRow): SerializedOrder {
  return { ...row, total_amount: Number(row.total_amount) };
}

function serializeOrderItem(row: QrOrderItemRow): SerializedOrderItem {
  return {
    ...row,
    item_price: Number(row.item_price),
    subtotal:   Number(row.subtotal),
  };
}

// ── Folio helpers (adminPrisma — no RLS/withTenant available in public routes)

async function recalcFolioTotals(folioId: string): Promise<void> {
  const items = await adminPrisma.folioItem.findMany({
    where:  { folioId, isVoided: false },
    select: { type: true, amount: true },
  });
  let charges = 0, taxes = 0, discounts = 0;
  for (const item of items) {
    if (item.type === FolioItemType.TAX)          taxes     += item.amount;
    else if (item.type === FolioItemType.DISCOUNT) discounts += item.amount;
    else                                           charges   += item.amount;
  }
  const paymentsAgg = await adminPrisma.payment.aggregate({
    where: { folioId, status: "COMPLETED", isRefund: false },
    _sum:  { amount: true },
  });
  const payments = paymentsAgg._sum.amount ?? 0;
  const balance  = charges + taxes - discounts - payments;
  await adminPrisma.folio.update({
    where: { id: folioId },
    data: {
      chargesTotal:   charges,
      taxTotal:       taxes,
      discountsTotal: discounts,
      paymentsTotal:  payments,
      balanceDue:     Math.max(0, balance),
    },
  });
}

// Reads snapshotted items from qr_order_items — called on delivery, not on order creation.
async function autoPostToFolio(
  hotelId:       string,
  orderId:       string,
  orderNumber:   string,
  reservationId: string,
): Promise<void> {
  const folio = await adminPrisma.folio.findUnique({
    where:  { reservationId },
    select: { id: true, isOpen: true },
  });
  if (!folio?.isOpen) return;

  const items = await adminPrisma.$queryRaw<QrOrderItemRow[]>`
    SELECT * FROM qr_order_items WHERE order_id = ${orderId}::uuid
  `;

  for (const item of items) {
    await adminPrisma.folioItem.create({
      data: {
        hotelId,
        folioId:     folio.id,
        type:        FolioItemType.FOOD_BEVERAGE,
        description: `${item.item_name} (QR Order ${orderNumber})`,
        unitAmount:  Number(item.item_price),
        quantity:    item.quantity,
        amount:      Number(item.subtotal),
        netAmount:   Number(item.subtotal),
      },
    });
  }

  await recalcFolioTotals(folio.id);

  await adminPrisma.$executeRaw`
    UPDATE qr_orders
    SET    folio_id = ${folio.id}::uuid, updated_at = now()
    WHERE  id       = ${orderId}::uuid AND hotel_id = ${hotelId}::uuid
  `;
}

// ── Shared item-fetch helper ──────────────────────────────────────────────────

async function fetchAndValidateItems(
  hotelId: string,
  orderItems: PlaceOrderDto["items"],
): Promise<Map<string, { name: string; price: number }>> {
  const uniqueIds  = [...new Set(orderItems.map((i) => i.menuItemId))];
  const menuItems  = await QrMenuService.getItemsByIds(hotelId, uniqueIds);

  if (menuItems.length !== uniqueIds.length) {
    throw new AppError(400, "One or more menu items not found");
  }
  // isQrVisible alone gates QR orderability — independent of isAvailable (POS).
  const unavailable = menuItems.filter((i) => !i.isQrVisible);
  if (unavailable.length > 0) {
    throw new AppError(400, `"${unavailable[0].name}" is currently unavailable`);
  }

  return new Map(menuItems.map((i) => [i.id, { name: i.name, price: i.price }]));
}

// ── Service ───────────────────────────────────────────────────────────────────

export const QrOrderService = {

  // ── Public: verify room (returns only found + roomNumber — no PII) ─────────

  async verifyRoom(hotelId: string, roomNumber: string): Promise<{
    found:      boolean;
    roomNumber: string;
    guestName:  string | null;
    guestPhone: string | null;
  }> {
    const reservation = await adminPrisma.reservation.findFirst({
      where: {
        hotelId,
        status: ReservationStatus.CHECKED_IN,
        rooms:  { some: { room: { number: roomNumber } } },
      },
      select: {
        id:    true,
        guest: { select: { fullName: true, phone: true } },
      },
    });
    if (!reservation) {
      return { found: false, roomNumber, guestName: null, guestPhone: null };
    }
    return {
      found:      true,
      roomNumber,
      guestName:  reservation.guest.fullName,
      guestPhone: reservation.guest.phone ?? null,
    };
  },

  // ── Public: place order ────────────────────────────────────────────────────

  async createOrder(
    hotelId: string,
    dto: PlaceOrderDto,
  ): Promise<{ orderNumber: string; estimatedMinutes: number }> {
    // 1. Validate items and build price map
    const itemMap = await fetchAndValidateItems(hotelId, dto.items);
    const total   = dto.items.reduce(
      (sum, oi) => sum + (itemMap.get(oi.menuItemId)!.price * oi.quantity),
      0,
    );

    // 2. Verify room (non-fatal — order proceeds even if verification fails or throws)
    let roomVerified   = false;
    let reservationId: string | null = null;
    if (dto.roomNumber) {
      try {
        const reservation = await adminPrisma.reservation.findFirst({
          where: {
            hotelId,
            status: ReservationStatus.CHECKED_IN,
            rooms:  { some: { room: { number: dto.roomNumber } } },
          },
          select: { id: true },
        });
        if (reservation) {
          roomVerified  = true;
          reservationId = reservation.id;
        }
      } catch {
        // Verification failure is non-fatal
      }
    }

    // 3. Atomically assign a sequential order number and insert the order.
    //    pg_advisory_xact_lock serialises concurrent order-number generation
    //    per hotel without a dedicated counter table.
    const resIdSql = reservationId != null
      ? Prisma.sql`${reservationId}::uuid`
      : Prisma.sql`NULL::uuid`;

    const order = await adminPrisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(hashtext(${hotelId})::bigint)
      `;

      const counterRows = await tx.$queryRaw<[{ n: number }]>`
        SELECT COALESCE(MAX(CAST(SUBSTRING(order_number FROM 5) AS INTEGER)), 0) + 1 AS n
        FROM   qr_orders
        WHERE  hotel_id = ${hotelId}::uuid
      `;
      const orderNumber = `ORD-${String(counterRows[0]?.n ?? 1).padStart(4, "0")}`;

      const [newOrder] = await tx.$queryRaw<QrOrderRow[]>(Prisma.sql`
        INSERT INTO qr_orders
          (hotel_id, order_number, guest_name, guest_phone, room_number,
           room_verified, reservation_id, delivery_type, special_instructions,
           payment_preference, status, total_amount)
        VALUES
          (${hotelId}::uuid, ${orderNumber}, ${dto.guestName}, ${dto.guestPhone},
           ${dto.roomNumber ?? null}, ${roomVerified}, ${resIdSql},
           ${dto.deliveryType}, ${dto.specialInstructions ?? null},
           ${dto.paymentPreference ?? "charge_to_room"},
           'pending', ${total}::bigint)
        RETURNING *
      `);

      // Snapshot line items (item_name + item_price are copied at order time)
      for (const oi of dto.items) {
        const item = itemMap.get(oi.menuItemId)!;
        await tx.$executeRaw`
          INSERT INTO qr_order_items
            (order_id, menu_item_id, item_name, item_price, quantity, special_note, subtotal)
          VALUES
            (${newOrder.id}::uuid, ${oi.menuItemId}::uuid, ${item.name},
             ${item.price}::bigint, ${oi.quantity}::int,
             ${oi.specialNote ?? null}, ${item.price * oi.quantity}::bigint)
        `;
      }

      return newOrder;
    });

    notifyHotelDataChanged(hotelId);
    return { orderNumber: order.order_number, estimatedMinutes: 25 };
  },

  // ── Staff: list all orders (with items attached) ───────────────────────────

  async listOrders(hotelId: string, params: ListQrOrdersQuery) {
    const skip  = (params.page - 1) * params.limit;
    const conds: Prisma.Sql[] = [Prisma.sql`hotel_id = ${hotelId}::uuid`];

    if (params.status)    conds.push(Prisma.sql`status     = ${params.status}`);
    if (params.startDate) conds.push(Prisma.sql`created_at >= ${params.startDate}::date`);
    if (params.endDate)   conds.push(Prisma.sql`created_at <  (${params.endDate}::date + INTERVAL '1 day')`);

    const where = Prisma.join(conds, " AND ");

    const [orders, countRows] = await Promise.all([
      adminPrisma.$queryRaw<QrOrderRow[]>`
        SELECT * FROM qr_orders
        WHERE  ${where}
        ORDER  BY created_at DESC
        LIMIT  ${params.limit}::int
        OFFSET ${skip}::int
      `,
      adminPrisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*)::bigint AS count FROM qr_orders WHERE ${where}
      `,
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    if (orders.length === 0) {
      return { data: [], meta: paginationMeta(total, params.page, params.limit) };
    }

    const orderIds = orders.map((o) => o.id);
    const items    = await adminPrisma.$queryRaw<QrOrderItemRow[]>`
      SELECT * FROM qr_order_items
      WHERE  order_id = ANY(${orderIds}::uuid[])
      ORDER  BY created_at ASC
    `;

    const itemsByOrder = new Map<string, SerializedOrderItem[]>();
    for (const item of items) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(serializeOrderItem(item));
      itemsByOrder.set(item.order_id, list);
    }

    return {
      data: orders.map((o) => ({ ...serializeOrder(o), items: itemsByOrder.get(o.id) ?? [] })),
      meta: paginationMeta(total, params.page, params.limit),
    };
  },

  // ── Kitchen: active orders only (excludes delivered and cancelled) ─────────

  async getKitchenOrders(hotelId: string) {
    const orders = await adminPrisma.$queryRaw<QrOrderRow[]>`
      SELECT * FROM qr_orders
      WHERE  hotel_id = ${hotelId}::uuid
        AND  status   NOT IN ('delivered', 'cancelled')
      ORDER  BY created_at DESC
    `;

    if (orders.length === 0) return [];

    const orderIds = orders.map((o) => o.id);
    const items    = await adminPrisma.$queryRaw<QrOrderItemRow[]>`
      SELECT * FROM qr_order_items
      WHERE  order_id = ANY(${orderIds}::uuid[])
      ORDER  BY created_at ASC
    `;

    const itemsByOrder = new Map<string, SerializedOrderItem[]>();
    for (const item of items) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(serializeOrderItem(item));
      itemsByOrder.set(item.order_id, list);
    }

    return orders.map((o) => ({ ...serializeOrder(o), items: itemsByOrder.get(o.id) ?? [] }));
  },

  // ── Staff: advance status ──────────────────────────────────────────────────

  async advanceStatus(
    hotelId:  string,
    orderId:  string,
    dto:      AdvanceStatusDto,
    actorId:  string,
  ): Promise<SerializedOrder> {
    const rows = await adminPrisma.$queryRaw<QrOrderRow[]>`
      SELECT * FROM qr_orders
      WHERE id = ${orderId}::uuid AND hotel_id = ${hotelId}::uuid
      LIMIT 1
    `;
    if (rows.length === 0) throw new AppError(404, "Order not found");
    const order = rows[0];

    if (order.status === "cancelled") throw new AppError(400, "Cannot update a cancelled order");
    if (order.status === "delivered") throw new AppError(400, "Order is already delivered");

    // Enforce forward-only status progression (except cancel which is always allowed)
    if (dto.status !== "cancelled") {
      const SEQ = ["pending", "confirmed", "preparing", "ready", "delivered"] as const;
      const cur = SEQ.indexOf(order.status as (typeof SEQ)[number]);
      const nxt = SEQ.indexOf(dto.status as (typeof SEQ)[number]);
      if (nxt <= cur) {
        throw new AppError(400, `Cannot move order from "${order.status}" to "${dto.status}"`);
      }
    }

    // "Pay now" orders have no folio to reconcile against — staff must record
    // which payment method the guest actually handed over before the order can
    // be marked delivered, so the sale lands in the cash book.
    if (dto.status === "delivered" && order.payment_preference === "pay_now" && !dto.paymentMethod) {
      throw new AppError(400, "Payment method received is required to mark this order delivered");
    }

    const [updated] = await adminPrisma.$queryRaw<QrOrderRow[]>`
      UPDATE qr_orders
      SET    status         = ${dto.status},
             payment_method = ${dto.paymentMethod ?? order.payment_method},
             updated_at     = now()
      WHERE  id     = ${orderId}::uuid AND hotel_id = ${hotelId}::uuid
      RETURNING *
    `;
    await adminPrisma.auditLog.create({
      data: {
        hotelId, userId: actorId,
        action:   "QR_ORDER_STATUS_UPDATE",
        entity:   "qr_order",
        entityId: orderId,
        before:   JSON.parse(JSON.stringify({ status: order.status })),
        after:    JSON.parse(JSON.stringify({ status: dto.status })),
      },
    });

    // On delivery: auto-post to folio if guest chose "charge to room" and hasn't been posted yet
    if (
      dto.status === "delivered" &&
      order.payment_preference === "charge_to_room" &&
      order.reservation_id &&
      !order.folio_id
    ) {
      autoPostToFolio(hotelId, orderId, order.order_number, order.reservation_id)
        .catch((err) => {
          console.error("[QrOrder] folio post on delivery failed:", order.order_number, err);
        });
    }

    // On delivery of a "pay now" order: record the sale in the cash book under
    // whichever payment method staff just captured above.
    if (dto.status === "delivered" && order.payment_preference === "pay_now" && dto.paymentMethod) {
      createLedgerEntryFromQrOrder(
        hotelId,
        {
          id:            orderId,
          orderNumber:   order.order_number,
          total:         Number(order.total_amount),
          paymentMethod: dto.paymentMethod,
        },
        actorId,
      );
    }

    // On confirm (kitchen accepts): deduct inventory for linked items. Forward-only
    // status progression above guarantees this fires exactly once per order —
    // a "pending" order that gets cancelled before confirmation never deducts.
    if (dto.status === "confirmed") {
      const orderItems = await adminPrisma.$queryRaw<QrOrderItemRow[]>`
        SELECT * FROM qr_order_items WHERE order_id = ${orderId}::uuid
      `;
      const deductible = orderItems
        .filter((i) => i.menu_item_id !== null)
        .map((i) => ({ posItemId: i.menu_item_id as string, quantity: i.quantity }));

      if (deductible.length > 0) {
        deductInventoryForQrOrder(hotelId, orderId, deductible, actorId)
          .catch((err) => console.error("[Inventory] QR order deduction error:", order.order_number, err));
      }
    }

    notifyHotelDataChanged(hotelId);
    return serializeOrder(updated!);
  },

  // ── Staff: manual post to folio ────────────────────────────────────────────

  async postToFolio(
    hotelId:  string,
    orderId:  string,
    actorId:  string,
  ): Promise<SerializedOrder> {
    const rows = await adminPrisma.$queryRaw<QrOrderRow[]>`
      SELECT * FROM qr_orders
      WHERE id = ${orderId}::uuid AND hotel_id = ${hotelId}::uuid
      LIMIT 1
    `;
    if (rows.length === 0) throw new AppError(404, "Order not found");
    const order = rows[0];

    if (order.folio_id)      throw new AppError(409, "Order is already posted to a folio");
    if (order.status === "cancelled") throw new AppError(400, "Cannot post a cancelled order");
    if (!order.reservation_id) {
      throw new AppError(400, "No verified reservation linked to this order");
    }

    const folio = await adminPrisma.folio.findUnique({
      where:  { reservationId: order.reservation_id },
      select: { id: true, isOpen: true },
    });
    if (!folio)        throw new AppError(404, "Folio not found for this reservation");
    if (!folio.isOpen) throw new AppError(400, "Folio is closed");

    const items = await adminPrisma.$queryRaw<QrOrderItemRow[]>`
      SELECT * FROM qr_order_items WHERE order_id = ${orderId}::uuid
    `;

    for (const item of items) {
      await adminPrisma.folioItem.create({
        data: {
          hotelId,
          folioId:     folio.id,
          type:        FolioItemType.FOOD_BEVERAGE,
          description: `${item.item_name} (QR Order ${order.order_number})`,
          unitAmount:  Number(item.item_price),
          quantity:    item.quantity,
          amount:      Number(item.subtotal),
          netAmount:   Number(item.subtotal),
        },
      });
    }

    await recalcFolioTotals(folio.id);

    const [updated] = await adminPrisma.$queryRaw<QrOrderRow[]>`
      UPDATE qr_orders
      SET    folio_id = ${folio.id}::uuid, updated_at = now()
      WHERE  id       = ${orderId}::uuid AND hotel_id = ${hotelId}::uuid
      RETURNING *
    `;
    await adminPrisma.auditLog.create({
      data: {
        hotelId, userId: actorId,
        action:   "QR_ORDER_POSTED_TO_FOLIO",
        entity:   "qr_order",
        entityId: orderId,
        after:    JSON.parse(JSON.stringify({ folioId: folio.id, orderNumber: order.order_number })),
      },
    });
    notifyHotelDataChanged(hotelId);
    return serializeOrder(updated!);
  },

  // ── Kitchen/Staff: edit order ─────────────────────────────────────────────

  async editOrder(
    hotelId: string,
    orderId: string,
    dto:     EditOrderDto,
    actorId: string,
  ) {
    const rows = await adminPrisma.$queryRaw<QrOrderRow[]>`
      SELECT * FROM qr_orders
      WHERE id = ${orderId}::uuid AND hotel_id = ${hotelId}::uuid
      LIMIT 1
    `;
    if (rows.length === 0) throw new AppError(404, "Order not found");
    const order = rows[0];
    if (order.status === "cancelled") throw new AppError(400, "Cannot edit a cancelled order");
    if (order.status === "delivered") throw new AppError(400, "Cannot edit a delivered order");

    // Re-fetch menu item prices — never trust client-sent prices
    let newTotal: number | undefined;
    const itemMap = new Map<string, { name: string; price: number }>();

    if (dto.items && dto.items.length > 0) {
      const uniqueIds = [...new Set(dto.items.map((i) => i.menuItemId))];
      const menuItems = await QrMenuService.getItemsByIds(hotelId, uniqueIds);
      if (menuItems.length !== uniqueIds.length) {
        throw new AppError(400, "One or more menu items not found");
      }
      for (const m of menuItems) itemMap.set(m.id, { name: m.name, price: m.price });
      newTotal = dto.items.reduce(
        (sum, oi) => sum + (itemMap.get(oi.menuItemId)!.price * oi.quantity),
        0,
      );
    }

    // flag folio review if already posted
    const flagFolioReview = order.folio_id != null;

    const updated = await adminPrisma.$transaction(async (tx) => {
      if (dto.items && dto.items.length > 0) {
        await tx.$executeRaw`
          DELETE FROM qr_order_items WHERE order_id = ${orderId}::uuid
        `;
        for (const oi of dto.items) {
          const item = itemMap.get(oi.menuItemId)!;
          await tx.$executeRaw`
            INSERT INTO qr_order_items
              (order_id, menu_item_id, item_name, item_price, quantity, special_note, subtotal)
            VALUES
              (${orderId}::uuid, ${oi.menuItemId}::uuid, ${item.name},
               ${item.price}::bigint, ${oi.quantity}::int,
               ${oi.specialNote ?? null}, ${item.price * oi.quantity}::bigint)
          `;
        }
      }

      const sets: Prisma.Sql[] = [];
      if (newTotal           !== undefined) sets.push(Prisma.sql`total_amount           = ${newTotal}::bigint`);
      if (dto.deliveryType   !== undefined) sets.push(Prisma.sql`delivery_type          = ${dto.deliveryType}`);
      if (dto.specialInstructions !== undefined) sets.push(Prisma.sql`special_instructions = ${dto.specialInstructions ?? null}`);
      if (flagFolioReview)                  sets.push(Prisma.sql`requires_folio_review  = true`);
      sets.push(Prisma.sql`updated_at = now()`);

      const setClause = Prisma.join(sets, ", ");
      const [result] = await tx.$queryRaw<QrOrderRow[]>`
        UPDATE qr_orders SET ${setClause}
        WHERE id = ${orderId}::uuid AND hotel_id = ${hotelId}::uuid
        RETURNING *
      `;
      return result!;
    });

    const updatedItems = await adminPrisma.$queryRaw<QrOrderItemRow[]>`
      SELECT * FROM qr_order_items WHERE order_id = ${orderId}::uuid ORDER BY created_at ASC
    `;

    await adminPrisma.auditLog.create({
      data: {
        hotelId, userId: actorId,
        action:   "QR_ORDER_EDIT",
        entity:   "qr_order",
        entityId: orderId,
        after:    JSON.parse(JSON.stringify({ deliveryType: dto.deliveryType, itemCount: dto.items?.length })),
      },
    });

    notifyHotelDataChanged(hotelId);
    return {
      ...serializeOrder(updated),
      items: updatedItems.map(serializeOrderItem),
    };
  },

  // ── Staff/Kitchen: cancel order ────────────────────────────────────────────

  async cancelOrder(
    hotelId:  string,
    orderId:  string,
    actorId:  string,
  ): Promise<SerializedOrder> {
    const rows = await adminPrisma.$queryRaw<QrOrderRow[]>`
      SELECT * FROM qr_orders
      WHERE id = ${orderId}::uuid AND hotel_id = ${hotelId}::uuid
      LIMIT 1
    `;
    if (rows.length === 0) throw new AppError(404, "Order not found");
    const order = rows[0];

    if (order.status === "cancelled") throw new AppError(400, "Order is already cancelled");
    if (order.status === "delivered") throw new AppError(400, "Cannot cancel a delivered order");

    const [updated] = await adminPrisma.$queryRaw<QrOrderRow[]>`
      UPDATE qr_orders
      SET    status = 'cancelled', updated_at = now()
      WHERE  id     = ${orderId}::uuid AND hotel_id = ${hotelId}::uuid
      RETURNING *
    `;
    await adminPrisma.auditLog.create({
      data: {
        hotelId, userId: actorId,
        action:   "QR_ORDER_CANCEL",
        entity:   "qr_order",
        entityId: orderId,
        before:   JSON.parse(JSON.stringify({ status: order.status })),
        after:    JSON.parse(JSON.stringify({ status: "cancelled" })),
      },
    });
    notifyHotelDataChanged(hotelId);
    return serializeOrder(updated!);
  },

  // ── Public: track order by order number ──────────────────────────────────

  async trackOrder(hotelId: string, orderNumber: string) {
    const rows = await adminPrisma.$queryRaw<QrOrderRow[]>`
      SELECT id, order_number, status, delivery_type, special_instructions, created_at, total_amount, payment_preference, room_number
      FROM   qr_orders
      WHERE  hotel_id     = ${hotelId}::uuid
        AND  order_number ILIKE '%' || ${orderNumber}
      ORDER  BY created_at DESC
      LIMIT  1
    `;
    if (rows.length === 0) return null;
    const order = rows[0];

    const items = await adminPrisma.$queryRaw<{ item_name: string; quantity: number; item_price: bigint; subtotal: bigint }[]>`
      SELECT item_name, quantity, item_price, subtotal
      FROM   qr_order_items
      WHERE  order_id = ${order.id}::uuid
      ORDER  BY created_at ASC
    `;

    return {
      orderNumber:         order.order_number,
      status:              order.status,
      deliveryType:        order.delivery_type,
      specialInstructions: order.special_instructions,
      createdAt:           order.created_at,
      totalAmount:         Number(order.total_amount),
      paymentPreference:   order.payment_preference,
      roomNumber:          order.room_number,
      items:               items.map((i) => ({
        name:      i.item_name,
        quantity:  i.quantity,
        price:     Number(i.item_price),
        lineTotal: Number(i.subtotal),
      })),
    };
  },
};
