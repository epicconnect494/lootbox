import { route, ok } from "@/lib/api";
import { skuBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { category, productSku } from "@/db/schema";
import { parseDecimalToMinor } from "@/lib/money";
import { audit } from "@/lib/audit";
import { eq, isNull } from "drizzle-orm";

export const GET = route({ auth: "admin", permission: "inventory.read" }, async () => {
  const db = getDb();
  const rows = await db.select({ sku: productSku, category }).from(productSku).innerJoin(category, eq(category.id, productSku.categoryId)).where(isNull(productSku.deletedAt)).orderBy(productSku.sku);
  const categories = await db.select().from(category).orderBy(category.sortOrder);
  return ok({ items: rows.map((r) => ({ ...r.sku, category: r.category.name })), categories });
});

export const POST = route({ auth: "admin", permission: "inventory.write", body: skuBody }, async ({ body, session }) => {
  const db = getDb();
  const [row] = await db.insert(productSku).values({ sku: body.sku, categoryId: body.categoryId, name: body.name, brand: body.brand ?? null, isUnique: body.isUnique, pooledQuantity: body.pooledQuantity, defaultReferenceValueMinor: parseDecimalToMinor(body.referenceValue), defaultSellbackOfferMinor: parseDecimalToMinor(body.sellbackOffer), accent: body.accent, shippingRestricted: body.shippingRestricted, shippingRestrictionNote: body.shippingRestrictionNote ?? null }).returning();
  await audit(db, { actorUserId: session!.user.id, action: "sku.create", entityType: "product_sku", entityId: row.id, after: row });
  return ok({ sku: row }, 201);
});
