import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { inventoryItem, productSku, valuationSnapshot } from "@/db/schema";
import { err } from "@/lib/errors";
import type { Minor } from "@/lib/money";

export async function nextItemCode(tx: DbOrTx): Promise<string> {
  const r = await tx.execute<{ n: string }>(sql`SELECT COUNT(*)::text AS n FROM inventory_item`);
  return `ITM-${String(Number(r.rows[0].n) + 1).padStart(6, "0")}`;
}

/** Reserve a unique item for a pack version. Fails if the item is not IN_STOCK (no double allocation). */
export async function reserveUniqueItem(tx: DbOrTx, itemId: string, forType: string, forId: string) {
  const [item] = await tx.select().from(inventoryItem).where(eq(inventoryItem.id, itemId)).for("update");
  if (!item) throw err.notFound("Inventory item");
  if (item.status === "RESERVED" && item.reservedForType === forType && item.reservedForId === forId) return item;
  if (item.status !== "IN_STOCK") throw err.conflict(`Item ${item.itemCode} is not available (status ${item.status})`);
  const [updated] = await tx
    .update(inventoryItem)
    .set({ status: "RESERVED", reservedForType: forType, reservedForId: forId, reservedAt: new Date() })
    .where(and(eq(inventoryItem.id, itemId), eq(inventoryItem.status, "IN_STOCK")))
    .returning();
  if (!updated) throw err.conflict(`Item ${item.itemCode} was reserved concurrently`);
  return updated;
}

export async function releaseUniqueItem(tx: DbOrTx, itemId: string, forType: string, forId: string) {
  await tx
    .update(inventoryItem)
    .set({ status: "IN_STOCK", reservedForType: null, reservedForId: null, reservedAt: null })
    .where(and(eq(inventoryItem.id, itemId), eq(inventoryItem.status, "RESERVED"), eq(inventoryItem.reservedForType, forType), eq(inventoryItem.reservedForId, forId)));
}

export async function reservePooled(tx: DbOrTx, skuId: string, qty: number) {
  const res = await tx
    .update(productSku)
    .set({ pooledReserved: sql`${productSku.pooledReserved} + ${qty}` })
    .where(and(eq(productSku.id, skuId), sql`${productSku.pooledQuantity} - ${productSku.pooledReserved} >= ${qty}`))
    .returning({ id: productSku.id });
  if (res.length === 0) throw err.conflict("Not enough pooled stock to reserve");
}

export async function releasePooled(tx: DbOrTx, skuId: string, qty: number) {
  await tx.update(productSku).set({ pooledReserved: sql`GREATEST(${productSku.pooledReserved} - ${qty}, 0)` }).where(eq(productSku.id, skuId));
}

/** Consume one pooled unit: decrements pool and materializes a physical item row owned by the user. */
export async function consumePooledUnit(tx: DbOrTx, skuId: string, ownerUserId: string, opts: { warehouseId?: string | null; acquisitionCostMinor?: Minor; condition?: string }) {
  const res = await tx
    .update(productSku)
    .set({ pooledQuantity: sql`${productSku.pooledQuantity} - 1`, pooledReserved: sql`${productSku.pooledReserved} - 1` })
    .where(and(eq(productSku.id, skuId), sql`${productSku.pooledReserved} >= 1`))
    .returning();
  if (res.length === 0) throw err.conflict("Pooled stock exhausted");
  const code = await nextItemCode(tx);
  const [item] = await tx
    .insert(inventoryItem)
    .values({
      itemCode: code,
      skuId,
      warehouseId: opts.warehouseId ?? null,
      condition: (opts.condition as typeof inventoryItem.$inferInsert.condition) ?? "NEW",
      acquisitionCostMinor: opts.acquisitionCostMinor ?? 0n,
      status: "IN_VAULT",
      ownerUserId,
    })
    .returning();
  return item;
}

export async function latestValuation(db: DbOrTx, opts: { skuId?: string | null; inventoryItemId?: string | null }) {
  if (opts.inventoryItemId) {
    const v = await db.query.valuationSnapshot.findFirst({ where: eq(valuationSnapshot.inventoryItemId, opts.inventoryItemId), orderBy: (t, { desc }) => desc(t.observedAt) });
    if (v) return v;
  }
  if (opts.skuId) {
    return db.query.valuationSnapshot.findFirst({ where: eq(valuationSnapshot.skuId, opts.skuId), orderBy: (t, { desc }) => desc(t.observedAt) });
  }
  return undefined;
}
