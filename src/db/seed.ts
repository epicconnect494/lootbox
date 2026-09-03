/* eslint-disable no-console */
import { and, eq, sql } from "drizzle-orm";
import type { Db } from "./client";
import * as s from "./schema";
import { PERMISSIONS, ROLES, type RoleKey } from "@/lib/permissions";
import { hashPassword, encryptString } from "@/lib/crypto";
import { parseDecimalToMinor as usd } from "@/lib/money";
import { suggestRtpAdjustments, type OutcomeInput } from "@/lib/rtp";
import { draw, generateServerSeed, mapIndexToOutcome, serverSeedHash } from "@/lib/fairness/node";
import { getOrCreateUserAccount, getSystemAccount } from "@/domain/ledger";
import { createPackDraft, publishVersion, reviewVersion, submitForApproval, upsertOutcome } from "@/domain/packs";
import { openPack, getOrCreateUserSeed, setClientSeed } from "@/domain/openings";
import { createBattle, joinBattle } from "@/domain/battles";
import { createRace, createScoringPolicy, DEFAULT_RULES } from "@/domain/races";
import { createRaffle, closeRaffle, drawRaffle, enterRaffle } from "@/domain/raffles";
import { deposit, submitVerification } from "@/domain/users";
import { drainOutbox } from "@/domain/worker";
import { recordValuation } from "@/domain/admin";

export const DEMO_PASSWORD = "demo-password-123";

export const DEMO_ACCOUNTS: Array<{ email: string; name: string; role: RoleKey; verified: boolean; fund: string }> = [
  { email: "customer@demo.lootbox", name: "Avery Collector", role: "CUSTOMER", verified: true, fund: "500.00" },
  { email: "nova@demo.lootbox", name: "Nova Reyes", role: "CUSTOMER", verified: true, fund: "400.00" },
  { email: "kai@demo.lootbox", name: "Kai Moreno", role: "CUSTOMER", verified: true, fund: "400.00" },
  { email: "sol@demo.lootbox", name: "Sol Ashby", role: "CUSTOMER", verified: true, fund: "400.00" },
  { email: "fresh@demo.lootbox", name: "Fresh Account", role: "CUSTOMER", verified: false, fund: "0" },
  { email: "support@demo.lootbox", name: "Sam Support", role: "SUPPORT", verified: true, fund: "0" },
  { email: "risk@demo.lootbox", name: "Riley Risk", role: "RISK", verified: true, fund: "0" },
  { email: "catalog@demo.lootbox", name: "Casey Catalog", role: "CATALOG_MANAGER", verified: true, fund: "0" },
  { email: "finance@demo.lootbox", name: "Fin Ledger", role: "FINANCE", verified: true, fund: "0" },
  { email: "admin@demo.lootbox", name: "Ada Admin", role: "SUPER_ADMIN", verified: true, fund: "0" },
];

export async function seedBase(db: Db) {
  await db
    .insert(s.jurisdiction)
    .values([
      { code: "DEMO", name: "Demo Region (all features, local development only)", minAge: 18, paidChanceEnabled: true, battlesEnabled: true, rafflesEnabled: true, raffleFreeEntryRequired: true, cashConversionEnabled: true, cryptoConversionEnabled: false, freeEntryRouteEnabled: true, botsEnabled: false, legalApprovalReference: "NOT LEGAL APPROVAL: local demo configuration", legalApprovedAt: null },
      { code: "GB", name: "United Kingdom", minAge: 18, paidChanceEnabled: false, battlesEnabled: false, rafflesEnabled: true, raffleFreeEntryRequired: true, cashConversionEnabled: false },
      { code: "US-NY", name: "United States – New York", minAge: 21, paidChanceEnabled: false, battlesEnabled: false, rafflesEnabled: false, cashConversionEnabled: false },
      { code: "CA-ON", name: "Canada – Ontario", minAge: 19, paidChanceEnabled: false, battlesEnabled: false, rafflesEnabled: true, cashConversionEnabled: false },
      { code: "DE", name: "Germany", minAge: 18, paidChanceEnabled: false, battlesEnabled: false, rafflesEnabled: false, cashConversionEnabled: false },
    ])
    .onConflictDoNothing();

  const perms = await db.insert(s.permission).values(PERMISSIONS.map((key) => ({ key }))).onConflictDoNothing().returning();
  const allPerms = perms.length === PERMISSIONS.length ? perms : await db.select().from(s.permission);
  for (const [key, def] of Object.entries(ROLES)) {
    const [r] = await db.insert(s.role).values({ key, name: def.name }).onConflictDoUpdate({ target: s.role.key, set: { name: def.name } }).returning();
    if (def.permissions.length) await db.insert(s.rolePermission).values(def.permissions.map((p) => ({ roleId: r.id, permissionId: allPerms.find((x) => x.key === p)!.id }))).onConflictDoNothing();
  }
  await db
    .insert(s.category)
    .values([
      { slug: "tcg", name: "TCG", description: "Graded and sealed trading cards", sortOrder: 1 },
      { slug: "sneakers", name: "Sneakers", description: "Authenticated deadstock pairs", sortOrder: 2 },
      { slug: "watches", name: "Watches", description: "Serviced, papers-included timepieces", sortOrder: 3 },
      { slug: "gaming-tech", name: "Gaming & Tech", description: "Sealed hardware and limited peripherals", sortOrder: 4 },
    ])
    .onConflictDoNothing();
  await db.insert(s.warehouseLocation).values({ code: "VAULT-1", name: "Primary Vault", countryCode: "US", address: { city: "Austin", region: "TX" } }).onConflictDoNothing();
  for (const kind of ["SYSTEM_PAYMENT_CLEARING", "SYSTEM_PACK_SALES", "SYSTEM_SELLBACK_PAYOUTS", "SYSTEM_PRIZES", "SYSTEM_FEES", "SYSTEM_REFUNDS", "SYSTEM_CHARGEBACKS", "SYSTEM_MARKETPLACE_ESCROW", "SYSTEM_PROMO_FUNDING", "SYSTEM_BATTLE_POOL"] as const) await getSystemAccount(db, kind);
  const policy = (await db.query.raceScoringPolicy.findFirst()) ?? (await createScoringPolicy(db, null, "Weekly race scoring v1", DEFAULT_RULES));
  return { policy };
}

export async function seedUsers(db: Db) {
  const roles = await db.select().from(s.role);
  const users: Record<string, typeof s.user.$inferSelect> = {};
  for (const a of DEMO_ACCOUNTS) {
    const existing = await db.query.user.findFirst({ where: eq(s.user.email, a.email) });
    let u = existing;
    if (!u) {
      [u] = await db.insert(s.user).values({ email: a.email, passwordHash: hashPassword(DEMO_PASSWORD), displayName: a.name, jurisdictionCode: "DEMO", dateOfBirth: new Date("1990-05-15T00:00:00Z"), timezone: "America/New_York", emailVerifiedAt: new Date() }).returning();
      await db.insert(s.userRole).values({ userId: u.id, roleId: roles.find((r) => r.key === "CUSTOMER")!.id }).onConflictDoNothing();
      if (a.role !== "CUSTOMER") await db.insert(s.userRole).values({ userId: u.id, roleId: roles.find((r) => r.key === a.role)!.id }).onConflictDoNothing();
      await getOrCreateUserAccount(db, u.id);
      await getOrCreateUserSeed(db, u.id);
      if (a.verified) {
        await submitVerification(db, u.id, "AGE", { method: "dob", simulate: "approve" });
        await submitVerification(db, u.id, "IDENTITY", { method: "document", simulate: "approve" });
      }
      if (a.fund !== "0") await deposit(db, u.id, usd(a.fund), "test-card", `seed-deposit-${u.id}`);
    }
    users[a.email] = u;
  }
  // A clearly labeled house bot (only usable when FEATURE_BOTS_ENABLED and the jurisdiction allows bots).
  const bot = await db.query.user.findFirst({ where: eq(s.user.isBot, true) });
  if (!bot) {
    const [b] = await db.insert(s.user).values({ email: "bot@system.lootbox", passwordHash: hashPassword(generateServerSeed()), displayName: "Circuit", isBot: true, jurisdictionCode: "DEMO", dateOfBirth: new Date("1990-01-01T00:00:00Z") }).returning();
    await getOrCreateUserAccount(db, b.id);
    await getOrCreateUserSeed(db, b.id);
  }
  return users;
}

type ItemSpec = { name: string; sku: string; grader?: string; grade?: string; cert?: string; condition?: string; size?: string; serial?: string; cost: string; value: string; sellback: string; accent: string; image?: string };

const ACCENTS = ["violet", "cyan", "amber", "rose", "emerald", "slate"];

async function ensureSku(db: Db, cat: typeof s.category.$inferSelect, spec: { sku: string; name: string; brand?: string; isUnique: boolean; pooledQuantity?: number; value: string; sellback: string; accent: string; shippingRestricted?: boolean; note?: string; image?: string }) {
  const existing = await db.query.productSku.findFirst({ where: eq(s.productSku.sku, spec.sku) });
  if (existing) return existing;
  const [row] = await db
    .insert(s.productSku)
    .values({ sku: spec.sku, categoryId: cat.id, name: spec.name, brand: spec.brand ?? "Lootbox Authenticated", isUnique: spec.isUnique, pooledQuantity: spec.pooledQuantity ?? 0, defaultReferenceValueMinor: usd(spec.value), defaultSellbackOfferMinor: usd(spec.sellback), accent: spec.accent, shippingRestricted: spec.shippingRestricted ?? false, shippingRestrictionNote: spec.note ?? null, imageKey: spec.image ?? null })
    .returning();
  return row;
}

async function ensureItem(db: Db, skuRow: typeof s.productSku.$inferSelect, warehouseId: string, adminId: string, spec: ItemSpec, index: number) {
  const code = `ITM-${String(index).padStart(6, "0")}`;
  const existing = await db.query.inventoryItem.findFirst({ where: eq(s.inventoryItem.itemCode, code) });
  if (existing) return existing;
  const [item] = await db
    .insert(s.inventoryItem)
    .values({ itemCode: code, skuId: skuRow.id, warehouseId, serialNumber: spec.serial ?? null, certificationId: spec.cert ?? null, grader: spec.grader ?? null, grade: spec.grade ?? null, size: spec.size ?? null, condition: (spec.condition as "MINT") ?? "NEAR_MINT", acquisitionCostMinor: usd(spec.cost), status: "IN_STOCK", mediaKeys: [] })
    .returning();
  await recordValuation(db, adminId, { inventoryItemId: item.id, skuId: skuRow.id, referenceValueMinor: usd(spec.value), sellbackOfferMinor: usd(spec.sellback), source: "market-index:demo-v1", sourceRef: `https://index.example/${spec.cert ?? spec.serial ?? code}`, observedAt: new Date(Date.now() - 6 * 3_600_000) });
  return item;
}

export interface SeedCatalog {
  cats: Record<string, typeof s.category.$inferSelect>;
  skus: Record<string, typeof s.productSku.$inferSelect>;
  items: Record<string, typeof s.inventoryItem.$inferSelect>;
}

export async function seedInventory(db: Db, adminId: string): Promise<SeedCatalog> {
  const cats = Object.fromEntries((await db.select().from(s.category)).map((c) => [c.slug, c]));
  const wh = (await db.query.warehouseLocation.findFirst())!;
  const skus: SeedCatalog["skus"] = {};
  const items: SeedCatalog["items"] = {};
  let idx = 1;

  // ---- TCG: "Electric Legends" fictional set. Unique graded cards. ----
  const legends: ItemSpec[] = [
    { name: "Voltaic Drake – Holo Alt Art", sku: "EL-001", grader: "VaultGrade", grade: "10", cert: "VG-10-88120041", cost: "1450.00", value: "2200.00", sellback: "1760.00", accent: "cyan" },
    { name: "Stormcaller Lynx – Full Art", sku: "EL-002", grader: "VaultGrade", grade: "10", cert: "VG-10-88120042", cost: "640.00", value: "980.00", sellback: "784.00", accent: "violet" },
    { name: "Ampere Owl – Rainbow", sku: "EL-003", grader: "VaultGrade", grade: "9.5", cert: "VG-95-88120043", cost: "310.00", value: "460.00", sellback: "368.00", accent: "amber" },
    { name: "Circuit Fox – Reverse Holo", sku: "EL-004", grader: "VaultGrade", grade: "9", cert: "VG-9-88120044", cost: "120.00", value: "185.00", sellback: "148.00", accent: "rose" },
    { name: "Static Hare – Holo", sku: "EL-005", grader: "VaultGrade", grade: "9", cert: "VG-9-88120045", cost: "70.00", value: "110.00", sellback: "88.00", accent: "emerald" },
    { name: "Tesla Moth – Holo", sku: "EL-006", grader: "VaultGrade", grade: "8.5", cert: "VG-85-88120046", cost: "38.00", value: "60.00", sellback: "48.00", accent: "cyan" },
  ];
  for (const spec of legends) {
    const sku = await ensureSku(db, cats.tcg, { sku: spec.sku, name: spec.name, brand: "Electric Legends (fictional set)", isUnique: true, value: spec.value, sellback: spec.sellback, accent: spec.accent });
    skus[spec.sku] = sku;
    items[spec.sku] = await ensureItem(db, sku, wh.id, adminId, spec, idx++);
  }
  // Pooled TCG SKUs.
  skus["EL-PACK"] = await ensureSku(db, cats.tcg, { sku: "EL-PACK", name: "Electric Legends Booster (sealed)", brand: "Electric Legends (fictional set)", isUnique: false, pooledQuantity: 5000, value: "4.50", sellback: "3.60", accent: "violet" });
  skus["EL-SLEEVE"] = await ensureSku(db, cats.tcg, { sku: "EL-SLEEVE", name: "Electric Legends Sleeve Set", brand: "Electric Legends (fictional set)", isUnique: false, pooledQuantity: 5000, value: "1.20", sellback: "0.90", accent: "slate" });
  skus["EL-RARE"] = await ensureSku(db, cats.tcg, { sku: "EL-RARE", name: "Electric Legends Rare (raw, NM)", brand: "Electric Legends (fictional set)", isUnique: false, pooledQuantity: 2000, value: "18.00", sellback: "14.40", accent: "cyan" });
  skus["EL-TIN"] = await ensureSku(db, cats.tcg, { sku: "EL-TIN", name: "Electric Legends Collector Tin", brand: "Electric Legends (fictional set)", isUnique: false, pooledQuantity: 800, value: "42.00", sellback: "33.60", accent: "amber" });

  // ---- Sneakers ----
  const kicks: ItemSpec[] = [
    { name: "Aeroform Runner 'Ion Blue' – US 10", sku: "SNK-001", serial: "AF-IB-10-00417", size: "US 10", condition: "NEW_IN_BOX", cost: "280.00", value: "420.00", sellback: "336.00", accent: "cyan" },
    { name: "Aeroform Runner 'Ember' – US 9.5", sku: "SNK-002", serial: "AF-EM-95-00092", size: "US 9.5", condition: "NEW_IN_BOX", cost: "210.00", value: "320.00", sellback: "256.00", accent: "amber" },
    { name: "Northline Court 'Frost' – US 11", sku: "SNK-003", serial: "NL-FR-11-01188", size: "US 11", condition: "NEW_IN_BOX", cost: "140.00", value: "210.00", sellback: "168.00", accent: "slate" },
    { name: "Aeroform Runner 'Ember' – US 9.5 (raffle prize)", sku: "SNK-004", serial: "AF-EM-95-00093", size: "US 9.5", condition: "NEW_IN_BOX", cost: "210.00", value: "320.00", sellback: "256.00", accent: "amber" },
  ];
  for (const spec of kicks) {
    const sku = await ensureSku(db, cats.sneakers, { sku: spec.sku, name: spec.name, brand: "Aeroform (fictional)", isUnique: true, value: spec.value, sellback: spec.sellback, accent: spec.accent });
    skus[spec.sku] = sku;
    items[spec.sku] = await ensureItem(db, sku, wh.id, adminId, spec, idx++);
  }
  skus["SNK-SOCK"] = await ensureSku(db, cats.sneakers, { sku: "SNK-SOCK", name: "Aeroform Performance Socks (3-pack)", brand: "Aeroform (fictional)", isUnique: false, pooledQuantity: 3000, value: "14.00", sellback: "11.20", accent: "slate" });
  skus["SNK-LACE"] = await ensureSku(db, cats.sneakers, { sku: "SNK-LACE", name: "Premium Lace Kit", brand: "Aeroform (fictional)", isUnique: false, pooledQuantity: 3000, value: "6.00", sellback: "4.80", accent: "rose" });
  skus["SNK-TEE"] = await ensureSku(db, cats.sneakers, { sku: "SNK-TEE", name: "Aeroform Logo Tee", brand: "Aeroform (fictional)", isUnique: false, pooledQuantity: 1500, value: "28.00", sellback: "22.40", accent: "violet" });

  // ---- Watches ----
  const watches: ItemSpec[] = [
    { name: "Meridian Chrono 40 – Steel/Blue", sku: "WCH-001", serial: "MC40-2024-00311", condition: "EXCELLENT", cost: "2100.00", value: "3100.00", sellback: "2480.00", accent: "cyan" },
    { name: "Meridian Field 38 – Bronze", sku: "WCH-002", serial: "MF38-2023-00842", condition: "EXCELLENT", cost: "780.00", value: "1150.00", sellback: "920.00", accent: "amber" },
    { name: "Meridian Quartz 36 – Black", sku: "WCH-003", serial: "MQ36-2024-01207", condition: "NEW", cost: "260.00", value: "390.00", sellback: "312.00", accent: "slate" },
  ];
  for (const spec of watches) {
    const sku = await ensureSku(db, cats.watches, { sku: spec.sku, name: spec.name, brand: "Meridian (fictional)", isUnique: true, value: spec.value, sellback: spec.sellback, accent: spec.accent, shippingRestricted: spec.sku === "WCH-001", note: spec.sku === "WCH-001" ? "Insured courier only; signature required" : undefined });
    skus[spec.sku] = sku;
    items[spec.sku] = await ensureItem(db, sku, wh.id, adminId, spec, idx++);
  }
  skus["WCH-STRAP"] = await ensureSku(db, cats.watches, { sku: "WCH-STRAP", name: "Meridian Leather Strap", brand: "Meridian (fictional)", isUnique: false, pooledQuantity: 1200, value: "45.00", sellback: "36.00", accent: "amber" });
  skus["WCH-TOOL"] = await ensureSku(db, cats.watches, { sku: "WCH-TOOL", name: "Spring-bar Tool Kit", brand: "Meridian (fictional)", isUnique: false, pooledQuantity: 2000, value: "12.00", sellback: "9.60", accent: "slate" });
  skus["WCH-ROLL"] = await ensureSku(db, cats.watches, { sku: "WCH-ROLL", name: "Meridian Travel Roll", brand: "Meridian (fictional)", isUnique: false, pooledQuantity: 900, value: "85.00", sellback: "68.00", accent: "violet" });

  // ---- Gaming & Tech ----
  const tech: ItemSpec[] = [
    { name: "Pulse Handheld – Limited Graphite", sku: "TEC-001", serial: "PH-LG-000512", condition: "NEW_IN_BOX", cost: "420.00", value: "620.00", sellback: "496.00", accent: "violet" },
    { name: "Pulse Pro Controller – Aurora", sku: "TEC-002", serial: "PPC-AU-004421", condition: "NEW_IN_BOX", cost: "95.00", value: "150.00", sellback: "120.00", accent: "cyan" },
  ];
  for (const spec of tech) {
    const sku = await ensureSku(db, cats["gaming-tech"], { sku: spec.sku, name: spec.name, brand: "Pulse (fictional)", isUnique: true, value: spec.value, sellback: spec.sellback, accent: spec.accent });
    skus[spec.sku] = sku;
    items[spec.sku] = await ensureItem(db, sku, wh.id, adminId, spec, idx++);
  }
  skus["TEC-CABLE"] = await ensureSku(db, cats["gaming-tech"], { sku: "TEC-CABLE", name: "Braided USB-C Cable 2m", brand: "Pulse (fictional)", isUnique: false, pooledQuantity: 5000, value: "9.00", sellback: "7.20", accent: "slate" });
  skus["TEC-GRIP"] = await ensureSku(db, cats["gaming-tech"], { sku: "TEC-GRIP", name: "Pulse Thumb Grips", brand: "Pulse (fictional)", isUnique: false, pooledQuantity: 5000, value: "3.00", sellback: "2.40", accent: "rose" });
  skus["TEC-HEAD"] = await ensureSku(db, cats["gaming-tech"], { sku: "TEC-HEAD", name: "Pulse Wireless Headset", brand: "Pulse (fictional)", isUnique: false, pooledQuantity: 600, value: "120.00", sellback: "96.00", accent: "cyan" });
  skus["TEC-GIFT"] = await ensureSku(db, cats["gaming-tech"], { sku: "TEC-GIFT", name: "Pulse Store Credit Card $10", brand: "Pulse (fictional)", isUnique: false, pooledQuantity: 5000, value: "10.00", sellback: "8.00", accent: "emerald" });

  // Battle demo pack items: four pooled SKUs with exact disclosed values.
  skus["BTL-82"] = await ensureSku(db, cats["gaming-tech"], { sku: "BTL-82", name: "Pulse Dock Bundle", brand: "Pulse (fictional)", isUnique: false, pooledQuantity: 500, value: "82.00", sellback: "70.00", accent: "violet" });
  skus["BTL-61"] = await ensureSku(db, cats["gaming-tech"], { sku: "BTL-61", name: "Pulse Carry Case Pro", brand: "Pulse (fictional)", isUnique: false, pooledQuantity: 500, value: "61.00", sellback: "52.00", accent: "cyan" });
  skus["BTL-49"] = await ensureSku(db, cats["gaming-tech"], { sku: "BTL-49", name: "Pulse Charging Stand", brand: "Pulse (fictional)", isUnique: false, pooledQuantity: 500, value: "49.00", sellback: "42.00", accent: "amber" });
  skus["BTL-24"] = await ensureSku(db, cats["gaming-tech"], { sku: "BTL-24", name: "Pulse Screen Shield", brand: "Pulse (fictional)", isUnique: false, pooledQuantity: 500, value: "24.00", sellback: "16.00", accent: "rose" });

  return { cats, skus, items };
}

interface PackSpec {
  slug: string;
  name: string;
  tagline: string;
  category: string;
  price: string;
  accent: string;
  tags: string[];
  outcomes: Array<{ label: string; tier: string; sku: string; item?: string; qty: number; value?: string; sellback?: string }>;
}

const PACKS: PackSpec[] = [
  { slug: "electric-legends", name: "Electric Legends", tagline: "Six graded grails from the fictional Electric Legends set. Finite run of 400.", category: "tcg", price: "25.00", accent: "cyan", tags: ["tcg", "new", "live", "grail"], outcomes: [
    { label: "Voltaic Drake – Holo Alt Art (VG 10)", tier: "GRAIL", sku: "EL-001", item: "EL-001", qty: 1 },
    { label: "Stormcaller Lynx – Full Art (VG 10)", tier: "GRAIL", sku: "EL-002", item: "EL-002", qty: 1 },
    { label: "Ampere Owl – Rainbow (VG 9.5)", tier: "RARE", sku: "EL-003", item: "EL-003", qty: 1 },
    { label: "Circuit Fox – Reverse Holo (VG 9)", tier: "RARE", sku: "EL-004", item: "EL-004", qty: 1 },
    { label: "Static Hare – Holo (VG 9)", tier: "RARE", sku: "EL-005", item: "EL-005", qty: 1 },
    { label: "Tesla Moth – Holo (VG 8.5)", tier: "UNCOMMON", sku: "EL-006", item: "EL-006", qty: 1 },
    { label: "Collector Tin", tier: "UNCOMMON", sku: "EL-TIN", qty: 24 },
    { label: "Raw Rare (NM)", tier: "UNCOMMON", sku: "EL-RARE", qty: 90 },
    { label: "Sealed Booster", tier: "COMMON", sku: "EL-PACK", qty: 280 },
  ] },
  { slug: "spark-starter", name: "Spark Starter", tagline: "Entry-level TCG pack. Every pull is a real sealed product.", category: "tcg", price: "1.00", accent: "violet", tags: ["tcg", "under-10", "best-value"], outcomes: [
    { label: "Raw Rare (NM)", tier: "RARE", sku: "EL-RARE", qty: 20 },
    { label: "Sealed Booster", tier: "UNCOMMON", sku: "EL-PACK", qty: 100 },
    { label: "Sleeve Set", tier: "COMMON", sku: "EL-SLEEVE", qty: 880 },
  ] },
  { slug: "booster-bundle", name: "Booster Bundle", tagline: "Sealed boosters with a shot at a collector tin.", category: "tcg", price: "5.00", accent: "amber", tags: ["tcg", "under-10"], outcomes: [
    { label: "Collector Tin", tier: "RARE", sku: "EL-TIN", qty: 30 },
    { label: "Raw Rare (NM)", tier: "UNCOMMON", sku: "EL-RARE", qty: 120 },
    { label: "Sealed Booster", tier: "COMMON", sku: "EL-PACK", qty: 850 },
  ] },
  { slug: "aeroform-drop", name: "Aeroform Drop", tagline: "Three authenticated deadstock pairs headline this sneaker drop.", category: "sneakers", price: "40.00", accent: "cyan", tags: ["sneakers", "live", "ending-soon"], outcomes: [
    { label: "Aeroform Runner 'Ion Blue' – US 10", tier: "GRAIL", sku: "SNK-001", item: "SNK-001", qty: 1 },
    { label: "Aeroform Runner 'Ember' – US 9.5", tier: "GRAIL", sku: "SNK-002", item: "SNK-002", qty: 1 },
    { label: "Northline Court 'Frost' – US 11", tier: "RARE", sku: "SNK-003", item: "SNK-003", qty: 1 },
    { label: "Aeroform Logo Tee", tier: "UNCOMMON", sku: "SNK-TEE", qty: 17 },
    { label: "Performance Socks (3-pack)", tier: "COMMON", sku: "SNK-SOCK", qty: 40 },
  ] },
  { slug: "lace-up", name: "Lace Up", tagline: "Sneaker accessories under ten dollars.", category: "sneakers", price: "8.00", accent: "rose", tags: ["sneakers", "under-10"], outcomes: [
    { label: "Aeroform Logo Tee", tier: "RARE", sku: "SNK-TEE", qty: 20 },
    { label: "Performance Socks (3-pack)", tier: "UNCOMMON", sku: "SNK-SOCK", qty: 60 },
    { label: "Premium Lace Kit", tier: "COMMON", sku: "SNK-LACE", qty: 120 },
  ] },
  { slug: "meridian-vault", name: "Meridian Vault", tagline: "Three serviced Meridian timepieces with papers. Finite run of 120.", category: "watches", price: "250.00", accent: "amber", tags: ["watches", "live", "grail"], outcomes: [
    { label: "Meridian Chrono 40 – Steel/Blue", tier: "GRAIL", sku: "WCH-001", item: "WCH-001", qty: 1 },
    { label: "Meridian Field 38 – Bronze", tier: "GRAIL", sku: "WCH-002", item: "WCH-002", qty: 1 },
    { label: "Meridian Quartz 36 – Black", tier: "RARE", sku: "WCH-003", item: "WCH-003", qty: 1 },
    { label: "Meridian Travel Roll", tier: "UNCOMMON", sku: "WCH-ROLL", qty: 30 },
    { label: "Meridian Leather Strap", tier: "COMMON", sku: "WCH-STRAP", qty: 87 },
  ] },
  { slug: "strap-swap", name: "Strap Swap", tagline: "Watch accessories with a travel roll upside.", category: "watches", price: "15.00", accent: "slate", tags: ["watches", "new"], outcomes: [
    { label: "Meridian Travel Roll", tier: "RARE", sku: "WCH-ROLL", qty: 3 },
    { label: "Meridian Leather Strap", tier: "UNCOMMON", sku: "WCH-STRAP", qty: 10 },
    { label: "Spring-bar Tool Kit", tier: "COMMON", sku: "WCH-TOOL", qty: 87 },
  ] },
  { slug: "pulse-limited", name: "Pulse Limited", tagline: "A limited Graphite handheld headlines this tech drop.", category: "gaming-tech", price: "30.00", accent: "violet", tags: ["gaming-tech", "live", "new"], outcomes: [
    { label: "Pulse Handheld – Limited Graphite", tier: "GRAIL", sku: "TEC-001", item: "TEC-001", qty: 1 },
    { label: "Pulse Pro Controller – Aurora", tier: "RARE", sku: "TEC-002", item: "TEC-002", qty: 1 },
    { label: "Pulse Wireless Headset", tier: "UNCOMMON", sku: "TEC-HEAD", qty: 6 },
    { label: "Braided USB-C Cable", tier: "COMMON", sku: "TEC-CABLE", qty: 32 },
  ] },
  { slug: "pocket-pulse", name: "Pocket Pulse", tagline: "Two-dollar tech pack. Real accessories every time.", category: "gaming-tech", price: "2.00", accent: "emerald", tags: ["gaming-tech", "under-10", "best-value"], outcomes: [
    { label: "Braided USB-C Cable", tier: "RARE", sku: "TEC-CABLE", qty: 25 },
    { label: "Store Credit Card $10", tier: "RARE", sku: "TEC-GIFT", qty: 10 },
    { label: "Pulse Thumb Grips", tier: "COMMON", sku: "TEC-GRIP", qty: 265 },
  ] },
  { slug: "headset-hunt", name: "Headset Hunt", tagline: "Chase a wireless headset; floor is store credit.", category: "gaming-tech", price: "12.00", accent: "cyan", tags: ["gaming-tech", "best-value"], outcomes: [
    { label: "Pulse Wireless Headset", tier: "RARE", sku: "TEC-HEAD", qty: 12 },
    { label: "Braided USB-C Cable", tier: "UNCOMMON", sku: "TEC-CABLE", qty: 40 },
    { label: "Store Credit Card $10", tier: "COMMON", sku: "TEC-GIFT", qty: 148 },
  ] },
  { slug: "tin-collector", name: "Tin Collector", tagline: "Collector tins and raw rares. Finite run of 200.", category: "tcg", price: "20.00", accent: "amber", tags: ["tcg", "ending-soon"], outcomes: [
    { label: "Collector Tin", tier: "RARE", sku: "EL-TIN", qty: 60 },
    { label: "Raw Rare (NM)", tier: "COMMON", sku: "EL-RARE", qty: 140 },
  ] },
  { slug: "circuit-clash", name: "Circuit Clash", tagline: "Battle-tuned pack: four disclosed accessory outcomes.", category: "gaming-tech", price: "50.00", accent: "rose", tags: ["gaming-tech", "battle"], outcomes: [
    { label: "Pulse Dock Bundle", tier: "RARE", sku: "BTL-82", qty: 5 },
    { label: "Pulse Carry Case Pro", tier: "UNCOMMON", sku: "BTL-61", qty: 5 },
    { label: "Pulse Charging Stand", tier: "UNCOMMON", sku: "BTL-49", qty: 5 },
    { label: "Pulse Screen Shield", tier: "COMMON", sku: "BTL-24", qty: 5 },
  ] },
];

export async function seedPacks(db: Db, catalog: SeedCatalog, catalogUserId: string, financeUserId: string) {
  const out: Record<string, { packId: string; versionId: string; slug: string }> = {};
  for (const spec of PACKS) {
    const existing = await db.query.pack.findFirst({ where: eq(s.pack.slug, spec.slug) });
    if (existing?.currentVersionId) {
      out[spec.slug] = { packId: existing.id, versionId: existing.currentVersionId, slug: spec.slug };
      continue;
    }
    const price = usd(spec.price);
    const actor = { userId: catalogUserId, role: "CATALOG_MANAGER" };
    const { pack, version } = await createPackDraft(db, actor, { slug: spec.slug, name: spec.name, tagline: spec.tagline, categoryId: catalog.cats[spec.category].id, priceMinor: price, accent: spec.accent, tags: spec.tags, kind: "FINITE" });
    // Build outcome inputs and use the solver to hit exactly 90.00% sell-back RTP on the common outcome.
    const inputs: OutcomeInput[] = spec.outcomes.map((o) => {
      const sku = catalog.skus[o.sku];
      return { label: o.label, quantity: o.qty, referenceValueMinor: o.value ? usd(o.value) : sku.defaultReferenceValueMinor, sellbackOfferMinor: o.sellback ? usd(o.sellback) : sku.defaultSellbackOfferMinor, isUniqueItem: !!o.item };
    });
    const suggestions = suggestRtpAdjustments(price, inputs, { targetRtpBp: 9000, toleranceBp: 50, basis: "SELLBACK" });
    const valueFix = suggestions.find((x) => x.kind === "ADJUST_COMMON_VALUE");
    const qtyFix = suggestions.find((x) => x.kind === "ADJUST_COMMON_QUANTITY");
    if (valueFix && valueFix.outcomeIndex !== undefined) {
      inputs[valueFix.outcomeIndex] = { ...inputs[valueFix.outcomeIndex], sellbackOfferMinor: valueFix.newSellbackOfferMinor!, referenceValueMinor: valueFix.newReferenceValueMinor! };
    } else if (qtyFix && qtyFix.outcomeIndex !== undefined) {
      console.warn(`seed: ${spec.slug} balanced by quantity: ${qtyFix.description}`);
      inputs[qtyFix.outcomeIndex] = { ...inputs[qtyFix.outcomeIndex], quantity: qtyFix.newQuantity! };
      spec.outcomes[qtyFix.outcomeIndex].qty = qtyFix.newQuantity!;
    } else if (suggestions[0].kind !== "ALREADY_ON_TARGET") {
      throw new Error(`seed: cannot balance ${spec.slug}: ${suggestions.map((x) => x.description).join("; ")}`);
    }
    for (let i = 0; i < spec.outcomes.length; i++) {
      const o = spec.outcomes[i];
      const sku = catalog.skus[o.sku];
      const item = o.item ? catalog.items[o.item] : null;
      const val = item ? await db.query.valuationSnapshot.findFirst({ where: eq(s.valuationSnapshot.inventoryItemId, item.id) }) : null;
      await upsertOutcome(db, actor, version.id, { label: o.label, tier: o.tier, skuId: sku.id, inventoryItemId: item?.id ?? null, quantity: o.qty, referenceValueMinor: inputs[i].referenceValueMinor, sellbackOfferMinor: inputs[i].sellbackOfferMinor, condition: item?.condition ?? "NEW", shippingEligible: !sku.shippingRestricted, valuationSnapshotId: val?.id ?? null });
    }
    await submitForApproval(db, actor, version.id);
    await reviewVersion(db, { userId: financeUserId, role: "FINANCE" }, version.id, "APPROVED", "Seed approval: economics reviewed");
    await publishVersion(db, actor, version.id);
    out[spec.slug] = { packId: pack.id, versionId: version.id, slug: spec.slug };
  }
  return out;
}

export async function seedRace(db: Db, policyId: string, adminId: string) {
  const existing = await db.query.race.findFirst({ where: eq(s.race.status, "ACTIVE") });
  if (existing) return existing;
  const startsAt = new Date(Date.now() - 2 * 86_400_000);
  startsAt.setUTCMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 7 * 86_400_000);
  const prizes: Array<{ rank: number; amountMinor: bigint }> = [];
  for (let r = 1; r <= 100; r++) {
    const amt = r === 1 ? "500.00" : r === 2 ? "250.00" : r === 3 ? "150.00" : r <= 10 ? "50.00" : r <= 25 ? "20.00" : r <= 50 ? "10.00" : "5.00";
    prizes.push({ rank: r, amountMinor: usd(amt) });
  }
  return createRace(db, adminId, { slug: `weekly-${startsAt.toISOString().slice(0, 10)}`, name: "Weekly Collector Race", timezone: "America/New_York", startsAt, endsAt, scoringPolicyId: policyId, prizes });
}

export async function seedPastRace(db: Db, policyId: string, adminId: string, users: Record<string, typeof s.user.$inferSelect>) {
  const existing = await db.query.race.findFirst({ where: eq(s.race.status, "SETTLED") });
  if (existing) return existing;
  const startsAt = new Date(Date.now() - 16 * 86_400_000);
  startsAt.setUTCMinutes(0, 0, 0);
  const endsAt = new Date(startsAt.getTime() + 7 * 86_400_000);
  const r = await createRace(db, adminId, { slug: `weekly-${startsAt.toISOString().slice(0, 10)}`, name: "Weekly Collector Race", timezone: "America/New_York", startsAt, endsAt, scoringPolicyId: policyId, prizes: [{ rank: 1, amountMinor: usd("200.00") }, { rank: 2, amountMinor: usd("100.00") }, { rank: 3, amountMinor: usd("50.00") }] });
  await db.update(s.race).set({ status: "ACTIVE" }).where(eq(s.race.id, r.id));
  const entrants = [users["nova@demo.lootbox"], users["kai@demo.lootbox"], users["sol@demo.lootbox"], users["customer@demo.lootbox"]];
  const pts = [1250, 980, 640, 310];
  for (let i = 0; i < entrants.length; i++) {
    const at = new Date(startsAt.getTime() + (i + 1) * 3_600_000);
    await db.insert(s.raceScoreEvent).values({ raceId: r.id, userId: entrants[i].id, sourceType: "PROMO_ENTRY", sourceId: crypto.randomUUID(), points: pts[i], explanation: "Historical seed entry", occurredAt: at });
    await db.insert(s.raceStanding).values({ raceId: r.id, userId: entrants[i].id, points: pts[i], lastQualifyingAt: at });
  }
  const { lockRace, fraudReview, settleRace } = await import("@/domain/races");
  await lockRace(db, adminId, r.id);
  await fraudReview(db, adminId, r.id);
  await settleRace(db, adminId, r.id);
  return r;
}

export async function seedActivity(db: Db, users: Record<string, typeof s.user.$inferSelect>, packs: Record<string, { versionId: string }>) {
  const plan: Array<[string, string, number]> = [
    ["customer@demo.lootbox", "spark-starter", 3],
    ["customer@demo.lootbox", "pocket-pulse", 2],
    ["customer@demo.lootbox", "electric-legends", 2],
    ["customer@demo.lootbox", "headset-hunt", 1],
    ["nova@demo.lootbox", "booster-bundle", 4],
    ["nova@demo.lootbox", "aeroform-drop", 1],
    ["kai@demo.lootbox", "pulse-limited", 2],
    ["kai@demo.lootbox", "spark-starter", 5],
    ["sol@demo.lootbox", "tin-collector", 1],
    ["sol@demo.lootbox", "lace-up", 3],
  ];
  const existing = await db.select({ c: sql<number>`COUNT(*)::int` }).from(s.opening);
  if (Number(existing[0].c) > 0) return;
  for (const [email, slug, n] of plan) {
    for (let i = 0; i < n; i++) await openPack(db, { userId: users[email].id, packVersionId: packs[slug].versionId, idempotencyKey: `seed:${email}:${slug}:${i}` });
  }
  await drainOutbox(db, 1000);
}

/** Four-player Crazy Battle with totals $82, $61, $24, $49 where $24 wins everything. */
export async function seedCrazyBattle(db: Db, users: Record<string, typeof s.user.$inferSelect>, packs: Record<string, { versionId: string }>) {
  const existing = await db.query.battle.findFirst({ where: and(eq(s.battle.mode, "CRAZY"), eq(s.battle.status, "SETTLED")) });
  if (existing) return existing;
  const players = ["customer@demo.lootbox", "nova@demo.lootbox", "kai@demo.lootbox", "sol@demo.lootbox"].map((e) => users[e]);
  const clientSeeds = ["avery-luck", "nova-seed", "kai-roll", "sol-flare"];
  for (let i = 0; i < players.length; i++) await setClientSeed(db, players[i].id, clientSeeds[i]);
  const version = (await db.query.packVersion.findFirst({ where: eq(s.packVersion.id, packs["circuit-clash"].versionId) }))!;
  const outcomes = await db.select().from(s.packOutcome).where(eq(s.packOutcome.packVersionId, version.id)).orderBy(s.packOutcome.position);
  const b = await createBattle(db, players[0].id, { mode: "CRAZY", speed: "NORMAL", isPrivate: false, seats: 4, packVersionIds: [version.id], idempotencyKey: "seed-crazy-battle" });
  // Find a server seed that produces the desired disclosed outcome sequence ($82, $61, $24, $49). All settlement still runs through the real engine.
  const target = [usd("82.00"), usd("61.00"), usd("24.00"), usd("49.00")].map((v) => outcomes.findIndex((o) => o.referenceValueMinor === v));
  const combined = clientSeeds.join("|").slice(0, 64);
  let found: string | null = null;
  for (let attempt = 0; attempt < 200_000 && !found; attempt++) {
    const candidate = generateServerSeed();
    const weights = outcomes.map((o) => o.quantityRemaining);
    let ok = true;
    for (let seat = 0; seat < 4; seat++) {
      const d = draw({ serverSeed: candidate, clientSeed: combined, nonce: seat, scopeId: version.id, manifestHash: version.manifestHash!, range: weights.reduce((a, c) => a + c, 0) });
      const m = mapIndexToOutcome(d.index, weights);
      if (m.outcomeIndex !== target[seat]) {
        ok = false;
        break;
      }
      weights[m.outcomeIndex] -= 1;
    }
    if (ok) found = candidate;
  }
  if (!found) throw new Error("seed: could not find a battle seed for the demo sequence");
  await db.update(s.fairnessSeed).set({ serverSeedEncrypted: encryptString(found, `seed:BATTLE:${b.id}`), serverSeedHash: serverSeedHash(found) }).where(eq(s.fairnessSeed.id, b.seedId!));
  await db.update(s.battle).set({ serverSeedHash: serverSeedHash(found) }).where(eq(s.battle.id, b.id));
  for (let i = 1; i < players.length; i++) await joinBattle(db, players[i].id, b.id, null, `seed-crazy-join-${i}`);
  await drainOutbox(db, 1000);
  const settled = (await db.query.battle.findFirst({ where: eq(s.battle.id, b.id) }))!;
  const seats = await db.select().from(s.battleSeat).where(eq(s.battleSeat.battleId, b.id)).orderBy(s.battleSeat.seatIndex);
  const totals = seats.map((x) => x.totalValueMinor.toString());
  if (totals.join(",") !== "8200,6100,2400,4900" || settled.winnerUserIds[0] !== players[2].id) throw new Error(`seed: crazy battle totals unexpected: ${totals.join(",")}`);
  return settled;
}

export async function seedRaffles(db: Db, users: Record<string, typeof s.user.$inferSelect>, catalog: SeedCatalog, adminId: string) {
  const done = await db.query.raffle.findFirst({ where: eq(s.raffle.status, "DRAWN") });
  const upcoming = await db.query.raffle.findFirst({ where: eq(s.raffle.status, "UPCOMING") });
  if (!upcoming) {
    const opensAt = new Date(Date.now() + 2 * 86_400_000);
    await createRaffle(db, adminId, {
      slug: "aeroform-ember-raffle",
      name: "Aeroform Runner 'Ember' Raffle",
      description: "One authenticated pair, US 9.5, new in box. Free entry; no purchase necessary.",
      entryMode: "FREE",
      maxTickets: 2000,
      maxTicketsPerUser: 5,
      ticketPriceMinor: 0n,
      winnersCount: 1,
      amoeEnabled: true,
      amoeInstructions: "Mail a postcard with your account email to Lootbox AMOE, PO Box 0000, Austin TX (demo).",
      allowedJurisdictions: [],
      opensAt,
      closesAt: new Date(opensAt.getTime() + 5 * 86_400_000),
      drawsAt: new Date(opensAt.getTime() + 5 * 86_400_000 + 3_600_000),
      claimDeadlineAt: new Date(opensAt.getTime() + 20 * 86_400_000),
      publicRandomnessSource: "NIST Randomness Beacon pulse at draw time (declared in advance)",
      prizes: [{ rank: 1, title: "Aeroform Runner 'Ember' – US 9.5", condition: "NEW_IN_BOX", referenceValueMinor: usd("320.00"), valueSource: "market-index:demo-v1", valueObservedAt: new Date(), inventoryItemId: catalog.items["SNK-004"].id }],
    });
  }
  if (!done) {
    const opensAt = new Date(Date.now() - 12 * 86_400_000);
    const r = await createRaffle(db, adminId, {
      slug: "meridian-quartz-raffle",
      name: "Meridian Quartz 36 Raffle",
      description: "Completed community raffle. Fully verifiable below.",
      entryMode: "FREE",
      maxTickets: 500,
      maxTicketsPerUser: 10,
      ticketPriceMinor: 0n,
      winnersCount: 1,
      amoeEnabled: true,
      allowedJurisdictions: [],
      opensAt,
      closesAt: new Date(Date.now() + 3_600_000), // temporarily open so seed entries pass validation; rewritten below
      drawsAt: new Date(Date.now() + 2 * 3_600_000),
      claimDeadlineAt: new Date(Date.now() + 30 * 86_400_000),
      publicRandomnessSource: "Public blockchain block hash declared before close (demo value)",
      prizes: [{ rank: 1, title: "Meridian Quartz 36 – Black", condition: "NEW", referenceValueMinor: usd("390.00"), valueSource: "market-index:demo-v1", valueObservedAt: new Date(), inventoryItemId: null }],
    });
    const entrants = ["customer@demo.lootbox", "nova@demo.lootbox", "kai@demo.lootbox", "sol@demo.lootbox", "fresh@demo.lootbox"];
    const counts = [5, 3, 7, 2, 1];
    for (let i = 0; i < entrants.length; i++) {
      const u = users[entrants[i]];
      if (entrants[i] === "fresh@demo.lootbox") {
        await enterRaffle(db, u.id, r.id, counts[i], "AMOE", { idempotencyKey: `seed-amoe-${u.id}`, sourceRef: "POSTCARD-0001", actorUserId: adminId });
      } else {
        await enterRaffle(db, u.id, r.id, counts[i], "FREE", { idempotencyKey: `seed-raffle-${u.id}` });
      }
    }
    await closeRaffle(db, adminId, r.id);
    await drawRaffle(db, adminId, r.id, "00000000000000000002a7c1f4e9b3d8c6a5f2e1d0c9b8a7f6e5d4c3b2a1f0e9", "demo-chain block #900123 hash (declared before close)");
    await db.update(s.raffle).set({ closesAt: new Date(Date.now() - 5 * 86_400_000), drawsAt: new Date(Date.now() - 5 * 86_400_000 + 3_600_000) }).where(eq(s.raffle.id, r.id));
  }
}

export async function seedAll(db: Db) {
  const { policy } = await seedBase(db);
  const users = await seedUsers(db);
  const admin = users["admin@demo.lootbox"];
  const catalog = await seedInventory(db, admin.id);
  const packs = await seedPacks(db, catalog, users["catalog@demo.lootbox"].id, users["finance@demo.lootbox"].id);
  await seedRace(db, policy.id, admin.id);
  await seedActivity(db, users, packs);
  await seedCrazyBattle(db, users, packs);
  await seedRaffles(db, users, catalog, admin.id);
  await seedPastRace(db, policy.id, admin.id, users);
  await drainOutbox(db, 1000);
  return { users, packs };
}
