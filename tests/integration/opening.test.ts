import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, and } from "drizzle-orm";
import * as s from "@/db/schema";
import { db, fresh, makeUser, makePack, standardOutcomes, balance, closePool } from "./helpers";
import { openPack, getOpeningView, rotateUserSeed } from "@/domain/openings";
import { verifyReceiptSignature } from "@/lib/fairness/node";
import { verifyOpening } from "@/lib/fairness/verify";
import { reconcile } from "@/domain/admin";
import { AppError } from "@/lib/errors";

describe("atomic pack opening", () => {
  let user: { id: string };
  let versionId: string;
  beforeAll(async () => {
    await fresh();
    user = await makeUser({ fundMinor: 5000n });
    const p = await makePack({ price: 1000n, outcomes: standardOutcomes() });
    versionId = p.version.id;
  });
  afterAll(closePool);

  it("settles in one transaction: debit, inventory, holding, receipt", async () => {
    const before = await balance(user.id);
    const r = await openPack(db, { userId: user.id, packVersionId: versionId, idempotencyKey: "k1" });
    expect(r.replayed).toBe(false);
    expect(await balance(user.id)).toBe(before - 1000n);
    const v = (await db.query.packVersion.findFirst({ where: eq(s.packVersion.id, versionId) }))!;
    expect(v.remainingOpenings).toBe(99);
    const holding = await db.query.vaultHolding.findFirst({ where: and(eq(s.vaultHolding.userId, user.id), eq(s.vaultHolding.status, "ACTIVE")) });
    expect(holding?.inventoryItemId).toBe(r.item.id);
    const item = (await db.query.inventoryItem.findFirst({ where: eq(s.inventoryItem.id, r.item.id) }))!;
    expect(item.status).toBe("IN_VAULT");
    expect(item.ownerUserId).toBe(user.id);
    expect(verifyReceiptSignature(r.receipt.payloadCanonical, r.receipt.signature)).toBe(true);
    expect(r.receipt.rangeSize).toBe(100);
    expect(r.receipt.nonce).toBe(0);
    const transfer = await db.query.ownershipTransfer.findFirst({ where: eq(s.ownershipTransfer.id, r.opening.ownershipTransferId!) });
    expect(transfer?.toUserId).toBe(user.id);
    const ledger = await db.select().from(s.ledgerEntry).where(eq(s.ledgerEntry.transactionId, r.opening.ledgerTransactionId!));
    expect(ledger.reduce((a, e) => a + e.amountMinor, 0n)).toBe(0n);
  });

  it("is idempotent for retries with the same key and increments nonce for new opens", async () => {
    const a = await openPack(db, { userId: user.id, packVersionId: versionId, idempotencyKey: "k2" });
    const b = await openPack(db, { userId: user.id, packVersionId: versionId, idempotencyKey: "k2" });
    expect(b.replayed).toBe(true);
    expect(b.opening.id).toBe(a.opening.id);
    expect(a.receipt.nonce).toBe(1);
    const count = await db.select().from(s.opening).where(eq(s.opening.userId, user.id));
    expect(count.length).toBe(2);
  });

  it("rejects insufficient funds with no side effects", async () => {
    const poor = await makeUser({ fundMinor: 500n });
    const v0 = (await db.query.packVersion.findFirst({ where: eq(s.packVersion.id, versionId) }))!;
    await expect(openPack(db, { userId: poor.id, packVersionId: versionId, idempotencyKey: "k3" })).rejects.toMatchObject({ code: "INSUFFICIENT_FUNDS" });
    const v1 = (await db.query.packVersion.findFirst({ where: eq(s.packVersion.id, versionId) }))!;
    expect(v1.remainingOpenings).toBe(v0.remainingOpenings);
    expect(await balance(poor.id)).toBe(500n);
    const seed = await db.query.fairnessSeed.findFirst({ where: eq(s.fairnessSeed.userId, poor.id) });
    expect(seed?.nonce).toBe(0);
  });

  it("blocks unverified, excluded and limited users", async () => {
    const unverified = await makeUser({ verified: false, fundMinor: 5000n });
    await expect(openPack(db, { userId: unverified.id, packVersionId: versionId, idempotencyKey: "k4" })).rejects.toSatisfy((e: AppError) => e.code === "GATE_BLOCKED" && JSON.stringify(e.details).includes("IDENTITY_UNVERIFIED"));
    const minor = await makeUser({ verified: false, fundMinor: 5000n, dob: new Date(Date.now() - 16 * 365 * 86_400_000) });
    await expect(openPack(db, { userId: minor.id, packVersionId: versionId, idempotencyKey: "k4b" })).rejects.toSatisfy((e: AppError) => e.code === "GATE_BLOCKED" && JSON.stringify(e.details).includes("AGE_UNVERIFIED"));
    const excluded = await makeUser({ fundMinor: 5000n });
    await db.insert(s.selfExclusion).values({ userId: excluded.id, type: "COOLING_OFF", endsAt: new Date(Date.now() + 86_400_000) });
    await expect(openPack(db, { userId: excluded.id, packVersionId: versionId, idempotencyKey: "k5" })).rejects.toMatchObject({ code: "GATE_BLOCKED" });
    const limited = await makeUser({ fundMinor: 5000n });
    await db.insert(s.responsiblePlayLimit).values({ userId: limited.id, type: "SPEND_DAILY", amountMinor: 1500n });
    await openPack(db, { userId: limited.id, packVersionId: versionId, idempotencyKey: "k6" });
    await expect(openPack(db, { userId: limited.id, packVersionId: versionId, idempotencyKey: "k7" })).rejects.toMatchObject({ code: "GATE_BLOCKED" });
    const wrongRegion = await makeUser({ fundMinor: 5000n, jurisdiction: "GB" });
    await expect(openPack(db, { userId: wrongRegion.id, packVersionId: versionId, idempotencyKey: "k8" })).rejects.toMatchObject({ code: "GATE_BLOCKED" });
  });

  it("receipt verifies end-to-end after the seed is revealed", async () => {
    const r = await openPack(db, { userId: user.id, packVersionId: versionId, idempotencyKey: "k9" });
    let view = await getOpeningView(db, r.opening.id, user.id);
    expect(view?.receipt?.revealedServerSeed).toBeNull();
    const rotated = await rotateUserSeed(db, user.id, "my-new-seed");
    expect(rotated.retired.revealedServerSeed).toHaveLength(64);
    view = await getOpeningView(db, r.opening.id, user.id);
    const rec = view!.receipt!;
    expect(rec.revealedServerSeed).toBe(rotated.retired.revealedServerSeed);
    const snapshot = rec.valueSnapshot as { remainingQuantities: number[] };
    const verified = await verifyOpening({ serverSeed: rec.revealedServerSeed!, serverSeedHash: rec.serverSeedHash, clientSeed: rec.clientSeed, nonce: rec.nonce, packVersionId: rec.packVersionId, manifestHash: rec.manifestHash, remainingQuantities: snapshot.remainingQuantities, expectedDigest: rec.digest, expectedIndex: rec.selectedIndex, expectedOutcomePosition: view!.outcome.position });
    expect(verified.ok).toBe(true);
    const next = await db.query.fairnessSeed.findFirst({ where: and(eq(s.fairnessSeed.userId, user.id), eq(s.fairnessSeed.status, "ACTIVE")) });
    expect(next?.clientSeed).toBe("my-new-seed");
    expect(next?.nonce).toBe(0);
  });

  it("refresh returns the same settled opening and never reopens", async () => {
    const r = await openPack(db, { userId: user.id, packVersionId: versionId, idempotencyKey: "k10" });
    const v1 = await getOpeningView(db, r.opening.id, user.id);
    const v2 = await getOpeningView(db, r.opening.id, user.id);
    expect(v1!.outcome.id).toBe(v2!.outcome.id);
    expect(v1!.receipt!.digest).toBe(v2!.receipt!.digest);
    const other = await makeUser();
    expect(await getOpeningView(db, r.opening.id, other.id)).toBeNull();
  });

  it("keeps all invariants", async () => {
    const r = await reconcile(db);
    expect(r.problems).toEqual([]);
  });
});
