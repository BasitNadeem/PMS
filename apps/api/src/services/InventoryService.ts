import type { TenantTx } from "@pms/db";
import { InventoryTransactionType, Prisma } from "@pms/db";
import { adminPrisma } from "@pms/db";
import { AppError } from "../utils/AppError";
import { paginationMeta } from "../utils/pagination";
import { notifyHotelDataChanged } from "../lib/realtime";
import type {
  ListInventoryQuery,
  CreateInventoryItemDto,
  UpdateInventoryItemDto,
  CreateTransactionDto,
} from "../schemas/inventory";

type WithTenantFn = <T>(fn: (db: TenantTx) => Promise<T>) => Promise<T>;

// Row shape returned by $queryRaw for inventory_items
interface RawInventoryItem {
  id: string;
  hotel_id: string;
  name: string;
  sku: string | null;
  category: string;
  unit: string;
  current_stock: string; // Decimal comes as string from raw
  par_level: string;
  reorder_level: string;
  cost_per_unit: number;
  supplier: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface LowStockCountRow {
  count: bigint;
}

interface TotalValueRow {
  total: string | null;
}

function mapRawItem(raw: RawInventoryItem) {
  return {
    id:           raw.id,
    hotelId:      raw.hotel_id,
    name:         raw.name,
    sku:          raw.sku,
    category:     raw.category,
    unit:         raw.unit,
    currentStock: parseFloat(raw.current_stock),
    parLevel:     parseFloat(raw.par_level),
    reorderLevel: parseFloat(raw.reorder_level),
    costPerUnit:  raw.cost_per_unit,
    supplier:     raw.supplier,
    isActive:     raw.is_active,
    createdAt:    raw.created_at,
    updatedAt:    raw.updated_at,
  };
}

export const InventoryService = {
  async listItems(withTenant: WithTenantFn, hotelId: string, params: ListInventoryQuery) {
    const skip = (params.page - 1) * params.limit;

    if (params.lowStockOnly) {
      // Prisma doesn't support field-to-field comparisons in findMany,
      // so use $queryRaw. Build optional clauses as string fragments combined
      // via Prisma.sql tagged template joins.
      const clauses: ReturnType<typeof Prisma.sql>[] = [];
      if (params.category) {
        clauses.push(Prisma.sql`AND category = ${params.category}`);
      }
      if (params.search) {
        const pattern = `%${params.search}%`;
        clauses.push(Prisma.sql`AND (name ILIKE ${pattern} OR sku ILIKE ${pattern} OR supplier ILIKE ${pattern})`);
      }

      const extraClauses = clauses.length > 0
        ? Prisma.join(clauses, " ")
        : Prisma.empty;

      const [items, countRows] = await withTenant((db) =>
        Promise.all([
          db.$queryRaw<RawInventoryItem[]>(
            Prisma.sql`
              SELECT *
              FROM inventory_items
              WHERE hotel_id = ${hotelId}::uuid
                AND is_active = true
                AND current_stock <= reorder_level
                ${extraClauses}
              ORDER BY category ASC, name ASC
              LIMIT ${params.limit} OFFSET ${skip}
            `
          ),
          db.$queryRaw<LowStockCountRow[]>(
            Prisma.sql`
              SELECT COUNT(*) as count
              FROM inventory_items
              WHERE hotel_id = ${hotelId}::uuid
                AND is_active = true
                AND current_stock <= reorder_level
                ${extraClauses}
            `
          ),
        ])
      );

      const total = Number(countRows[0]?.count ?? 0);
      return {
        data: items.map(mapRawItem),
        meta: paginationMeta(total, params.page, params.limit),
      };
    }

    // Standard query using Prisma ORM
    const where: {
      hotelId:   string;
      isActive:  boolean;
      category?: string;
      OR?: Array<{
        name?:     { contains: string; mode: "insensitive" };
        sku?:      { contains: string; mode: "insensitive" };
        supplier?: { contains: string; mode: "insensitive" };
      }>;
    } = { hotelId, isActive: true };

    if (params.category) {
      where.category = params.category;
    }
    if (params.search) {
      where.OR = [
        { name:     { contains: params.search, mode: "insensitive" } },
        { sku:      { contains: params.search, mode: "insensitive" } },
        { supplier: { contains: params.search, mode: "insensitive" } },
      ];
    }

    const [items, total] = await withTenant((db) =>
      Promise.all([
        db.inventoryItem.findMany({
          where,
          orderBy: [{ category: "asc" }, { name: "asc" }],
          skip,
          take: params.limit,
        }),
        db.inventoryItem.count({ where }),
      ])
    );

    return {
      data: items.map((item) => ({
        ...item,
        currentStock: parseFloat(item.currentStock.toString()),
        parLevel:     parseFloat(item.parLevel.toString()),
        reorderLevel: parseFloat(item.reorderLevel.toString()),
      })),
      meta: paginationMeta(total, params.page, params.limit),
    };
  },

  async getItem(withTenant: WithTenantFn, hotelId: string, itemId: string) {
    const item = await withTenant((db) =>
      db.inventoryItem.findFirst({
        where: { id: itemId, hotelId, isActive: true },
      })
    );
    if (!item) throw new AppError(404, "Item not found");

    const transactions = await withTenant((db) =>
      db.inventoryTransaction.findMany({
        where:   { itemId, hotelId },
        orderBy: { createdAt: "desc" },
        take:    20,
      })
    );

    // Resolve performer names via adminPrisma (cross-tenant user lookup)
    const userIds = [
      ...new Set(
        transactions.map((t) => t.performedBy).filter((id): id is string => id !== null)
      ),
    ];

    const userMap = new Map<string, string>();
    if (userIds.length > 0) {
      const users = await adminPrisma.user.findMany({
        where:  { id: { in: userIds } },
        select: { id: true, name: true },
      });
      for (const u of users) {
        userMap.set(u.id, u.name);
      }
    }

    return {
      ...item,
      currentStock: parseFloat(item.currentStock.toString()),
      parLevel:     parseFloat(item.parLevel.toString()),
      reorderLevel: parseFloat(item.reorderLevel.toString()),
      transactions: transactions.map((t) => ({
        ...t,
        quantity:        parseFloat(t.quantity.toString()),
        performedByName: t.performedBy ? (userMap.get(t.performedBy) ?? null) : null,
      })),
    };
  },

  async createItem(
    withTenant: WithTenantFn,
    hotelId: string,
    data: CreateInventoryItemDto,
    actorId: string,
  ) {
    const costPerUnitPaisas = Math.round(data.costPerUnit * 100);

    return withTenant(async (db) => {
      const item = await db.inventoryItem.create({
        data: {
          hotelId,
          name:         data.name,
          sku:          data.sku ?? null,
          category:     data.category,
          unit:         data.unit,
          parLevel:     data.parLevel,
          reorderLevel: data.reorderLevel,
          costPerUnit:  costPerUnitPaisas,
          supplier:     data.supplier ?? null,
          isActive:     true,
        },
      });

      if (data.openingStock > 0) {
        await db.inventoryTransaction.create({
          data: {
            hotelId,
            itemId:        item.id,
            type:          InventoryTransactionType.OPENING_STOCK,
            quantity:      data.openingStock,
            unitCost:      costPerUnitPaisas,
            totalCost:     Math.round(data.openingStock * costPerUnitPaisas),
            referenceType: "OPENING_STOCK",
            performedBy:   actorId,
          },
        });
      }

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "INVENTORY_ITEM_CREATE",
          entity:   "inventory_item",
          entityId: item.id,
          after:    { name: data.name, category: data.category },
        },
      });

      return {
        ...item,
        currentStock: parseFloat(item.currentStock.toString()),
        parLevel:     parseFloat(item.parLevel.toString()),
        reorderLevel: parseFloat(item.reorderLevel.toString()),
      };
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async updateItem(
    withTenant: WithTenantFn,
    hotelId: string,
    itemId: string,
    data: UpdateInventoryItemDto,
    actorId: string,
  ) {
    const existing = await withTenant((db) =>
      db.inventoryItem.findFirst({ where: { id: itemId, hotelId } })
    );
    if (!existing) throw new AppError(404, "Item not found");

    const updateData: {
      name?:        string;
      category?:    string;
      unit?:        string;
      parLevel?:    number;
      reorderLevel?: number;
      costPerUnit?: number;
      supplier?:    string | null;
      sku?:         string | null;
    } = {};
    if (data.name         !== undefined) updateData.name         = data.name;
    if (data.category     !== undefined) updateData.category     = data.category;
    if (data.unit         !== undefined) updateData.unit         = data.unit;
    if (data.parLevel     !== undefined) updateData.parLevel     = data.parLevel;
    if (data.reorderLevel !== undefined) updateData.reorderLevel = data.reorderLevel;
    if (data.supplier     !== undefined) updateData.supplier     = data.supplier ?? null;
    if (data.sku          !== undefined) updateData.sku          = data.sku ?? null;
    if (data.costPerUnit  !== undefined) updateData.costPerUnit  = Math.round(data.costPerUnit * 100);

    return withTenant(async (db) => {
      const updated = await db.inventoryItem.update({
        where: { id: itemId },
        data:  updateData,
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "INVENTORY_ITEM_UPDATE",
          entity:   "inventory_item",
          entityId: itemId,
          before:   { name: existing.name, category: existing.category },
          after:    { name: updated.name,  category: updated.category  },
        },
      });

      return {
        ...updated,
        currentStock: parseFloat(updated.currentStock.toString()),
        parLevel:     parseFloat(updated.parLevel.toString()),
        reorderLevel: parseFloat(updated.reorderLevel.toString()),
      };
    }).then((result) => {
      notifyHotelDataChanged(hotelId);
      return result;
    });
  },

  async deactivateItem(
    withTenant: WithTenantFn,
    hotelId: string,
    itemId: string,
    actorId: string,
  ) {
    await withTenant(async (db) => {
      await db.inventoryItem.update({
        where: { id: itemId, hotelId },
        data:  { isActive: false },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "INVENTORY_ITEM_DEACTIVATE",
          entity:   "inventory_item",
          entityId: itemId,
        },
      });
    });

    notifyHotelDataChanged(hotelId);
  },

  async recordTransaction(
    withTenant: WithTenantFn,
    hotelId: string,
    itemId: string,
    data: CreateTransactionDto,
    actorId: string,
  ) {
    const item = await withTenant((db) =>
      db.inventoryItem.findFirst({ where: { id: itemId, hotelId, isActive: true } })
    );
    if (!item) throw new AppError(404, "Item not found");

    const unitCostPaisas = data.unitCost !== undefined ? Math.round(data.unitCost * 100) : null;
    const totalCost =
      unitCostPaisas !== null ? Math.round(data.quantity * unitCostPaisas) : null;

    await withTenant(async (db) => {
      await db.inventoryTransaction.create({
        data: {
          hotelId,
          itemId,
          type:          data.type as InventoryTransactionType,
          quantity:      data.quantity,
          unitCost:      unitCostPaisas ?? undefined,
          totalCost:     totalCost ?? undefined,
          notes:         data.notes ?? null,
          referenceId:   data.referenceId ?? null,
          referenceType: data.referenceType ?? null,
          performedBy:   actorId,
        },
      });

      await db.auditLog.create({
        data: {
          hotelId,
          userId:   actorId,
          action:   "INVENTORY_TRANSACTION_CREATE",
          entity:   "inventory_transaction",
          entityId: itemId,
          after:    { type: data.type, quantity: data.quantity },
        },
      });
    });

    notifyHotelDataChanged(hotelId);

    // Re-fetch item after DB trigger has updated currentStock
    const updatedItem = await withTenant((db) =>
      db.inventoryItem.findFirst({ where: { id: itemId, hotelId } })
    );

    return {
      ...updatedItem!,
      currentStock: parseFloat(updatedItem!.currentStock.toString()),
      parLevel:     parseFloat(updatedItem!.parLevel.toString()),
      reorderLevel: parseFloat(updatedItem!.reorderLevel.toString()),
    };
  },

  async getLowStockItems(withTenant: WithTenantFn, hotelId: string) {
    const rows = await withTenant((db) =>
      db.$queryRaw<RawInventoryItem[]>`
        SELECT *
        FROM inventory_items
        WHERE hotel_id = ${hotelId}::uuid
          AND is_active = true
          AND current_stock <= reorder_level
        ORDER BY (reorder_level - current_stock) DESC
      `
    );
    return rows.map(mapRawItem);
  },

  async getSummary(withTenant: WithTenantFn, hotelId: string) {
    return withTenant(async (db) => {
      const [totalItems, lowStockRows, outOfStockRows, categoryRows, totalValueRows] =
        await Promise.all([
          db.inventoryItem.count({ where: { hotelId, isActive: true } }),
          db.$queryRaw<LowStockCountRow[]>`
            SELECT COUNT(*) as count
            FROM inventory_items
            WHERE hotel_id = ${hotelId}::uuid
              AND is_active = true
              AND current_stock <= reorder_level
          `,
          db.$queryRaw<LowStockCountRow[]>`
            SELECT COUNT(*) as count
            FROM inventory_items
            WHERE hotel_id = ${hotelId}::uuid
              AND is_active = true
              AND current_stock <= 0
          `,
          db.inventoryItem.findMany({
            where:  { hotelId, isActive: true },
            select: { category: true },
          }),
          db.$queryRaw<TotalValueRow[]>`
            SELECT COALESCE(SUM(current_stock::numeric * cost_per_unit), 0)::text AS total
            FROM inventory_items
            WHERE hotel_id = ${hotelId}::uuid
              AND is_active = true
          `,
        ]);

      // Deduplicate categories and count items per category
      const categoryCountMap = new Map<string, number>();
      for (const row of categoryRows) {
        categoryCountMap.set(row.category, (categoryCountMap.get(row.category) ?? 0) + 1);
      }
      const categories = [...categoryCountMap.entries()].map(([category, count]) => ({
        category,
        count,
      }));

      return {
        totalItems,
        lowStockCount:       Number(lowStockRows[0]?.count  ?? 0),
        outOfStockCount:     Number(outOfStockRows[0]?.count ?? 0),
        categories,
        totalInventoryValue: parseFloat(totalValueRows[0]?.total ?? "0"),
      };
    });
  },
};

// PrismaClient and TenantTx both expose the same posItem/inventoryTransaction
// methods used here — share one implementation across both call sites.
interface DbLike {
  posItem: {
    findMany: (args: {
      where: { id: { in: string[] }; hotelId: string };
      select: { id: true; inventoryItemId: true; inventoryQtyUsed: true };
    }) => Promise<{ id: string; inventoryItemId: string | null; inventoryQtyUsed: Prisma.Decimal | null }[]>;
  };
  inventoryTransaction: {
    create: (args: {
      data: {
        hotelId: string;
        itemId: string;
        type: InventoryTransactionType;
        quantity: number;
        referenceType: string;
        referenceId: string;
        performedBy: string;
      };
    }) => Promise<unknown>;
  };
}

async function runInventoryDeduction(
  db: DbLike,
  hotelId: string,
  orderId: string,
  referenceType: string,
  orderItems: { posItemId: string; quantity: number }[],
  actorId: string,
): Promise<void> {
  const posItemIds = orderItems.map((i) => i.posItemId);
  const posItems = await db.posItem.findMany({
    where:  { id: { in: posItemIds }, hotelId },
    select: { id: true, inventoryItemId: true, inventoryQtyUsed: true },
  });

  for (const orderItem of orderItems) {
    const posItem = posItems.find((p) => p.id === orderItem.posItemId);
    if (!posItem?.inventoryItemId || !posItem.inventoryQtyUsed) continue;

    const qty = orderItem.quantity * parseFloat(posItem.inventoryQtyUsed.toString());
    try {
      await db.inventoryTransaction.create({
        data: {
          hotelId,
          itemId:        posItem.inventoryItemId,
          type:          InventoryTransactionType.CONSUMPTION,
          quantity:      qty,
          referenceType,
          referenceId:   orderId,
          performedBy:   actorId,
        },
      });
    } catch (err) {
      console.error("[Inventory] deduction failed for posItem", posItem.id, err);
    }
  }
}

/**
 * Deducts inventory for all items in a settled POS order.
 * Fire-and-forget — must be called with .catch() and never throws.
 */
export async function deductInventoryForOrder(
  withTenant: WithTenantFn,
  hotelId: string,
  orderId: string,
  orderItems: { posItemId: string; quantity: number }[],
  actorId: string,
): Promise<void> {
  try {
    await withTenant((db) => runInventoryDeduction(db, hotelId, orderId, "POS_ORDER", orderItems, actorId));
  } catch (err) {
    console.error("[Inventory] deductInventoryForOrder error", err);
  }
}

/**
 * Deducts inventory for all items in a confirmed QR guest order. Uses
 * adminPrisma directly — QrOrderService has no withTenant context (mirrors
 * its existing pattern for everything else).
 * Fire-and-forget — must be called with .catch() and never throws.
 */
export async function deductInventoryForQrOrder(
  hotelId: string,
  orderId: string,
  orderItems: { posItemId: string; quantity: number }[],
  actorId: string,
): Promise<void> {
  try {
    await runInventoryDeduction(adminPrisma, hotelId, orderId, "QR_ORDER", orderItems, actorId);
  } catch (err) {
    console.error("[Inventory] deductInventoryForQrOrder error", err);
  }
}
