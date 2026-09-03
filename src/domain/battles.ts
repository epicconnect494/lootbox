import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db/client";
import { battle, battlePull, battleRound, battleSeat, fairnessSeed, inventoryItem, opening, ownershipTransfer, pack, packOutcome, packVersion, productSku, user, vaultHolding, type SharedRule } from "@/db/schema";
import { audit } from "@/lib/audit";
import { config } from "@/lib/config";
import { randomHex } from "@/lib/crypto";
import { err } from "@/lib/errors";
import { draw } from "@/lib/fairness/node";
import { enqueueOutbox } from "@/lib/outbox";
import { serializable } from "@/lib/tx";
import { assertEligible } from "./gates";
import { getOrCreateUserAccount, getSystemAccount, postTransaction } from "./ledger";
import { createScopedSeed, decryptSeed, getOrCreateUserSeed, openPackInTx } from "./openings";

export type BattleMode = "CLASSIC" | "CRAZY" | "SHARED" | "KEEP";

export const MODE_RULES: Record<BattleMode, { title: string; banner: string; summary: string }> = {
  CLASSIC: { title: "Classic", banner: "HIGHEST TOTAL WINS", summary: "Highest combined disclosed item value wins every eligible item in the pool." },
  CRAZY: { title: "Crazy Mode", banner: "LOWEST TOTAL WINS", summary: "Lowest combined disclosed item value wins every item in the pool. Valuations are fixed at the manifest snapshot." },
  SHARED: { title: "Shared", banner: "POOL IS SHARED", summary: "All items are pooled, sorted by disclosed value, and dealt in snake order by rank (highest total picks first). Fully deterministic and disclosed before entry." },
  KEEP: { title: "Keep", banner: "EVERYONE KEEPS THEIR PULLS", summary: "A synchronized social opening. Each player keeps exactly what they pull." },
};

function code(): string {
  return randomHex(4).toUpperCase();
}

export async function createBattle(db: Db, userId: string, input: { mode: BattleMode; speed: "NORMAL" | "FAST"; isPrivate: boolean; seats: number; packVersionIds: string[]; sharedRule?: SharedRule | null; idempotencyKey: string }) {
  if (input.seats < 2 || input.seats > 4) throw err.validation("Battles have 2-4 players");
  if (input.packVersionIds.length < 1 || input.packVersionIds.length > 10) throw err.validation("Choose 1-10 packs");
  if (input.mode === "SHARED" && !input.sharedRule) throw err.validation("Shared battles need a disclosed split rule");
  return serializable(db, async (tx) => {
    const versions = await tx.select().from(packVersion).where(inArray(packVersion.id, [...new Set(input.packVersionIds)]));
    const byId = new Map(versions.map((v) => [v.id, v]));
    let entry = 0n;
    const currency = versions[0]?.currency ?? "USD";
    for (const id of input.packVersionIds) {
      const v = byId.get(id);
      if (!v || v.status !== "PUBLISHED") throw err.validation("Every pack in the sequence must be live");
      if (v.currency !== currency) throw err.validation("Packs must share a currency");
      const needed = input.packVersionIds.filter((x) => x === id).length * input.seats;
      if (v.remainingOpenings < needed) throw err.soldOut(`Not enough remaining openings in a selected pack for ${input.seats} players`);
      entry += v.priceMinor;
    }
    await assertEligible(tx, userId, "BATTLE", entry);
    const [b] = await tx
      .insert(battle)
      .values({ code: code(), mode: input.mode, speed: input.speed, isPrivate: input.isPrivate, joinCode: input.isPrivate ? randomHex(3).toUpperCase() : null, seats: input.seats, packVersionIds: input.packVersionIds, entryCostMinor: entry, currency, sharedRule: input.mode === "SHARED" ? (input.sharedRule ?? null) : null, createdBy: userId })
      .returning();
    // Commit the server seed hash before any player's client seed is known.
    const seed = await createScopedSeed(tx, "BATTLE", b.id, "");
    await tx.update(battle).set({ seedId: seed.id, serverSeedHash: seed.serverSeedHash }).where(eq(battle.id, b.id));
    await joinInTx(tx, b.id, userId, 0, input.idempotencyKey);
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "battle.create", entityType: "battle", entityId: b.id, after: { mode: b.mode, seats: b.seats, entry: entry.toString(), serverSeedHash: seed.serverSeedHash } });
    return { ...b, seedId: seed.id, serverSeedHash: seed.serverSeedHash };
  });
}

async function joinInTx(tx: DbOrTx, battleId: string, userId: string, seatIndex: number, idempotencyKey: string, opts: { bot?: boolean } = {}) {
  const [b] = await tx.select().from(battle).where(eq(battle.id, battleId)).for("update");
  if (!b) throw err.notFound("Battle");
  if (b.status !== "OPEN") throw err.state("Battle is no longer open");
  const userSeed = await getOrCreateUserSeed(tx, userId);
  const userAcct = await getOrCreateUserAccount(tx, userId, "USER_CASH", b.currency);
  const sales = await getSystemAccount(tx, "SYSTEM_PACK_SALES", b.currency);
  const source = opts.bot ? await getSystemAccount(tx, "SYSTEM_PROMO_FUNDING", b.currency) : userAcct;
  const trx = await postTransaction(tx, {
    kind: "BATTLE_ENTRY",
    referenceType: "battle",
    referenceId: b.id,
    idempotencyKey: `battle-entry:${userId}:${idempotencyKey}`,
    description: `Battle ${b.code} entry`,
    currency: b.currency,
    entries: [
      { accountId: source.id, amountMinor: -b.entryCostMinor, memo: "battle entry" },
      { accountId: sales.id, amountMinor: b.entryCostMinor, memo: "battle entry" },
    ],
    createdBy: userId,
  });
  const [seat] = await tx.insert(battleSeat).values({ battleId: b.id, seatIndex, userId, isBot: !!opts.bot, clientSeed: userSeed.clientSeed, entryLedgerTransactionId: trx.id }).returning();
  await enqueueOutbox(tx, "realtime.battle", { battleId: b.id, type: "seat.joined", seatIndex, userId }, { type: "battle", id: b.id });
  if (!opts.bot) await enqueueOutbox(tx, "race.score", { sourceType: "BATTLE_ENTRY", sourceId: seat.id, userId, amountMinor: b.entryCostMinor.toString(), occurredAt: seat.joinedAt.toISOString() }, { type: "battle_seat", id: seat.id });
  return seat;
}

export async function joinBattle(db: Db, userId: string, battleId: string, joinCode: string | null, idempotencyKey: string) {
  return serializable(db, async (tx) => {
    const [b] = await tx.select().from(battle).where(eq(battle.id, battleId)).for("update");
    if (!b) throw err.notFound("Battle");
    if (b.status !== "OPEN") throw err.state("Battle is not open");
    if (b.isPrivate && b.joinCode !== joinCode) throw err.forbidden("Invalid join code");
    const seats = await tx.select().from(battleSeat).where(eq(battleSeat.battleId, b.id));
    if (seats.some((s) => s.userId === userId)) throw err.conflict("Already seated");
    if (seats.length >= b.seats) throw err.state("Battle is full");
    await assertEligible(tx, userId, "BATTLE", b.entryCostMinor);
    const seat = await joinInTx(tx, b.id, userId, seats.length, idempotencyKey);
    if (seats.length + 1 === b.seats) await runBattleInTx(tx, b.id);
    return seat;
  });
}

/** Adds a clearly labeled house bot. Only when bots are legally enabled. */
export async function addBot(db: Db, userId: string, battleId: string) {
  if (!config.features.bots) throw err.feature("Bots are not enabled");
  return serializable(db, async (tx) => {
    const [b] = await tx.select().from(battle).where(eq(battle.id, battleId)).for("update");
    if (!b || b.createdBy !== userId) throw err.forbidden();
    if (b.status !== "OPEN") throw err.state("Battle is not open");
    const bot = await tx.query.user.findFirst({ where: eq(user.isBot, true) });
    if (!bot) throw err.state("No bot account configured");
    const seats = await tx.select().from(battleSeat).where(eq(battleSeat.battleId, b.id));
    if (seats.length >= b.seats) throw err.state("Battle is full");
    const seat = await joinInTx(tx, b.id, bot.id, seats.length, `bot:${b.id}:${seats.length}`, { bot: true });
    if (seats.length + 1 === b.seats) await runBattleInTx(tx, b.id);
    return seat;
  });
}

export async function cancelBattle(db: Db, actorUserId: string, battleId: string, opts: { admin?: boolean; reason?: string } = {}) {
  return serializable(db, async (tx) => {
    const [b] = await tx.select().from(battle).where(eq(battle.id, battleId)).for("update");
    if (!b) throw err.notFound("Battle");
    if (!opts.admin && b.createdBy !== actorUserId) throw err.forbidden();
    if (b.status !== "OPEN") throw err.state("Only open battles can be cancelled");
    await refundSeats(tx, b, actorUserId, opts.reason ?? "Cancelled before start");
    await tx.update(battle).set({ status: "CANCELLED", voidedAt: new Date(), voidReason: opts.reason ?? "Cancelled before start", voidedBy: actorUserId }).where(eq(battle.id, b.id));
    await audit(tx, { actorUserId, action: "battle.cancel", entityType: "battle", entityId: b.id, reason: opts.reason });
    await enqueueOutbox(tx, "realtime.battle", { battleId: b.id, type: "cancelled" }, { type: "battle", id: b.id });
  });
}

async function refundSeats(tx: DbOrTx, b: typeof battle.$inferSelect, actorUserId: string, reason: string) {
  const seats = await tx.select().from(battleSeat).where(eq(battleSeat.battleId, b.id));
  const sales = await getSystemAccount(tx, "SYSTEM_PACK_SALES", b.currency);
  for (const s of seats) {
    const target = s.isBot ? await getSystemAccount(tx, "SYSTEM_PROMO_FUNDING", b.currency) : await getOrCreateUserAccount(tx, s.userId, "USER_CASH", b.currency);
    await postTransaction(tx, {
      kind: "REFUND",
      referenceType: "battle_seat",
      referenceId: s.id,
      idempotencyKey: `battle-refund:${s.id}`,
      description: `Battle ${b.code} refund: ${reason}`,
      currency: b.currency,
      entries: [
        { accountId: sales.id, amountMinor: -b.entryCostMinor },
        { accountId: target.id, amountMinor: b.entryCostMinor },
      ],
      createdBy: actorUserId,
    });
    if (!s.isBot) await enqueueOutbox(tx, "race.score", { sourceType: "REVERSAL", sourceId: s.id, originalSourceType: "BATTLE_ENTRY", userId: s.userId, reason: "REFUND", occurredAt: new Date().toISOString() });
  }
}

/**
 * Runs every pull and settles ownership in ONE serializable transaction. Realtime presentation is derived
 * from the stored pulls afterwards; nothing about the outcome depends on any client.
 */
async function runBattleInTx(tx: DbOrTx, battleId: string) {
  const [b] = await tx.select().from(battle).where(eq(battle.id, battleId)).for("update");
  const seats = await tx.select().from(battleSeat).where(eq(battleSeat.battleId, battleId)).orderBy(asc(battleSeat.seatIndex));
  if (seats.length !== b.seats) throw err.state("Battle is not full");
  const combined = seats.map((s) => s.clientSeed).join("|");
  const [seedRow] = await tx.select().from(fairnessSeed).where(eq(fairnessSeed.id, b.seedId!)).for("update");
  await tx.update(fairnessSeed).set({ clientSeed: combined.slice(0, 64) }).where(eq(fairnessSeed.id, seedRow.id));
  const seedForDraw = { ...seedRow, clientSeed: combined.slice(0, 64) };
  await tx.update(battle).set({ status: "IN_PROGRESS", startedAt: new Date(), combinedClientSeed: combined }).where(eq(battle.id, battleId));

  const totals = new Map<string, bigint>(seats.map((s) => [s.id, 0n]));
  const pulls: Array<{ seatId: string; openingId: string; itemId: string; valueMinor: bigint; pullIndex: number; roundIndex: number }> = [];
  let pullIndex = 0;
  for (let r = 0; r < b.packVersionIds.length; r++) {
    const pvId = b.packVersionIds[r];
    const [round] = await tx.insert(battleRound).values({ battleId, roundIndex: r, packVersionId: pvId }).returning();
    for (const s of seats) {
      const nonce = r * seats.length + s.seatIndex;
      const res = await openPackInTx(tx, { userId: s.userId, packVersionId: pvId, idempotencyKey: `battle:${battleId}:${r}:${s.seatIndex}`, source: "BATTLE", battle: { battleId, seedRow: seedForDraw, nonce, ledgerTransactionId: s.entryLedgerTransactionId } });
      const value = res.outcome.referenceValueMinor;
      const running = (totals.get(s.id) ?? 0n) + value;
      totals.set(s.id, running);
      await tx.insert(battlePull).values({ battleId, roundId: round.id, seatId: s.id, openingId: res.opening.id, pullIndex, valueMinor: value, runningTotalMinor: running });
      pulls.push({ seatId: s.id, openingId: res.opening.id, itemId: res.item.id, valueMinor: value, pullIndex, roundIndex: r });
      pullIndex++;
    }
    await tx.update(battleRound).set({ completedAt: new Date() }).where(eq(battleRound.id, round.id));
  }
  for (const s of seats) await tx.update(battleSeat).set({ totalValueMinor: totals.get(s.id)! }).where(eq(battleSeat.id, s.id));

  // ---- Settlement ----
  const ranked = [...seats].sort((a, c) => {
    const ta = totals.get(a.id)!;
    const tc = totals.get(c.id)!;
    if (ta === tc) return a.seatIndex - c.seatIndex;
    return b.mode === "CRAZY" ? (ta < tc ? -1 : 1) : ta > tc ? -1 : 1;
  });
  let winners: typeof seats = [];
  let tieBreak: unknown = null;
  if (b.mode === "KEEP") {
    winners = [];
  } else if (b.mode === "SHARED") {
    winners = ranked;
  } else {
    const best = totals.get(ranked[0].id)!;
    const tied = ranked.filter((s) => totals.get(s.id) === best);
    if (tied.length === 1) winners = [tied[0]];
    else {
      // Provably fair tie-break with a fresh nonce beyond every pull nonce.
      const nonce = b.packVersionIds.length * seats.length;
      const serverSeed = decryptSeed(seedRow);
      const d = draw({ serverSeed, clientSeed: seedForDraw.clientSeed, nonce, scopeId: battleId, manifestHash: b.serverSeedHash!, range: tied.length });
      winners = [tied[d.index]];
      tieBreak = { nonce, message: d.message, digest: d.digest, range: tied.length, steps: d.steps, selectedIndex: d.index, candidates: tied.map((s) => ({ seatIndex: s.seatIndex, userId: s.userId })) };
    }
  }

  // Ownership transfers (atomic with settlement).
  const awarded = new Map<string, bigint>(seats.map((s) => [s.id, 0n]));
  const assign = async (pull: (typeof pulls)[number], toSeat: typeof seats[number]) => {
    const fromSeat = seats.find((s) => s.id === pull.seatId)!;
    awarded.set(toSeat.id, (awarded.get(toSeat.id) ?? 0n) + pull.valueMinor);
    if (fromSeat.id === toSeat.id) return;
    const [item] = await tx.select().from(inventoryItem).where(eq(inventoryItem.id, pull.itemId)).for("update");
    const [oldHolding] = await tx.select().from(vaultHolding).where(and(eq(vaultHolding.inventoryItemId, item.id), eq(vaultHolding.status, "ACTIVE"))).for("update");
    await tx.update(vaultHolding).set({ status: "TRANSFERRED", endedAt: new Date() }).where(eq(vaultHolding.id, oldHolding.id));
    await tx.insert(ownershipTransfer).values({ inventoryItemId: item.id, fromUserId: fromSeat.userId, toUserId: toSeat.userId, reason: "BATTLE_SETTLEMENT", referenceType: "battle", referenceId: battleId });
    await tx.insert(vaultHolding).values({ userId: toSeat.userId, inventoryItemId: item.id, acquiredVia: "BATTLE_SETTLEMENT", acquiredRefId: battleId, referenceValueMinor: oldHolding.referenceValueMinor, sellbackOfferMinor: oldHolding.sellbackOfferMinor, currency: oldHolding.currency });
    await tx.update(inventoryItem).set({ ownerUserId: toSeat.userId }).where(eq(inventoryItem.id, item.id));
  };
  if (b.mode === "CLASSIC" || b.mode === "CRAZY") {
    for (const p of pulls) await assign(p, winners[0]);
  } else if (b.mode === "SHARED") {
    const pool = [...pulls].sort((a, c) => (a.valueMinor === c.valueMinor ? a.pullIndex - c.pullIndex : a.valueMinor > c.valueMinor ? -1 : 1));
    const order = ranked; // snake order by rank
    for (let i = 0; i < pool.length; i++) {
      const lap = Math.floor(i / order.length);
      const pos = i % order.length;
      const target = lap % 2 === 0 ? order[pos] : order[order.length - 1 - pos];
      await assign(pool[i], target);
    }
  } else {
    for (const p of pulls) awarded.set(p.seatId, (awarded.get(p.seatId) ?? 0n) + p.valueMinor);
  }
  for (const s of ranked) await tx.update(battleSeat).set({ finalRank: ranked.indexOf(s) + 1, awardedValueMinor: awarded.get(s.id) ?? 0n }).where(eq(battleSeat.id, s.id));

  const summary = { mode: b.mode, rule: MODE_RULES[b.mode].summary, totals: seats.map((s) => ({ seatIndex: s.seatIndex, userId: s.userId, totalMinor: totals.get(s.id)!.toString(), awardedMinor: (awarded.get(s.id) ?? 0n).toString() })), winners: winners.map((w) => w.userId), tieBreak };
  const revealed = decryptSeed(seedRow);
  await tx.update(fairnessSeed).set({ status: "REVEALED", revealedAt: new Date(), retiredAt: new Date(), revealedServerSeed: revealed, nonce: b.packVersionIds.length * seats.length + 1, useCount: pulls.length }).where(eq(fairnessSeed.id, seedRow.id));
  await tx.update(battle).set({ status: "SETTLED", settledAt: new Date(), winnerUserIds: b.mode === "KEEP" ? [] : winners.map((w) => w.userId), tieBreakReceipt: tieBreak, settlementSummary: summary }).where(eq(battle.id, battleId));
  await audit(tx, { actorUserId: null, actorRole: "SYSTEM", action: "battle.settle", entityType: "battle", entityId: battleId, after: summary });
  await enqueueOutbox(tx, "realtime.battle", { battleId, type: "settled" }, { type: "battle", id: battleId });
  for (const s of seats) if (!s.isBot) await enqueueOutbox(tx, "notification.create", { userId: s.userId, kind: "BATTLE", title: `Battle ${b.code} settled`, body: winners.some((w) => w.userId === s.userId) ? "You won the pool." : b.mode === "KEEP" ? "Your pulls are in your vault." : "Better luck next time; see the receipt for the full breakdown.", href: `/battles/${battleId}` });
}

/** Controlled void policy: only when every item from the battle is still in the recipients' vaults. Refunds all entries. */
export async function voidBattle(db: Db, adminUserId: string, battleId: string, reason: string) {
  if (!reason || reason.length < 10) throw err.validation("A reason of at least 10 characters is required to void a battle");
  return serializable(db, async (tx) => {
    const [b] = await tx.select().from(battle).where(eq(battle.id, battleId)).for("update");
    if (!b) throw err.notFound("Battle");
    if (b.status === "OPEN") {
      await refundSeats(tx, b, adminUserId, reason);
      await tx.update(battle).set({ status: "VOIDED", voidedAt: new Date(), voidReason: reason, voidedBy: adminUserId }).where(eq(battle.id, b.id));
      await audit(tx, { actorUserId: adminUserId, action: "battle.void", entityType: "battle", entityId: b.id, reason, before: { status: b.status }, after: { status: "VOIDED" } });
      return;
    }
    if (b.status !== "SETTLED") throw err.state(`Cannot void a ${b.status} battle`);
    const pulls = await tx.select().from(battlePull).where(eq(battlePull.battleId, b.id));
    const openings = await tx.select().from(opening).where(inArray(opening.id, pulls.map((p) => p.openingId)));
    for (const op of openings) {
      const [item] = await tx.select().from(inventoryItem).where(eq(inventoryItem.id, op.inventoryItemId!)).for("update");
      if (item.status !== "IN_VAULT") throw err.state(`Item ${item.itemCode} has left the vault (${item.status}); void policy forbids reversal`);
    }
    for (const op of openings) {
      const [item] = await tx.select().from(inventoryItem).where(eq(inventoryItem.id, op.inventoryItemId!)).for("update");
      const [holding] = await tx.select().from(vaultHolding).where(and(eq(vaultHolding.inventoryItemId, item.id), eq(vaultHolding.status, "ACTIVE"))).for("update");
      await tx.update(vaultHolding).set({ status: "VOIDED", endedAt: new Date() }).where(eq(vaultHolding.id, holding.id));
      await tx.insert(ownershipTransfer).values({ inventoryItemId: item.id, fromUserId: item.ownerUserId, toUserId: null, reason: "VOID", referenceType: "battle", referenceId: b.id });
      const [o] = await tx.select().from(packOutcome).where(eq(packOutcome.id, op.outcomeId)).for("update");
      const [pv] = await tx.select().from(packVersion).where(eq(packVersion.id, o.packVersionId)).for("update");
      const live = pv.status === "PUBLISHED" || pv.status === "PAUSED";
      // The manifest slot is restored: the physical item returns to stock (re-reserved while the version is live).
      await tx.update(packOutcome).set({ quantityRemaining: sql`${packOutcome.quantityRemaining} + 1` }).where(eq(packOutcome.id, o.id));
      await tx.update(packVersion).set({ remainingOpenings: sql`${packVersion.remainingOpenings} + 1` }).where(eq(packVersion.id, pv.id));
      if (o.inventoryItemId) {
        await tx.update(inventoryItem).set(live ? { status: "RESERVED", ownerUserId: null, reservedForType: "pack_version", reservedForId: pv.id, reservedAt: new Date() } : { status: "IN_STOCK", ownerUserId: null }).where(eq(inventoryItem.id, item.id));
      } else {
        await tx.update(inventoryItem).set({ status: "RETIRED", ownerUserId: null, notes: `Voided battle ${b.code}` }).where(eq(inventoryItem.id, item.id));
        await tx.update(productSku).set({ pooledQuantity: sql`${productSku.pooledQuantity} + 1`, pooledReserved: live ? sql`${productSku.pooledReserved} + 1` : productSku.pooledReserved }).where(eq(productSku.id, o.skuId));
      }
      await tx.update(opening).set({ status: "VOIDED", voidedAt: new Date(), voidReason: reason }).where(eq(opening.id, op.id));
      await enqueueOutbox(tx, "race.score", { sourceType: "REVERSAL", sourceId: op.id, originalSourceType: "OPENING", userId: op.userId, reason: "VOID", occurredAt: new Date().toISOString() });
    }
    await refundSeats(tx, b, adminUserId, reason);
    await tx.update(battle).set({ status: "VOIDED", voidedAt: new Date(), voidReason: reason, voidedBy: adminUserId }).where(eq(battle.id, b.id));
    await audit(tx, { actorUserId: adminUserId, action: "battle.void", entityType: "battle", entityId: b.id, reason, before: { status: b.status }, after: { status: "VOIDED" } });
    await enqueueOutbox(tx, "realtime.battle", { battleId: b.id, type: "voided" }, { type: "battle", id: b.id });
  });
}

// ---- Reads ----------------------------------------------------------------------------------
export async function getBattleView(db: DbOrTx, battleId: string, viewerUserId: string | null) {
  const b = await db.query.battle.findFirst({ where: eq(battle.id, battleId) });
  if (!b) return null;
  const seats = await db
    .select({ s: battleSeat, displayName: user.displayName, isBotUser: user.isBot })
    .from(battleSeat)
    .innerJoin(user, eq(user.id, battleSeat.userId))
    .where(eq(battleSeat.battleId, b.id))
    .orderBy(asc(battleSeat.seatIndex));
  const rounds = await db.select().from(battleRound).where(eq(battleRound.battleId, b.id)).orderBy(asc(battleRound.roundIndex));
  const pulls = await db
    .select({ p: battlePull, o: packOutcome, sku: productSku, openingId: opening.id })
    .from(battlePull)
    .innerJoin(opening, eq(opening.id, battlePull.openingId))
    .innerJoin(packOutcome, eq(packOutcome.id, opening.outcomeId))
    .innerJoin(productSku, eq(productSku.id, packOutcome.skuId))
    .where(eq(battlePull.battleId, b.id))
    .orderBy(asc(battlePull.pullIndex));
  const versions = await db
    .select({ v: packVersion, p: pack })
    .from(packVersion)
    .innerJoin(pack, eq(pack.id, packVersion.packId))
    .where(inArray(packVersion.id, [...new Set(b.packVersionIds)]));
  const seed = b.seedId ? await db.query.fairnessSeed.findFirst({ where: eq(fairnessSeed.id, b.seedId) }) : null;
  const viewerSeated = seats.some((s) => s.s.userId === viewerUserId);
  return {
    battle: { ...b, joinCode: viewerSeated || b.createdBy === viewerUserId ? b.joinCode : null },
    rules: MODE_RULES[b.mode],
    seats: seats.map(({ s, displayName, isBotUser }) => ({ id: s.id, seatIndex: s.seatIndex, userId: s.userId, displayName: s.isBot || isBotUser ? `${displayName} (House Bot)` : displayName, isBot: s.isBot, totalValueMinor: s.totalValueMinor, finalRank: s.finalRank, awardedValueMinor: s.awardedValueMinor, isViewer: s.userId === viewerUserId })),
    sequence: b.packVersionIds.map((id) => {
      const row = versions.find((x) => x.v.id === id)!;
      return { packVersionId: id, name: row.p.name, slug: row.p.slug, accent: row.p.accent, priceMinor: row.v.priceMinor };
    }),
    rounds,
    pulls: pulls.map(({ p, o, sku, openingId }) => ({ id: p.id, roundId: p.roundId, seatId: p.seatId, openingId, pullIndex: p.pullIndex, valueMinor: p.valueMinor, runningTotalMinor: p.runningTotalMinor, outcome: { id: o.id, label: o.label, tier: o.tier, accent: sku.accent, imageKey: sku.imageKey, name: sku.name } })),
    fairness: seed ? { serverSeedHash: seed.serverSeedHash, revealedServerSeed: seed.status === "REVEALED" ? seed.revealedServerSeed : null, combinedClientSeed: b.combinedClientSeed, tieBreak: b.tieBreakReceipt } : null,
  };
}

export async function listBattles(db: DbOrTx, status: "live" | "history" | "mine", viewerUserId: string | null, limit = 30) {
  const where = status === "live" ? inArray(battle.status, ["OPEN", "IN_PROGRESS"]) : status === "history" ? inArray(battle.status, ["SETTLED", "VOIDED", "CANCELLED"]) : undefined;
  const rows = await db
    .select()
    .from(battle)
    .where(status === "mine" && viewerUserId ? sql`${battle.id} IN (SELECT battle_id FROM battle_seat WHERE user_id = ${viewerUserId})` : (where ?? sql`true`))
    .orderBy(desc(battle.createdAt))
    .limit(limit);
  if (!rows.length) return [];
  const seats = await db
    .select({ s: battleSeat, displayName: user.displayName })
    .from(battleSeat)
    .innerJoin(user, eq(user.id, battleSeat.userId))
    .where(inArray(battleSeat.battleId, rows.map((r) => r.id)));
  const versions = await db
    .select({ v: packVersion, p: pack })
    .from(packVersion)
    .innerJoin(pack, eq(pack.id, packVersion.packId))
    .where(inArray(packVersion.id, [...new Set(rows.flatMap((r) => r.packVersionIds))]));
  return rows
    .filter((r) => !r.isPrivate || status === "mine" || r.createdBy === viewerUserId)
    .map((r) => ({
      id: r.id,
      code: r.code,
      mode: r.mode,
      speed: r.speed,
      status: r.status,
      isPrivate: r.isPrivate,
      seats: r.seats,
      entryCostMinor: r.entryCostMinor,
      currency: r.currency,
      createdAt: r.createdAt,
      settledAt: r.settledAt,
      winnerUserIds: r.winnerUserIds,
      players: seats.filter((s) => s.s.battleId === r.id).sort((a, b) => a.s.seatIndex - b.s.seatIndex).map((s) => ({ userId: s.s.userId, displayName: s.s.isBot ? `${s.displayName} (House Bot)` : s.displayName, totalValueMinor: s.s.totalValueMinor, finalRank: s.s.finalRank })),
      packs: r.packVersionIds.map((id) => {
        const row = versions.find((x) => x.v.id === id);
        return row ? { name: row.p.name, accent: row.p.accent, slug: row.p.slug } : { name: "Pack", accent: "violet", slug: "" };
      }),
    }));
}
