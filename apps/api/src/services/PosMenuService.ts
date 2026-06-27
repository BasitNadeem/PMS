import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateItemDto,
  UpdateItemDto,
} from "../schemas/pos";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

export const PosMenuService = {
  // includeInactive=true also returns categories hidden from the POS terminal
  // (e.g. QR-only categories) — used by the Menu Setup admin screen so staff
  // can still find and edit them.
  async listCategories(withTenant: WithTenantFn, includeInactive = false) {
    return withTenant((db) =>
      db.posCategory.findMany({
        where:   includeInactive ? {} : { isActive: true },
        include: {
          items: {
            where:   includeInactive ? {} : { isAvailable: true },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      }),
    );
  },

  async createCategory(withTenant: WithTenantFn, actor: JwtPayload, dto: CreateCategoryDto) {
    return withTenant(async (db) => {
      const category = await db.posCategory.create({
        data: {
          hotelId:        actor.hotelId,
          name:           dto.name,
          sortOrder:      dto.sortOrder,
          isActive:       true,
          isQrVisible:    dto.isQrVisible,
          availableFrom:  dto.availableFrom ?? null,
          availableUntil: dto.availableUntil ?? null,
        },
      });
      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "POS_CATEGORY_CREATE",
          entity:   "posCategory",
          entityId: category.id,
          after:    JSON.parse(JSON.stringify({ name: dto.name })),
        },
      });
      return category;
    });
  },

  async updateCategory(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    id: string,
    dto: UpdateCategoryDto,
  ) {
    return withTenant(async (db) => {
      const existing = await db.posCategory.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Category not found");

      const updated = await db.posCategory.update({
        where: { id },
        data: {
          ...(dto.name           !== undefined && { name:           dto.name }),
          ...(dto.sortOrder      !== undefined && { sortOrder:      dto.sortOrder }),
          ...(dto.isActive       !== undefined && { isActive:       dto.isActive }),
          ...(dto.isQrVisible    !== undefined && { isQrVisible:    dto.isQrVisible }),
          ...(dto.availableFrom  !== undefined && { availableFrom:  dto.availableFrom }),
          ...(dto.availableUntil !== undefined && { availableUntil: dto.availableUntil }),
        },
      });
      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "POS_CATEGORY_UPDATE",
          entity:   "posCategory",
          entityId: id,
          after:    JSON.parse(JSON.stringify(dto)),
        },
      });
      return updated;
    });
  },

  async deleteCategory(withTenant: WithTenantFn, actor: JwtPayload, id: string) {
    return withTenant(async (db) => {
      const existing = await db.posCategory.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Category not found");

      const itemCount = await db.posItem.count({ where: { categoryId: id } });
      if (itemCount > 0) {
        throw new AppError(409, "Move or delete the items in this category first");
      }

      await db.posCategory.delete({ where: { id } });
      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "POS_CATEGORY_DELETE",
          entity:   "posCategory",
          entityId: id,
        },
      });
    });
  },

  async createItem(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    categoryId: string,
    dto: CreateItemDto,
  ) {
    return withTenant(async (db) => {
      const category = await db.posCategory.findUnique({ where: { id: categoryId } });
      if (!category) throw new AppError(404, "Category not found");

      const item = await db.posItem.create({
        data: {
          hotelId:     actor.hotelId,
          categoryId,
          name:        dto.name,
          description: dto.description,
          price:       dto.price,
          isAvailable: dto.isAvailable,
          sortOrder:   dto.sortOrder,
          photoUrl:    dto.photoUrl ?? null,
          isQrVisible: dto.isQrVisible,
          isFeatured:  dto.isFeatured,
        },
      });
      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "POS_ITEM_CREATE",
          entity:   "posItem",
          entityId: item.id,
          after:    JSON.parse(JSON.stringify({ name: dto.name, price: dto.price })),
        },
      });
      return item;
    });
  },

  async updateItem(
    withTenant: WithTenantFn,
    actor: JwtPayload,
    id: string,
    dto: UpdateItemDto,
  ) {
    return withTenant(async (db) => {
      const existing = await db.posItem.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Menu item not found");

      const updated = await db.posItem.update({
        where: { id },
        data: {
          ...(dto.name             !== undefined && { name:             dto.name }),
          ...(dto.description      !== undefined && { description:      dto.description }),
          ...(dto.price            !== undefined && { price:            dto.price }),
          ...(dto.isAvailable      !== undefined && { isAvailable:      dto.isAvailable }),
          ...(dto.sortOrder        !== undefined && { sortOrder:        dto.sortOrder }),
          ...(dto.inventoryItemId  !== undefined && { inventoryItemId:  dto.inventoryItemId }),
          ...(dto.inventoryQtyUsed !== undefined && { inventoryQtyUsed: dto.inventoryQtyUsed }),
          ...(dto.photoUrl         !== undefined && { photoUrl:         dto.photoUrl }),
          ...(dto.isQrVisible      !== undefined && { isQrVisible:      dto.isQrVisible }),
          ...(dto.isFeatured       !== undefined && { isFeatured:       dto.isFeatured }),
        },
      });
      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "POS_ITEM_UPDATE",
          entity:   "posItem",
          entityId: id,
          after:    JSON.parse(JSON.stringify(dto)),
        },
      });
      return updated;
    });
  },

  async deleteItem(withTenant: WithTenantFn, actor: JwtPayload, id: string) {
    return withTenant(async (db) => {
      const existing = await db.posItem.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Menu item not found");

      await db.posItem.delete({ where: { id } });
      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "POS_ITEM_DELETE",
          entity:   "posItem",
          entityId: id,
        },
      });
    });
  },

  async toggleItemAvailability(withTenant: WithTenantFn, actor: JwtPayload, id: string) {
    return withTenant(async (db) => {
      const existing = await db.posItem.findUnique({ where: { id } });
      if (!existing) throw new AppError(404, "Menu item not found");

      const updated = await db.posItem.update({
        where: { id },
        data:  { isAvailable: !existing.isAvailable },
      });
      await db.auditLog.create({
        data: {
          hotelId:  actor.hotelId,
          userId:   actor.userId,
          action:   "POS_ITEM_TOGGLE",
          entity:   "posItem",
          entityId: id,
          after:    JSON.parse(JSON.stringify({ isAvailable: updated.isAvailable })),
        },
      });
      return updated;
    });
  },
};
