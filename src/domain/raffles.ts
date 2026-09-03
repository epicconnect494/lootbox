import { and, asc, desc, eq, inArray, lte, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db/client";
import { fairnessSeed, inventoryItem, ownershipTransfer, raffle, raffleDraw, raffleEntry, raffleManifest, rafflePrize, user, vaultHolding } from "@/db/schema";
import { audit } from "@/lib/audit";
import { randomHex, sha256Hex } from "@/lib/crypto";
import { err } from "@/lib/errors";
import { draw } from "@/lib/fairness/node";
import { enqueueOutbox } from "@/lib/outbox";
import { serializable } from "@/lib/tx";
import { assertEligible } from "./gates";
import { getOrCreateUserAccount, getSystemAccount, postTransaction } from "./ledger";
import { createScopedSeed, decryptSeed } from "./openings";
import { reserveUniqueItem } from "./inventory";

export interface RaffleInput {
  slug: string;
  name: string;
  description?: string;
  entryMode: "FREE" | "PROMOTIONAL" | "PURCHASE_LINKED";
  maxTickets: number;
  maxTicketsPerUser: number;
  ticketPriceMinor: bigint;
  winnersCount: number;
  amoeEnabled: boolean;
  amoeInstructions?: string;
  allowedJurisdictions: string[];
  opensAt: Date;
  closesAt: Date;
  drawsAt: Date;
  claimDeadlineAt: Date;
  publicRandomnessSource: string;
  prizes: Array<{ rank: number; title: string; description?: string; condition?: string; referenceValueMinor: bigint; valueSource?: string; valueObservedAt?: Date; inventoryItemId?: string | null }>;
}

/** Creates the raffle and commits the server-seed hash immediately (long before close). */
export async function createRaffle(db: Db, actorUserId: string, input: RaffleInput) {
  if (input.entryMode === "PURCHASE_LINKED" && !input.amoeEnabled) throw err.validation("Purchase-linked raffles must offer a free alternative method of entry");
  if (input.entryMode !== "PURCHASE_LINKED" && input.ticketPriceMinor !== 0n) throw err.validation("Only purchase-linked raffles can carry a ticket price");
  return serializable(db, async (tx) => {
    const [r] = await tx
      .insert(raffle)
      .values({ ...input, description: input.description ?? null, amoeInstructions: input.amoeInstructions ?? null, status: input.opensAt <= new Date() ? "OPEN" : "UPCOMING", createdBy: actorUserId })
      .returning();
    const seed = await createScopedSeed(tx, "RAFFLE", r.id, "");
    await tx.update(raffle).set({ seedId: seed.id, serverSeedHash: seed.serverSeedHash, serverSeedCommittedAt: new Date() }).where(eq(raffle.id, r.id));
    for (const p of input.prizes) {
      if (p.inventoryItemId) await reserveUniqueItem(tx, p.inventoryItemId, "raffle", r.id);
      await tx.insert(rafflePrize).values({ raffleId: r.id, rank: p.rank, title: p.title, description: p.description ?? null, condition: p.condition ?? null, referenceValueMinor: p.referenceValueMinor, valueSource: p.valueSource ?? null, valueObservedAt: p.valueObservedAt ?? null, inventoryItemId: p.inventoryItemId ?? null });
    }
    await audit(tx, { actorUserId, action: "raffle.create", entityType: "raffle", entityId: r.id, after: { serverSeedHash: seed.serverSeedHash, entryMode: r.entryMode } });
    return { ...r, serverSeedHash: seed.serverSeedHash };
  });
}

export async function enterRaffle(db: Db, userId: string, raffleId: string, count: number, source: "FREE" | "PROMO" | "PURCHASE" | "AMOE" | "ADMIN", opts: { idempotencyKey: string; sourceRef?: string; actorUserId?: string }) {
  if (!Number.isInteger(count) || count < 1 || count > 100) throw err.validation("Enter 1-100 tickets");
  return serializable(db, async (tx) => {
    const [r] = await tx.select().from(raffle).where(eq(raffle.id, raffleId)).for("update");
    if (!r) throw err.notFound("Raffle");
    const now = new Date();
    if (r.status !== "OPEN" || now < r.opensAt || now >= r.closesAt) throw err.state("Raffle is not accepting entries");
    const u = await tx.query.user.findFirst({ where: eq(user.id, userId) });
    if (!u) throw err.notFound("User");
    if (r.allowedJurisdictions.length && (!u.jurisdictionCode || !r.allowedJurisdictions.includes(u.jurisdictionCode))) throw err.gate("This raffle is not available in your region");
    const paid = source === "PURCHASE";
    if (paid && r.entryMode !== "PURCHASE_LINKED") throw err.validation("This raffle is not purchase-linked");
    if (source === "AMOE" && !r.amoeEnabled) throw err.validation("Free entry route disabled");
    if ((source === "AMOE" || source === "ADMIN") && !opts.actorUserId) throw err.forbidden("AMOE entries are recorded by staff");
    await assertEligible(tx, userId, paid ? "RAFFLE_PAID" : "RAFFLE_FREE", paid ? r.ticketPriceMinor * BigInt(count) : 0n);
    const existing = await tx.select({ c: sql<number>`COUNT(*)::int` }).from(raffleEntry).where(and(eq(raffleEntry.raffleId, r.id), eq(raffleEntry.userId, userId)));
    if (Number(existing[0].c) + count > r.maxTicketsPerUser) throw err.limit(`Maximum ${r.maxTicketsPerUser} tickets per person`);
    const issued = await tx.select({ c: sql<number>`COUNT(*)::int` }).from(raffleEntry).where(eq(raffleEntry.raffleId, r.id));
    const already = Number(issued[0].c);
    if (already + count > r.maxTickets) throw err.soldOut("Not enough tickets remaining");
    if (paid && r.ticketPriceMinor > 0n) {
      const acct = await getOrCreateUserAccount(tx, userId, "USER_CASH", r.currency);
      const sales = await getSystemAccount(tx, "SYSTEM_PACK_SALES", r.currency);
      const total = r.ticketPriceMinor * BigInt(count);
      await postTransaction(tx, { kind: "PACK_PURCHASE", referenceType: "raffle", referenceId: r.id, idempotencyKey: `raffle:${userId}:${opts.idempotencyKey}`, description: `${r.name} tickets ×${count}`, currency: r.currency, entries: [{ accountId: acct.id, amountMinor: -total }, { accountId: sales.id, amountMinor: total }], createdBy: userId });
    }
    const rows = Array.from({ length: count }, (_, i) => ({ raffleId: r.id, userId, ticketNumber: already + i + 1, ticketId: `TKT-${randomHex(6).toUpperCase()}`, source, sourceRef: opts.sourceRef ?? null }));
    const inserted = await tx.insert(raffleEntry).values(rows).returning();
    await enqueueOutbox(tx, "realtime.raffle", { raffleId: r.id, type: "tickets.issued", issued: already + count }, { type: "raffle", id: r.id });
    if (opts.actorUserId) await audit(tx, { actorUserId: opts.actorUserId, action: "raffle.entry.staff", entityType: "raffle", entityId: r.id, after: { userId, count, source, sourceRef: opts.sourceRef } });
    return inserted;
  });
}

/** Close: canonical sort by ticket number, serialize, publish manifest hash. */
export async function closeRaffle(db: Db, actorUserId: string | null, raffleId: string) {
  return serializable(db, async (tx) => {
    const [r] = await tx.select().from(raffle).where(eq(raffle.id, raffleId)).for("update");
    if (!r) throw err.notFound("Raffle");
    if (r.status !== "OPEN") throw err.state(`Raffle is ${r.status}`);
    const tickets = await tx.select().from(raffleEntry).where(eq(raffleEntry.raffleId, r.id)).orderBy(asc(raffleEntry.ticketNumber));
    const canonical = JSON.stringify(tickets.map((t) => t.ticketId));
    const manifestHash = sha256Hex(canonical);
    await tx.insert(raffleManifest).values({ raffleId: r.id, ticketCount: tickets.length, manifestHash, canonicalManifest: canonical });
    await tx.update(raffle).set({ status: "CLOSED" }).where(eq(raffle.id, r.id));
    await audit(tx, { actorUserId, actorRole: actorUserId ? undefined : "SYSTEM", action: "raffle.close", entityType: "raffle", entityId: r.id, after: { manifestHash, ticketCount: tickets.length } });
    await enqueueOutbox(tx, "realtime.raffle", { raffleId: r.id, type: "closed", manifestHash }, { type: "raffle", id: r.id });
    return { manifestHash, ticketCount: tickets.length };
  });
}

function runDraw(serverSeed: string, publicRandomness: string, raffleId: string, manifestHash: string, tickets: Array<{ ticketNumber: number; ticketId: string; userId: string }>, winnersCount: number) {
  const winners: Array<{ rank: number; nonce: number; message: string; digest: string; steps: unknown; ticketNumber: number; ticketId: string; userId: string }> = [];
  const taken = new Set<number>();
  let nonce = 0;
  while (winners.length < Math.min(winnersCount, tickets.length) && nonce < 10_000) {
    const d = draw({ serverSeed, clientSeed: publicRandomness, nonce, scopeId: raffleId, manifestHash, range: tickets.length });
    const t = tickets[d.index];
    if (!taken.has(t.ticketNumber)) {
      taken.add(t.ticketNumber);
      winners.push({ rank: winners.length + 1, nonce, message: d.message, digest: d.digest, steps: d.steps, ticketNumber: t.ticketNumber, ticketId: t.ticketId, userId: t.userId });
    }
    nonce++;
  }
  return winners;
}

export async function drawRaffle(db: Db, actorUserId: string, raffleId: string, publicRandomness: string, publicRandomnessSource: string) {
  if (!publicRandomness || publicRandomness.length < 8) throw err.validation("Declare the independent public randomness value");
  return serializable(db, async (tx) => {
    const [r] = await tx.select().from(raffle).where(eq(raffle.id, raffleId)).for("update");
    if (!r) throw err.notFound("Raffle");
    if (r.status !== "CLOSED") throw err.state(`Raffle must be CLOSED to draw (is ${r.status})`);
    const manifest = await tx.query.raffleManifest.findFirst({ where: eq(raffleManifest.raffleId, r.id) });
    if (!manifest) throw err.state("Manifest missing");
    if (manifest.ticketCount === 0) throw err.state("No tickets were issued");
    const [seedRow] = await tx.select().from(fairnessSeed).where(eq(fairnessSeed.id, r.seedId!)).for("update");
    const serverSeed = decryptSeed(seedRow);
    const tickets = await tx.select().from(raffleEntry).where(eq(raffleEntry.raffleId, r.id)).orderBy(asc(raffleEntry.ticketNumber));
    const winners = runDraw(serverSeed, publicRandomness, r.id, manifest.manifestHash, tickets, r.winnersCount);
    const [d] = await tx
      .insert(raffleDraw)
      .values({ raffleId: r.id, drawNumber: 1, manifestHash: manifest.manifestHash, serverSeedHash: seedRow.serverSeedHash, serverSeed, publicRandomness, publicRandomnessSource, ticketCount: manifest.ticketCount, winners, drawnBy: actorUserId })
      .returning();
    await tx.update(fairnessSeed).set({ status: "REVEALED", revealedAt: new Date(), retiredAt: new Date(), revealedServerSeed: serverSeed, clientSeed: publicRandomness.slice(0, 64) }).where(eq(fairnessSeed.id, seedRow.id));
    await applyWinners(tx, r.id, winners);
    await tx.update(raffle).set({ status: "DRAWN" }).where(eq(raffle.id, r.id));
    await audit(tx, { actorUserId, action: "raffle.draw", entityType: "raffle", entityId: r.id, after: { drawId: d.id, winners: winners.map((w) => w.ticketNumber) } });
    await enqueueOutbox(tx, "realtime.raffle", { raffleId: r.id, type: "drawn" }, { type: "raffle", id: r.id });
    return d;
  });
}

async function applyWinners(tx: DbOrTx, raffleId: string, winners: Array<{ rank: number; userId: string }>) {
  await tx.update(rafflePrize).set({ winnerUserId: null, claimedAt: null }).where(eq(rafflePrize.raffleId, raffleId));
  for (const w of winners) {
    await tx.update(rafflePrize).set({ winnerUserId: w.userId }).where(and(eq(rafflePrize.raffleId, raffleId), eq(rafflePrize.rank, w.rank)));
    await enqueueOutbox(tx, "notification.create", { userId: w.userId, kind: "RAFFLE", title: "You won a raffle prize", body: `Claim it before the deadline.`, href: `/raffles/${raffleId}` });
  }
}

/** Audited redraw: never overwrites; supersedes the previous draw and records the reason. */
export async function redrawRaffle(db: Db, actorUserId: string, raffleId: string, reason: string, publicRandomness: string, publicRandomnessSource: string) {
  if (!reason || reason.length < 20) throw err.validation("A detailed reason (20+ chars) is required for a redraw");
  return serializable(db, async (tx) => {
    const [r] = await tx.select().from(raffle).where(eq(raffle.id, raffleId)).for("update");
    if (!r || r.status !== "DRAWN") throw err.state("Only drawn raffles can be redrawn");
    const claimed = await tx.query.rafflePrize.findFirst({ where: and(eq(rafflePrize.raffleId, r.id), sql`${rafflePrize.claimedAt} IS NOT NULL`) });
    if (claimed) throw err.state("A prize has already been claimed; redraw is not permitted");
    const prev = await tx.select().from(raffleDraw).where(and(eq(raffleDraw.raffleId, r.id), eq(raffleDraw.status, "VALID"))).orderBy(desc(raffleDraw.drawNumber));
    const manifest = (await tx.query.raffleManifest.findFirst({ where: eq(raffleManifest.raffleId, r.id) }))!;
    const seedRow = (await tx.query.fairnessSeed.findFirst({ where: eq(fairnessSeed.id, r.seedId!) }))!;
    const serverSeed = seedRow.revealedServerSeed ?? decryptSeed(seedRow);
    const tickets = await tx.select().from(raffleEntry).where(eq(raffleEntry.raffleId, r.id)).orderBy(asc(raffleEntry.ticketNumber));
    const winners = runDraw(serverSeed, publicRandomness, r.id, manifest.manifestHash, tickets, r.winnersCount);
    for (const p of prev) await tx.update(raffleDraw).set({ status: "SUPERSEDED" }).where(eq(raffleDraw.id, p.id));
    const maxNum = prev.length ? Math.max(...prev.map((p) => p.drawNumber)) : (await tx.select({ m: sql<number>`COALESCE(MAX(draw_number),0)` }).from(raffleDraw).where(eq(raffleDraw.raffleId, r.id)))[0].m;
    const [d] = await tx
      .insert(raffleDraw)
      .values({ raffleId: r.id, drawNumber: Number(maxNum) + 1, manifestHash: manifest.manifestHash, serverSeedHash: seedRow.serverSeedHash, serverSeed, publicRandomness, publicRandomnessSource, ticketCount: manifest.ticketCount, winners, reason, drawnBy: actorUserId })
      .returning();
    await applyWinners(tx, r.id, winners);
    await audit(tx, { actorUserId, action: "raffle.redraw", entityType: "raffle", entityId: r.id, reason, before: { superseded: prev.map((p) => p.id) }, after: { drawId: d.id, winners: winners.map((w) => w.ticketNumber) } });
    return d;
  });
}

export async function claimPrize(db: Db, userId: string, raffleId: string, prizeId: string) {
  return serializable(db, async (tx) => {
    const [p] = await tx.select().from(rafflePrize).where(and(eq(rafflePrize.id, prizeId), eq(rafflePrize.raffleId, raffleId))).for("update");
    if (!p) throw err.notFound("Prize");
    if (p.winnerUserId !== userId) throw err.forbidden("You did not win this prize");
    if (p.claimedAt) return p;
    const r = (await tx.query.raffle.findFirst({ where: eq(raffle.id, raffleId) }))!;
    if (new Date() > r.claimDeadlineAt) throw err.state("Claim deadline has passed");
    if (p.inventoryItemId) {
      const [item] = await tx.select().from(inventoryItem).where(eq(inventoryItem.id, p.inventoryItemId)).for("update");
      if (item.status !== "RESERVED" || item.reservedForId !== raffleId) throw err.state("Prize item is not reserved for this raffle");
      await tx.update(inventoryItem).set({ status: "IN_VAULT", ownerUserId: userId, reservedForType: null, reservedForId: null, reservedAt: null }).where(eq(inventoryItem.id, item.id));
      await tx.insert(ownershipTransfer).values({ inventoryItemId: item.id, fromUserId: null, toUserId: userId, reason: "RAFFLE_PRIZE", referenceType: "raffle", referenceId: raffleId });
      await tx.insert(vaultHolding).values({ userId, inventoryItemId: item.id, acquiredVia: "RAFFLE_PRIZE", acquiredRefId: raffleId, referenceValueMinor: p.referenceValueMinor, sellbackOfferMinor: (p.referenceValueMinor * 80n) / 100n, currency: p.currency });
    }
    const [claimed] = await tx.update(rafflePrize).set({ claimedAt: new Date() }).where(eq(rafflePrize.id, p.id)).returning();
    const remaining = await tx.select({ c: sql<number>`COUNT(*)::int` }).from(rafflePrize).where(and(eq(rafflePrize.raffleId, raffleId), sql`${rafflePrize.claimedAt} IS NULL`));
    if (Number(remaining[0].c) === 0) await tx.update(raffle).set({ status: "CLAIMED" }).where(eq(raffle.id, raffleId));
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "raffle.claim", entityType: "raffle_prize", entityId: p.id });
    return claimed;
  });
}

export async function raffleScheduler(db: Db): Promise<{ opened: number; closed: number }> {
  const now = new Date();
  const toOpen = await db.select().from(raffle).where(and(eq(raffle.status, "UPCOMING"), lte(raffle.opensAt, now)));
  for (const r of toOpen) await db.update(raffle).set({ status: "OPEN" }).where(eq(raffle.id, r.id));
  const toClose = await db.select().from(raffle).where(and(eq(raffle.status, "OPEN"), lte(raffle.closesAt, now)));
  for (const r of toClose) await closeRaffle(db, null, r.id);
  return { opened: toOpen.length, closed: toClose.length };
}

export async function listRaffles(db: DbOrTx) {
  const rows = await db.select().from(raffle).where(inArray(raffle.status, ["UPCOMING", "OPEN", "CLOSED", "DRAWN", "CLAIMED"])).orderBy(desc(raffle.drawsAt));
  if (!rows.length) return [];
  const prizes = await db.select().from(rafflePrize).where(inArray(rafflePrize.raffleId, rows.map((r) => r.id)));
  const counts = await db.execute<{ raffle_id: string; c: number }>(sql`SELECT raffle_id, COUNT(*)::int AS c FROM raffle_entry WHERE raffle_id IN (${sql.join(rows.map((r) => sql`${r.id}`), sql`, `)}) GROUP BY raffle_id`);
  return rows.map((r) => ({ ...r, prize: prizes.find((p) => p.raffleId === r.id && p.rank === 1) ?? null, issued: Number(counts.rows.find((c) => c.raffle_id === r.id)?.c ?? 0) }));
}

export async function raffleView(db: DbOrTx, raffleId: string, viewerUserId: string | null) {
  const r = await db.query.raffle.findFirst({ where: eq(raffle.id, raffleId) });
  if (!r) return null;
  const prizes = await db.select().from(rafflePrize).where(eq(rafflePrize.raffleId, r.id)).orderBy(asc(rafflePrize.rank));
  const issued = await db.select({ c: sql<number>`COUNT(*)::int` }).from(raffleEntry).where(eq(raffleEntry.raffleId, r.id));
  const mine = viewerUserId ? await db.select().from(raffleEntry).where(and(eq(raffleEntry.raffleId, r.id), eq(raffleEntry.userId, viewerUserId))).orderBy(asc(raffleEntry.ticketNumber)) : [];
  const manifest = await db.query.raffleManifest.findFirst({ where: eq(raffleManifest.raffleId, r.id) });
  const draws = await db.select().from(raffleDraw).where(eq(raffleDraw.raffleId, r.id)).orderBy(asc(raffleDraw.drawNumber));
  const winnerNames = draws.length ? await db.select({ id: user.id, displayName: user.displayName }).from(user).where(inArray(user.id, [...new Set(draws.flatMap((d) => d.winners.map((w) => w.userId)))])) : [];
  return {
    raffle: r,
    prizes: prizes.map((p) => ({ ...p, isMine: p.winnerUserId === viewerUserId })),
    issued: Number(issued[0].c),
    myTickets: mine.map((t) => ({ ticketNumber: t.ticketNumber, ticketId: t.ticketId, source: t.source })),
    manifest: manifest ? { ticketCount: manifest.ticketCount, manifestHash: manifest.manifestHash, lockedAt: manifest.lockedAt, canonicalManifest: manifest.canonicalManifest } : null,
    draws: draws.map((d) => ({ ...d, winners: d.winners.map((w) => ({ ...w, displayName: winnerNames.find((n) => n.id === w.userId)?.displayName ?? "Entrant" })) })),
  };
}
