import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import type {
  ListUpsellItemsQuery,
  CreateUpsellItemDto,
  UpdateUpsellItemDto,
} from "../schemas/upsells";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { publicWithTenant } from "../lib/publicTenant";
import { notifyHotelDataChanged } from "../lib/realtime";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export const UpsellService = {
  async listUpsellItems(withTenant: WithTenantFn, query: ListUpsellItemsQuery) {
    const skip = (query.page - 1) * query.limit;
    const where = query.isActive !== undefined ? { isActive: query.isActive } : {};

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.upsellItem.findMany({
          where,
          orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
          skip,
          take: query.limit,
        }),
        db.upsellItem.count({ where }),
      ])
    );

    return { data: items, meta: paginationMeta(total, query.page, query.limit) };
  },

  async createUpsellItem(
    withTenant: WithTenantFn,
    hotelId: string,
    data: CreateUpsellItemDto,
    actor: JwtPayload
  ) {
    return withTenant(async (db) => {
      const item = await db.upsellItem.create({
        data: {
          hotelId,
          name:        data.name,
          description: data.description,
          category:    data.category,
          priceType:   data.priceType,
          amount:      data.amount,
          imageUrl:    data.imageUrl,
        },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actor.userId,
          action:   "UPSELL_CREATE",
          entity:   "upsellItem",
          entityId: item.id,
          after:    JSON.parse(JSON.stringify({ name: item.name, amount: item.amount })),
        },
      });

      return item;
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async updateUpsellItem(
    withTenant: WithTenantFn,
    hotelId: string,
    id: string,
    data: UpdateUpsellItemDto,
    actor: JwtPayload
  ) {
    return withTenant(async (db) => {
      const existing = await db.upsellItem.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Upsell not found");

      const item = await db.upsellItem.update({
        where: { id },
        data: {
          ...(data.name        !== undefined && { name: data.name }),
          ...(data.description !== undefined && { description: data.description }),
          ...(data.category    !== undefined && { category: data.category }),
          ...(data.priceType   !== undefined && { priceType: data.priceType }),
          ...(data.amount      !== undefined && { amount: data.amount }),
          ...(data.imageUrl    !== undefined && { imageUrl: data.imageUrl }),
          ...(data.isActive    !== undefined && { isActive: data.isActive }),
        },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actor.userId,
          action:   "UPSELL_UPDATE",
          entity:   "upsellItem",
          entityId: item.id,
          before:   JSON.parse(JSON.stringify({ name: existing.name, amount: existing.amount, isActive: existing.isActive })),
          after:    JSON.parse(JSON.stringify({ name: item.name, amount: item.amount, isActive: item.isActive })),
        },
      });

      return item;
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  // Soft-deactivate rather than delete: past reservations reference the item,
  // and ReservationUpsell keeps its own price snapshot regardless.
  async deactivateUpsellItem(
    withTenant: WithTenantFn,
    hotelId: string,
    id: string,
    actor: JwtPayload
  ) {
    return withTenant(async (db) => {
      const existing = await db.upsellItem.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Upsell not found");

      const item = await db.upsellItem.update({
        where: { id },
        data: { isActive: false },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actor.userId,
          action:   "UPSELL_DELETE",
          entity:   "upsellItem",
          entityId: item.id,
          before:   JSON.parse(JSON.stringify({ name: existing.name, isActive: existing.isActive })),
        },
      });

      return item;
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async listActiveUpsellsPublic(hotelId: string) {
    return publicWithTenant(hotelId)((db) =>
      db.upsellItem.findMany({
        where: { isActive: true },
        orderBy: { createdAt: "asc" },
        select: {
          id:          true,
          name:        true,
          description: true,
          category:    true,
          priceType:   true,
          amount:      true,
          imageUrl:    true,
        },
      })
    );
  },
};
