import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { db, fresh, makeUser, makePack, standardOutcomes, balance, closePool } from "./helpers";
import { createRace, fraudReview, lockRace, raceView, scoreEvent, settleRace, computeLeaderboard } from "@/domain/races";
import { openPack } from "@/domain/openings";
import { drainOutbox } from "@/domain/worker";
import { recordRiskEvent } from "@/domain/users";
import { reconcile } from "@/domain/admin";

describe("weekly race", () => {
  let policyId: string;
  let raceId: string;
  beforeAll(async () => {
    const { policy } = await fresh();
    policyId = policy.id;
    const startsAt = new Date(Date.now() - 86_400_000);
    const r = await createRace(db, null, { slug: "test-race", name: "Test Race", timezone: "UTC", startsAt, endsAt: new Date(startsAt.getTime() + 7 * 86_400_000), scoringPolicyId: policyId, prizes: [{ rank: 1, amountMinor: 10000n }, { rank: 2, amountMinor: 5000n }, { rank: 3, amountMinor: 1000n }] });
    raceId = r.id;
  });
  afterAll(closePool);

  it("rejects non-seven-day windows and ladders over 100", async () => {
    await expect(createRace(db, null, { slug: "bad", name: "bad", timezone: "UTC", startsAt: new Date(), endsAt: new Date(Date.now() + 86_400_000), scoringPolicyId: policyId, prizes: [] })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("scores qualified openings from the outbox, idempotently", async () => {
    const p = await makePack({ price: 1000n, outcomes: standardOutcomes() });
    const u = await makeUser({ fundMinor: 5000n });
    const r = await openPack(db, { userId: u.id, packVersionId: p.version.id, idempotencyKey: "r1" });
    await drainOutbox(db, 100);
    await drainOutbox(db, 100);
    const standing = (await db.query.raceStanding.findFirst({ where: eq(s.raceStanding.userId, u.id) }))!;
    // $10 => 10 units * 10 + 5 = 105 points
    expect(standing.points).toBe(105);
    const again = await scoreEvent(db, { sourceType: "OPENING", sourceId: r.opening.id, userId: u.id, amountMinor: 1000n, occurredAt: r.opening.createdAt });
    expect(again?.scored).toBe(false);
    const view = (await raceView(db, raceId, u.id))!;
    expect(view.me?.rank).toBe(1);
    expect(view.me?.points).toBe(105);
    expect(view.me?.explanation[0].explanation).toMatch(/10 × 10 pts/);
  });

  it("excludes reversed events (void/refund/chargeback) without deleting history", async () => {
    const u = await makeUser();
    const evId = crypto.randomUUID();
    await scoreEvent(db, { sourceType: "OPENING", sourceId: evId, userId: u.id, amountMinor: 5000n, occurredAt: new Date() });
    let st = (await db.query.raceStanding.findFirst({ where: eq(s.raceStanding.userId, u.id) }))!;
    expect(st.points).toBe(505);
    await scoreEvent(db, { sourceType: "REVERSAL", sourceId: evId, originalSourceType: "OPENING", userId: u.id, reason: "CHARGEBACK", occurredAt: new Date() });
    st = (await db.query.raceStanding.findFirst({ where: eq(s.raceStanding.userId, u.id) }))!;
    expect(st.points).toBe(0);
    const events = await db.select().from(s.raceScoreEvent).where(eq(s.raceScoreEvent.userId, u.id));
    expect(events.length).toBe(2);
    expect(events.find((e) => e.sourceType === "REVERSAL")?.excluded).toBe("CHARGEBACK");
  });

  it("breaks ties by earliest qualifying event, locks a snapshot, reviews fraud and settles idempotently", async () => {
    const early = await makeUser();
    const late = await makeUser();
    const fraud = await makeUser();
    const t0 = new Date(Date.now() - 3600_000);
    await scoreEvent(db, { sourceType: "PROMO_ENTRY", sourceId: crypto.randomUUID(), userId: early.id, amountMinor: 10000n, occurredAt: t0 });
    await scoreEvent(db, { sourceType: "PROMO_ENTRY", sourceId: crypto.randomUUID(), userId: late.id, amountMinor: 10000n, occurredAt: new Date(t0.getTime() + 1000) });
    await scoreEvent(db, { sourceType: "PROMO_ENTRY", sourceId: crypto.randomUUID(), userId: fraud.id, amountMinor: 19000n, occurredAt: new Date(t0.getTime() + 2000) });
    await recordRiskEvent(db, { userId: fraud.id, kind: "LINKED_ACCOUNT", severity: "HIGH" });
    const lb = await computeLeaderboard(db, raceId, 10);
    expect(lb[0].user_id).toBe(fraud.id);
    const lock = await lockRace(db, null, raceId);
    expect(lock.snapshotHash).toHaveLength(64);
    await expect(settleRace(db, null, "00000000-0000-4000-8000-000000000000")).rejects.toMatchObject({ code: "NOT_FOUND" });
    const excluded = await fraudReview(db, null, raceId);
    expect(excluded).toContain(fraud.id);
    const summary = await settleRace(db, null, raceId);
    const view = (await raceView(db, raceId, null))!;
    expect(view.leaderboard[0].user_id).toBe(early.id);
    expect(view.leaderboard[1].user_id).toBe(late.id);
    expect(await balance(early.id)).toBe(10000n);
    expect(await balance(late.id)).toBe(5000n);
    // settle again: no double pay
    await settleRace(db, null, raceId);
    expect(await balance(early.id)).toBe(10000n);
    const paid = await db.select().from(s.ledgerTransaction).where(eq(s.ledgerTransaction.kind, "RACE_PRIZE"));
    expect(paid.length).toBeGreaterThanOrEqual(3);
    expect(BigInt((summary as { paidMinor: string }).paidMinor)).toBeGreaterThan(0n);
    expect((await reconcile(db)).problems).toEqual([]);
  });
});
