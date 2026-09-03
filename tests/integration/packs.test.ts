import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import * as s from "@/db/schema";
import { db, fresh, makeUser, makePack, standardOutcomes, closePool } from "./helpers";
import { cloneVersion, evaluateVersionHealth, pauseVersion, publishVersion, resumeVersion, reviewVersion, submitForApproval, upsertOutcome, versionEconomics } from "@/domain/packs";
import { reserveUniqueItem } from "@/domain/inventory";
import { runSchedulers } from "@/domain/worker";
import { sha256Hex } from "@/lib/crypto";

describe("pack versions", () => {
  beforeAll(fresh);
  afterAll(closePool);

  it("refuses to submit or publish a version outside the RTP tolerance", async () => {
    const p = await makePack({ price: 1000n, publish: false, outcomes: [{ label: "common", qty: 10, value: 1000n, sellback: 500n }] });
    const eco = await versionEconomics(db, p.version.id);
    expect(eco.validation.ok).toBe(false);
    expect(eco.validation.errors.join(" ")).toMatch(/Sell-back RTP 50.00%/);
    expect(eco.suggestions.some((x) => x.kind === "ADJUST_COMMON_VALUE")).toBe(true);
    await expect(submitForApproval(db, { userId: p.catalog.id }, p.version.id)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("enforces separation of duties on approval", async () => {
    const p = await makePack({ price: 1000n, publish: false, outcomes: standardOutcomes() });
    await submitForApproval(db, { userId: p.catalog.id }, p.version.id);
    await expect(reviewVersion(db, { userId: p.catalog.id }, p.version.id, "APPROVED", "self")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await reviewVersion(db, { userId: p.finance.id }, p.version.id, "APPROVED", "ok");
  });

  it("publishing locks the manifest, reserves items and freezes outcomes", async () => {
    const p = await makePack({ price: 1000n, outcomes: standardOutcomes() });
    const commitment = (await db.query.packManifestCommitment.findFirst({ where: eq(s.packManifestCommitment.packVersionId, p.version.id) }))!;
    expect(commitment.manifestHash).toBe(sha256Hex(commitment.canonicalManifest));
    expect(p.version.manifestHash).toBe(commitment.manifestHash);
    expect(p.version.sellbackRtpBp).toBe(8995);
    expect(p.version.merchandiseRtpBp).toBe(10910);
    const item = (await db.query.inventoryItem.findFirst({ where: eq(s.inventoryItem.id, p.items[0]!) }))!;
    expect(item.status).toBe("RESERVED");
    expect(item.reservedForId).toBe(p.version.id);
    const outcome = (await db.query.packOutcome.findFirst({ where: eq(s.packOutcome.packVersionId, p.version.id) }))!;
    await expect(upsertOutcome(db, { userId: p.catalog.id }, p.version.id, { id: outcome.id, label: "x", tier: "COMMON", skuId: outcome.skuId, quantity: 5, referenceValueMinor: 1n, sellbackOfferMinor: 1n })).rejects.toMatchObject({ code: "INVALID_STATE" });
    // same unique item cannot be reserved for anything else
    await expect(db.transaction((tx) => reserveUniqueItem(tx, p.items[0]!, "raffle", "00000000-0000-4000-8000-000000000009"))).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("clone creates a new draft version and never mutates the published one", async () => {
    const p = await makePack({ price: 1000n, outcomes: standardOutcomes() });
    const nv = await cloneVersion(db, { userId: p.catalog.id }, p.version.id);
    expect(nv.version).toBe(2);
    expect(nv.status).toBe("DRAFT");
    const outs = await db.select().from(s.packOutcome).where(eq(s.packOutcome.packVersionId, nv.id));
    expect(outs.length).toBe(2);
    const orig = (await db.query.packVersion.findFirst({ where: eq(s.packVersion.id, p.version.id) }))!;
    expect(orig.status).toBe("PUBLISHED");
    expect(orig.manifestHash).toBe(p.version.manifestHash);
  });

  it("pauses automatically when a valuation goes stale and can only resume when healthy", async () => {
    const p = await makePack({ price: 1000n, outcomes: standardOutcomes() });
    const outcome = (await db.query.packOutcome.findFirst({ where: eq(s.packOutcome.inventoryItemId, p.items[0]!) }))!;
    await db.update(s.valuationSnapshot).set({ observedAt: new Date(Date.now() - 100 * 3_600_000) }).where(eq(s.valuationSnapshot.id, outcome.valuationSnapshotId!));
    const health = await evaluateVersionHealth(db, p.version.id);
    expect(health.ok).toBe(false);
    expect(health.reasons[0]).toMatch(/stale/);
    await runSchedulers(db);
    const v = (await db.query.packVersion.findFirst({ where: eq(s.packVersion.id, p.version.id) }))!;
    expect(v.status).toBe("PAUSED");
    await expect(resumeVersion(db, { userId: p.catalog.id }, p.version.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
    await db.update(s.valuationSnapshot).set({ observedAt: new Date() }).where(eq(s.valuationSnapshot.id, outcome.valuationSnapshotId!));
    await resumeVersion(db, { userId: p.catalog.id }, p.version.id);
    await pauseVersion(db, { userId: p.catalog.id }, p.version.id, "manual");
    const paused = (await db.query.packVersion.findFirst({ where: eq(s.packVersion.id, p.version.id) }))!;
    expect(paused.status).toBe("PAUSED");
    expect(paused.pauseReason).toBe("manual");
  });

  it("pauses when merchandise liability exceeds the configured limit", async () => {
    const p = await makePack({ price: 1000n, outcomes: standardOutcomes() });
    await db.update(s.packVersion).set({ liabilityLimitMinor: 100n }).where(eq(s.packVersion.id, p.version.id));
    const health = await evaluateVersionHealth(db, p.version.id);
    expect(health.reasons.join()).toMatch(/liability/);
  });

  it("rejects publishing a draft that skipped approval", async () => {
    const p = await makePack({ price: 1000n, publish: false, outcomes: standardOutcomes() });
    await expect(publishVersion(db, { userId: p.catalog.id }, p.version.id)).rejects.toMatchObject({ code: "INVALID_STATE" });
    const u = await makeUser();
    void u;
  });
});
