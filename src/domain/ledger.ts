import { and, eq, sql } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { ledgerEntry, ledgerTransaction, walletAccount } from "@/db/schema";
import { err } from "@/lib/errors";
import type { Minor } from "@/lib/money";

export type AccountKind = (typeof walletAccount.$inferSelect)["kind"];
export type LedgerKind = (typeof ledgerTransaction.$inferSelect)["kind"];

export async function getOrCreateUserAccount(tx: DbOrTx, userId: string, kind: AccountKind = "USER_CASH", currency = "USD") {
  const existing = await tx.query.walletAccount.findFirst({ where: and(eq(walletAccount.userId, userId), eq(walletAccount.kind, kind), eq(walletAccount.currency, currency)) });
  if (existing) return existing;
  const [row] = await tx
    .insert(walletAccount)
    .values({ ownerType: "USER", userId, kind, currency })
    .onConflictDoNothing()
    .returning();
  if (row) return row;
  return (await tx.query.walletAccount.findFirst({ where: and(eq(walletAccount.userId, userId), eq(walletAccount.kind, kind), eq(walletAccount.currency, currency)) }))!;
}

export async function getSystemAccount(tx: DbOrTx, kind: AccountKind, currency = "USD") {
  const existing = await tx.query.walletAccount.findFirst({ where: and(eq(walletAccount.ownerType, "SYSTEM"), eq(walletAccount.kind, kind), eq(walletAccount.currency, currency)) });
  if (existing) return existing;
  const [row] = await tx.insert(walletAccount).values({ ownerType: "SYSTEM", kind, currency }).onConflictDoNothing().returning();
  if (row) return row;
  return (await tx.query.walletAccount.findFirst({ where: and(eq(walletAccount.ownerType, "SYSTEM"), eq(walletAccount.kind, kind), eq(walletAccount.currency, currency)) }))!;
}

export interface Entry {
  accountId: string;
  amountMinor: Minor;
  memo?: string;
}

export interface PostInput {
  kind: LedgerKind;
  referenceType?: string;
  referenceId?: string;
  idempotencyKey?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string | null;
  entries: Entry[];
  currency?: string;
}

/**
 * Post a balanced double-entry transaction. The DB additionally enforces balance (deferred trigger)
 * and non-negative user balances (check constraint). Must run inside the caller's transaction.
 */
export async function postTransaction(tx: DbOrTx, input: PostInput) {
  const sum = input.entries.reduce((a, e) => a + e.amountMinor, 0n);
  if (sum !== 0n) throw new Error(`ledger transaction does not balance (sum=${sum})`);
  if (input.entries.length < 2) throw new Error("ledger transaction needs at least two entries");
  for (const e of input.entries) if (e.amountMinor === 0n) throw new Error("ledger entries must be non-zero");

  // Lock debited user accounts and pre-check funds so we can return a clean error instead of a constraint violation.
  for (const e of input.entries) {
    if (e.amountMinor >= 0n) continue;
    const [acct] = await tx.select().from(walletAccount).where(eq(walletAccount.id, e.accountId)).for("update");
    if (!acct) throw err.notFound("Wallet account");
    if (acct.ownerType === "USER" && acct.balanceMinor + e.amountMinor < 0n) throw err.funds();
  }

  const [trx] = await tx
    .insert(ledgerTransaction)
    .values({
      kind: input.kind,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
      createdBy: input.createdBy ?? null,
    })
    .returning();
  await tx.insert(ledgerEntry).values(input.entries.map((e) => ({ transactionId: trx.id, accountId: e.accountId, amountMinor: e.amountMinor, currency: input.currency ?? "USD", memo: e.memo ?? null })));
  return trx;
}

export async function getUserBalance(db: DbOrTx, userId: string, currency = "USD"): Promise<{ cashMinor: Minor; promoMinor: Minor }> {
  const rows = await db.select().from(walletAccount).where(and(eq(walletAccount.userId, userId), eq(walletAccount.currency, currency)));
  const cash = rows.find((r) => r.kind === "USER_CASH")?.balanceMinor ?? 0n;
  const promo = rows.find((r) => r.kind === "USER_PROMO")?.balanceMinor ?? 0n;
  return { cashMinor: cash, promoMinor: promo };
}

/** Sum of debits of given kinds for a user within a window (used by responsible-play limits). */
export async function sumUserDebits(db: DbOrTx, userId: string, kinds: LedgerKind[], since: Date): Promise<Minor> {
  const rows = await db.execute<{ total: bigint | string | null }>(sql`
    SELECT COALESCE(SUM(-le.amount_minor), 0) AS total
    FROM ledger_entry le
    JOIN wallet_account wa ON wa.id = le.account_id
    JOIN ledger_transaction lt ON lt.id = le.transaction_id
    WHERE wa.user_id = ${userId} AND wa.kind = 'USER_CASH' AND le.amount_minor < 0
      AND lt.kind IN (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})
      AND lt.created_at >= ${since}`);
  return BigInt(rows.rows[0]?.total ?? 0);
}

export async function sumUserCredits(db: DbOrTx, userId: string, kinds: LedgerKind[], since: Date): Promise<Minor> {
  const rows = await db.execute<{ total: bigint | string | null }>(sql`
    SELECT COALESCE(SUM(le.amount_minor), 0) AS total
    FROM ledger_entry le
    JOIN wallet_account wa ON wa.id = le.account_id
    JOIN ledger_transaction lt ON lt.id = le.transaction_id
    WHERE wa.user_id = ${userId} AND wa.kind = 'USER_CASH' AND le.amount_minor > 0
      AND lt.kind IN (${sql.join(kinds.map((k) => sql`${k}`), sql`, `)})
      AND lt.created_at >= ${since}`);
  return BigInt(rows.rows[0]?.total ?? 0);
}
