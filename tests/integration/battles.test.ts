import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import * as s from "@/db/schema";
import { db, fresh, makeUser, makePack, balance, closePool } from "./helpers";
import { createBattle, getBattleView, joinBattle, voidBattle, cancelBattle } from "@/domain/battles";
import { drainOutbox } from "@/domain/worker";
import { reconcile } from "@/domain/admin";
import { verifyOpening } from "@/lib/fairness/verify";
import { draw } from "@/lib/fairness/node";

describe("battles", () => {
  beforeAll(fresh);
  afterAll(closePool);

  async function twoOutcomePack() {
    // two pooled outcomes with distinct values so totals differ; sellback 90%: (5*4500 + 5*900)/ (10*3000) = 27000/30000 = 90%
    return makePack({ price: 3000n, outcomes: [
      { label: "high", qty: 50, value: 5000n, sellback: 4500n },
      { label: "low", qty: 50, value: 1000n, sellback: 900n },
    ] });
  }

  it("CRAZY: lowest total wins the whole pool, transferred atomically, receipts verify", async () => {
    const p = await twoOutcomePack();
    const a = await makeUser({ fundMinor: 10000n });
    const b = await makeUser({ fundMinor: 10000n });
    const battle = await createBattle(db, a.id, { mode: "CRAZY", speed: "FAST", isPrivate: false, seats: 2, packVersionIds: [p.version.id, p.version.id], idempotencyKey: "cb1" });
    expect(battle.entryCostMinor).toBe(6000n);
    expect(await balance(a.id)).toBe(4000n);
    await joinBattle(db, b.id, battle.id, null, "cb1-join");
    await drainOutbox(db, 100);
    const view = (await getBattleView(db, battle.id, a.id))!;
    expect(view.battle.status).toBe("SETTLED");
    expect(view.pulls.length).toBe(4);
    const totals = view.seats.map((x) => x.totalValueMinor);
    const min = totals.reduce((x, y) => (x < y ? x : y));
    const winners = view.seats.filter((x) => x.totalValueMinor === min);
    if (winners.length === 1) {
      expect(view.battle.winnerUserIds).toEqual([winners[0].userId]);
      expect(view.battle.tieBreakReceipt).toBeNull();
    } else {
      expect(view.battle.tieBreakReceipt).not.toBeNull();
      expect(winners.map((w) => w.userId)).toContain(view.battle.winnerUserIds[0]);
    }
    const winner = view.battle.winnerUserIds[0];
    const holdings = await db.select().from(s.vaultHolding).where(and(eq(s.vaultHolding.status, "ACTIVE"), eq(s.vaultHolding.userId, winner)));
    expect(holdings.length).toBe(4);
    const loser = view.seats.find((x) => x.userId !== winner)!;
    const loserHoldings = await db.select().from(s.vaultHolding).where(and(eq(s.vaultHolding.status, "ACTIVE"), eq(s.vaultHolding.userId, loser.userId)));
    expect(loserHoldings.length).toBe(0);
    // Every pull recomputes from the revealed battle seed with the documented nonce scheme.
    expect(view.fairness?.revealedServerSeed).toHaveLength(64);
    for (const pull of view.pulls) {
      const receipt = (await db.query.fairnessReceipt.findFirst({ where: eq(s.fairnessReceipt.openingId, pull.openingId) }))!;
      const snap = receipt.valueSnapshot as { remainingQuantities: number[] };
      const v = await verifyOpening({ serverSeed: view.fairness!.revealedServerSeed!, serverSeedHash: receipt.serverSeedHash, clientSeed: receipt.clientSeed, nonce: receipt.nonce, packVersionId: receipt.packVersionId, manifestHash: receipt.manifestHash, remainingQuantities: snap.remainingQuantities, expectedDigest: receipt.digest, expectedIndex: receipt.selectedIndex });
      expect(v.ok).toBe(true);
    }
    expect((await reconcile(db)).problems).toEqual([]);
  });

  it("tie-break is deterministic from the committed seed", async () => {
    // single-outcome pack guarantees a tie
    const p = await makePack({ price: 1000n, outcomes: [{ label: "only", qty: 20, value: 1000n, sellback: 900n }] });
    const a = await makeUser({ fundMinor: 5000n });
    const b = await makeUser({ fundMinor: 5000n });
    const battle = await createBattle(db, a.id, { mode: "CLASSIC", speed: "NORMAL", isPrivate: true, seats: 2, packVersionIds: [p.version.id], idempotencyKey: "tb" });
    await expect(joinBattle(db, b.id, battle.id, "WRONG", "tb-join")).rejects.toMatchObject({ code: "FORBIDDEN" });
    const view0 = (await getBattleView(db, battle.id, a.id))!;
    await joinBattle(db, b.id, battle.id, view0.battle.joinCode, "tb-join");
    const view = (await getBattleView(db, battle.id, a.id))!;
    const tb = view.battle.tieBreakReceipt as { nonce: number; digest: string; selectedIndex: number; range: number };
    expect(tb.nonce).toBe(2);
    const seed = view.fairness!.revealedServerSeed!;
    const recomputed = draw({ serverSeed: seed, clientSeed: view.fairness!.combinedClientSeed!.slice(0, 64), nonce: 2, scopeId: battle.id, manifestHash: view.battle.serverSeedHash!, range: 2 });
    expect(recomputed.digest).toBe(tb.digest);
    expect(recomputed.index).toBe(tb.selectedIndex);
    expect(view.battle.winnerUserIds[0]).toBe(view.seats[tb.selectedIndex].userId);
  });

  it("SHARED deals items in snake order and KEEP keeps pulls", async () => {
    const p = await twoOutcomePack();
    const users = await Promise.all([makeUser({ fundMinor: 20000n }), makeUser({ fundMinor: 20000n }), makeUser({ fundMinor: 20000n })]);
    const shared = await createBattle(db, users[0].id, { mode: "SHARED", speed: "FAST", isPrivate: false, seats: 3, packVersionIds: [p.version.id, p.version.id], sharedRule: { type: "EQUAL_SPLIT_VALUE" }, idempotencyKey: "sh" });
    await joinBattle(db, users[1].id, shared.id, null, "sh1");
    await joinBattle(db, users[2].id, shared.id, null, "sh2");
    const sv = (await getBattleView(db, shared.id, null))!;
    expect(sv.battle.status).toBe("SETTLED");
    const awarded = sv.seats.map((x) => x.awardedValueMinor!);
    expect(awarded.reduce((a, b) => a + b, 0n)).toBe(sv.pulls.reduce((a, pl) => a + pl.valueMinor, 0n));
    const keep = await createBattle(db, users[0].id, { mode: "KEEP", speed: "FAST", isPrivate: false, seats: 2, packVersionIds: [p.version.id], idempotencyKey: "kp" });
    await joinBattle(db, users[1].id, keep.id, null, "kp1");
    const kv = (await getBattleView(db, keep.id, null))!;
    expect(kv.battle.winnerUserIds).toEqual([]);
    for (const seat of kv.seats) expect(seat.awardedValueMinor).toBe(seat.totalValueMinor);
  });

  it("void policy: refunds entries and reverses ownership only while items are in vaults", async () => {
    const p = await twoOutcomePack();
    const a = await makeUser({ fundMinor: 10000n });
    const b = await makeUser({ fundMinor: 10000n });
    const risk = await makeUser({ role: "RISK" });
    const battle = await createBattle(db, a.id, { mode: "CLASSIC", speed: "FAST", isPrivate: false, seats: 2, packVersionIds: [p.version.id], idempotencyKey: "vd" });
    await joinBattle(db, b.id, battle.id, null, "vd1");
    await expect(voidBattle(db, risk.id, battle.id, "short")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    await voidBattle(db, risk.id, battle.id, "Inventory discrepancy discovered during audit");
    expect(await balance(a.id)).toBe(10000n);
    expect(await balance(b.id)).toBe(10000n);
    const v = (await getBattleView(db, battle.id, null))!;
    expect(v.battle.status).toBe("VOIDED");
    const active = await db.select().from(s.vaultHolding).where(and(eq(s.vaultHolding.status, "ACTIVE"), eq(s.vaultHolding.userId, a.id)));
    expect(active.length).toBe(0);
    const ops = await db.select().from(s.opening).where(eq(s.opening.battleId, battle.id));
    for (const o of ops) expect(o.status).toBe("VOIDED");
    // open battle cancel refunds the creator
    const open = await createBattle(db, a.id, { mode: "CLASSIC", speed: "FAST", isPrivate: false, seats: 2, packVersionIds: [p.version.id], idempotencyKey: "cn" });
    await cancelBattle(db, a.id, open.id);
    expect(await balance(a.id)).toBe(10000n);
    expect((await reconcile(db)).problems).toEqual([]);
  });

  it("requires every pack in the sequence to have enough remaining openings", async () => {
    const p = await makePack({ price: 1000n, outcomes: [{ label: "only", qty: 3, value: 1000n, sellback: 900n }] });
    const a = await makeUser({ fundMinor: 10000n });
    await expect(createBattle(db, a.id, { mode: "CLASSIC", speed: "FAST", isPrivate: false, seats: 4, packVersionIds: [p.version.id], idempotencyKey: "nr" })).rejects.toMatchObject({ code: "SOLD_OUT" });
  });
});
