import { eq } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { idParam, shipmentPatchBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { inventoryItem, shipment, vaultHolding } from "@/db/schema";
import { audit } from "@/lib/audit";
import { decryptString } from "@/lib/crypto";
import { err } from "@/lib/errors";
import { enqueueOutbox } from "@/lib/outbox";

const TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["ADDRESS_VERIFIED", "CANCELLED"],
  ADDRESS_VERIFIED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED", "DISPUTED"],
  DELIVERED: ["DISPUTED", "RETURNED"],
  DISPUTED: ["DELIVERED", "RETURNED"],
};

export const GET = route({ auth: "admin", permission: "fulfillment.read", params: idParam }, async ({ params, session, requestId }) => {
  const db = getDb();
  const s = await db.query.shipment.findFirst({ where: eq(shipment.id, params.id) });
  if (!s) throw err.notFound("Shipment");
  await audit(db, { actorUserId: session!.user.id, action: "shipment.address.view", entityType: "shipment", entityId: s.id, correlationId: requestId });
  return ok({ shipment: { ...s, addressEncrypted: undefined, address: JSON.parse(decryptString(s.addressEncrypted, `ship:${s.userId}`)) } });
});

export const PATCH = route({ auth: "admin", permission: "fulfillment.write", params: idParam, body: shipmentPatchBody }, async ({ params, body, session, requestId }) => {
  const db = getDb();
  const updated = await db.transaction(async (tx) => {
    const [s] = await tx.select().from(shipment).where(eq(shipment.id, params.id)).for("update");
    if (!s) throw err.notFound("Shipment");
    if (!TRANSITIONS[s.status]?.includes(body.status)) throw err.state(`Cannot move shipment from ${s.status} to ${body.status}`);
    const [after] = await tx.update(shipment).set({ status: body.status, carrier: body.carrier, trackingNumber: body.trackingNumber, notes: body.notes, disputeReason: body.disputeReason, addressVerified: body.status === "ADDRESS_VERIFIED" ? true : s.addressVerified, shippedAt: body.status === "SHIPPED" ? new Date() : s.shippedAt, deliveredAt: body.status === "DELIVERED" ? new Date() : s.deliveredAt }).where(eq(shipment.id, s.id)).returning();
    const itemStatus = body.status === "SHIPPED" ? "SHIPPED" : body.status === "DELIVERED" ? "DELIVERED" : body.status === "RETURNED" ? "IN_VAULT" : body.status === "CANCELLED" ? "IN_VAULT" : null;
    if (itemStatus) await tx.update(inventoryItem).set({ status: itemStatus, custody: body.status === "SHIPPED" ? "IN_TRANSIT" : body.status === "DELIVERED" ? "DELIVERED" : "WAREHOUSE" }).where(eq(inventoryItem.id, s.inventoryItemId));
    if (body.status === "DELIVERED") await tx.update(vaultHolding).set({ status: "SHIPPED", endedAt: new Date() }).where(eq(vaultHolding.id, s.holdingId));
    await audit(tx, { actorUserId: session!.user.id, action: "shipment.update", entityType: "shipment", entityId: s.id, before: { status: s.status }, after: { status: after.status, tracking: after.trackingNumber }, correlationId: requestId });
    await enqueueOutbox(tx, "notification.create", { userId: s.userId, kind: "SHIPMENT", title: `Shipment ${after.status.toLowerCase().replace("_", " ")}`, body: after.trackingNumber ? `Tracking: ${after.carrier ?? ""} ${after.trackingNumber}` : "Your shipment status changed.", href: "/vault" });
    return after;
  });
  return ok({ shipment: { ...updated, addressEncrypted: undefined } });
});
