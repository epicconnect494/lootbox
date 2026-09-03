import { sql, eq } from "drizzle-orm";
import { getDb, getPool, type Db } from "@/db/client";
import * as s from "@/db/schema";
import { seedBase } from "@/db/seed";
import { hashPassword } from "@/lib/crypto";
import { getOrCreateUserAccount, getSystemAccount, postTransaction } from "@/domain/ledger";
import { getOrCreateUserSeed } from "@/domain/openings";
import { createPackDraft, publishVersion, reviewVersion, submitForApproval, upsertOutcome } from "@/domain/packs";
import { recordValuation } from "@/domain/admin";
import type { RoleKey } from "@/lib/permissions";

export const db: Db = getDb();

export async function truncateAll() {
  const rows = await db.execute<{ tablename: string }>(sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '__drizzle%'`);
  const names = rows.rows.map((r) => `"${r.tablename}"`).join(", ");
  if (names) await db.execute(sql.raw(`TRUNCATE ${names} RESTART IDENTITY CASCADE`));
}

export async function fresh() {
  await truncateAll();
  return seedBase(db);
}

export async function closePool() {
  await getPool().end();
}

export interface TestUser {
  id: string;
  email: string;
}

export async function makeUser(opts: { email?: string; role?: RoleKey; verified?: boolean; fundMinor?: bigint; jurisdiction?: string | null; dob?: Date | null } = {}): Promise<TestUser> {
  const email = opts.email ?? `u${Math.random().toString(36).slice(2, 10)}@test.local`;
  const [u] = await db.insert(s.user).values({ email, passwordHash: hashPassword("test-password-123"), displayName: email.split("@")[0], jurisdictionCode: opts.jurisdiction === undefined ? "DEMO" : opts.jurisdiction, dateOfBirth: opts.dob === undefined ? new Date("1990-01-01") : opts.dob }).returning();
  const roles = await db.select().from(s.role);
  await db.insert(s.userRole).values({ userId: u.id, roleId: roles.find((r) => r.key === "CUSTOMER")!.id });
  if (opts.role && opts.role !== "CUSTOMER") await db.insert(s.userRole).values({ userId: u.id, roleId: roles.find((r) => r.key === opts.role)!.id });
  await getOrCreateUserAccount(db, u.id);
  await getOrCreateUserSeed(db, u.id);
  if (opts.verified ?? true) {
    await db.insert(s.userVerification).values([
      { userId: u.id, type: "AGE", status: "APPROVED", provider: "mock" },
      { userId: u.id, type: "IDENTITY", status: "APPROVED", provider: "mock" },
    ]);
  }
  if (opts.fundMinor && opts.fundMinor > 0n) await fund(u.id, opts.fundMinor);
  return { id: u.id, email };
}

export async function fund(userId: string, amountMinor: bigint) {
  await db.transaction(async (tx) => {
    const acct = await getOrCreateUserAccount(tx, userId);
    const clearing = await getSystemAccount(tx, "SYSTEM_PAYMENT_CLEARING");
    await postTransaction(tx, { kind: "DEPOSIT", description: "test fund", entries: [{ accountId: clearing.id, amountMinor: -amountMinor }, { accountId: acct.id, amountMinor }] });
  });
}

export async function balance(userId: string): Promise<bigint> {
  const acct = await db.query.walletAccount.findFirst({ where: eq(s.walletAccount.userId, userId) });
  return acct?.balanceMinor ?? 0n;
}

export interface OutcomeSpec {
  label: string;
  qty: number;
  value: bigint;
  sellback: bigint;
  unique?: boolean;
  tier?: string;
}

/** Creates SKUs/items and a published pack version through the real workflow. Outcomes must already satisfy 90% ± 0.5% sell-back RTP unless `skipValidation`. */
export async function makePack(opts: { price: bigint; outcomes: OutcomeSpec[]; slug?: string; catalogUser?: TestUser; financeUser?: TestUser; publish?: boolean }) {
  const cat = (await db.query.category.findFirst())!;
  const wh = (await db.query.warehouseLocation.findFirst())!;
  const catalog = opts.catalogUser ?? (await makeUser({ role: "CATALOG_MANAGER" }));
  const finance = opts.financeUser ?? (await makeUser({ role: "FINANCE" }));
  const slug = opts.slug ?? `pack-${Math.random().toString(36).slice(2, 8)}`;
  const actor = { userId: catalog.id, role: "CATALOG_MANAGER" };
  const { pack, version } = await createPackDraft(db, actor, { slug, name: slug, categoryId: cat.id, priceMinor: opts.price });
  const items: Array<string | null> = [];
  for (const o of opts.outcomes) {
    const [sku] = await db.insert(s.productSku).values({ sku: `${slug}-${o.label}`.slice(0, 60), categoryId: cat.id, name: o.label, isUnique: !!o.unique, pooledQuantity: o.unique ? 0 : o.qty * 10, defaultReferenceValueMinor: o.value, defaultSellbackOfferMinor: o.sellback }).returning();
    let itemId: string | null = null;
    if (o.unique) {
      const [item] = await db.insert(s.inventoryItem).values({ itemCode: `${slug}-${o.label}`.slice(0, 30) + Math.random().toString(36).slice(2, 5), skuId: sku.id, warehouseId: wh.id, certificationId: `CERT-${Math.random().toString(36).slice(2, 10)}`, grader: "VG", grade: "10", acquisitionCostMinor: o.value / 2n, status: "IN_STOCK" }).returning();
      itemId = item.id;
      await recordValuation(db, catalog.id, { inventoryItemId: item.id, skuId: sku.id, referenceValueMinor: o.value, sellbackOfferMinor: o.sellback, source: "test" });
    }
    items.push(itemId);
    const val = itemId ? await db.query.valuationSnapshot.findFirst({ where: eq(s.valuationSnapshot.inventoryItemId, itemId) }) : null;
    await upsertOutcome(db, actor, version.id, { label: o.label, tier: o.tier ?? "COMMON", skuId: sku.id, inventoryItemId: itemId, quantity: o.qty, referenceValueMinor: o.value, sellbackOfferMinor: o.sellback, valuationSnapshotId: val?.id ?? null });
  }
  if (opts.publish ?? true) {
    await submitForApproval(db, actor, version.id);
    await reviewVersion(db, { userId: finance.id, role: "FINANCE" }, version.id, "APPROVED", "test");
    await publishVersion(db, actor, version.id);
  }
  const v = (await db.query.packVersion.findFirst({ where: eq(s.packVersion.id, version.id) }))!;
  return { pack, version: v, items, catalog, finance };
}

/** Standard 90.00% sell-back pack: price $10, 1 grail + 99 commons. sellback: 1600 + 99*747 = 89953 / 100000 = 89.95% */
export function standardOutcomes(): OutcomeSpec[] {
  return [
    { label: "grail", qty: 1, value: 20000n, sellback: 16000n, unique: true, tier: "GRAIL" },
    { label: "common", qty: 99, value: 900n, sellback: 747n },
  ];
}

/** Drizzle wraps PG errors ("Failed query: ..."); the real message lives in `cause`. */
export async function dbError(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "";
  } catch (e) {
    const err = e as { message?: string; cause?: { message?: string } };
    return `${err.cause?.message ?? ""} ${err.message ?? ""}`;
  }
}
