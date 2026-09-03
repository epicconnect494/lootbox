import { eq } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { idParam, inventoryPatchBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { inventoryItem, valuationSnapshot, ownershipTransfer } from "@/db/schema";
import { audit } from "@/lib/audit";
import { err } from "@/lib/errors";
import { desc } from "drizzle-orm";

export const GET = route({ auth: "admin", permission: "inventory.read", params: idParam }, async ({ params }) => {
  const db = getDb();
  const item = await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, params.id) });
  if (!item) throw err.notFound("Item");
  const valuations = await db.select().from(valuationSnapshot).where(eq(valuationSnapshot.inventoryItemId, item.id)).orderBy(desc(valuationSnapshot.observedAt));
  const history = await db.select().from(ownershipTransfer).where(eq(ownershipTransfer.inventoryItemId, item.id)).orderBy(desc(ownershipTransfer.createdAt));
  return ok({ item, valuations, history });
});

export const PATCH = route({ auth: "admin", permission: "inventory.write", params: idParam, body: inventoryPatchBody }, async ({ params, body, session, requestId }) => {
  const db = getDb();
  const updated = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(inventoryItem).where(eq(inventoryItem.id, params.id)).for("update");
    if (!before) throw err.notFound("Item");
    if (body.status && before.status !== "INTAKE" && before.status !== "IN_STOCK" && before.status !== "RETURNED") throw err.state(`Cannot change status of an item that is ${before.status}`);
    const [after] = await tx.update(inventoryItem).set({ status: body.status, custody: body.custody, notes: body.notes }).where(eq(inventoryItem.id, params.id)).returning();
    await audit(tx, { actorUserId: session!.user.id, actorRole: session!.user.roles.join(","), action: "inventory.update", entityType: "inventory_item", entityId: params.id, reason: body.reason, before, after, correlationId: requestId });
    return after;
  });
  return ok({ item: updated });
});
