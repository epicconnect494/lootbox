import { boolean, check, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, currency, id, money, updatedAt } from "./_common";
import { battleModeEnum, battleSpeedEnum, battleStatusEnum } from "./enums";
import { user } from "./identity";
import { packVersion } from "./packs";
import { opening } from "./openings";
import { ledgerTransaction } from "./money";

export type SharedRule = { type: "EQUAL_SPLIT_VALUE" } | { type: "RANK_SPLIT_BP"; shares: number[] };

export const battle = pgTable(
  "battle",
  {
    id: id(),
    code: varchar("code", { length: 12 }).notNull().unique(),
    mode: battleModeEnum("mode").notNull(),
    speed: battleSpeedEnum("speed").notNull().default("NORMAL"),
    status: battleStatusEnum("status").notNull().default("OPEN"),
    isPrivate: boolean("is_private").notNull().default(false),
    joinCode: varchar("join_code", { length: 16 }),
    seats: smallint("seats").notNull(),
    /** Ordered identical sequence of pack versions every player opens. */
    packVersionIds: jsonb("pack_version_ids").$type<string[]>().notNull(),
    entryCostMinor: money("entry_cost_minor").notNull(),
    currency: currency(),
    sharedRule: jsonb("shared_rule").$type<SharedRule | null>(),
    seedId: uuid("seed_id"),
    serverSeedHash: varchar("server_seed_hash", { length: 64 }),
    combinedClientSeed: varchar("combined_client_seed", { length: 512 }),
    createdBy: uuid("created_by").notNull().references(() => user.id),
    startedAt: timestamp("started_at", { withTimezone: true }),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    voidedBy: uuid("voided_by").references(() => user.id),
    winnerUserIds: jsonb("winner_user_ids").$type<string[]>().notNull().default([]),
    tieBreakReceipt: jsonb("tie_break_receipt").$type<unknown>(),
    settlementSummary: jsonb("settlement_summary").$type<unknown>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("battle_status_idx").on(t.status, t.createdAt), check("battle_seats_range", sql`seats BETWEEN 2 AND 4`)],
);

export const battleSeat = pgTable(
  "battle_seat",
  {
    id: id(),
    battleId: uuid("battle_id").notNull().references(() => battle.id),
    seatIndex: smallint("seat_index").notNull(),
    userId: uuid("user_id").notNull().references(() => user.id),
    isBot: boolean("is_bot").notNull().default(false),
    clientSeed: varchar("client_seed", { length: 64 }).notNull(),
    entryLedgerTransactionId: uuid("entry_ledger_transaction_id").references(() => ledgerTransaction.id),
    totalValueMinor: money("total_value_minor").notNull().default(sql`0`),
    finalRank: smallint("final_rank"),
    awardedValueMinor: money("awarded_value_minor"),
    joinedAt: createdAt(),
  },
  (t) => [uniqueIndex("battle_seat_index_uq").on(t.battleId, t.seatIndex), uniqueIndex("battle_seat_user_uq").on(t.battleId, t.userId)],
);

export const battleRound = pgTable(
  "battle_round",
  {
    id: id(),
    battleId: uuid("battle_id").notNull().references(() => battle.id),
    roundIndex: smallint("round_index").notNull(),
    packVersionId: uuid("pack_version_id").notNull().references(() => packVersion.id),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("battle_round_uq").on(t.battleId, t.roundIndex)],
);

export const battlePull = pgTable(
  "battle_pull",
  {
    id: id(),
    battleId: uuid("battle_id").notNull().references(() => battle.id),
    roundId: uuid("round_id").notNull().references(() => battleRound.id),
    seatId: uuid("seat_id").notNull().references(() => battleSeat.id),
    openingId: uuid("opening_id").notNull().references(() => opening.id).unique(),
    pullIndex: integer("pull_index").notNull(), // global order within the battle
    valueMinor: money("value_minor").notNull(),
    runningTotalMinor: money("running_total_minor").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("battle_pull_round_seat_uq").on(t.roundId, t.seatId), index("battle_pull_battle_idx").on(t.battleId, t.pullIndex)],
);
