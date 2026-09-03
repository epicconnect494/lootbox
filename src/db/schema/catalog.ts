import { boolean, check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, currency, deletedAt, id, money, updatedAt } from "./_common";
import { custodyEnum, inventoryStatusEnum, itemConditionEnum } from "./enums";
import { user } from "./identity";

export const category = pgTable("category", {
  id: id(),
  slug: varchar("slug", { length: 64 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const warehouseLocation = pgTable("warehouse_location", {
  id: id(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: text("name").notNull(),
  countryCode: varchar("country_code", { length: 2 }).notNull(),
  address: jsonb("address").$type<Record<string, string>>().notNull().default({}),
  createdAt: createdAt(),
});

/** A pooled SKU represents fungible stock (e.g. sealed booster). Unique graded items reference a SKU as their "kind". */
export const productSku = pgTable(
  "product_sku",
  {
    id: id(),
    sku: varchar("sku", { length: 64 }).notNull().unique(),
    categoryId: uuid("category_id").notNull().references(() => category.id),
    name: text("name").notNull(),
    description: text("description"),
    brand: text("brand"),
    imageKey: text("image_key"),
    /** Visual accent used by placeholder artwork. */
    accent: varchar("accent", { length: 16 }).notNull().default("violet"),
    isUnique: boolean("is_unique").notNull().default(false),
    pooledQuantity: integer("pooled_quantity").notNull().default(0),
    pooledReserved: integer("pooled_reserved").notNull().default(0),
    defaultReferenceValueMinor: money("default_reference_value_minor").notNull().default(sql`0`),
    defaultSellbackOfferMinor: money("default_sellback_offer_minor").notNull().default(sql`0`),
    currency: currency(),
    shippingRestricted: boolean("shipping_restricted").notNull().default(false),
    shippingRestrictionNote: text("shipping_restriction_note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [index("product_sku_category_idx").on(t.categoryId), check("product_sku_pool_nonneg", sql`pooled_quantity >= 0 AND pooled_reserved >= 0 AND pooled_reserved <= pooled_quantity`)],
);

export const inventoryItem = pgTable(
  "inventory_item",
  {
    id: id(),
    itemCode: varchar("item_code", { length: 32 }).notNull().unique(), // human item ID e.g. ITM-000123
    skuId: uuid("sku_id").notNull().references(() => productSku.id),
    warehouseId: uuid("warehouse_id").references(() => warehouseLocation.id),
    serialNumber: varchar("serial_number", { length: 128 }),
    certificationId: varchar("certification_id", { length: 128 }),
    grader: varchar("grader", { length: 64 }),
    grade: varchar("grade", { length: 32 }),
    size: varchar("size", { length: 32 }),
    condition: itemConditionEnum("condition").notNull().default("NEAR_MINT"),
    acquisitionCostMinor: money("acquisition_cost_minor").notNull().default(sql`0`),
    currency: currency(),
    status: inventoryStatusEnum("status").notNull().default("INTAKE"),
    custody: custodyEnum("custody").notNull().default("WAREHOUSE"),
    /** Exactly one reservation may exist: enforced by this column + status. */
    reservedForType: varchar("reserved_for_type", { length: 32 }),
    reservedForId: uuid("reserved_for_id"),
    reservedAt: timestamp("reserved_at", { withTimezone: true }),
    ownerUserId: uuid("owner_user_id").references(() => user.id),
    mediaKeys: jsonb("media_keys").$type<string[]>().notNull().default([]),
    notes: text("notes"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    index("inventory_item_sku_idx").on(t.skuId, t.status),
    index("inventory_item_owner_idx").on(t.ownerUserId),
    uniqueIndex("inventory_item_cert_uq").on(t.grader, t.certificationId).where(sql`certification_id IS NOT NULL`),
    check("inventory_reservation_consistent", sql`(status <> 'RESERVED') OR (reserved_for_type IS NOT NULL AND reserved_for_id IS NOT NULL)`),
  ],
);

export const valuationSnapshot = pgTable(
  "valuation_snapshot",
  {
    id: id(),
    skuId: uuid("sku_id").references(() => productSku.id),
    inventoryItemId: uuid("inventory_item_id").references(() => inventoryItem.id),
    referenceValueMinor: money("reference_value_minor").notNull(),
    sellbackOfferMinor: money("sellback_offer_minor").notNull(),
    currency: currency(),
    source: varchar("source", { length: 64 }).notNull(), // e.g. "market-index:v3", "manual"
    sourceRef: text("source_ref"),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("valuation_sku_idx").on(t.skuId, t.observedAt), index("valuation_item_idx").on(t.inventoryItemId, t.observedAt), check("valuation_sellback_le_ref", sql`sellback_offer_minor <= reference_value_minor AND sellback_offer_minor >= 0`)],
);
