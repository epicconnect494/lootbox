import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { listMarketplace } from "@/domain/vault";

export const GET = route({ auth: "none" }, async () => {
  const rows = await listMarketplace(getDb());
  return ok({ items: rows.map(({ l, item, sku }) => ({ id: l.id, askMinor: l.askMinor, currency: l.currency, createdAt: l.createdAt, sellerUserId: l.sellerUserId, item: { id: item.id, itemCode: item.itemCode, grade: item.grade, grader: item.grader, condition: item.condition }, sku: { name: sku.name, accent: sku.accent, brand: sku.brand } })) });
});
