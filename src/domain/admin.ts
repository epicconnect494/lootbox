import { and, desc, eq, gte, ilike, inArray, or, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { adminAuditEvent, battle, category, chargeback, inventoryItem, ledgerEntry, ledgerTransaction, opening, pack, packVersion, payment, productSku, raffle, race, refund, riskEvent, shipment, user, userRole, role, userVerification, walletAccount, vaultHolding, valuationSnapshot, sellbackQuote, marketplaceListing } from "@/db/schema";
import { audit } from "@/lib/audit";
import { err } from "@/lib/errors";

export async function dashboard(db: DbOrTx) {
  const since7 = new Date(Date.now() - 7 * 86_400_000);
  const sales = await db.execute<{ gross: string; opens: string; merch: string; sellback: string; sold_back: string; sold_back_value: string }>(sql`
    SELECT COALESCE(SUM(price_minor),0)::text AS gross, COUNT(*)::text AS opens,
           COALESCE(SUM(reference_value_minor),0)::text AS merch, COALESCE(SUM(sellback_offer_minor),0)::text AS sellback,
           (SELECT COUNT(*) FROM sellback_quote WHERE status = 'ACCEPTED')::text AS sold_back,
           (SELECT COALESCE(SUM(offer_minor),0) FROM sellback_quote WHERE status = 'ACCEPTED')::text AS sold_back_value
    FROM opening WHERE status = 'SETTLED' AND source <> 'BATTLE'`);
  const s = sales.rows[0];
  const gross = BigInt(s.gross);
  const realizedMerchRtpBp = gross > 0n ? Number((BigInt(s.merch) * 10000n) / gross) : 0;
  const realizedSellbackRtpBp = gross > 0n ? Number((BigInt(s.sellback) * 10000n) / gross) : 0;
  const liability = await db.execute<{ merch: string; sellback: string }>(sql`
    SELECT COALESCE(SUM(po.quantity_remaining * po.reference_value_minor),0)::text AS merch, COALESCE(SUM(po.quantity_remaining * po.sellback_offer_minor),0)::text AS sellback
    FROM pack_outcome po JOIN pack_version pv ON pv.id = po.pack_version_id WHERE pv.status IN ('PUBLISHED','PAUSED')`);
  const vaultLiability = await db.execute<{ merch: string; sellback: string; items: string }>(sql`SELECT COALESCE(SUM(reference_value_minor),0)::text AS merch, COALESCE(SUM(sellback_offer_minor),0)::text AS sellback, COUNT(*)::text AS items FROM vault_holding WHERE status = 'ACTIVE'`);
  const inventory = await db.execute<{ status: string; c: string; cost: string }>(sql`SELECT status, COUNT(*)::text AS c, COALESCE(SUM(acquisition_cost_minor),0)::text AS cost FROM inventory_item GROUP BY status ORDER BY status`);
  const recent = await db.execute<{ day: string; gross: string; opens: string }>(sql`SELECT to_char(created_at, 'YYYY-MM-DD') AS day, COALESCE(SUM(price_minor),0)::text AS gross, COUNT(*)::text AS opens FROM opening WHERE created_at >= ${since7} AND status='SETTLED' GROUP BY 1 ORDER BY 1`);
  const packs = await db.execute<{ status: string; c: string }>(sql`SELECT status, COUNT(*)::text AS c FROM pack_version GROUP BY status`);
  const battles = await db.execute<{ status: string; c: string }>(sql`SELECT status, COUNT(*)::text AS c FROM battle GROUP BY status`);
  const activeRace = await db.query.race.findFirst({ where: inArray(race.status, ["ACTIVE", "REVIEW", "LOCKED"]), orderBy: desc(race.startsAt) });
  const raffles = await db.select().from(raffle).where(inArray(raffle.status, ["OPEN", "CLOSED", "UPCOMING"]));
  const users = await db.execute<{ total: string; verified: string }>(sql`SELECT (SELECT COUNT(*) FROM "user" WHERE deleted_at IS NULL)::text AS total, (SELECT COUNT(DISTINCT user_id) FROM user_verification WHERE type='IDENTITY' AND status='APPROVED')::text AS verified`);
  const acquisitionOfOpened = await db.execute<{ cost: string }>(sql`SELECT COALESCE(SUM(ii.acquisition_cost_minor),0)::text AS cost FROM opening o JOIN inventory_item ii ON ii.id = o.inventory_item_id WHERE o.status='SETTLED' AND o.source <> 'BATTLE'`);
  const contribution = gross - BigInt(acquisitionOfOpened.rows[0].cost);
  return {
    sales: { grossMinor: gross, opens: Number(s.opens), realizedMerchRtpBp, realizedSellbackRtpBp, soldBackCount: Number(s.sold_back), soldBackValueMinor: BigInt(s.sold_back_value), contributionMarginMinor: contribution },
    liability: { remainingMerchMinor: BigInt(liability.rows[0].merch), remainingSellbackMinor: BigInt(liability.rows[0].sellback), vaultMerchMinor: BigInt(vaultLiability.rows[0].merch), vaultSellbackMinor: BigInt(vaultLiability.rows[0].sellback), vaultItems: Number(vaultLiability.rows[0].items) },
    inventory: inventory.rows.map((r) => ({ status: r.status, count: Number(r.c), costMinor: BigInt(r.cost) })),
    daily: recent.rows.map((r) => ({ day: r.day, grossMinor: BigInt(r.gross), opens: Number(r.opens) })),
    packs: packs.rows.map((r) => ({ status: r.status, count: Number(r.c) })),
    battles: battles.rows.map((r) => ({ status: r.status, count: Number(r.c) })),
    race: activeRace ? { id: activeRace.id, name: activeRace.name, status: activeRace.status, endsAt: activeRace.endsAt } : null,
    raffles: raffles.map((r) => ({ id: r.id, name: r.name, status: r.status, drawsAt: r.drawsAt })),
    users: { total: Number(users.rows[0].total), verified: Number(users.rows[0].verified) },
  };
}

export async function listInventory(db: DbOrTx, f: { status?: string; q?: string; limit?: number } = {}) {
  const conds = [];
  if (f.status) conds.push(eq(inventoryItem.status, f.status as typeof inventoryItem.$inferSelect.status));
  if (f.q) conds.push(or(ilike(inventoryItem.itemCode, `%${f.q}%`), ilike(productSku.name, `%${f.q}%`), ilike(inventoryItem.certificationId, `%${f.q}%`)));
  return db
    .select({ item: inventoryItem, sku: productSku, category })
    .from(inventoryItem)
    .innerJoin(productSku, eq(productSku.id, inventoryItem.skuId))
    .innerJoin(category, eq(category.id, productSku.categoryId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(inventoryItem.createdAt))
    .limit(f.limit ?? 200);
}

export async function listPackVersions(db: DbOrTx) {
  return db
    .select({ v: packVersion, p: pack, category })
    .from(packVersion)
    .innerJoin(pack, eq(pack.id, packVersion.packId))
    .innerJoin(category, eq(category.id, pack.categoryId))
    .orderBy(desc(packVersion.updatedAt));
}

export async function listUsers(db: DbOrTx, q?: string, limit = 100) {
  const rows = await db
    .select({ u: user })
    .from(user)
    .where(q ? or(ilike(user.email, `%${q}%`), ilike(user.displayName, `%${q}%`)) : undefined)
    .orderBy(desc(user.createdAt))
    .limit(limit);
  if (!rows.length) return [];
  const ids = rows.map((r) => r.u.id);
  const roles = await db.select({ userId: userRole.userId, key: role.key }).from(userRole).innerJoin(role, eq(role.id, userRole.roleId)).where(inArray(userRole.userId, ids));
  const balances = await db.select().from(walletAccount).where(and(inArray(walletAccount.userId, ids), eq(walletAccount.kind, "USER_CASH")));
  const kyc = await db.select().from(userVerification).where(and(inArray(userVerification.userId, ids), eq(userVerification.status, "APPROVED")));
  const risks = await db.select({ userId: riskEvent.userId, c: sql<number>`COUNT(*)::int` }).from(riskEvent).where(and(inArray(riskEvent.userId, ids), sql`${riskEvent.resolvedAt} IS NULL`)).groupBy(riskEvent.userId);
  return rows.map(({ u }) => ({
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    status: u.status,
    jurisdictionCode: u.jurisdictionCode,
    riskScore: u.riskScore,
    linkedAccountGroup: u.linkedAccountGroup,
    createdAt: u.createdAt,
    roles: roles.filter((r) => r.userId === u.id).map((r) => r.key),
    balanceMinor: balances.find((b) => b.userId === u.id)?.balanceMinor ?? 0n,
    verified: kyc.filter((k) => k.userId === u.id).map((k) => k.type),
    openRisk: Number(risks.find((r) => r.userId === u.id)?.c ?? 0),
  }));
}

export async function userDetail(db: DbOrTx, userId: string) {
  const u = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!u) throw err.notFound("User");
  const [roles, verifications, risks, accounts, openings, holdings, payments, chargebacks, refunds] = await Promise.all([
    db.select({ key: role.key }).from(userRole).innerJoin(role, eq(role.id, userRole.roleId)).where(eq(userRole.userId, userId)),
    db.select().from(userVerification).where(eq(userVerification.userId, userId)).orderBy(desc(userVerification.createdAt)),
    db.select().from(riskEvent).where(eq(riskEvent.userId, userId)).orderBy(desc(riskEvent.createdAt)).limit(50),
    db.select().from(walletAccount).where(eq(walletAccount.userId, userId)),
    db.select().from(opening).where(eq(opening.userId, userId)).orderBy(desc(opening.createdAt)).limit(50),
    db.select().from(vaultHolding).where(and(eq(vaultHolding.userId, userId), eq(vaultHolding.status, "ACTIVE"))),
    db.select().from(payment).where(eq(payment.userId, userId)).orderBy(desc(payment.createdAt)).limit(50),
    db.select().from(chargeback).where(eq(chargeback.userId, userId)),
    db.select().from(refund).where(eq(refund.userId, userId)),
  ]);
  const linked = u.linkedAccountGroup ? await db.select({ id: user.id, email: user.email, displayName: user.displayName }).from(user).where(and(eq(user.linkedAccountGroup, u.linkedAccountGroup), sql`${user.id} <> ${userId}`)) : [];
  return { user: { ...u, passwordHash: undefined }, roles: roles.map((r) => r.key), verifications, risks, accounts, openings, holdings, payments, chargebacks, refunds, linked };
}

export async function ledgerOverview(db: DbOrTx, limit = 100) {
  const accounts = await db.select().from(walletAccount).where(eq(walletAccount.ownerType, "SYSTEM")).orderBy(walletAccount.kind);
  const userTotals = await db.execute<{ total: string; c: string }>(sql`SELECT COALESCE(SUM(balance_minor),0)::text AS total, COUNT(*)::text AS c FROM wallet_account WHERE owner_type='USER'`);
  const transactions = await db.select().from(ledgerTransaction).orderBy(desc(ledgerTransaction.createdAt)).limit(limit);
  const entries = transactions.length ? await db.select().from(ledgerEntry).where(inArray(ledgerEntry.transactionId, transactions.map((t) => t.id))) : [];
  const payments = await db.select().from(payment).orderBy(desc(payment.createdAt)).limit(50);
  const refunds = await db.select().from(refund).orderBy(desc(refund.createdAt)).limit(50);
  const chargebacks = await db.select().from(chargeback).orderBy(desc(chargeback.createdAt)).limit(50);
  return { systemAccounts: accounts, userLiability: { totalMinor: BigInt(userTotals.rows[0].total), accounts: Number(userTotals.rows[0].c) }, transactions: transactions.map((t) => ({ ...t, entries: entries.filter((e) => e.transactionId === t.id) })), payments, refunds, chargebacks };
}

/** Invariant checks: ledger balance, materialized balances, vault ownership, manifest quantities, settlement totals. */
export async function reconcile(db: DbOrTx) {
  const problems: Array<{ check: string; detail: unknown }> = [];
  const unbalanced = await db.execute<{ transaction_id: string; s: string }>(sql`SELECT transaction_id, SUM(amount_minor)::text AS s FROM ledger_entry GROUP BY transaction_id HAVING SUM(amount_minor) <> 0`);
  if (unbalanced.rows.length) problems.push({ check: "ledger.balanced", detail: unbalanced.rows });
  const globalSum = await db.execute<{ s: string }>(sql`SELECT COALESCE(SUM(amount_minor),0)::text AS s FROM ledger_entry`);
  if (globalSum.rows[0].s !== "0") problems.push({ check: "ledger.global_zero", detail: globalSum.rows[0] });
  const materialized = await db.execute<{ id: string; balance: string; computed: string }>(sql`
    SELECT wa.id, wa.balance_minor::text AS balance, COALESCE(SUM(le.amount_minor),0)::text AS computed
    FROM wallet_account wa LEFT JOIN ledger_entry le ON le.account_id = wa.id GROUP BY wa.id HAVING wa.balance_minor <> COALESCE(SUM(le.amount_minor),0)`);
  if (materialized.rows.length) problems.push({ check: "ledger.materialized_balance", detail: materialized.rows });
  const negative = await db.execute<{ id: string }>(sql`SELECT id FROM wallet_account WHERE owner_type='USER' AND balance_minor < 0`);
  if (negative.rows.length) problems.push({ check: "ledger.user_non_negative", detail: negative.rows });
  const doubleOwned = await db.execute<{ inventory_item_id: string }>(sql`SELECT inventory_item_id FROM vault_holding WHERE status='ACTIVE' GROUP BY inventory_item_id HAVING COUNT(*) > 1`);
  if (doubleOwned.rows.length) problems.push({ check: "vault.single_owner", detail: doubleOwned.rows });
  const ownerMismatch = await db.execute<{ id: string }>(sql`
    SELECT ii.id FROM inventory_item ii LEFT JOIN vault_holding vh ON vh.inventory_item_id = ii.id AND vh.status='ACTIVE'
    WHERE (ii.owner_user_id IS NOT NULL AND (vh.user_id IS NULL OR vh.user_id <> ii.owner_user_id)) OR (ii.owner_user_id IS NULL AND vh.id IS NOT NULL)`);
  if (ownerMismatch.rows.length) problems.push({ check: "vault.owner_matches_item", detail: ownerMismatch.rows });
  const manifest = await db.execute<{ id: string; remaining: number; computed: string }>(sql`
    SELECT pv.id, pv.remaining_openings AS remaining, COALESCE(SUM(po.quantity_remaining),0)::text AS computed
    FROM pack_version pv LEFT JOIN pack_outcome po ON po.pack_version_id = pv.id WHERE pv.status IN ('PUBLISHED','PAUSED','CLOSED') AND pv.published_at IS NOT NULL
    GROUP BY pv.id HAVING pv.remaining_openings <> COALESCE(SUM(po.quantity_remaining),0)`);
  if (manifest.rows.length) problems.push({ check: "pack.remaining_matches_outcomes", detail: manifest.rows });
  const consumed = await db.execute<{ id: string; opened: string; expected: string }>(sql`
    SELECT pv.id, COUNT(o.id)::text AS opened, (pv.total_openings - pv.remaining_openings)::text AS expected
    FROM pack_version pv LEFT JOIN opening o ON o.pack_version_id = pv.id AND o.status='SETTLED' WHERE pv.published_at IS NOT NULL
    GROUP BY pv.id HAVING COUNT(o.id) <> (pv.total_openings - pv.remaining_openings)`);
  if (consumed.rows.length) problems.push({ check: "pack.openings_match_consumption", detail: consumed.rows });
  const receipts = await db.execute<{ id: string }>(sql`SELECT o.id FROM opening o LEFT JOIN fairness_receipt fr ON fr.opening_id = o.id WHERE fr.id IS NULL`);
  if (receipts.rows.length) problems.push({ check: "opening.has_receipt", detail: receipts.rows });
  const battles = await db.execute<{ id: string; pulls: string; expected: string }>(sql`
    SELECT b.id, COUNT(bp.id)::text AS pulls, (b.seats * jsonb_array_length(b.pack_version_ids))::text AS expected
    FROM battle b LEFT JOIN battle_pull bp ON bp.battle_id = b.id WHERE b.status='SETTLED' GROUP BY b.id HAVING COUNT(bp.id) <> b.seats * jsonb_array_length(b.pack_version_ids)`);
  if (battles.rows.length) problems.push({ check: "battle.pull_count", detail: battles.rows });
  const racePay = await db.execute<{ id: string; paid: string; summary: string }>(sql`
    SELECT r.id, COALESCE(SUM(s.prize_amount_minor),0)::text AS paid, (r.settlement_summary->>'paidMinor') AS summary
    FROM race r LEFT JOIN race_standing s ON s.race_id = r.id WHERE r.status='SETTLED' GROUP BY r.id HAVING COALESCE(SUM(s.prize_amount_minor),0)::text <> COALESCE(r.settlement_summary->>'paidMinor','0')`);
  if (racePay.rows.length) problems.push({ check: "race.settlement_totals", detail: racePay.rows });
  return { ok: problems.length === 0, problems, checkedAt: new Date().toISOString() };
}

export async function searchAudit(db: DbOrTx, f: { q?: string; entityType?: string; actorUserId?: string; limit?: number }) {
  const conds = [];
  if (f.entityType) conds.push(eq(adminAuditEvent.entityType, f.entityType));
  if (f.actorUserId) conds.push(eq(adminAuditEvent.actorUserId, f.actorUserId));
  if (f.q) conds.push(or(ilike(adminAuditEvent.action, `%${f.q}%`), ilike(adminAuditEvent.entityId, `%${f.q}%`), ilike(adminAuditEvent.reason, `%${f.q}%`)));
  return db
    .select({ e: adminAuditEvent, actorName: user.displayName })
    .from(adminAuditEvent)
    .leftJoin(user, eq(user.id, adminAuditEvent.actorUserId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(adminAuditEvent.createdAt))
    .limit(f.limit ?? 200);
}

export async function listShipments(db: DbOrTx, status?: string) {
  return db
    .select({ s: shipment, item: inventoryItem, sku: productSku, userEmail: user.email })
    .from(shipment)
    .innerJoin(inventoryItem, eq(inventoryItem.id, shipment.inventoryItemId))
    .innerJoin(productSku, eq(productSku.id, inventoryItem.skuId))
    .innerJoin(user, eq(user.id, shipment.userId))
    .where(status ? eq(shipment.status, status as typeof shipment.$inferSelect.status) : undefined)
    .orderBy(desc(shipment.createdAt))
    .limit(200);
}

export async function listBattlesAdmin(db: DbOrTx) {
  return db.select().from(battle).orderBy(desc(battle.createdAt)).limit(200);
}

export async function listRiskEvents(db: DbOrTx) {
  return db.select({ r: riskEvent, email: user.email }).from(riskEvent).leftJoin(user, eq(user.id, riskEvent.userId)).orderBy(desc(riskEvent.createdAt)).limit(200);
}

export async function sellbackOverview(db: DbOrTx) {
  const quotes = await db.select().from(sellbackQuote).orderBy(desc(sellbackQuote.createdAt)).limit(100);
  const listings = await db.select({ l: marketplaceListing, item: inventoryItem, sku: productSku }).from(marketplaceListing).innerJoin(inventoryItem, eq(inventoryItem.id, marketplaceListing.inventoryItemId)).innerJoin(productSku, eq(productSku.id, inventoryItem.skuId)).orderBy(desc(marketplaceListing.createdAt)).limit(100);
  return { quotes, listings };
}

export async function recordValuation(db: DbOrTx, actorUserId: string, input: { skuId?: string | null; inventoryItemId?: string | null; referenceValueMinor: bigint; sellbackOfferMinor: bigint; source: string; sourceRef?: string; observedAt?: Date }) {
  if (input.sellbackOfferMinor > input.referenceValueMinor) throw err.validation("Sell-back offer cannot exceed reference value");
  const [v] = await db.insert(valuationSnapshot).values({ skuId: input.skuId ?? null, inventoryItemId: input.inventoryItemId ?? null, referenceValueMinor: input.referenceValueMinor, sellbackOfferMinor: input.sellbackOfferMinor, source: input.source, sourceRef: input.sourceRef ?? null, observedAt: input.observedAt ?? new Date(), createdBy: actorUserId }).returning();
  await audit(db, { actorUserId, action: "valuation.record", entityType: "valuation_snapshot", entityId: v.id, after: v });
  return v;
}

export async function staleValuations(db: DbOrTx, maxAgeHours: number) {
  const cutoff = new Date(Date.now() - maxAgeHours * 3_600_000);
  return db.select().from(valuationSnapshot).where(gte(valuationSnapshot.observedAt, cutoff)).limit(1);
}
