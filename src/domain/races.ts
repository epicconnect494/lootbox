import { and, asc, desc, eq, gte, lte, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db/client";
import { race, racePrize, raceScoreEvent, raceScoringPolicy, raceStanding, riskEvent, user, type ScoringRules } from "@/db/schema";
import { audit } from "@/lib/audit";
import { hashObject } from "@/lib/crypto";
import { err } from "@/lib/errors";
import { enqueueOutbox } from "@/lib/outbox";
import { serializable } from "@/lib/tx";
import { getOrCreateUserAccount, getSystemAccount, postTransaction } from "./ledger";

export const DEFAULT_RULES: ScoringRules = {
  pointsPerUnitSpent: 10,
  pointsPerOpening: 5,
  pointsPerBattleEntry: 5,
  pointsPerPromoUnit: 10,
  maxPointsPerEvent: 2000,
  tiePolicy: "EARLIEST_QUALIFYING_EVENT_WINS",
  excludedKinds: ["VOID", "REFUND", "CHARGEBACK", "FRAUD", "BONUS_ABUSE"],
};

export async function createScoringPolicy(db: Db, actorUserId: string | null, name: string, rules: ScoringRules) {
  const max = await db.select({ m: sql<number>`COALESCE(MAX(version),0)` }).from(raceScoringPolicy);
  const [row] = await db.insert(raceScoringPolicy).values({ version: Number(max[0].m) + 1, name, rules, policyHash: hashObject(rules), createdBy: actorUserId }).returning();
  return row;
}

export interface RaceInput {
  slug: string;
  name: string;
  timezone: string;
  startsAt: Date;
  endsAt: Date;
  scoringPolicyId: string;
  prizes: Array<{ rank: number; amountMinor: bigint; label?: string }>;
  currency?: string;
}

export async function createRace(db: Db, actorUserId: string | null, input: RaceInput) {
  if (input.prizes.length > 100) throw err.validation("Prize ladder has at most 100 positions");
  const days = (input.endsAt.getTime() - input.startsAt.getTime()) / 86_400_000;
  if (Math.abs(days - 7) > 0.01) throw err.validation("A weekly race must span exactly seven days");
  return db.transaction(async (tx) => {
    const [r] = await tx.insert(race).values({ slug: input.slug, name: input.name, timezone: input.timezone, startsAt: input.startsAt, endsAt: input.endsAt, scoringPolicyId: input.scoringPolicyId, currency: input.currency ?? "USD", createdBy: actorUserId, status: input.startsAt <= new Date() ? "ACTIVE" : "SCHEDULED" }).returning();
    if (input.prizes.length) await tx.insert(racePrize).values(input.prizes.map((p) => ({ raceId: r.id, rank: p.rank, amountMinor: p.amountMinor, currency: input.currency ?? "USD", label: p.label ?? null })));
    await audit(tx, { actorUserId, action: "race.create", entityType: "race", entityId: r.id, after: { slug: r.slug, prizes: input.prizes.length } });
    return r;
  });
}

export interface ScoreInput {
  sourceType: "OPENING" | "BATTLE_ENTRY" | "PROMO_ENTRY" | "REVERSAL";
  sourceId: string;
  originalSourceType?: string;
  userId: string;
  amountMinor?: bigint;
  reason?: string;
  occurredAt: Date;
}

function pointsFor(rules: ScoringRules, input: ScoreInput): { points: number; explanation: string } {
  const units = Number((input.amountMinor ?? 0n) / 100n); // whole currency units, exact integer division
  if (input.sourceType === "OPENING") {
    const p = Math.min(rules.maxPointsPerEvent, units * rules.pointsPerUnitSpent + rules.pointsPerOpening);
    return { points: p, explanation: `${units} × ${rules.pointsPerUnitSpent} pts per unit + ${rules.pointsPerOpening} per opening (cap ${rules.maxPointsPerEvent})` };
  }
  if (input.sourceType === "BATTLE_ENTRY") {
    const p = Math.min(rules.maxPointsPerEvent, units * rules.pointsPerUnitSpent + rules.pointsPerBattleEntry);
    return { points: p, explanation: `${units} × ${rules.pointsPerUnitSpent} pts per unit + ${rules.pointsPerBattleEntry} per battle entry (cap ${rules.maxPointsPerEvent})` };
  }
  if (input.sourceType === "PROMO_ENTRY") {
    const p = Math.min(rules.maxPointsPerEvent, units * rules.pointsPerPromoUnit);
    return { points: p, explanation: `No-purchase entry: ${units} × ${rules.pointsPerPromoUnit} pts (cap ${rules.maxPointsPerEvent})` };
  }
  return { points: 0, explanation: "reversal" };
}

/** Idempotent scoring of a qualified event into the race that contains its timestamp. */
export async function scoreEvent(db: Db, input: ScoreInput): Promise<{ scored: boolean; points: number } | null> {
  return serializable(db, async (tx) => {
    if (input.sourceType === "REVERSAL") return reverseEvent(tx, input);
    const [r] = await tx
      .select()
      .from(race)
      .where(and(eq(race.status, "ACTIVE"), lte(race.startsAt, input.occurredAt), gte(race.endsAt, input.occurredAt)))
      .limit(1)
      .for("update");
    if (!r) return null;
    const policy = (await tx.query.raceScoringPolicy.findFirst({ where: eq(raceScoringPolicy.id, r.scoringPolicyId) }))!;
    const { points, explanation } = pointsFor(policy.rules, input);
    if (points <= 0) return { scored: false, points: 0 };
    const inserted = await tx
      .insert(raceScoreEvent)
      .values({ raceId: r.id, userId: input.userId, sourceType: input.sourceType, sourceId: input.sourceId, points, explanation, occurredAt: input.occurredAt })
      .onConflictDoNothing()
      .returning();
    if (!inserted.length) return { scored: false, points: 0 };
    await tx
      .insert(raceStanding)
      .values({ raceId: r.id, userId: input.userId, points, lastQualifyingAt: input.occurredAt })
      .onConflictDoUpdate({ target: [raceStanding.raceId, raceStanding.userId], set: { points: sql`${raceStanding.points} + ${points}`, lastQualifyingAt: sql`GREATEST(${raceStanding.lastQualifyingAt}, ${input.occurredAt})` } });
    await enqueueOutbox(tx, "realtime.race", { raceId: r.id, type: "standing.updated", userId: input.userId }, { type: "race", id: r.id });
    return { scored: true, points };
  });
}

/** Excludes a previously scored event (void/refund/chargeback/fraud) by appending a negative reversal row. */
async function reverseEvent(tx: DbOrTx, input: ScoreInput) {
  const original = await tx.query.raceScoreEvent.findFirst({ where: and(eq(raceScoreEvent.sourceId, input.sourceId), eq(raceScoreEvent.sourceType, (input.originalSourceType ?? "OPENING") as "OPENING")) });
  if (!original) return null;
  const [r] = await tx.select().from(race).where(eq(race.id, original.raceId)).for("update");
  if (r.status === "SETTLED") return { scored: false, points: 0 };
  const inserted = await tx
    .insert(raceScoreEvent)
    .values({ raceId: r.id, userId: original.userId, sourceType: "REVERSAL", sourceId: input.sourceId, points: -original.points, explanation: `Reversal of ${original.sourceType} (${input.reason ?? "excluded"})`, excluded: input.reason ?? "EXCLUDED", occurredAt: input.occurredAt })
    .onConflictDoNothing()
    .returning();
  if (!inserted.length) return { scored: false, points: 0 };
  await tx.update(raceStanding).set({ points: sql`${raceStanding.points} - ${original.points}` }).where(and(eq(raceStanding.raceId, r.id), eq(raceStanding.userId, original.userId)));
  return { scored: true, points: -original.points };
}

/** Deterministic ordering: points desc, earliest lastQualifyingAt asc, userId asc. Published in advance. */
function rankSql() {
  return sql`ROW_NUMBER() OVER (ORDER BY points DESC, last_qualifying_at ASC NULLS LAST, user_id ASC)`;
}

export async function computeLeaderboard(db: DbOrTx, raceId: string, limit = 100) {
  const rows = await db.execute<{ user_id: string; points: number; rank: number; last_qualifying_at: Date | null; display_name: string; excluded_reason: string | null; prize_amount_minor: bigint | null }>(sql`
    SELECT s.user_id, s.points, s.last_qualifying_at, s.excluded_reason, s.prize_amount_minor, u.display_name,
           ${rankSql()} AS rank
    FROM race_standing s JOIN "user" u ON u.id = s.user_id
    WHERE s.race_id = ${raceId} AND s.excluded_reason IS NULL AND s.points > 0
    ORDER BY rank ASC LIMIT ${limit}`);
  return rows.rows;
}

export async function raceView(db: DbOrTx, raceId: string, viewerUserId: string | null) {
  const r = await db.query.race.findFirst({ where: eq(race.id, raceId) });
  if (!r) return null;
  const prizes = await db.select().from(racePrize).where(eq(racePrize.raceId, raceId)).orderBy(asc(racePrize.rank));
  const policy = await db.query.raceScoringPolicy.findFirst({ where: eq(raceScoringPolicy.id, r.scoringPolicyId) });
  const leaderboard = await computeLeaderboard(db, raceId, 100);
  let me: null | { rank: number | null; points: number; prizeMinor: bigint | null; gapToNextPaidMinor: number | null; nextPaidRank: number | null; explanation: Array<{ points: number; explanation: string; occurredAt: Date; sourceType: string }> } = null;
  if (viewerUserId) {
    const all = await db.execute<{ user_id: string; points: number; rank: number }>(sql`
      SELECT s.user_id, s.points, ${rankSql()} AS rank FROM race_standing s WHERE s.race_id = ${raceId} AND s.excluded_reason IS NULL AND s.points > 0`);
    const mine = all.rows.find((x) => x.user_id === viewerUserId);
    const events = await db.select().from(raceScoreEvent).where(and(eq(raceScoreEvent.raceId, raceId), eq(raceScoreEvent.userId, viewerUserId))).orderBy(desc(raceScoreEvent.occurredAt)).limit(20);
    const myRank = mine ? Number(mine.rank) : null;
    const paidRanks = prizes.map((p) => p.rank);
    const nextPaid = myRank === null ? (paidRanks.length ? Math.max(...paidRanks) : null) : (paidRanks.filter((k) => k < myRank).sort((a, b) => b - a)[0] ?? null);
    const nextPaidRow = nextPaid ? all.rows.find((x) => Number(x.rank) === nextPaid) : null;
    me = {
      rank: myRank,
      points: mine ? Number(mine.points) : 0,
      prizeMinor: myRank ? (prizes.find((p) => p.rank === myRank)?.amountMinor ?? null) : null,
      gapToNextPaidMinor: nextPaidRow ? Number(nextPaidRow.points) - (mine ? Number(mine.points) : 0) + 1 : null,
      nextPaidRank: nextPaid,
      explanation: events.map((e) => ({ points: e.points, explanation: e.explanation, occurredAt: e.occurredAt, sourceType: e.sourceType })),
    };
  }
  return { race: r, prizes, policy: policy ? { version: policy.version, name: policy.name, rules: policy.rules, policyHash: policy.policyHash } : null, leaderboard, me };
}

export async function currentRace(db: DbOrTx) {
  return db.query.race.findFirst({ where: eq(race.status, "ACTIVE"), orderBy: desc(race.startsAt) }) ?? db.query.race.findFirst({ where: eq(race.status, "SCHEDULED"), orderBy: asc(race.startsAt) });
}

export async function pastRaces(db: DbOrTx, limit = 10) {
  return db.select().from(race).where(eq(race.status, "SETTLED")).orderBy(desc(race.endsAt)).limit(limit);
}

/** Lock: freezes standings, assigns ranks, stores an audit snapshot hash; moves to REVIEW for fraud checks. */
export async function lockRace(db: Db, actorUserId: string | null, raceId: string) {
  return serializable(db, async (tx) => {
    const [r] = await tx.select().from(race).where(eq(race.id, raceId)).for("update");
    if (!r) throw err.notFound("Race");
    if (r.status !== "ACTIVE") throw err.state(`Race is ${r.status}`);
    const rows = await tx.execute<{ id: string; user_id: string; points: number; rank: number }>(sql`
      SELECT s.id, s.user_id, s.points, ${rankSql()} AS rank FROM race_standing s WHERE s.race_id = ${raceId} AND s.points > 0`);
    for (const row of rows.rows) await tx.update(raceStanding).set({ rank: Number(row.rank) }).where(eq(raceStanding.id, row.id));
    const snapshot = rows.rows.map((x) => ({ userId: x.user_id, points: Number(x.points), rank: Number(x.rank) }));
    const hash = hashObject(snapshot);
    await tx.update(race).set({ status: "REVIEW", lockedAt: new Date(), lockSnapshot: snapshot, lockSnapshotHash: hash }).where(eq(race.id, raceId));
    await audit(tx, { actorUserId, actorRole: actorUserId ? undefined : "SYSTEM", action: "race.lock", entityType: "race", entityId: raceId, after: { snapshotHash: hash, entrants: snapshot.length } });
    return { snapshotHash: hash, entrants: snapshot.length };
  });
}

/** Fraud review: excludes users with open HIGH/CRITICAL risk events or suspended accounts. Returns exclusions applied. */
export async function fraudReview(db: Db, actorUserId: string | null, raceId: string) {
  return db.transaction(async (tx) => {
    const standings = await tx.select().from(raceStanding).where(eq(raceStanding.raceId, raceId));
    const excluded: string[] = [];
    for (const s of standings) {
      const u = await tx.query.user.findFirst({ where: eq(user.id, s.userId) });
      const flagged = await tx.query.riskEvent.findFirst({ where: and(eq(riskEvent.userId, s.userId), sql`${riskEvent.resolvedAt} IS NULL`, sql`${riskEvent.severity} IN ('HIGH','CRITICAL')`) });
      const reason = !u || u.status !== "ACTIVE" ? "ACCOUNT_STATUS" : u.isBot ? "BOT" : flagged ? `FRAUD:${flagged.kind}` : null;
      if (reason) {
        await tx.update(raceStanding).set({ excludedReason: reason }).where(eq(raceStanding.id, s.id));
        excluded.push(s.userId);
      }
    }
    await audit(tx, { actorUserId, action: "race.fraud_review", entityType: "race", entityId: raceId, after: { excluded } });
    return excluded;
  });
}

/** Idempotent settlement: pays the ladder from SYSTEM_PRIZES; re-runs never double pay. */
export async function settleRace(db: Db, actorUserId: string | null, raceId: string) {
  return serializable(db, async (tx) => {
    const [r] = await tx.select().from(race).where(eq(race.id, raceId)).for("update");
    if (!r) throw err.notFound("Race");
    if (r.status !== "REVIEW" && r.status !== "SETTLED") throw err.state(`Race must be in REVIEW to settle (is ${r.status})`);
    const prizes = await tx.select().from(racePrize).where(eq(racePrize.raceId, raceId));
    // Recompute ranks after exclusions, deterministic.
    const rows = await tx.execute<{ id: string; user_id: string; points: number; rank: number; prize_ledger_transaction_id: string | null }>(sql`
      SELECT s.id, s.user_id, s.points, s.prize_ledger_transaction_id, ${rankSql()} AS rank FROM race_standing s
      WHERE s.race_id = ${raceId} AND s.excluded_reason IS NULL AND s.points > 0`);
    const prizesAcct = await getSystemAccount(tx, "SYSTEM_PRIZES", r.currency);
    let paid = 0n;
    const winners: Array<{ userId: string; rank: number; amountMinor: string }> = [];
    for (const row of rows.rows) {
      const rank = Number(row.rank);
      const prize = prizes.find((p) => p.rank === rank);
      await tx.update(raceStanding).set({ rank }).where(eq(raceStanding.id, row.id));
      if (!prize || row.prize_ledger_transaction_id) continue;
      const acct = await getOrCreateUserAccount(tx, row.user_id, "USER_CASH", r.currency);
      const trx = await postTransaction(tx, {
        kind: "RACE_PRIZE",
        referenceType: "race",
        referenceId: raceId,
        idempotencyKey: `race-prize:${raceId}:${row.user_id}`,
        description: `${r.name} rank ${rank} prize`,
        currency: r.currency,
        entries: [
          { accountId: prizesAcct.id, amountMinor: -prize.amountMinor },
          { accountId: acct.id, amountMinor: prize.amountMinor },
        ],
        createdBy: actorUserId,
      });
      await tx.update(raceStanding).set({ prizeAmountMinor: prize.amountMinor, prizeLedgerTransactionId: trx.id }).where(eq(raceStanding.id, row.id));
      paid += prize.amountMinor;
      winners.push({ userId: row.user_id, rank, amountMinor: prize.amountMinor.toString() });
      await enqueueOutbox(tx, "notification.create", { userId: row.user_id, kind: "RACE", title: `${r.name}: you placed #${rank}`, body: `Prize credited to your balance.`, href: "/race" });
    }
    const summary = { paidMinor: paid.toString(), winners, settledAt: new Date().toISOString() };
    await tx.update(race).set({ status: "SETTLED", settledAt: new Date(), settlementSummary: summary }).where(eq(race.id, raceId));
    await audit(tx, { actorUserId, action: "race.settle", entityType: "race", entityId: raceId, after: summary });
    await enqueueOutbox(tx, "realtime.race", { raceId, type: "settled" }, { type: "race", id: raceId });
    return summary;
  });
}

/** Scheduler tick: activate scheduled races, lock finished ones. */
export async function raceScheduler(db: Db): Promise<{ activated: number; locked: number }> {
  const now = new Date();
  const toActivate = await db.select().from(race).where(and(eq(race.status, "SCHEDULED"), lte(race.startsAt, now)));
  for (const r of toActivate) await db.update(race).set({ status: "ACTIVE" }).where(eq(race.id, r.id));
  const toLock = await db.select().from(race).where(and(eq(race.status, "ACTIVE"), lte(race.endsAt, now)));
  for (const r of toLock) {
    await lockRace(db, null, r.id);
    await fraudReview(db, null, r.id);
  }
  return { activated: toActivate.length, locked: toLock.length };
}

export async function promoEntry(db: Db, actorUserId: string, userId: string, unitsMinor: bigint, ref: string) {
  const id = hashObject({ ref, userId }).slice(0, 32);
  const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-4${id.slice(13, 16)}-8${id.slice(17, 20)}-${id.slice(20, 32)}`;
  await audit(db, { actorUserId, action: "race.promo_entry", entityType: "race_score_event", entityId: uuid, after: { userId, unitsMinor: unitsMinor.toString(), ref } });
  return scoreEvent(db, { sourceType: "PROMO_ENTRY", sourceId: uuid, userId, amountMinor: unitsMinor, occurredAt: new Date() });
}
