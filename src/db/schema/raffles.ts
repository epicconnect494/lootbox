import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, currency, id, money, updatedAt } from "./_common";
import { raffleDrawStatusEnum, raffleEntryModeEnum, raffleEntrySourceEnum, raffleStatusEnum } from "./enums";
import { user } from "./identity";
import { inventoryItem } from "./catalog";

export const raffle = pgTable(
  "raffle",
  {
    id: id(),
    slug: varchar("slug", { length: 64 }).notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    status: raffleStatusEnum("status").notNull().default("DRAFT"),
    entryMode: raffleEntryModeEnum("entry_mode").notNull().default("FREE"),
    maxTickets: integer("max_tickets").notNull(),
    maxTicketsPerUser: integer("max_tickets_per_user").notNull().default(10),
    ticketPriceMinor: money("ticket_price_minor").notNull().default(sql`0`),
    currency: currency(),
    winnersCount: integer("winners_count").notNull().default(1),
    amoeEnabled: boolean("amoe_enabled").notNull().default(true),
    amoeInstructions: text("amoe_instructions"),
    allowedJurisdictions: jsonb("allowed_jurisdictions").$type<string[]>().notNull().default([]),
    opensAt: timestamp("opens_at", { withTimezone: true }).notNull(),
    closesAt: timestamp("closes_at", { withTimezone: true }).notNull(),
    drawsAt: timestamp("draws_at", { withTimezone: true }).notNull(),
    claimDeadlineAt: timestamp("claim_deadline_at", { withTimezone: true }).notNull(),
    seedId: uuid("seed_id"),
    serverSeedHash: varchar("server_seed_hash", { length: 64 }),
    serverSeedCommittedAt: timestamp("server_seed_committed_at", { withTimezone: true }),
    publicRandomnessSource: text("public_randomness_source"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("raffle_status_idx").on(t.status, t.drawsAt), check("raffle_schedule", sql`closes_at > opens_at AND draws_at >= closes_at AND claim_deadline_at > draws_at`)],
);

export const rafflePrize = pgTable(
  "raffle_prize",
  {
    id: id(),
    raffleId: uuid("raffle_id").notNull().references(() => raffle.id),
    rank: integer("rank").notNull().default(1),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItem.id),
    title: text("title").notNull(),
    description: text("description"),
    condition: varchar("condition", { length: 32 }),
    referenceValueMinor: money("reference_value_minor").notNull(),
    currency: currency(),
    valueSource: text("value_source"),
    valueObservedAt: timestamp("value_observed_at", { withTimezone: true }),
    winnerUserId: uuid("winner_user_id").references(() => user.id),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("raffle_prize_rank_uq").on(t.raffleId, t.rank)],
);

/** Immutable ticket. ticket_number is contiguous 1..N per raffle; ticket_id is a random unique token. */
export const raffleEntry = pgTable(
  "raffle_entry",
  {
    id: id(),
    raffleId: uuid("raffle_id").notNull().references(() => raffle.id),
    userId: uuid("user_id").notNull().references(() => user.id),
    ticketNumber: integer("ticket_number").notNull(),
    ticketId: varchar("ticket_id", { length: 32 }).notNull(),
    source: raffleEntrySourceEnum("source").notNull(),
    sourceRef: varchar("source_ref", { length: 160 }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("raffle_entry_number_uq").on(t.raffleId, t.ticketNumber), uniqueIndex("raffle_entry_ticket_uq").on(t.ticketId), index("raffle_entry_user_idx").on(t.raffleId, t.userId)],
);

export const raffleManifest = pgTable("raffle_manifest", {
  id: id(),
  raffleId: uuid("raffle_id").notNull().references(() => raffle.id).unique(),
  ticketCount: integer("ticket_count").notNull(),
  manifestHash: varchar("manifest_hash", { length: 64 }).notNull(),
  canonicalManifest: text("canonical_manifest").notNull(),
  lockedAt: createdAt(),
});

/** Append-only. A redraw creates a new row and marks the previous as SUPERSEDED (never overwritten). */
export const raffleDraw = pgTable(
  "raffle_draw",
  {
    id: id(),
    raffleId: uuid("raffle_id").notNull().references(() => raffle.id),
    drawNumber: integer("draw_number").notNull(),
    status: raffleDrawStatusEnum("status").notNull().default("VALID"),
    manifestHash: varchar("manifest_hash", { length: 64 }).notNull(),
    serverSeedHash: varchar("server_seed_hash", { length: 64 }).notNull(),
    serverSeed: varchar("server_seed", { length: 64 }).notNull(),
    publicRandomness: text("public_randomness").notNull(),
    publicRandomnessSource: text("public_randomness_source").notNull(),
    ticketCount: integer("ticket_count").notNull(),
    winners: jsonb("winners").$type<Array<{ rank: number; nonce: number; message: string; digest: string; steps: unknown; ticketNumber: number; ticketId: string; userId: string }>>().notNull(),
    reason: text("reason"),
    drawnBy: uuid("drawn_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("raffle_draw_number_uq").on(t.raffleId, t.drawNumber)],
);
