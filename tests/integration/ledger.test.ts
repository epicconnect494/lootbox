import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql, eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { db, fresh, makeUser, closePool, dbError } from "./helpers";
import { getOrCreateUserAccount, getSystemAccount, postTransaction } from "@/domain/ledger";
import { reconcile } from "@/domain/admin";

describe("double-entry ledger", () => {
  beforeAll(fresh);
  afterAll(closePool);

  it("rejects unbalanced transactions at the database level", async () => {
    const u = await makeUser();
    expect(
      await dbError(
        db.transaction(async (tx) => {
          const acct = await getOrCreateUserAccount(tx, u.id);
          const sys = await getSystemAccount(tx, "SYSTEM_PACK_SALES");
          const [trx] = await tx.insert(s.ledgerTransaction).values({ kind: "ADJUSTMENT" }).returning();
          await tx.insert(s.ledgerEntry).values([{ transactionId: trx.id, accountId: acct.id, amountMinor: 500n }, { transactionId: trx.id, accountId: sys.id, amountMinor: -400n }]);
        }),
      ),
    ).toMatch(/unbalanced/);
    await expect(postTransaction(db, { kind: "ADJUSTMENT", entries: [{ accountId: "00000000-0000-4000-8000-000000000000", amountMinor: 1n }, { accountId: "00000000-0000-4000-8000-000000000001", amountMinor: 1n }] })).rejects.toThrow(/balance/);
  });

  it("never lets a user balance go negative", async () => {
    const u = await makeUser({ fundMinor: 100n });
    await expect(
      db.transaction(async (tx) => {
        const acct = await getOrCreateUserAccount(tx, u.id);
        const sys = await getSystemAccount(tx, "SYSTEM_PACK_SALES");
        await postTransaction(tx, { kind: "PACK_PURCHASE", entries: [{ accountId: acct.id, amountMinor: -101n }, { accountId: sys.id, amountMinor: 101n }] });
      }),
    ).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    // bypassing the service layer still hits the check constraint
    await expect(
      db.transaction(async (tx) => {
        const acct = await getOrCreateUserAccount(tx, u.id);
        const sys = await getSystemAccount(tx, "SYSTEM_PACK_SALES");
        const [trx] = await tx.insert(s.ledgerTransaction).values({ kind: "ADJUSTMENT" }).returning();
        await tx.insert(s.ledgerEntry).values([{ transactionId: trx.id, accountId: acct.id, amountMinor: -101n }, { transactionId: trx.id, accountId: sys.id, amountMinor: 101n }]);
      }),
    ).rejects.toThrow();
    const acct = await db.query.walletAccount.findFirst({ where: eq(s.walletAccount.userId, u.id) });
    expect(acct?.balanceMinor).toBe(100n);
  });

  it("is append-only: updates and deletes are blocked", async () => {
    const u = await makeUser({ fundMinor: 100n });
    const entry = (await db.select().from(s.ledgerEntry).limit(1))[0];
    expect(await dbError(db.execute(sql`UPDATE ledger_entry SET amount_minor = 999 WHERE id = ${entry.id}`))).toMatch(/append-only/);
    expect(await dbError(db.execute(sql`DELETE FROM ledger_entry WHERE id = ${entry.id}`))).toMatch(/append-only/);
    expect(await dbError(db.execute(sql`DELETE FROM ledger_transaction WHERE id = ${entry.transactionId}`))).toMatch(/append-only/);
    const audit = (await db.select().from(s.adminAuditEvent).limit(1))[0];
    if (audit) expect(await dbError(db.execute(sql`UPDATE admin_audit_event SET action = 'x' WHERE id = ${audit.id}`))).toMatch(/append-only/);
    void u;
  });

  it("materialized balances always equal the sum of entries", async () => {
    const r = await reconcile(db);
    expect(r.problems).toEqual([]);
    const total = await db.execute<{ s: string }>(sql`SELECT COALESCE(SUM(amount_minor),0)::text AS s FROM ledger_entry`);
    expect(total.rows[0].s).toBe("0");
  });
});
