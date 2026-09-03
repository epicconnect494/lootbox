import { boolean, check, index, integer, jsonb, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, currency, deletedAt, id, money, updatedAt } from "./_common";
import { packKindEnum, packStatusEnum, packVersionStatusEnum } from "./enums";
import { category, inventoryItem, productSku, valuationSnapshot } from "./catalog";
import { user } from "./identity";

export const pack = pgTable(
  "pack",
  {
    id: id(),
    slug: varchar("slug", { length: 96 }).notNull().unique(),
    name: text("name").notNull(),
    tagline: text("tagline"),
    description: text("description"),
    categoryId: uuid("category_id").notNull().references(() => category.id),
    kind: packKindEnum("kind").notNull().default("FINITE"),
    status: packStatusEnum("status").notNull().default("DRAFT"),
    heroImageKey: text("hero_image_key"),
    accent: varchar("accent", { length: 16 }).notNull().default("violet"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    /** Points to the version currently shown to customers (PUBLISHED or PAUSED). */
    currentVersionId: uuid("current_version_id"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("pack_category_idx").on(t.categoryId, t.status)],
);

/** Immutable once published: price, outcomes, quantities and the manifest hash never change. */
export const packVersion = pgTable(
  "pack_version",
  {
    id: id(),
    packId: uuid("pack_id").notNull().references(() => pack.id),
    version: integer("version").notNull(),
    status: packVersionStatusEnum("status").notNull().default("DRAFT"),
    priceMinor: money("price_minor").notNull(),
    currency: currency(),
    totalOpenings: integer("total_openings").notNull(),
    remainingOpenings: integer("remaining_openings").notNull(),
    merchandiseRtpBp: integer("merchandise_rtp_bp"),
    sellbackRtpBp: integer("sellback_rtp_bp"),
    targetRtpBp: integer("target_rtp_bp").notNull().default(9000),
    rtpToleranceBp: integer("rtp_tolerance_bp").notNull().default(50),
    manifestHash: varchar("manifest_hash", { length: 64 }),
    manifestJson: jsonb("manifest_json").$type<unknown>(),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    pausedAt: timestamp("paused_at", { withTimezone: true }),
    pauseReason: text("pause_reason"),
    closedAt: timestamp("closed_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => user.id),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    submittedBy: uuid("submitted_by").references(() => user.id),
    liabilityLimitMinor: money("liability_limit_minor"),
    notes: text("notes"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("pack_version_pack_version_uq").on(t.packId, t.version),
    index("pack_version_status_idx").on(t.status),
    check("pack_version_remaining_range", sql`remaining_openings >= 0 AND remaining_openings <= total_openings`),
    check("pack_version_price_positive", sql`price_minor > 0`),
  ],
);

export const packOutcome = pgTable(
  "pack_outcome",
  {
    id: id(),
    packVersionId: uuid("pack_version_id").notNull().references(() => packVersion.id),
    position: smallint("position").notNull(),
    label: text("label").notNull(),
    tier: varchar("tier", { length: 16 }).notNull().default("COMMON"), // GRAIL | RARE | UNCOMMON | COMMON
    skuId: uuid("sku_id").notNull().references(() => productSku.id),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItem.id),
    valuationSnapshotId: uuid("valuation_snapshot_id").references(() => valuationSnapshot.id),
    quantityTotal: integer("quantity_total").notNull(),
    quantityRemaining: integer("quantity_remaining").notNull(),
    referenceValueMinor: money("reference_value_minor").notNull(),
    sellbackOfferMinor: money("sellback_offer_minor").notNull(),
    currency: currency(),
    condition: varchar("condition", { length: 32 }).notNull().default("NEAR_MINT"),
    shippingEligible: boolean("shipping_eligible").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("pack_outcome_version_position_uq").on(t.packVersionId, t.position),
    index("pack_outcome_item_idx").on(t.inventoryItemId),
    check("pack_outcome_qty_range", sql`quantity_remaining >= 0 AND quantity_remaining <= quantity_total AND quantity_total > 0`),
    check("pack_outcome_unique_item_qty", sql`inventory_item_id IS NULL OR quantity_total = 1`),
  ],
);

/** Published manifest commitment: hash + serialized manifest + inventory commitment at publish time. */
export const packManifestCommitment = pgTable(
  "pack_manifest_commitment",
  {
    id: id(),
    packVersionId: uuid("pack_version_id").notNull().references(() => packVersion.id).unique(),
    manifestHash: varchar("manifest_hash", { length: 64 }).notNull(),
    manifestJson: jsonb("manifest_json").$type<unknown>().notNull(),
    canonicalManifest: text("canonical_manifest").notNull(),
    publishedBy: uuid("published_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("pack_manifest_hash_idx").on(t.manifestHash)],
);

