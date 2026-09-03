import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import * as s from "@/db/schema";
import { db, fresh, makeUser, closePool, dbError } from "./helpers";
import { claimPrize, closeRaffle, createRaffle, drawRaffle, enterRaffle, raffleView, redrawRaffle } from "@/domain/raffles";
import { verifyRaffle } from "@/lib/fairness/verify";
import { sha256Hex } from "@/lib/crypto";

describe("raffles", () => {
  let admin: { id: string };
  beforeAll(async () => {
    await fresh();
    admin = await makeUser({ role: "SUPER_ADMIN" });
  });
  afterAll(closePool);

  async function makeRaffle(overrides: Partial<Parameters<typeof createRaffle>[2]> = {}) {
    const cat = (await db.query.category.findFirst())!;
    const [sku] = await db.insert(s.productSku).values({ sku: `RAF-${Math.random().toString(36).slice(2, 8)}`, categoryId: cat.id, name: "Prize", isUnique: true }).returning();
    const [item] = await db.insert(s.inventoryItem).values({ itemCode: `RAF-${Math.random().toString(36).slice(2, 8)}`, skuId: sku.id, status: "IN_STOCK", certificationId: `C-${Math.random().toString(36).slice(2, 8)}`, grader: "VG" }).returning();
    const now = Date.now();
    const r = await createRaffle(db, admin.id, {
      slug: `raffle-${Math.random().toString(36).slice(2, 8)}`,
      name: "Test raffle",
      entryMode: "FREE",
      maxTickets: 50,
      maxTicketsPerUser: 10,
      ticketPriceMinor: 0n,
      winnersCount: 2,
      amoeEnabled: true,
      allowedJurisdictions: [],
      opensAt: new Date(now - 1000),
      closesAt: new Date(now + 3_600_000),
      drawsAt: new Date(now + 7_200_000),
      claimDeadlineAt: new Date(now + 86_400_000),
      publicRandomnessSource: "test",
      prizes: [{ rank: 1, title: "Grand", referenceValueMinor: 10000n, inventoryItemId: item.id }, { rank: 2, title: "Second", referenceValueMinor: 1000n }],
      ...overrides,
    });
    return { raffle: r, item };
  }

  it("commits the server seed hash at creation and issues immutable unique tickets", async () => {
    const { raffle } = await makeRaffle();
    expect(raffle.serverSeedHash).toHaveLength(64);
    const u = await makeUser();
    const t = await enterRaffle(db, u.id, raffle.id, 3, "FREE", { idempotencyKey: "e1" });
    expect(t.map((x) => x.ticketNumber)).toEqual([1, 2, 3]);
    await expect(enterRaffle(db, u.id, raffle.id, 8, "FREE", { idempotencyKey: "e2" })).rejects.toMatchObject({ code: "LIMIT_EXCEEDED" });
    expect(await dbError(db.execute(sql`UPDATE raffle_entry SET user_id = ${admin.id} WHERE id = ${t[0].id}`))).toMatch(/append-only/);
    await expect(enterRaffle(db, u.id, raffle.id, 1, "AMOE", { idempotencyKey: "e3" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    const amoe = await enterRaffle(db, u.id, raffle.id, 1, "AMOE", { idempotencyKey: "e4", actorUserId: admin.id, sourceRef: "POSTCARD-1" });
    expect(amoe[0].source).toBe("AMOE");
  });

  it("purchase-linked raffles must offer a free route", async () => {
    await expect(makeRaffle({ entryMode: "PURCHASE_LINKED", ticketPriceMinor: 100n, amoeEnabled: false })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("close publishes a manifest hash; draw is reproducible; redraw supersedes and never overwrites", async () => {
    const { raffle, item } = await makeRaffle();
    const users = await Promise.all(Array.from({ length: 5 }, () => makeUser()));
    for (let i = 0; i < users.length; i++) await enterRaffle(db, users[i].id, raffle.id, i + 1, "FREE", { idempotencyKey: `t${i}` });
    const closed = await closeRaffle(db, admin.id, raffle.id);
    expect(closed.ticketCount).toBe(15);
    await expect(enterRaffle(db, users[0].id, raffle.id, 1, "FREE", { idempotencyKey: "late" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    const view0 = (await raffleView(db, raffle.id, null))!;
    expect(view0.manifest!.manifestHash).toBe(sha256Hex(view0.manifest!.canonicalManifest));
    const d = await drawRaffle(db, admin.id, raffle.id, "beacon-pulse-1234567890abcdef", "test beacon");
    expect(d.winners.length).toBe(2);
    expect(new Set(d.winners.map((w) => w.ticketNumber)).size).toBe(2);
    const verified = await verifyRaffle({ serverSeed: d.serverSeed, serverSeedHash: d.serverSeedHash, publicRandomness: d.publicRandomness, raffleId: raffle.id, manifestHash: d.manifestHash, ticketCount: d.ticketCount, winnersCount: 2, canonicalManifest: view0.manifest!.canonicalManifest, expectedWinners: d.winners.map((w) => w.ticketNumber) });
    expect(verified.ok).toBe(true);
    // original draw is frozen
    expect(await dbError(db.execute(sql`UPDATE raffle_draw SET winners = '[]'::jsonb WHERE id = ${d.id}`))).toMatch(/superseded/);
    expect(await dbError(db.execute(sql`DELETE FROM raffle_draw WHERE id = ${d.id}`))).toMatch(/append-only/);
    await expect(redrawRaffle(db, admin.id, raffle.id, "too short", "other-randomness-000000", "test")).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    const d2 = await redrawRaffle(db, admin.id, raffle.id, "Winner of ticket verified as a duplicate account during compliance review", "other-randomness-0000000000", "test beacon 2");
    expect(d2.drawNumber).toBe(2);
    const view = (await raffleView(db, raffle.id, null))!;
    expect(view.draws.length).toBe(2);
    expect(view.draws[0].status).toBe("SUPERSEDED");
    expect(view.draws[1].status).toBe("VALID");
    // winner claims the physical prize into their vault
    const winner = d2.winners[0];
    const prize = view.prizes.find((p) => p.rank === 1)!;
    const other = users.find((u) => u.id !== winner.userId)!;
    await expect(claimPrize(db, other.id, raffle.id, prize.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
    await claimPrize(db, winner.userId, raffle.id, prize.id);
    const it = (await db.query.inventoryItem.findFirst({ where: eq(s.inventoryItem.id, item.id) }))!;
    expect(it.status).toBe("IN_VAULT");
    expect(it.ownerUserId).toBe(winner.userId);
    await expect(redrawRaffle(db, admin.id, raffle.id, "Trying to redraw after a prize was already claimed by winner", "x-0000000000", "t")).rejects.toMatchObject({ code: "INVALID_STATE" });
  });
});
