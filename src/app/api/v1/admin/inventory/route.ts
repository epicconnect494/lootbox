import { route, ok } from "@/lib/api";
import { inventoryIntakeBody, inventoryQuery } from "@/api/schemas";
import { getDb } from "@/db/client";
import { listInventory, recordValuation } from "@/domain/admin";
import { inventoryItem, warehouseLocation } from "@/db/schema";
import { nextItemCode } from "@/domain/inventory";
import { parseDecimalToMinor } from "@/lib/money";
import { audit } from "@/lib/audit";

export const GET = route({ auth: "admin", permission: "inventory.read", query: inventoryQuery }, async ({ query }) => {
  const rows = await listInventory(getDb(), { status: query.status, q: query.q });
  return ok({ items: rows.map(({ item, sku, category }) => ({ ...item, sku: { id: sku.id, sku: sku.sku, name: sku.name, brand: sku.brand, isUnique: sku.isUnique, accent: sku.accent, shippingRestricted: sku.shippingRestricted }, category: category.name })) });
});

export const POST = route({ auth: "admin", permission: "inventory.write", body: inventoryIntakeBody }, async ({ body, session, requestId }) => {
  const db = getDb();
  const item = await db.transaction(async (tx) => {
    const wh = body.warehouseId ?? (await tx.query.warehouseLocation.findFirst())?.id ?? null;
    void warehouseLocation;
    const [row] = await tx
      .insert(inventoryItem)
      .values({ itemCode: await nextItemCode(tx), skuId: body.skuId, warehouseId: wh, serialNumber: body.serialNumber ?? null, certificationId: body.certificationId ?? null, grader: body.grader ?? null, grade: body.grade ?? null, size: body.size ?? null, condition: body.condition, acquisitionCostMinor: parseDecimalToMinor(body.acquisitionCost), status: "IN_STOCK", notes: body.notes ?? null })
      .returning();
    await recordValuation(tx, session!.user.id, { inventoryItemId: row.id, skuId: body.skuId, referenceValueMinor: parseDecimalToMinor(body.referenceValue), sellbackOfferMinor: parseDecimalToMinor(body.sellbackOffer), source: body.valuationSource, sourceRef: body.valuationSourceRef });
    await audit(tx, { actorUserId: session!.user.id, actorRole: session!.user.roles.join(","), action: "inventory.intake", entityType: "inventory_item", entityId: row.id, after: row, correlationId: requestId });
    return row;
  });
  return ok({ item }, 201);
});
