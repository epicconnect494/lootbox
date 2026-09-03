import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { db, fresh, makeUser, makePack, closePool } from "./helpers";
import { openPack } from "@/domain/openings";
import { reconcile } from "@/domain/admin";

describe("concurrent final-inventory opens", () => {
  beforeAll(fresh);
  afterAll(closePool);

  it("exactly N openings succeed for N remaining and unique items are never double-allocated", async () => {
    // 3 openings total: 1 unique grail + 2 commons. sellback: 1800 + 2*600 = 3000 / 3000 = 100%? use 90%: grail sb 1500, commons 600 -> 2700/3000 = 90%
    const p = await makePack({ price: 1000n, outcomes: [
      { label: "grail", qty: 1, value: 2000n, sellback: 1500n, unique: true },
      { label: "common", qty: 2, value: 700n, sellback: 600n },
    ] });
    const users = await Promise.all(Array.from({ length: 12 }, () => makeUser({ fundMinor: 1000n })));
    const results = await Promise.allSettled(users.map((u, i) => openPack(db, { userId: u.id, packVersionId: p.version.id, idempotencyKey: `c${i}` })));
    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    if (ok.length !== 3) console.error("codes", failed.map((f) => `${(f.reason as { code?: string }).code}: ${(f.reason as Error).message}`));
    expect(ok.length).toBe(3);
    expect(failed.length).toBe(9);
    for (const f of failed) expect(["SOLD_OUT", "PACK_UNAVAILABLE"]).toContain((f.reason as { code: string }).code);
    const v = (await db.query.packVersion.findFirst({ where: eq(s.packVersion.id, p.version.id) }))!;
    expect(v.remainingOpenings).toBe(0);
    expect(v.status).toBe("CLOSED");
    const holdings = await db.select().from(s.vaultHolding).where(eq(s.vaultHolding.inventoryItemId, p.items[0]!));
    expect(holdings.length).toBe(1);
    const openings = await db.select().from(s.opening).where(eq(s.opening.packVersionId, p.version.id));
    expect(openings.length).toBe(3);
    // losers keep their money
    for (const f of failed) {
      const idx = results.indexOf(f);
      const acct = await db.query.walletAccount.findFirst({ where: eq(s.walletAccount.userId, users[idx].id) });
      expect(acct?.balanceMinor).toBe(1000n);
    }
    expect((await reconcile(db)).problems).toEqual([]);
  });

  it("concurrent retries with the same idempotency key produce a single opening", async () => {
    const p = await makePack({ price: 1000n, outcomes: [{ label: "common", qty: 50, value: 1000n, sellback: 900n }] });
    const u = await makeUser({ fundMinor: 1000n });
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => openPack(db, { userId: u.id, packVersionId: p.version.id, idempotencyKey: "same-key" })));
    const ids = new Set(results.filter((r) => r.status === "fulfilled").map((r) => (r as PromiseFulfilledResult<{ opening: { id: string } }>).value.opening.id));
    expect(ids.size).toBe(1);
    const openings = await db.select().from(s.opening).where(eq(s.opening.userId, u.id));
    expect(openings.length).toBe(1);
    const acct = await db.query.walletAccount.findFirst({ where: eq(s.walletAccount.userId, u.id) });
    expect(acct?.balanceMinor).toBe(0n);
  });
});
