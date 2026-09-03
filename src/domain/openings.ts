import { and, asc, desc, eq, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db/client";
import { fairnessReceipt, fairnessSeed, inventoryItem, opening, ownershipTransfer, pack, packOutcome, packVersion, productSku, vaultHolding } from "@/db/schema";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { decryptString, encryptString, randomHex } from "@/lib/crypto";
import { err } from "@/lib/errors";
import { draw, generateServerSeed, mapIndexToOutcome, remainingInventoryCommitment, serverSeedHash, signReceipt, signingKeyId } from "@/lib/fairness/node";
import { enqueueOutbox } from "@/lib/outbox";
import { serializable } from "@/lib/tx";
import { assertEligible } from "./gates";
import { consumePooledUnit } from "./inventory";
import { getOrCreateUserAccount, getSystemAccount, postTransaction } from "./ledger";

// ---- Seeds --------------------------------------------------------------------------------
export async function getOrCreateUserSeed(tx: DbOrTx, userId: string, opts: { lock?: boolean } = {}) {
  const q = tx.select().from(fairnessSeed).where(and(eq(fairnessSeed.userId, userId), eq(fairnessSeed.scope, "USER"), eq(fairnessSeed.status, "ACTIVE")));
  const [existing] = opts.lock ? await q.for("update") : await q;
  if (existing) return existing;
  const seed = generateServerSeed();
  const [created] = await tx
    .insert(fairnessSeed)
    .values({ scope: "USER", userId, serverSeedHash: serverSeedHash(seed), serverSeedEncrypted: encryptString(seed, `seed:${userId}`), clientSeed: randomHex(8), nonce: 0 })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  const [again] = await tx.select().from(fairnessSeed).where(and(eq(fairnessSeed.userId, userId), eq(fairnessSeed.scope, "USER"), eq(fairnessSeed.status, "ACTIVE"))).for("update");
  return again;
}

export async function createScopedSeed(tx: DbOrTx, scope: "BATTLE" | "RAFFLE", scopeRefId: string, clientSeed: string) {
  const seed = generateServerSeed();
  const [row] = await tx.insert(fairnessSeed).values({ scope, scopeRefId, serverSeedHash: serverSeedHash(seed), serverSeedEncrypted: encryptString(seed, `seed:${scope}:${scopeRefId}`), clientSeed, nonce: 0 }).returning();
  return row;
}

export function decryptSeed(row: typeof fairnessSeed.$inferSelect): string {
  const aad = row.scope === "USER" ? `seed:${row.userId}` : `seed:${row.scope}:${row.scopeRefId}`;
  return decryptString(row.serverSeedEncrypted, aad);
}

/** Retire the active seed (revealing it) and create a fresh one. Users may rotate at any time. */
export async function rotateUserSeed(db: Db, userId: string, newClientSeed?: string) {
  return db.transaction(async (tx) => {
    const current = await getOrCreateUserSeed(tx, userId, { lock: true });
    const revealed = decryptSeed(current);
    await tx.update(fairnessSeed).set({ status: "REVEALED", retiredAt: new Date(), revealedAt: new Date(), revealedServerSeed: revealed }).where(eq(fairnessSeed.id, current.id));
    const seed = generateServerSeed();
    const [next] = await tx
      .insert(fairnessSeed)
      .values({ scope: "USER", userId, serverSeedHash: serverSeedHash(seed), serverSeedEncrypted: encryptString(seed, `seed:${userId}`), clientSeed: (newClientSeed ?? current.clientSeed).slice(0, 64), nonce: 0 })
      .returning();
    await audit(tx, { actorUserId: userId, action: "fairness.seed.rotate", entityType: "fairness_seed", entityId: next.id, before: { retired: current.id }, after: { nextHash: next.serverSeedHash } });
    return { retired: { id: current.id, serverSeedHash: current.serverSeedHash, revealedServerSeed: revealed, uses: current.useCount }, next: { id: next.id, serverSeedHash: next.serverSeedHash, clientSeed: next.clientSeed } };
  });
}

export async function setClientSeed(db: Db, userId: string, clientSeed: string) {
  const cleaned = clientSeed.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(cleaned)) throw err.validation("Client seed must be 1-64 characters: letters, digits, _ or -");
  return db.transaction(async (tx) => {
    const current = await getOrCreateUserSeed(tx, userId, { lock: true });
    await tx.update(fairnessSeed).set({ clientSeed: cleaned }).where(eq(fairnessSeed.id, current.id));
    return { ...current, clientSeed: cleaned };
  });
}

/** Rotation policy executed by the worker: reveal seeds past the reveal window or max uses. */
export async function revealEligibleSeeds(db: Db): Promise<number> {
  const cutoff = new Date(Date.now() - config.fairness.seedRevealAfterHours * 3_600_000);
  const rows = await db
    .select()
    .from(fairnessSeed)
    .where(and(eq(fairnessSeed.scope, "USER"), eq(fairnessSeed.status, "ACTIVE"), sql`(${fairnessSeed.createdAt} < ${cutoff} OR ${fairnessSeed.useCount} >= ${config.fairness.seedMaxUses}) AND ${fairnessSeed.useCount} > 0`));
  let n = 0;
  for (const r of rows) {
    await rotateUserSeed(db, r.userId!);
    n++;
  }
  return n;
}

// ---- Opening --------------------------------------------------------------------------------
export interface OpenInput {
  userId: string;
  packVersionId: string;
  idempotencyKey: string;
  source?: "DIRECT" | "BATTLE" | "PROMO";
  /** For battles: the battle seed and pre-paid entry; the opening is not debited again. */
  battle?: { battleId: string; seedRow: typeof fairnessSeed.$inferSelect; nonce: number; ledgerTransactionId: string | null };
  correlationId?: string | null;
}

export interface OpenResult {
  opening: typeof opening.$inferSelect;
  receipt: typeof fairnessReceipt.$inferSelect;
  outcome: typeof packOutcome.$inferSelect;
  item: typeof inventoryItem.$inferSelect;
  replayed: boolean;
}

/**
 * The single settlement path. One SERIALIZABLE transaction:
 * eligibility + balance -> nonce -> draw -> decrement inventory -> ledger debit -> item into vault -> signed receipt -> outbox.
 * The animation only ever visualizes the stored result.
 */
export async function openPack(db: Db, input: OpenInput): Promise<OpenResult> {
  return serializable(db, (tx) => openPackInTx(tx, input));
}

export async function openPackInTx(tx: DbOrTx, input: OpenInput): Promise<OpenResult> {
  const source = input.source ?? "DIRECT";
  // Defense-in-depth idempotency at the domain level (the API layer also wraps with Idempotency-Key).
  const prior = await tx.query.opening.findFirst({ where: and(eq(opening.userId, input.userId), eq(opening.idempotencyKey, input.idempotencyKey)) });
  if (prior) {
    const receipt = (await tx.query.fairnessReceipt.findFirst({ where: eq(fairnessReceipt.openingId, prior.id) }))!;
    const outcome = (await tx.query.packOutcome.findFirst({ where: eq(packOutcome.id, prior.outcomeId) }))!;
    const item = (await tx.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, prior.inventoryItemId!) }))!;
    return { opening: prior, receipt, outcome, item, replayed: true };
  }

  const [v] = await tx.select().from(packVersion).where(eq(packVersion.id, input.packVersionId)).for("update");
  if (!v) throw err.notFound("Pack version");
  if (v.status !== "PUBLISHED") throw new (await import("@/lib/errors")).AppError("PACK_UNAVAILABLE", v.status === "PAUSED" ? "This pack is paused" : "This pack is not available");
  if (v.remainingOpenings <= 0) throw err.soldOut();
  const p = (await tx.query.pack.findFirst({ where: eq(pack.id, v.packId) }))!;

  if (source !== "BATTLE") await assertEligible(tx, input.userId, "OPEN", v.priceMinor);

  const outcomes = await tx.select().from(packOutcome).where(eq(packOutcome.packVersionId, v.id)).orderBy(asc(packOutcome.position)).for("update");
  const weights = outcomes.map((o) => o.quantityRemaining);
  const range = weights.reduce((a, b) => a + b, 0);
  if (range <= 0 || range !== v.remainingOpenings) throw err.state("Inventory commitment mismatch; opening aborted");
  const remainingBefore = outcomes.map((o) => ({ outcomeId: o.id, position: o.position, remaining: o.quantityRemaining }));
  const commitment = remainingInventoryCommitment(remainingBefore.map((r) => ({ outcomeId: r.outcomeId, remaining: r.remaining })));

  // Seed + atomic nonce.
  let seedRow: typeof fairnessSeed.$inferSelect;
  let nonce: number;
  if (input.battle) {
    seedRow = input.battle.seedRow;
    nonce = input.battle.nonce;
  } else {
    seedRow = await getOrCreateUserSeed(tx, input.userId, { lock: true });
    nonce = seedRow.nonce;
    await tx.update(fairnessSeed).set({ nonce: sql`${fairnessSeed.nonce} + 1`, useCount: sql`${fairnessSeed.useCount} + 1` }).where(eq(fairnessSeed.id, seedRow.id));
  }
  const serverSeed = decryptSeed(seedRow);
  const result = draw({ serverSeed, clientSeed: seedRow.clientSeed, nonce, scopeId: v.id, manifestHash: v.manifestHash!, range });
  const mapped = mapIndexToOutcome(result.index, weights);
  const outcome = outcomes[mapped.outcomeIndex];

  // Decrement inventory atomically (guards ensure never below zero).
  const dec = await tx
    .update(packOutcome)
    .set({ quantityRemaining: sql`${packOutcome.quantityRemaining} - 1` })
    .where(and(eq(packOutcome.id, outcome.id), sql`${packOutcome.quantityRemaining} > 0`))
    .returning();
  if (dec.length === 0) throw err.soldOut("Outcome exhausted");
  const vdec = await tx
    .update(packVersion)
    .set({ remainingOpenings: sql`${packVersion.remainingOpenings} - 1` })
    .where(and(eq(packVersion.id, v.id), sql`${packVersion.remainingOpenings} > 0`))
    .returning();
  if (vdec.length === 0) throw err.soldOut();
  if (vdec[0].remainingOpenings === 0) {
    await tx.update(packVersion).set({ status: "CLOSED", closedAt: new Date(), pauseReason: "Sold out" }).where(eq(packVersion.id, v.id));
  }

  // Ledger: debit customer, credit pack sales (battles pay at entry).
  let ledgerTransactionId: string | null = input.battle?.ledgerTransactionId ?? null;
  if (source !== "BATTLE") {
    const userAcct = await getOrCreateUserAccount(tx, input.userId, "USER_CASH", v.currency);
    const sales = await getSystemAccount(tx, "SYSTEM_PACK_SALES", v.currency);
    const trx = await postTransaction(tx, {
      kind: "PACK_PURCHASE",
      referenceType: "pack_version",
      referenceId: v.id,
      idempotencyKey: `open:${input.userId}:${input.idempotencyKey}`,
      description: `Open ${p.name} v${v.version}`,
      currency: v.currency,
      entries: [
        { accountId: userAcct.id, amountMinor: -v.priceMinor, memo: "pack purchase" },
        { accountId: sales.id, amountMinor: v.priceMinor, memo: "pack sale" },
      ],
      createdBy: input.userId,
    });
    ledgerTransactionId = trx.id;
  }

  // Item into vault (unique or pooled materialization).
  let item: typeof inventoryItem.$inferSelect;
  if (outcome.inventoryItemId) {
    const [locked] = await tx.select().from(inventoryItem).where(eq(inventoryItem.id, outcome.inventoryItemId)).for("update");
    if (!locked || locked.status !== "RESERVED" || locked.reservedForId !== v.id) throw err.state("Unique item is no longer reserved for this pack");
    const [updated] = await tx
      .update(inventoryItem)
      .set({ status: "IN_VAULT", ownerUserId: input.userId, reservedForType: null, reservedForId: null, reservedAt: null })
      .where(and(eq(inventoryItem.id, locked.id), eq(inventoryItem.status, "RESERVED")))
      .returning();
    if (!updated) throw err.conflict("Item allocation conflict");
    item = updated;
  } else {
    const sku = await tx.query.productSku.findFirst({ where: eq(productSku.id, outcome.skuId) });
    item = await consumePooledUnit(tx, outcome.skuId, input.userId, { condition: outcome.condition, acquisitionCostMinor: sku?.defaultSellbackOfferMinor ?? 0n });
  }

  const [op] = await tx
    .insert(opening)
    .values({
      userId: input.userId,
      packVersionId: v.id,
      outcomeId: outcome.id,
      inventoryItemId: item.id,
      source,
      priceMinor: source === "BATTLE" ? 0n : v.priceMinor,
      referenceValueMinor: outcome.referenceValueMinor,
      sellbackOfferMinor: outcome.sellbackOfferMinor,
      currency: v.currency,
      ledgerTransactionId,
      battleId: input.battle?.battleId ?? null,
      idempotencyKey: input.idempotencyKey,
    })
    .returning();

  const [transfer] = await tx
    .insert(ownershipTransfer)
    .values({ inventoryItemId: item.id, fromUserId: null, toUserId: input.userId, reason: "OPENING", referenceType: "opening", referenceId: op.id, ledgerTransactionId })
    .returning();
  await tx.insert(vaultHolding).values({ userId: input.userId, inventoryItemId: item.id, acquiredVia: "OPENING", acquiredRefId: op.id, referenceValueMinor: outcome.referenceValueMinor, sellbackOfferMinor: outcome.sellbackOfferMinor, currency: v.currency });
  await tx.update(opening).set({ ownershipTransferId: transfer.id }).where(eq(opening.id, op.id));

  const valueSnapshot = {
    referenceValueMinor: outcome.referenceValueMinor.toString(),
    sellbackOfferMinor: outcome.sellbackOfferMinor.toString(),
    currency: outcome.currency,
    valuationSnapshotId: outcome.valuationSnapshotId,
    remainingBefore,
    remainingQuantities: weights,
  };
  const payload = {
    algorithmVersion: 1,
    openingId: op.id,
    openedAt: op.createdAt.toISOString(),
    userId: input.userId,
    packId: p.id,
    packSlug: p.slug,
    packVersionId: v.id,
    packVersion: v.version,
    manifestHash: v.manifestHash,
    remainingInventoryCommitment: commitment,
    serverSeedHash: seedRow.serverSeedHash,
    clientSeed: seedRow.clientSeed,
    nonce,
    message: result.message,
    digest: result.digest,
    rangeSize: range,
    rejectionLimit: result.limit,
    samplingSteps: result.steps,
    selectedIndex: result.index,
    outcomeId: outcome.id,
    outcomePosition: outcome.position,
    inventoryItemId: item.id,
    valueSnapshot,
    ledgerTransactionId,
    ownershipTransferId: transfer.id,
  };
  const signed = signReceipt(payload);
  const [receipt] = await tx
    .insert(fairnessReceipt)
    .values({
      openingId: op.id,
      seedId: seedRow.id,
      packVersionId: v.id,
      manifestHash: v.manifestHash!,
      remainingInventoryCommitment: commitment,
      serverSeedHash: seedRow.serverSeedHash,
      clientSeed: seedRow.clientSeed,
      nonce,
      message: result.message,
      digest: result.digest,
      rangeSize: range,
      samplingSteps: result.steps,
      selectedIndex: result.index,
      outcomeId: outcome.id,
      inventoryItemId: item.id,
      valueSnapshot,
      ledgerTransactionId,
      ownershipTransferId: transfer.id,
      payloadCanonical: signed.canonical,
      signature: signed.signature,
      signingKeyId: signingKeyId(),
    })
    .returning();

  await enqueueOutbox(tx, "realtime.opening", { openingId: op.id, userId: input.userId }, { type: "opening", id: op.id });
  if (source !== "BATTLE") await enqueueOutbox(tx, "race.score", { sourceType: "OPENING", sourceId: op.id, userId: input.userId, amountMinor: v.priceMinor.toString(), occurredAt: op.createdAt.toISOString() }, { type: "opening", id: op.id });
  await audit(tx, { actorUserId: input.userId, actorRole: "CUSTOMER", action: "opening.settle", entityType: "opening", entityId: op.id, after: { outcomeId: outcome.id, itemId: item.id, digest: result.digest }, correlationId: input.correlationId ?? null });

  return { opening: { ...op, ownershipTransferId: transfer.id }, receipt, outcome: dec[0], item, replayed: false };
}

// ---- Reads ----------------------------------------------------------------------------------
export async function getOpeningView(db: DbOrTx, openingId: string, viewerUserId: string | null, opts: { admin?: boolean } = {}) {
  const op = await db.query.opening.findFirst({ where: eq(opening.id, openingId) });
  if (!op) return null;
  if (!opts.admin && op.userId !== viewerUserId) return null;
  const receipt = await db.query.fairnessReceipt.findFirst({ where: eq(fairnessReceipt.openingId, op.id) });
  const seed = receipt ? await db.query.fairnessSeed.findFirst({ where: eq(fairnessSeed.id, receipt.seedId) }) : null;
  const v = (await db.query.packVersion.findFirst({ where: eq(packVersion.id, op.packVersionId) }))!;
  const p = (await db.query.pack.findFirst({ where: eq(pack.id, v.packId) }))!;
  const outcomeRows = await db
    .select({ o: packOutcome, sku: productSku })
    .from(packOutcome)
    .innerJoin(productSku, eq(productSku.id, packOutcome.skuId))
    .where(eq(packOutcome.packVersionId, v.id))
    .orderBy(asc(packOutcome.position));
  const item = op.inventoryItemId ? await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, op.inventoryItemId) }) : null;
  const holding = item ? await db.query.vaultHolding.findFirst({ where: and(eq(vaultHolding.inventoryItemId, item.id), eq(vaultHolding.userId, op.userId)), orderBy: desc(vaultHolding.createdAt) }) : null;
  const won = outcomeRows.find((r) => r.o.id === op.outcomeId)!;
  return {
    opening: op,
    pack: { id: p.id, slug: p.slug, name: p.name, accent: p.accent, version: v.version, priceMinor: v.priceMinor, currency: v.currency },
    outcome: { ...won.o, sku: { name: won.sku.name, accent: won.sku.accent, imageKey: won.sku.imageKey, brand: won.sku.brand } },
    /** representative strip for the presentation-only reel: every outcome with its initial weight */
    reelOutcomes: outcomeRows.map(({ o, sku }) => ({ id: o.id, label: o.label, tier: o.tier, quantityTotal: o.quantityTotal, referenceValueMinor: o.referenceValueMinor, accent: sku.accent, imageKey: sku.imageKey, name: sku.name })),
    item: item ? { id: item.id, itemCode: item.itemCode, grader: item.grader, grade: item.grade, certificationId: item.certificationId, serialNumber: item.serialNumber, condition: item.condition, custody: item.custody, status: item.status } : null,
    holding: holding ? { id: holding.id, status: holding.status } : null,
    receipt: receipt
      ? {
          ...receipt,
          revealedServerSeed: seed?.status === "REVEALED" ? seed.revealedServerSeed : null,
          seedStatus: seed?.status ?? null,
          seedRevealPolicy: `Server seeds are revealed when rotated by the user or automatically after ${config.fairness.seedRevealAfterHours}h / ${config.fairness.seedMaxUses} uses.`,
        }
      : null,
  };
}

export async function markRevealed(db: Db, openingId: string, userId: string) {
  await db.update(opening).set({ revealedAt: new Date() }).where(and(eq(opening.id, openingId), eq(opening.userId, userId), sql`${opening.revealedAt} IS NULL`));
}

export async function listUserOpenings(db: DbOrTx, userId: string, limit = 50) {
  return db
    .select({ o: opening, packName: pack.name, packSlug: pack.slug, outcomeLabel: packOutcome.label, tier: packOutcome.tier, accent: pack.accent })
    .from(opening)
    .innerJoin(packVersion, eq(packVersion.id, opening.packVersionId))
    .innerJoin(pack, eq(pack.id, packVersion.packId))
    .innerJoin(packOutcome, eq(packOutcome.id, opening.outcomeId))
    .where(eq(opening.userId, userId))
    .orderBy(desc(opening.createdAt))
    .limit(limit);
}
