import type { TenantTx } from "@pms/db";
import type { JwtPayload } from "../middleware/auth";
import { AppError } from "../utils/AppError";
import { notifyHotelDataChanged } from "../lib/realtime";
import type {
  CreateCategoryDto,
  UpdateCategoryDto,
  CreateItemDto,
  UpdateItemDto,
  RecipeIngredientDto,
} from "../schemas/pos";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

// A foreign key to inventory_items proves the row exists, not that it belongs
// to this hotel — Postgres checks FKs with RLS bypassed. Without this, a
// crafted request could point a recipe at another tenant's stock.
async function assertIngredientsBelongToHotel(
  db: TenantTx,
  hotelId: string,
  lines: RecipeIngredientDto[],
): Promise<void> {
  if (lines.length === 0) return;
  const ids = [...new Set(lines.map((line) => line.inventoryItemId))];
  const found = await db.inventoryItem.findMany({
    where:  { id: { in: ids }, hotelId },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    throw new AppError(400, "One or more ingredients are not inventory items of this hotel");
  }
}

function ingredientRows(hotelId: string, lines: RecipeIngredientDto[]) {
  return lines.map((line) => ({
    hotelId,
    inventoryItemId: line.inventoryItemId,
    qtyUsed:         line.qtyUsed,
  }));
}

export const PosMenuService = {
  // includeInactive=true also returns categories hidden from the POS terminal
  // (e.g. QR-only categories) — used by the Menu Setup admin screen so staff
  // can still find and edit them.
  async listCategories(withTenant: WithTenantFn, includeInactive = false) {
    return withTenant(async (db) => {
      const categories = await db.posCategory.findMany({
        where:   includeInactive ? {} : { isActive: true },
        include: {
          items: {
            where:   includeInactive ? {} : { isAvailable: true },
            include: {
              ingredients: {
                include: {
                  inventoryItem: {
                    select: { name: true, unit: true, currentStock: true, isActive: true },
                  },
                },
              },
            },
            orderBy: { sortOrder: "asc" },
          },
        },
        orderBy: { sortOrder: "asc" },
      });

      return categories.map((category) => ({
        ...category,
        // inventoryItemId / inventoryQtyUsed are dropped here on purpose: the
        // columns survive until the phase-2 migration, but they hold stale
        // pre-backfill values and nothing should read them again.
        items: category.items.map(({ inventoryItemId, inventoryQtyUsed, ingredients, ...item }) => ({
          ...item,
          ingredients: ingredients.map((line) => ({
            inventoryItemId: line.inventoryItemId,
            name:            line.inventoryItem.name,
            unit:            line.inventoryItem.unit,
            qtyUsed:         Number(line.qtyUsed),
            currentStock:    Number(line.inventoryItem.currentStock),
            isActive:        line.inventoryItem.isActive,
          })),
        })),
      }));
    });
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
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
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
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
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
    }).then(() => {
      notifyHotelDataChanged(actor.hotelId);
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

      await assertIngredientsBelongToHotel(db, actor.hotelId, dto.ingredients);

      const item = await db.posItem.create({
        data: {
          hotelId:          actor.hotelId,
          categoryId,
          name:             dto.name,
          description:      dto.description,
          price:            dto.price,
          isAvailable:      dto.isAvailable,
          sortOrder:        dto.sortOrder,
          ingredients:      { create: ingredientRows(actor.hotelId, dto.ingredients) },
          photoUrl:         dto.photoUrl ?? null,
          isQrVisible:      dto.isQrVisible,
          isFeatured:       dto.isFeatured,
          taxRate:          dto.taxRate,
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
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
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

      if (dto.ingredients) await assertIngredientsBelongToHotel(db, actor.hotelId, dto.ingredients);

      const updated = await db.posItem.update({
        where: { id },
        data: {
          ...(dto.name             !== undefined && { name:             dto.name }),
          ...(dto.description      !== undefined && { description:      dto.description }),
          ...(dto.price            !== undefined && { price:            dto.price }),
          ...(dto.isAvailable      !== undefined && { isAvailable:      dto.isAvailable }),
          ...(dto.sortOrder        !== undefined && { sortOrder:        dto.sortOrder }),
          // Sending `ingredients` replaces the recipe wholesale; omitting it
          // leaves the existing lines untouched.
          ...(dto.ingredients !== undefined && {
            ingredients: {
              deleteMany: {},
              create:     ingredientRows(actor.hotelId, dto.ingredients),
            },
          }),
          ...(dto.photoUrl         !== undefined && { photoUrl:         dto.photoUrl }),
          ...(dto.isQrVisible      !== undefined && { isQrVisible:      dto.isQrVisible }),
          ...(dto.isFeatured       !== undefined && { isFeatured:       dto.isFeatured }),
          ...(dto.taxRate          !== undefined && { taxRate:          dto.taxRate }),
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
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
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
    }).then(() => {
      notifyHotelDataChanged(actor.hotelId);
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
    }).then((result) => {
      notifyHotelDataChanged(actor.hotelId);
      return result;
    });
  },
};
