import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, currency, id, money, updatedAt } from "./_common";
import { raceStatusEnum } from "./enums";
import { user } from "./identity";
import { ledgerTransaction } from "./money";

export type ScoringRules = {
  /** points per whole currency unit spent on qualified pack purchases (integer, exact) */
  pointsPerUnitSpent: number;
  /** flat bonus per qualified opening */
  pointsPerOpening: number;
  /** flat bonus per qualified battle entry */
  pointsPerBattleEntry: number;
  /** points per whole unit for promotional / no-purchase entries (must be >= paid rate where legally required) */
  pointsPerPromoUnit: number;
  /** cap on points from a single event to prevent loss chasing rewards */
  maxPointsPerEvent: number;
  tiePolicy: "EARLIEST_QUALIFYING_EVENT_WINS";
  excludedKinds: string[];
};

export const raceScoringPolicy = pgTable("race_scoring_policy", {
  id: id(),
  version: integer("version").notNull().unique(),
  name: text("name").notNull(),
  rules: jsonb("rules").$type<ScoringRules>().notNull(),
  policyHash: varchar("policy_hash", { length: 64 }).notNull(),
  createdBy: uuid("created_by").references(() => user.id),
  createdAt: createdAt(),
});

export const race = pgTable(
  "race",
  {
    id: id(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    name: text("name").notNull(),
    status: raceStatusEnum("status").notNull().default("SCHEDULED"),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    scoringPolicyId: uuid("scoring_policy_id").notNull().references(() => raceScoringPolicy.id),
    currency: currency(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lockSnapshotHash: varchar("lock_snapshot_hash", { length: 64 }),
    lockSnapshot: jsonb("lock_snapshot").$type<unknown>(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    settlementSummary: jsonb("settlement_summary").$type<unknown>(),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("race_status_idx").on(t.status, t.startsAt), check("race_window", sql`ends_at > starts_at`)],
);

export const racePrize = pgTable(
  "race_prize",
  {
    id: id(),
    raceId: uuid("race_id").notNull().references(() => race.id),
    rank: integer("rank").notNull(),
    amountMinor: money("amount_minor").notNull(),
    currency: currency(),
    label: text("label"),
  },
  (t) => [uniqueIndex("race_prize_rank_uq").on(t.raceId, t.rank), check("race_prize_rank_range", sql`rank >= 1 AND rank <= 100`)],
);

/** Immutable qualified-event scoring rows derived from ledger/domain events. */
export const raceScoreEvent = pgTable(
  "race_score_event",
  {
    id: id(),
    raceId: uuid("race_id").notNull().references(() => race.id),
    userId: uuid("user_id").notNull().references(() => user.id),
    sourceType: varchar("source_type", { length: 48 }).notNull(), // OPENING | BATTLE_ENTRY | PROMO_ENTRY | REVERSAL
    sourceId: uuid("source_id").notNull(),
    points: integer("points").notNull(),
    explanation: text("explanation").notNull(),
    excluded: text("excluded"), // reason if excluded (VOID | REFUND | CHARGEBACK | FRAUD | BONUS_ABUSE)
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("race_score_event_source_uq").on(t.raceId, t.sourceType, t.sourceId), index("race_score_event_user_idx").on(t.raceId, t.userId)],
);

export const raceStanding = pgTable(
  "race_standing",
  {
    id: id(),
    raceId: uuid("race_id").notNull().references(() => race.id),
    userId: uuid("user_id").notNull().references(() => user.id),
    points: integer("points").notNull().default(0),
    rank: integer("rank"),
    /** tie-break: timestamp of the event that reached the final score */
    lastQualifyingAt: timestamp("last_qualifying_at", { withTimezone: true }),
    prizeAmountMinor: money("prize_amount_minor"),
    prizeLedgerTransactionId: uuid("prize_ledger_transaction_id").references(() => ledgerTransaction.id),
    excludedReason: text("excluded_reason"),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("race_standing_user_uq").on(t.raceId, t.userId), index("race_standing_rank_idx").on(t.raceId, t.points, t.lastQualifyingAt)],
);
