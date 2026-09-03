import { eq } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { inventoryItem } from "@/db/schema";
import { itemHistory } from "@/domain/vault";
import { err } from "@/lib/errors";

export const GET = route({ auth: "user", params: idParam }, async ({ params, session }) => {
  const db = getDb();
  const item = await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, params.id) });
  if (!item) throw err.notFound("Item");
  const history = await itemHistory(db, params.id);
  const involved = item.ownerUserId === session!.user.id || history.some((h) => h.fromUserId === session!.user.id || h.toUserId === session!.user.id);
  if (!involved && !session!.user.permissions.has("inventory.read")) throw err.forbidden();
  return ok({ item: { id: item.id, itemCode: item.itemCode, status: item.status, custody: item.custody }, history });
});
