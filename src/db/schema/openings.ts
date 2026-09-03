import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, currency, id, money, updatedAt } from "./_common";
import { openingSourceEnum, openingStatusEnum, seedScopeEnum, seedStatusEnum } from "./enums";
import { user } from "./identity";
import { inventoryItem } from "./catalog";
import { packOutcome, packVersion } from "./packs";
import { ledgerTransaction } from "./money";

/**
 * A server seed. The raw seed is encrypted at rest; only SHA-256(seed) is public until reveal.
 * scope USER: one active seed per user, nonce increments per opening.
 * scope BATTLE/RAFFLE: seed committed for a specific event.
 */
export const fairnessSeed = pgTable(
  "fairness_seed",
  {
    id: id(),
    scope: seedScopeEnum("scope").notNull(),
    userId: uuid("user_id").references(() => user.id),
    scopeRefId: uuid("scope_ref_id"),
    serverSeedHash: varchar("server_seed_hash", { length: 64 }).notNull(),
    serverSeedEncrypted: text("server_seed_encrypted").notNull(),
    revealedServerSeed: varchar("revealed_server_seed", { length: 64 }),
    clientSeed: varchar("client_seed", { length: 64 }).notNull(),
    nonce: integer("nonce").notNull().default(0),
    useCount: integer("use_count").notNull().default(0),
    status: seedStatusEnum("status").notNull().default("ACTIVE"),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    revealedAt: timestamp("revealed_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("fairness_seed_user_active_uq").on(t.userId).where(sql`scope = 'USER' AND status = 'ACTIVE'`),
    uniqueIndex("fairness_seed_scope_ref_uq").on(t.scope, t.scopeRefId).where(sql`scope_ref_id IS NOT NULL`),
    index("fairness_seed_hash_idx").on(t.serverSeedHash),
  ],
);

export const opening = pgTable(
  "opening",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id),
    packVersionId: uuid("pack_version_id").notNull().references(() => packVersion.id),
    outcomeId: uuid("outcome_id").notNull().references(() => packOutcome.id),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItem.id),
    source: openingSourceEnum("source").notNull().default("DIRECT"),
    status: openingStatusEnum("status").notNull().default("SETTLED"),
    priceMinor: money("price_minor").notNull(),
    referenceValueMinor: money("reference_value_minor").notNull(),
    sellbackOfferMinor: money("sellback_offer_minor").notNull(),
    currency: currency(),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransaction.id),
    ownershipTransferId: uuid("ownership_transfer_id"),
    battleId: uuid("battle_id"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    /** Whether the client has finished the reveal animation (presentation only, never affects outcome). */
    revealedAt: timestamp("revealed_at", { withTimezone: true }),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidReason: text("void_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("opening_user_idx").on(t.userId, t.createdAt),
    index("opening_version_idx").on(t.packVersionId, t.createdAt),
    uniqueIndex("opening_idem_uq").on(t.userId, t.idempotencyKey).where(sql`idempotency_key IS NOT NULL`),
    index("opening_battle_idx").on(t.battleId),
  ],
);

/** Append-only signed receipt (UPDATE/DELETE blocked by trigger). */
export const fairnessReceipt = pgTable(
  "fairness_receipt",
  {
    id: id(),
    openingId: uuid("opening_id").notNull().references(() => opening.id).unique(),
    seedId: uuid("seed_id").notNull().references(() => fairnessSeed.id),
    packVersionId: uuid("pack_version_id").notNull().references(() => packVersion.id),
    manifestHash: varchar("manifest_hash", { length: 64 }).notNull(),
    remainingInventoryCommitment: varchar("remaining_inventory_commitment", { length: 64 }).notNull(),
    serverSeedHash: varchar("server_seed_hash", { length: 64 }).notNull(),
    clientSeed: varchar("client_seed", { length: 64 }).notNull(),
    nonce: integer("nonce").notNull(),
    message: text("message").notNull(),
    digest: varchar("digest", { length: 64 }).notNull(),
    rangeSize: integer("range_size").notNull(),
    samplingSteps: jsonb("sampling_steps").$type<unknown>().notNull(),
    selectedIndex: integer("selected_index").notNull(),
    outcomeId: uuid("outcome_id").notNull(),
    inventoryItemId: uuid("inventory_item_id"),
    valueSnapshot: jsonb("value_snapshot").$type<unknown>().notNull(),
    ledgerTransactionId: uuid("ledger_transaction_id"),
    ownershipTransferId: uuid("ownership_transfer_id"),
    payloadCanonical: text("payload_canonical").notNull(),
    signature: text("signature").notNull(),
    signingKeyId: varchar("signing_key_id", { length: 64 }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("fairness_receipt_seed_idx").on(t.seedId, t.nonce), check("fairness_receipt_index_range", sql`selected_index >= 0 AND selected_index < range_size`)],
);
