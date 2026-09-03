import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db/client";
import { inventoryItem, marketplaceListing, marketplaceOrder, ownershipTransfer, productSku, sellbackQuote, shipment, vaultHolding } from "@/db/schema";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { encryptString } from "@/lib/crypto";
import { err } from "@/lib/errors";
import { applyBp } from "@/lib/money";
import { enqueueOutbox } from "@/lib/outbox";
import { serializable } from "@/lib/tx";
import { assertEligible } from "./gates";
import { getOrCreateUserAccount, getSystemAccount, postTransaction } from "./ledger";

export const SELLBACK_POLICY_VERSION = "sellback-v1:disclosed-offer";

export async function listVault(db: DbOrTx, userId: string) {
  const rows = await db
    .select({ h: vaultHolding, item: inventoryItem, sku: productSku })
    .from(vaultHolding)
    .innerJoin(inventoryItem, eq(inventoryItem.id, vaultHolding.inventoryItemId))
    .innerJoin(productSku, eq(productSku.id, inventoryItem.skuId))
    .where(and(eq(vaultHolding.userId, userId), eq(vaultHolding.status, "ACTIVE")))
    .orderBy(desc(vaultHolding.createdAt));
  const listings = rows.length ? await db.select().from(marketplaceListing).where(and(inArray(marketplaceListing.holdingId, rows.map((r) => r.h.id)), eq(marketplaceListing.status, "ACTIVE"))) : [];
  const shipments = rows.length ? await db.select().from(shipment).where(and(inArray(shipment.holdingId, rows.map((r) => r.h.id)), inArray(shipment.status, ["REQUESTED", "ADDRESS_VERIFIED", "PACKED", "SHIPPED"]))) : [];
  const items = rows.map(({ h, item, sku }) => ({
    holdingId: h.id,
    status: h.status,
    collectionName: h.collectionName,
    acquiredVia: h.acquiredVia,
    acquiredRefId: h.acquiredRefId,
    acquiredAt: h.createdAt,
    referenceValueMinor: h.referenceValueMinor,
    sellbackOfferMinor: h.sellbackOfferMinor,
    currency: h.currency,
    item: { id: item.id, itemCode: item.itemCode, status: item.status, custody: item.custody, grader: item.grader, grade: item.grade, certificationId: item.certificationId, serialNumber: item.serialNumber, size: item.size, condition: item.condition },
    sku: { name: sku.name, brand: sku.brand, accent: sku.accent, imageKey: sku.imageKey, shippingRestricted: sku.shippingRestricted, isUnique: sku.isUnique },
    listing: listings.find((l) => l.holdingId === h.id) ?? null,
    shipment: shipments.find((s) => s.holdingId === h.id) ?? null,
  }));
  const portfolioValueMinor = items.reduce((a, i) => a + i.referenceValueMinor, 0n);
  const sellbackValueMinor = items.reduce((a, i) => a + i.sellbackOfferMinor, 0n);
  return { items, portfolioValueMinor, sellbackValueMinor, uniqueCount: items.filter((i) => i.sku.isUnique).length, count: items.length };
}

export async function itemHistory(db: DbOrTx, itemId: string) {
  return db.select().from(ownershipTransfer).where(eq(ownershipTransfer.inventoryItemId, itemId)).orderBy(desc(ownershipTransfer.createdAt));
}

export async function setCollection(db: Db, userId: string, holdingIds: string[], collectionName: string | null) {
  if (collectionName && collectionName.length > 64) throw err.validation("Collection name too long");
  await db.update(vaultHolding).set({ collectionName }).where(and(eq(vaultHolding.userId, userId), inArray(vaultHolding.id, holdingIds), eq(vaultHolding.status, "ACTIVE")));
}

async function lockActiveHolding(tx: DbOrTx, holdingId: string, userId: string) {
  const [h] = await tx.select().from(vaultHolding).where(and(eq(vaultHolding.id, holdingId), eq(vaultHolding.userId, userId))).for("update");
  if (!h) throw err.notFound("Holding");
  if (h.status !== "ACTIVE") throw err.state(`Holding is ${h.status}`);
  const [item] = await tx.select().from(inventoryItem).where(eq(inventoryItem.id, h.inventoryItemId)).for("update");
  if (!item || item.ownerUserId !== userId) throw err.state("Ownership mismatch");
  return { h, item };
}

// ---- Sell-back --------------------------------------------------------------------------
export async function createSellbackQuote(db: Db, userId: string, holdingId: string) {
  return db.transaction(async (tx) => {
    await assertEligible(tx, userId, "SELLBACK");
    const { h, item } = await lockActiveHolding(tx, holdingId, userId);
    if (item.status !== "IN_VAULT") throw err.state(`Item is ${item.status}; cancel listings or shipments first`);
    await tx.update(sellbackQuote).set({ status: "EXPIRED" }).where(and(eq(sellbackQuote.holdingId, holdingId), eq(sellbackQuote.status, "OPEN")));
    const [q] = await tx
      .insert(sellbackQuote)
      .values({ userId, holdingId, inventoryItemId: item.id, offerMinor: h.sellbackOfferMinor, referenceValueMinor: h.referenceValueMinor, currency: h.currency, policyVersion: SELLBACK_POLICY_VERSION, expiresAt: new Date(Date.now() + config.economics.sellbackQuoteTtlMinutes * 60_000) })
      .returning();
    return q;
  });
}

export async function acceptSellbackQuote(db: Db, userId: string, quoteId: string, idempotencyKey: string) {
  return serializable(db, async (tx) => {
    const [q] = await tx.select().from(sellbackQuote).where(and(eq(sellbackQuote.id, quoteId), eq(sellbackQuote.userId, userId))).for("update");
    if (!q) throw err.notFound("Quote");
    if (q.status === "ACCEPTED") return q;
    if (q.status !== "OPEN") throw err.state(`Quote is ${q.status}`);
    if (q.expiresAt < new Date()) {
      await tx.update(sellbackQuote).set({ status: "EXPIRED" }).where(eq(sellbackQuote.id, q.id));
      throw err.state("Quote expired; request a new one");
    }
    await assertEligible(tx, userId, "SELLBACK");
    const { h, item } = await lockActiveHolding(tx, q.holdingId, userId);
    if (item.status !== "IN_VAULT") throw err.state(`Item is ${item.status}`);
    const userAcct = await getOrCreateUserAccount(tx, userId, "USER_CASH", q.currency);
    const payouts = await getSystemAccount(tx, "SYSTEM_SELLBACK_PAYOUTS", q.currency);
    const trx = await postTransaction(tx, {
      kind: "SELLBACK",
      referenceType: "sellback_quote",
      referenceId: q.id,
      idempotencyKey: `sellback:${userId}:${idempotencyKey}`,
      description: `Sell-back ${item.itemCode}`,
      currency: q.currency,
      entries: [
        { accountId: payouts.id, amountMinor: -q.offerMinor, memo: "sell-back payout" },
        { accountId: userAcct.id, amountMinor: q.offerMinor, memo: "sell-back proceeds" },
      ],
      createdBy: userId,
    });
    const [transfer] = await tx.insert(ownershipTransfer).values({ inventoryItemId: item.id, fromUserId: userId, toUserId: null, reason: "SELLBACK", referenceType: "sellback_quote", referenceId: q.id, ledgerTransactionId: trx.id }).returning();
    await tx.update(vaultHolding).set({ status: "SOLD_BACK", endedAt: new Date() }).where(eq(vaultHolding.id, h.id));
    await tx.update(inventoryItem).set({ status: "IN_STOCK", ownerUserId: null }).where(eq(inventoryItem.id, item.id));
    const [accepted] = await tx.update(sellbackQuote).set({ status: "ACCEPTED", acceptedAt: new Date(), ledgerTransactionId: trx.id }).where(eq(sellbackQuote.id, q.id)).returning();
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "sellback.accept", entityType: "sellback_quote", entityId: q.id, after: { transferId: transfer.id, ledgerTransactionId: trx.id } });
    await enqueueOutbox(tx, "notification.create", { userId, kind: "SELLBACK", title: "Sell-back complete", body: `${item.itemCode} sold back for the disclosed offer.`, href: "/account" });
    return accepted;
  });
}

// ---- Shipping ---------------------------------------------------------------------------
export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string; // ISO-2
  phone?: string;
}

export async function requestShipment(db: Db, userId: string, holdingId: string, address: Address, opts: { insured?: boolean } = {}) {
  return db.transaction(async (tx) => {
    const { h, item } = await lockActiveHolding(tx, holdingId, userId);
    if (item.status !== "IN_VAULT") throw err.state(`Item is ${item.status}`);
    const sku = await tx.query.productSku.findFirst({ where: eq(productSku.id, item.skuId) });
    if (sku?.shippingRestricted) throw err.state(sku.shippingRestrictionNote ?? "This item cannot be shipped");
    const fee = config.economics.shippingFeeMinor;
    if (fee > 0n) {
      const userAcct = await getOrCreateUserAccount(tx, userId, "USER_CASH", h.currency);
      const fees = await getSystemAccount(tx, "SYSTEM_FEES", h.currency);
      await postTransaction(tx, { kind: "SHIPPING_FEE", referenceType: "vault_holding", referenceId: h.id, description: "Shipping fee", currency: h.currency, entries: [{ accountId: userAcct.id, amountMinor: -fee }, { accountId: fees.id, amountMinor: fee }], createdBy: userId });
    }
    const [s] = await tx
      .insert(shipment)
      .values({ userId, holdingId: h.id, inventoryItemId: item.id, addressEncrypted: encryptString(JSON.stringify(address), `ship:${userId}`), addressCountry: address.country.toUpperCase(), insured: opts.insured ?? true, insuredValueMinor: h.referenceValueMinor, shippingFeeMinor: fee, currency: h.currency })
      .returning();
    await tx.update(inventoryItem).set({ status: "SHIP_REQUESTED" }).where(eq(inventoryItem.id, item.id));
    await enqueueOutbox(tx, "fulfillment.ship", { shipmentId: s.id }, { type: "shipment", id: s.id });
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "shipment.request", entityType: "shipment", entityId: s.id, after: { country: s.addressCountry, insured: s.insured } });
    return s;
  });
}

// ---- Marketplace ------------------------------------------------------------------------
export async function createListing(db: Db, userId: string, holdingId: string, askMinor: bigint) {
  if (askMinor <= 0n) throw err.validation("Ask must be positive");
  return db.transaction(async (tx) => {
    await assertEligible(tx, userId, "MARKETPLACE");
    const { h, item } = await lockActiveHolding(tx, holdingId, userId);
    if (item.status !== "IN_VAULT") throw err.state(`Item is ${item.status}`);
    const [l] = await tx.insert(marketplaceListing).values({ sellerUserId: userId, holdingId: h.id, inventoryItemId: item.id, askMinor, currency: h.currency }).returning();
    await tx.update(inventoryItem).set({ status: "LISTED" }).where(eq(inventoryItem.id, item.id));
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "listing.create", entityType: "marketplace_listing", entityId: l.id, after: { askMinor } });
    return l;
  });
}

export async function cancelListing(db: Db, userId: string, listingId: string, actor?: { adminUserId: string; reason: string }) {
  return db.transaction(async (tx) => {
    const [l] = await tx.select().from(marketplaceListing).where(eq(marketplaceListing.id, listingId)).for("update");
    if (!l) throw err.notFound("Listing");
    if (!actor && l.sellerUserId !== userId) throw err.forbidden();
    if (l.status !== "ACTIVE") throw err.state(`Listing is ${l.status}`);
    await tx.update(marketplaceListing).set({ status: "CANCELLED" }).where(eq(marketplaceListing.id, l.id));
    await tx.update(inventoryItem).set({ status: "IN_VAULT" }).where(and(eq(inventoryItem.id, l.inventoryItemId), eq(inventoryItem.status, "LISTED")));
    await audit(tx, { actorUserId: actor?.adminUserId ?? userId, action: "listing.cancel", entityType: "marketplace_listing", entityId: l.id, reason: actor?.reason });
  });
}

export async function buyListing(db: Db, buyerUserId: string, listingId: string, idempotencyKey: string) {
  return serializable(db, async (tx) => {
    const [l] = await tx.select().from(marketplaceListing).where(eq(marketplaceListing.id, listingId)).for("update");
    if (!l) throw err.notFound("Listing");
    if (l.status !== "ACTIVE") throw err.state(`Listing is ${l.status}`);
    if (l.sellerUserId === buyerUserId) throw err.validation("You cannot buy your own listing");
    await assertEligible(tx, buyerUserId, "MARKETPLACE", l.askMinor);
    const [item] = await tx.select().from(inventoryItem).where(eq(inventoryItem.id, l.inventoryItemId)).for("update");
    if (!item || item.status !== "LISTED" || item.ownerUserId !== l.sellerUserId) throw err.state("Item is no longer available");
    const fee = applyBp(l.askMinor, config.economics.marketplaceFeeBp);
    const buyer = await getOrCreateUserAccount(tx, buyerUserId, "USER_CASH", l.currency);
    const seller = await getOrCreateUserAccount(tx, l.sellerUserId, "USER_CASH", l.currency);
    const fees = await getSystemAccount(tx, "SYSTEM_FEES", l.currency);
    const trx = await postTransaction(tx, {
      kind: "MARKETPLACE_PURCHASE",
      referenceType: "marketplace_listing",
      referenceId: l.id,
      idempotencyKey: `mkt:${buyerUserId}:${idempotencyKey}`,
      description: `Marketplace purchase ${item.itemCode}`,
      currency: l.currency,
      entries: [
        { accountId: buyer.id, amountMinor: -l.askMinor, memo: "purchase" },
        { accountId: seller.id, amountMinor: l.askMinor - fee, memo: "sale proceeds" },
        { accountId: fees.id, amountMinor: fee, memo: "marketplace fee" },
      ].filter((e) => e.amountMinor !== 0n),
      createdBy: buyerUserId,
    });
    const [transfer] = await tx.insert(ownershipTransfer).values({ inventoryItemId: item.id, fromUserId: l.sellerUserId, toUserId: buyerUserId, reason: "MARKETPLACE", referenceType: "marketplace_listing", referenceId: l.id, ledgerTransactionId: trx.id }).returning();
    await tx.update(vaultHolding).set({ status: "TRANSFERRED", endedAt: new Date() }).where(eq(vaultHolding.id, l.holdingId));
    const [newHolding] = await tx.insert(vaultHolding).values({ userId: buyerUserId, inventoryItemId: item.id, acquiredVia: "MARKETPLACE", acquiredRefId: l.id, referenceValueMinor: l.askMinor, sellbackOfferMinor: applyBp(l.askMinor, 8000), currency: l.currency }).returning();
    await tx.update(inventoryItem).set({ status: "IN_VAULT", ownerUserId: buyerUserId }).where(eq(inventoryItem.id, item.id));
    await tx.update(marketplaceListing).set({ status: "SOLD" }).where(eq(marketplaceListing.id, l.id));
    const [order] = await tx.insert(marketplaceOrder).values({ listingId: l.id, buyerUserId, sellerUserId: l.sellerUserId, inventoryItemId: item.id, priceMinor: l.askMinor, feeMinor: fee, currency: l.currency, ledgerTransactionId: trx.id, ownershipTransferId: transfer.id, idempotencyKey }).returning();
    await audit(tx, { actorUserId: buyerUserId, actorRole: "CUSTOMER", action: "listing.buy", entityType: "marketplace_order", entityId: order.id, after: { holdingId: newHolding.id, fee } });
    await enqueueOutbox(tx, "notification.create", { userId: l.sellerUserId, kind: "ACCOUNT", title: "Item sold", body: `${item.itemCode} sold on the marketplace.`, href: "/vault" });
    return order;
  });
}

export async function listMarketplace(db: DbOrTx, limit = 48) {
  return db
    .select({ l: marketplaceListing, item: inventoryItem, sku: productSku })
    .from(marketplaceListing)
    .innerJoin(inventoryItem, eq(inventoryItem.id, marketplaceListing.inventoryItemId))
    .innerJoin(productSku, eq(productSku.id, inventoryItem.skuId))
    .where(eq(marketplaceListing.status, "ACTIVE"))
    .orderBy(desc(marketplaceListing.createdAt))
    .limit(limit);
}

export async function vaultReconciliation(db: DbOrTx) {
  const doubleOwned = await db.execute<{ inventory_item_id: string; c: number }>(sql`SELECT inventory_item_id, COUNT(*)::int AS c FROM vault_holding WHERE status = 'ACTIVE' GROUP BY inventory_item_id HAVING COUNT(*) > 1`);
  const ownerMismatch = await db.execute<{ id: string }>(sql`
    SELECT ii.id FROM inventory_item ii
    LEFT JOIN vault_holding vh ON vh.inventory_item_id = ii.id AND vh.status = 'ACTIVE'
    WHERE (ii.owner_user_id IS NOT NULL AND (vh.user_id IS NULL OR vh.user_id <> ii.owner_user_id))
       OR (ii.owner_user_id IS NULL AND vh.id IS NOT NULL)`);
  return { doubleOwned: doubleOwned.rows, ownerMismatch: ownerMismatch.rows };
}
