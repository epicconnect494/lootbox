import { boolean, check, index, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, currency, id, money, updatedAt } from "./_common";
import { holdingStatusEnum, listingStatusEnum, orderStatusEnum, quoteStatusEnum, shipmentStatusEnum, transferReasonEnum } from "./enums";
import { user } from "./identity";
import { inventoryItem } from "./catalog";
import { ledgerTransaction } from "./money";

/** One ACTIVE holding per physical item, enforced by partial unique index. */
export const vaultHolding = pgTable(
  "vault_holding",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id),
    inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItem.id),
    status: holdingStatusEnum("status").notNull().default("ACTIVE"),
    acquiredVia: transferReasonEnum("acquired_via").notNull(),
    acquiredRefId: uuid("acquired_ref_id"),
    referenceValueMinor: money("reference_value_minor").notNull(),
    sellbackOfferMinor: money("sellback_offer_minor").notNull(),
    currency: currency(),
    collectionName: varchar("collection_name", { length: 64 }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("vault_holding_item_active_uq").on(t.inventoryItemId).where(sql`status = 'ACTIVE'`),
    index("vault_holding_user_idx").on(t.userId, t.status),
  ],
);

/** Append-only chain of custody. */
export const ownershipTransfer = pgTable(
  "ownership_transfer",
  {
    id: id(),
    inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItem.id),
    fromUserId: uuid("from_user_id").references(() => user.id), // null = platform
    toUserId: uuid("to_user_id").references(() => user.id), // null = platform
    reason: transferReasonEnum("reason").notNull(),
    referenceType: varchar("reference_type", { length: 48 }),
    referenceId: uuid("reference_id"),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransaction.id),
    createdAt: createdAt(),
  },
  (t) => [index("ownership_transfer_item_idx").on(t.inventoryItemId, t.createdAt), index("ownership_transfer_ref_idx").on(t.referenceType, t.referenceId)],
);

export const sellbackQuote = pgTable(
  "sellback_quote",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id),
    holdingId: uuid("holding_id").notNull().references(() => vaultHolding.id),
    inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItem.id),
    offerMinor: money("offer_minor").notNull(),
    referenceValueMinor: money("reference_value_minor").notNull(),
    currency: currency(),
    policyVersion: varchar("policy_version", { length: 32 }).notNull(),
    status: quoteStatusEnum("status").notNull().default("OPEN"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransaction.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("sellback_quote_holding_idx").on(t.holdingId, t.status)],
);

export const shipment = pgTable(
  "shipment",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id),
    holdingId: uuid("holding_id").notNull().references(() => vaultHolding.id),
    inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItem.id),
    status: shipmentStatusEnum("status").notNull().default("REQUESTED"),
    /** Encrypted at rest. */
    addressEncrypted: text("address_encrypted").notNull(),
    addressCountry: varchar("address_country", { length: 2 }).notNull(),
    addressVerified: boolean("address_verified").notNull().default(false),
    insured: boolean("insured").notNull().default(true),
    insuredValueMinor: money("insured_value_minor").notNull(),
    shippingFeeMinor: money("shipping_fee_minor").notNull().default(sql`0`),
    currency: currency(),
    carrier: varchar("carrier", { length: 32 }),
    trackingNumber: varchar("tracking_number", { length: 96 }),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    disputeReason: text("dispute_reason"),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("shipment_status_idx").on(t.status, t.createdAt), index("shipment_user_idx").on(t.userId)],
);

export const marketplaceListing = pgTable(
  "marketplace_listing",
  {
    id: id(),
    sellerUserId: uuid("seller_user_id").notNull().references(() => user.id),
    holdingId: uuid("holding_id").notNull().references(() => vaultHolding.id),
    inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItem.id),
    askMinor: money("ask_minor").notNull(),
    currency: currency(),
    status: listingStatusEnum("status").notNull().default("ACTIVE"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("marketplace_listing_item_active_uq").on(t.inventoryItemId).where(sql`status = 'ACTIVE'`), index("marketplace_listing_status_idx").on(t.status, t.createdAt), check("marketplace_listing_ask_positive", sql`ask_minor > 0`)],
);

export const marketplaceOrder = pgTable("marketplace_order", {
  id: id(),
  listingId: uuid("listing_id").notNull().references(() => marketplaceListing.id).unique(),
  buyerUserId: uuid("buyer_user_id").notNull().references(() => user.id),
  sellerUserId: uuid("seller_user_id").notNull().references(() => user.id),
  inventoryItemId: uuid("inventory_item_id").notNull().references(() => inventoryItem.id),
  priceMinor: money("price_minor").notNull(),
  feeMinor: money("fee_minor").notNull(),
  currency: currency(),
  status: orderStatusEnum("status").notNull().default("SETTLED"),
  ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransaction.id),
  ownershipTransferId: uuid("ownership_transfer_id").references(() => ownershipTransfer.id),
  idempotencyKey: varchar("idempotency_key", { length: 160 }),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAt(),
});
