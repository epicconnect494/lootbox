import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db/client";
import { category, inventoryItem, pack, packManifestCommitment, packOutcome, packVersion, productSku, valuationSnapshot } from "@/db/schema";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { canonicalJson, sha256Hex } from "@/lib/crypto";
import { err } from "@/lib/errors";
import { computeEconomics, computeRtp, suggestRtpAdjustments, validatePackEconomics, type OutcomeInput } from "@/lib/rtp";
import { serializable } from "@/lib/tx";
import { releasePooled, releaseUniqueItem, reservePooled, reserveUniqueItem } from "./inventory";

export type PackVersionRow = typeof packVersion.$inferSelect;
export type PackOutcomeRow = typeof packOutcome.$inferSelect;

const EDITABLE = new Set(["DRAFT", "REJECTED"]);

export interface Actor {
  userId: string;
  role?: string | null;
  correlationId?: string | null;
}

export async function createPackDraft(db: Db, actor: Actor, input: { slug: string; name: string; tagline?: string; description?: string; categoryId: string; priceMinor: bigint; kind?: "FINITE" | "POOLED"; accent?: string; tags?: string[]; heroImageKey?: string | null }) {
  return db.transaction(async (tx) => {
    const [p] = await tx
      .insert(pack)
      .values({ slug: input.slug, name: input.name, tagline: input.tagline ?? null, description: input.description ?? null, categoryId: input.categoryId, kind: input.kind ?? "FINITE", accent: input.accent ?? "violet", tags: input.tags ?? [], heroImageKey: input.heroImageKey ?? null, createdBy: actor.userId })
      .returning();
    const [v] = await tx
      .insert(packVersion)
      .values({ packId: p.id, version: 1, priceMinor: input.priceMinor, totalOpenings: 0, remainingOpenings: 0, targetRtpBp: config.economics.targetSellbackRtpBp, rtpToleranceBp: config.economics.rtpToleranceBp, createdBy: actor.userId })
      .returning();
    await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: "pack.create", entityType: "pack", entityId: p.id, after: { pack: p, version: v }, correlationId: actor.correlationId });
    return { pack: p, version: v };
  });
}

export async function updateDraftVersion(db: Db, actor: Actor, versionId: string, patch: { priceMinor?: bigint; notes?: string | null; liabilityLimitMinor?: bigint | null; scheduledAt?: Date | null; name?: string; tagline?: string | null; description?: string | null; accent?: string; tags?: string[]; heroImageKey?: string | null }) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, versionId)).for("update");
    if (!v) throw err.notFound("Pack version");
    if (!EDITABLE.has(v.status)) throw err.state("Only draft versions can be edited; clone to create a new version.");
    const [updated] = await tx
      .update(packVersion)
      .set({ priceMinor: patch.priceMinor ?? v.priceMinor, notes: patch.notes === undefined ? v.notes : patch.notes, liabilityLimitMinor: patch.liabilityLimitMinor === undefined ? v.liabilityLimitMinor : patch.liabilityLimitMinor, scheduledAt: patch.scheduledAt === undefined ? v.scheduledAt : patch.scheduledAt, status: "DRAFT" })
      .where(eq(packVersion.id, versionId))
      .returning();
    if (patch.name || patch.tagline !== undefined || patch.description !== undefined || patch.accent || patch.tags || patch.heroImageKey !== undefined) {
      await tx
        .update(pack)
        .set({ name: patch.name, tagline: patch.tagline, description: patch.description, accent: patch.accent, tags: patch.tags, heroImageKey: patch.heroImageKey })
        .where(eq(pack.id, v.packId));
    }
    await recomputeDraftTotals(tx, versionId);
    await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: "pack.version.update", entityType: "pack_version", entityId: versionId, before: v, after: updated, correlationId: actor.correlationId });
    return updated;
  });
}

export async function upsertOutcome(db: Db, actor: Actor, versionId: string, input: { id?: string; label: string; tier: string; skuId: string; inventoryItemId?: string | null; quantity: number; referenceValueMinor: bigint; sellbackOfferMinor: bigint; condition?: string; shippingEligible?: boolean; valuationSnapshotId?: string | null }) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, versionId)).for("update");
    if (!v) throw err.notFound("Pack version");
    if (!EDITABLE.has(v.status)) throw err.state("Outcomes are locked once a version leaves draft.");
    if (input.inventoryItemId && input.quantity !== 1) throw err.validation("Unique items must have quantity 1");
    if (input.sellbackOfferMinor > input.referenceValueMinor) throw err.validation("Sell-back offer cannot exceed reference value");
    if (input.inventoryItemId) {
      const item = await tx.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, input.inventoryItemId) });
      if (!item) throw err.notFound("Inventory item");
      if (item.skuId !== input.skuId) throw err.validation("Inventory item does not belong to the selected SKU");
      if (item.status !== "IN_STOCK") throw err.conflict(`Item ${item.itemCode} is ${item.status}, not IN_STOCK`);
      const other = await tx.query.packOutcome.findFirst({ where: and(eq(packOutcome.inventoryItemId, input.inventoryItemId), eq(packOutcome.packVersionId, versionId)) });
      if (other && other.id !== input.id) throw err.conflict("This item is already an outcome in this version");
    }
    let row: PackOutcomeRow;
    if (input.id) {
      const [updated] = await tx
        .update(packOutcome)
        .set({ label: input.label, tier: input.tier, skuId: input.skuId, inventoryItemId: input.inventoryItemId ?? null, quantityTotal: input.quantity, quantityRemaining: input.quantity, referenceValueMinor: input.referenceValueMinor, sellbackOfferMinor: input.sellbackOfferMinor, condition: input.condition ?? "NEAR_MINT", shippingEligible: input.shippingEligible ?? true, valuationSnapshotId: input.valuationSnapshotId ?? null })
        .where(and(eq(packOutcome.id, input.id), eq(packOutcome.packVersionId, versionId)))
        .returning();
      if (!updated) throw err.notFound("Outcome");
      row = updated;
    } else {
      const maxPos = await tx.select({ m: sql<number>`COALESCE(MAX(position), -1)` }).from(packOutcome).where(eq(packOutcome.packVersionId, versionId));
      const [inserted] = await tx
        .insert(packOutcome)
        .values({ packVersionId: versionId, position: Number(maxPos[0].m) + 1, label: input.label, tier: input.tier, skuId: input.skuId, inventoryItemId: input.inventoryItemId ?? null, quantityTotal: input.quantity, quantityRemaining: input.quantity, referenceValueMinor: input.referenceValueMinor, sellbackOfferMinor: input.sellbackOfferMinor, condition: input.condition ?? "NEAR_MINT", shippingEligible: input.shippingEligible ?? true, valuationSnapshotId: input.valuationSnapshotId ?? null })
        .returning();
      row = inserted;
    }
    await recomputeDraftTotals(tx, versionId);
    await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: "pack.outcome.upsert", entityType: "pack_outcome", entityId: row.id, after: row, correlationId: actor.correlationId });
    return row;
  });
}

export async function removeOutcome(db: Db, actor: Actor, versionId: string, outcomeId: string) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, versionId)).for("update");
    if (!v || !EDITABLE.has(v.status)) throw err.state("Outcomes are locked once a version leaves draft.");
    const [removed] = await tx.delete(packOutcome).where(and(eq(packOutcome.id, outcomeId), eq(packOutcome.packVersionId, versionId))).returning();
    if (!removed) throw err.notFound("Outcome");
    // re-pack positions
    const rest = await tx.select().from(packOutcome).where(eq(packOutcome.packVersionId, versionId)).orderBy(asc(packOutcome.position));
    for (let i = 0; i < rest.length; i++) if (rest[i].position !== i) await tx.update(packOutcome).set({ position: i }).where(eq(packOutcome.id, rest[i].id));
    await recomputeDraftTotals(tx, versionId);
    await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: "pack.outcome.remove", entityType: "pack_outcome", entityId: outcomeId, before: removed, correlationId: actor.correlationId });
  });
}

async function recomputeDraftTotals(tx: DbOrTx, versionId: string) {
  const v = await tx.query.packVersion.findFirst({ where: eq(packVersion.id, versionId) });
  if (!v) return;
  const outcomes = await tx.select().from(packOutcome).where(eq(packOutcome.packVersionId, versionId)).orderBy(asc(packOutcome.position));
  const total = outcomes.reduce((a, o) => a + o.quantityTotal, 0);
  let merch: number | null = null;
  let sell: number | null = null;
  if (outcomes.length && v.priceMinor > 0n) {
    const r = computeRtp(v.priceMinor, outcomes.map(toOutcomeInput));
    merch = r.merchandiseRtpBp;
    sell = r.sellbackRtpBp;
  }
  await tx.update(packVersion).set({ totalOpenings: total, remainingOpenings: total, merchandiseRtpBp: merch, sellbackRtpBp: sell }).where(eq(packVersion.id, versionId));
}

export function toOutcomeInput(o: PackOutcomeRow): OutcomeInput {
  return { id: o.id, label: o.label, tier: o.tier, quantity: o.quantityTotal, referenceValueMinor: o.referenceValueMinor, sellbackOfferMinor: o.sellbackOfferMinor, isUniqueItem: !!o.inventoryItemId };
}

/** Full economics view for the admin builder. */
export async function versionEconomics(db: DbOrTx, versionId: string) {
  const v = await db.query.packVersion.findFirst({ where: eq(packVersion.id, versionId) });
  if (!v) throw err.notFound("Pack version");
  const outcomes = await db.select().from(packOutcome).where(eq(packOutcome.packVersionId, versionId)).orderBy(asc(packOutcome.position));
  const inputs = outcomes.map(toOutcomeInput);
  const validation = validatePackEconomics(v.priceMinor, inputs, { targetRtpBp: v.targetRtpBp, toleranceBp: v.rtpToleranceBp, basis: "SELLBACK", expectedTotalOpenings: v.totalOpenings });
  const suggestions = outcomes.length ? suggestRtpAdjustments(v.priceMinor, inputs, { targetRtpBp: v.targetRtpBp, toleranceBp: v.rtpToleranceBp, basis: "SELLBACK" }) : [];
  let acquisition = 0n;
  for (const o of outcomes) {
    if (o.inventoryItemId) {
      const item = await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, o.inventoryItemId) });
      acquisition += item?.acquisitionCostMinor ?? 0n;
    } else {
      // pooled: approximate acquisition cost from the SKU's default (sellback offer is the floor), use the sellback offer as conservative cost.
      acquisition += BigInt(o.quantityTotal) * o.sellbackOfferMinor;
    }
  }
  const economics = validation.result
    ? computeEconomics(validation.result, {
        paymentFeeBp: config.economics.paymentFeeBp,
        paymentFeeFixedMinor: config.economics.paymentFeeFixedMinor,
        fraudReserveBp: config.economics.fraudReserveBp,
        rewardsAllocationBp: config.economics.rewardsAllocationBp,
        shippingSubsidyMinor: config.economics.shippingSubsidyMinor,
        shipRateBp: 3000,
        acquisitionCostMinor: acquisition,
      })
    : null;
  return { version: v, outcomes, validation, suggestions, economics };
}

export async function submitForApproval(db: Db, actor: Actor, versionId: string) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, versionId)).for("update");
    if (!v) throw err.notFound("Pack version");
    if (!EDITABLE.has(v.status)) throw err.state(`Version is ${v.status}`);
    const eco = await versionEconomics(tx, versionId);
    if (!eco.validation.ok) throw err.validation("Version fails RTP/quantity validation", { errors: eco.validation.errors });
    await tx.update(packVersion).set({ status: "PENDING_APPROVAL", submittedBy: actor.userId }).where(eq(packVersion.id, versionId));
    await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: "pack.version.submit", entityType: "pack_version", entityId: versionId, before: { status: v.status }, after: { status: "PENDING_APPROVAL" }, correlationId: actor.correlationId });
  });
}

export async function reviewVersion(db: Db, actor: Actor, versionId: string, decision: "APPROVED" | "REJECTED", reason: string) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, versionId)).for("update");
    if (!v) throw err.notFound("Pack version");
    if (v.status !== "PENDING_APPROVAL") throw err.state("Version is not pending approval");
    if (v.submittedBy === actor.userId && decision === "APPROVED") throw err.forbidden("Separation of duties: the submitter cannot approve their own version");
    await tx.update(packVersion).set({ status: decision, approvedBy: decision === "APPROVED" ? actor.userId : null, approvedAt: decision === "APPROVED" ? new Date() : null, notes: reason }).where(eq(packVersion.id, versionId));
    await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: `pack.version.${decision.toLowerCase()}`, entityType: "pack_version", entityId: versionId, reason, before: { status: v.status }, after: { status: decision }, correlationId: actor.correlationId });
  });
}

export function buildManifest(v: PackVersionRow, p: typeof pack.$inferSelect, outcomes: PackOutcomeRow[]) {
  return {
    algorithmVersion: 1,
    packId: p.id,
    packSlug: p.slug,
    versionId: v.id,
    version: v.version,
    priceMinor: v.priceMinor.toString(),
    currency: v.currency,
    totalOpenings: v.totalOpenings,
    targetRtpBp: v.targetRtpBp,
    outcomes: outcomes.map((o) => ({
      id: o.id,
      position: o.position,
      label: o.label,
      tier: o.tier,
      skuId: o.skuId,
      inventoryItemId: o.inventoryItemId,
      valuationSnapshotId: o.valuationSnapshotId,
      quantity: o.quantityTotal,
      referenceValueMinor: o.referenceValueMinor.toString(),
      sellbackOfferMinor: o.sellbackOfferMinor.toString(),
      condition: o.condition,
      shippingEligible: o.shippingEligible,
    })),
  };
}

/**
 * Publishing is the immutability boundary: reserves every unique item / pooled unit, freezes
 * quantities, computes the manifest hash and stores the commitment. Serializable to prevent double reservation.
 */
export async function publishVersion(db: Db, actor: Actor, versionId: string, opts: { scheduledAt?: Date | null } = {}) {
  return serializable(db, async (tx) => {
    const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, versionId)).for("update");
    if (!v) throw err.notFound("Pack version");
    if (v.status !== "APPROVED" && v.status !== "SCHEDULED") throw err.state(`Version must be APPROVED to publish (is ${v.status})`);
    const p = await tx.query.pack.findFirst({ where: eq(pack.id, v.packId) });
    if (!p) throw err.notFound("Pack");
    const outcomes = await tx.select().from(packOutcome).where(eq(packOutcome.packVersionId, versionId)).orderBy(asc(packOutcome.position));
    const validation = validatePackEconomics(v.priceMinor, outcomes.map(toOutcomeInput), { targetRtpBp: v.targetRtpBp, toleranceBp: v.rtpToleranceBp, basis: "SELLBACK", expectedTotalOpenings: v.totalOpenings });
    if (!validation.ok) throw err.validation("Version fails validation", { errors: validation.errors });

    if (opts.scheduledAt && opts.scheduledAt > new Date()) {
      await tx.update(packVersion).set({ status: "SCHEDULED", scheduledAt: opts.scheduledAt }).where(eq(packVersion.id, versionId));
      await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: "pack.version.schedule", entityType: "pack_version", entityId: versionId, after: { scheduledAt: opts.scheduledAt }, correlationId: actor.correlationId });
      return { scheduled: true };
    }

    // Reserve inventory.
    for (const o of outcomes) {
      if (o.inventoryItemId) await reserveUniqueItem(tx, o.inventoryItemId, "pack_version", versionId);
      else await reservePooled(tx, o.skuId, o.quantityTotal);
    }
    // Close the previously live version of this pack (one live version at a time).
    if (p.currentVersionId && p.currentVersionId !== versionId) {
      await closeVersionInternal(tx, actor, p.currentVersionId, "Superseded by newer version");
    }
    const manifest = buildManifest(v, p, outcomes);
    const canonical = canonicalJson(manifest);
    const manifestHash = sha256Hex(canonical);
    const rtp = validation.result!;
    await tx
      .update(packVersion)
      .set({ status: "PUBLISHED", publishedAt: new Date(), manifestHash, manifestJson: manifest, merchandiseRtpBp: rtp.merchandiseRtpBp, sellbackRtpBp: rtp.sellbackRtpBp, remainingOpenings: v.totalOpenings, pausedAt: null, pauseReason: null })
      .where(eq(packVersion.id, versionId));
    await tx.update(packOutcome).set({ quantityRemaining: sql`quantity_total` }).where(eq(packOutcome.packVersionId, versionId));
    await tx.insert(packManifestCommitment).values({ packVersionId: versionId, manifestHash, manifestJson: manifest, canonicalManifest: canonical, publishedBy: actor.userId });
    await tx.update(pack).set({ currentVersionId: versionId, status: "ACTIVE" }).where(eq(pack.id, p.id));
    await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: "pack.version.publish", entityType: "pack_version", entityId: versionId, after: { manifestHash, merchandiseRtpBp: rtp.merchandiseRtpBp, sellbackRtpBp: rtp.sellbackRtpBp }, correlationId: actor.correlationId });
    return { scheduled: false, manifestHash };
  });
}

export async function pauseVersion(db: Db, actor: Actor | null, versionId: string, reason: string) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, versionId)).for("update");
    if (!v) throw err.notFound("Pack version");
    if (v.status !== "PUBLISHED") throw err.state(`Cannot pause a ${v.status} version`);
    await tx.update(packVersion).set({ status: "PAUSED", pausedAt: new Date(), pauseReason: reason }).where(eq(packVersion.id, versionId));
    await audit(tx, { actorUserId: actor?.userId ?? null, actorRole: actor?.role ?? "SYSTEM", action: "pack.version.pause", entityType: "pack_version", entityId: versionId, reason, before: { status: v.status }, after: { status: "PAUSED" }, correlationId: actor?.correlationId });
  });
}

export async function resumeVersion(db: Db, actor: Actor, versionId: string) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, versionId)).for("update");
    if (!v) throw err.notFound("Pack version");
    if (v.status !== "PAUSED") throw err.state("Version is not paused");
    const health = await evaluateVersionHealth(tx, versionId);
    if (!health.ok) throw err.state(`Cannot resume: ${health.reasons.join("; ")}`);
    await tx.update(packVersion).set({ status: "PUBLISHED", pausedAt: null, pauseReason: null }).where(eq(packVersion.id, versionId));
    await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: "pack.version.resume", entityType: "pack_version", entityId: versionId, before: { status: "PAUSED" }, after: { status: "PUBLISHED" }, correlationId: actor.correlationId });
  });
}

async function closeVersionInternal(tx: DbOrTx, actor: Actor | null, versionId: string, reason: string) {
  const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, versionId)).for("update");
  if (!v || v.status === "CLOSED") return;
  const outcomes = await tx.select().from(packOutcome).where(eq(packOutcome.packVersionId, versionId));
  for (const o of outcomes) {
    if (o.quantityRemaining <= 0) continue;
    if (o.inventoryItemId) await releaseUniqueItem(tx, o.inventoryItemId, "pack_version", versionId);
    else await releasePooled(tx, o.skuId, o.quantityRemaining);
  }
  await tx.update(packVersion).set({ status: "CLOSED", closedAt: new Date(), pauseReason: reason }).where(eq(packVersion.id, versionId));
  const p = await tx.query.pack.findFirst({ where: eq(pack.id, v.packId) });
  if (p?.currentVersionId === versionId) await tx.update(pack).set({ currentVersionId: null, status: "ARCHIVED" }).where(eq(pack.id, v.packId));
  await audit(tx, { actorUserId: actor?.userId ?? null, actorRole: actor?.role ?? "SYSTEM", action: "pack.version.close", entityType: "pack_version", entityId: versionId, reason, before: { status: v.status }, after: { status: "CLOSED" }, correlationId: actor?.correlationId });
}

export async function closeVersion(db: Db, actor: Actor | null, versionId: string, reason: string) {
  return serializable(db, (tx) => closeVersionInternal(tx, actor, versionId, reason));
}

/** Clone any version into a new DRAFT version (next version number) so changes never mutate a published manifest. */
export async function cloneVersion(db: Db, actor: Actor, versionId: string) {
  return db.transaction(async (tx) => {
    const v = await tx.query.packVersion.findFirst({ where: eq(packVersion.id, versionId) });
    if (!v) throw err.notFound("Pack version");
    const max = await tx.select({ m: sql<number>`MAX(version)` }).from(packVersion).where(eq(packVersion.packId, v.packId));
    const [nv] = await tx
      .insert(packVersion)
      .values({ packId: v.packId, version: Number(max[0].m) + 1, priceMinor: v.priceMinor, currency: v.currency, totalOpenings: v.totalOpenings, remainingOpenings: v.totalOpenings, targetRtpBp: v.targetRtpBp, rtpToleranceBp: v.rtpToleranceBp, liabilityLimitMinor: v.liabilityLimitMinor, createdBy: actor.userId, notes: `Cloned from v${v.version}` })
      .returning();
    const outcomes = await tx.select().from(packOutcome).where(eq(packOutcome.packVersionId, versionId)).orderBy(asc(packOutcome.position));
    if (outcomes.length) {
      await tx.insert(packOutcome).values(
        outcomes.map((o) => ({
          packVersionId: nv.id,
          position: o.position,
          label: o.label,
          tier: o.tier,
          skuId: o.skuId,
          // unique items still reserved by the old version cannot be re-used until it closes; keep the reference, publish will validate.
          inventoryItemId: o.inventoryItemId,
          valuationSnapshotId: o.valuationSnapshotId,
          quantityTotal: o.quantityTotal,
          quantityRemaining: o.quantityTotal,
          referenceValueMinor: o.referenceValueMinor,
          sellbackOfferMinor: o.sellbackOfferMinor,
          condition: o.condition,
          shippingEligible: o.shippingEligible,
        })),
      );
    }
    await recomputeDraftTotals(tx, nv.id);
    await audit(tx, { actorUserId: actor.userId, actorRole: actor.role, action: "pack.version.clone", entityType: "pack_version", entityId: nv.id, after: { from: versionId }, correlationId: actor.correlationId });
    return nv;
  });
}

/** Auto-pause triggers: stale valuations, unavailable unique inventory, liability limit breach. */
export async function evaluateVersionHealth(db: DbOrTx, versionId: string): Promise<{ ok: boolean; reasons: string[] }> {
  const v = await db.query.packVersion.findFirst({ where: eq(packVersion.id, versionId) });
  if (!v) return { ok: false, reasons: ["missing"] };
  const outcomes = await db.select().from(packOutcome).where(eq(packOutcome.packVersionId, versionId));
  const reasons: string[] = [];
  const maxAge = config.economics.valuationMaxAgeHours * 3_600_000;
  const now = Date.now();
  for (const o of outcomes) {
    if (o.quantityRemaining <= 0) continue;
    if (o.valuationSnapshotId) {
      const snap = await db.query.valuationSnapshot.findFirst({ where: eq(valuationSnapshot.id, o.valuationSnapshotId) });
      if (snap && now - snap.observedAt.getTime() > maxAge) reasons.push(`Valuation for "${o.label}" is stale (${Math.round((now - snap.observedAt.getTime()) / 3_600_000)}h)`);
    }
    if (o.inventoryItemId) {
      const item = await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, o.inventoryItemId) });
      if (!item || item.status !== "RESERVED" || item.reservedForId !== versionId) reasons.push(`Unique item for "${o.label}" is not reserved for this version`);
    } else {
      const sku = await db.query.productSku.findFirst({ where: eq(productSku.id, o.skuId) });
      if (!sku || sku.pooledReserved < o.quantityRemaining) reasons.push(`Pooled stock for "${o.label}" is insufficient`);
    }
  }
  const remainingLiability = outcomes.reduce((a, o) => a + BigInt(o.quantityRemaining) * o.referenceValueMinor, 0n);
  const limit = v.liabilityLimitMinor ?? config.economics.maxMerchLiabilityMinor;
  if (remainingLiability > limit) reasons.push(`Merchandise liability ${remainingLiability} exceeds limit ${limit}`);
  return { ok: reasons.length === 0, reasons };
}

// ---- Customer catalog queries ----------------------------------------------------------------
export interface CatalogFilter {
  category?: string;
  q?: string;
  maxPriceMinor?: bigint;
  minPriceMinor?: bigint;
  sort?: "new" | "price_asc" | "price_desc" | "value" | "ending";
  tag?: string;
  limit?: number;
}

export async function listCatalog(db: DbOrTx, f: CatalogFilter = {}) {
  const rows = await db
    .select({ pack, version: packVersion, category })
    .from(pack)
    .innerJoin(packVersion, eq(packVersion.id, pack.currentVersionId))
    .innerJoin(category, eq(category.id, pack.categoryId))
    .where(and(isNull(pack.deletedAt), inArray(packVersion.status, ["PUBLISHED", "PAUSED"])))
    .orderBy(desc(packVersion.publishedAt));
  let items = rows;
  if (f.category) items = items.filter((r) => r.category.slug === f.category);
  if (f.tag) items = items.filter((r) => r.pack.tags.includes(f.tag!));
  if (f.q) {
    const q = f.q.toLowerCase();
    items = items.filter((r) => r.pack.name.toLowerCase().includes(q) || (r.pack.tagline ?? "").toLowerCase().includes(q) || r.pack.tags.some((t) => t.includes(q)));
  }
  if (f.maxPriceMinor !== undefined) items = items.filter((r) => r.version.priceMinor <= f.maxPriceMinor!);
  if (f.minPriceMinor !== undefined) items = items.filter((r) => r.version.priceMinor >= f.minPriceMinor!);
  switch (f.sort) {
    case "price_asc":
      items.sort((a, b) => Number(a.version.priceMinor - b.version.priceMinor));
      break;
    case "price_desc":
      items.sort((a, b) => Number(b.version.priceMinor - a.version.priceMinor));
      break;
    case "value":
      items.sort((a, b) => (b.version.merchandiseRtpBp ?? 0) - (a.version.merchandiseRtpBp ?? 0));
      break;
    case "ending":
      items.sort((a, b) => a.version.remainingOpenings / a.version.totalOpenings - b.version.remainingOpenings / b.version.totalOpenings);
      break;
    default:
      break;
  }
  if (f.limit) items = items.slice(0, f.limit);
  return items.map((r) => ({
    id: r.pack.id,
    slug: r.pack.slug,
    name: r.pack.name,
    tagline: r.pack.tagline,
    accent: r.pack.accent,
    heroImageKey: r.pack.heroImageKey,
    tags: r.pack.tags,
    category: { slug: r.category.slug, name: r.category.name },
    kind: r.pack.kind,
    version: {
      id: r.version.id,
      version: r.version.version,
      status: r.version.status,
      priceMinor: r.version.priceMinor,
      currency: r.version.currency,
      totalOpenings: r.version.totalOpenings,
      remainingOpenings: r.version.remainingOpenings,
      merchandiseRtpBp: r.version.merchandiseRtpBp,
      sellbackRtpBp: r.version.sellbackRtpBp,
      publishedAt: r.version.publishedAt,
    },
  }));
}

export async function getPackDetail(db: DbOrTx, slug: string) {
  const p = await db.query.pack.findFirst({ where: and(eq(pack.slug, slug), isNull(pack.deletedAt)) });
  if (!p || !p.currentVersionId) return null;
  const v = await db.query.packVersion.findFirst({ where: eq(packVersion.id, p.currentVersionId) });
  if (!v) return null;
  const cat = await db.query.category.findFirst({ where: eq(category.id, p.categoryId) });
  const outcomes = await db
    .select({ o: packOutcome, sku: productSku, item: inventoryItem, val: valuationSnapshot })
    .from(packOutcome)
    .innerJoin(productSku, eq(productSku.id, packOutcome.skuId))
    .leftJoin(inventoryItem, eq(inventoryItem.id, packOutcome.inventoryItemId))
    .leftJoin(valuationSnapshot, eq(valuationSnapshot.id, packOutcome.valuationSnapshotId))
    .where(eq(packOutcome.packVersionId, v.id))
    .orderBy(asc(packOutcome.position));
  const commitment = await db.query.packManifestCommitment.findFirst({ where: eq(packManifestCommitment.packVersionId, v.id) });
  return {
    pack: p,
    version: v,
    category: cat,
    manifestHash: v.manifestHash,
    commitmentAt: commitment?.createdAt ?? null,
    outcomes: outcomes.map(({ o, sku, item, val }) => ({
      id: o.id,
      position: o.position,
      label: o.label,
      tier: o.tier,
      quantityTotal: o.quantityTotal,
      quantityRemaining: o.quantityRemaining,
      initialProbability: { num: o.quantityTotal, den: v.totalOpenings },
      liveProbability: { num: o.quantityRemaining, den: v.remainingOpenings },
      referenceValueMinor: o.referenceValueMinor,
      sellbackOfferMinor: o.sellbackOfferMinor,
      currency: o.currency,
      condition: o.condition,
      shippingEligible: o.shippingEligible && !sku.shippingRestricted,
      shippingNote: sku.shippingRestrictionNote,
      sku: { id: sku.id, sku: sku.sku, name: sku.name, brand: sku.brand, accent: sku.accent, imageKey: sku.imageKey, isUnique: sku.isUnique },
      item: item ? { id: item.id, itemCode: item.itemCode, grader: item.grader, grade: item.grade, certificationId: item.certificationId, serialNumber: item.serialNumber, size: item.size, condition: item.condition, custody: item.custody } : null,
      valuation: val ? { source: val.source, sourceRef: val.sourceRef, observedAt: val.observedAt } : null,
    })),
  };
}
