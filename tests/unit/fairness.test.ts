import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { buildMessage, mapIndexToOutcome, selectIndexFromDigest, SAMPLE_SPACE } from "@/lib/fairness/core";
import { draw, hmacDigest, serverSeedHash, signReceipt, verifyReceiptSignature } from "@/lib/fairness/node";
import { verifyOpening, verifyRaffle } from "@/lib/fairness/verify";
import { createHmac } from "node:crypto";
import vectors from "../../docs/fairness-test-vectors.json";

describe("fairness core", () => {
  it("builds the locked message format", () => {
    expect(buildMessage("abc", 7, "pv1", "deadbeef")).toBe("abc:7:pv1:deadbeef");
  });
  it("HMAC digest matches node crypto directly", () => {
    const seed = "11".repeat(32);
    const msg = "client:0:pv:hash";
    expect(hmacDigest(seed, msg)).toBe(createHmac("sha256", seed).update(msg).digest("hex"));
  });
  it("rejection sampling rejects values at or above the limit and accepts below", () => {
    const range = 3;
    const limit = SAMPLE_SPACE - (SAMPLE_SPACE % range); // 4294967295
    // first window = 0xffffffff (>= limit -> rejected), second window = 0x00000001 -> accepted, index 1
    const digest = "ffffffff" + "00000001" + "0".repeat(48);
    const r = selectIndexFromDigest(digest, range, () => "0".repeat(64));
    expect(r.limit).toBe(limit);
    expect(r.steps[0]).toMatchObject({ accepted: false, value: 0xffffffff });
    expect(r.steps[1]).toMatchObject({ accepted: true, value: 1 });
    expect(r.index).toBe(1);
  });
  it("uses extension digests when the primary digest is exhausted", () => {
    const range = 3;
    const digest = "ffffffff".repeat(8);
    let calls = 0;
    const r = selectIndexFromDigest(digest, range, (ext) => {
      calls++;
      return ext === 1 ? "ffffffff".repeat(8) : "00000002" + "0".repeat(56);
    });
    expect(calls).toBe(2);
    expect(r.index).toBe(2);
    expect(r.steps.filter((s) => !s.accepted).length).toBe(16);
  });
  it("boundary: value exactly limit-1 is accepted, limit is rejected", () => {
    const range = 1000;
    const limit = SAMPLE_SPACE - (SAMPLE_SPACE % range);
    const hex = (n: number) => n.toString(16).padStart(8, "0");
    const r1 = selectIndexFromDigest(hex(limit - 1) + "0".repeat(56), range, () => "0".repeat(64));
    expect(r1.steps[0].accepted).toBe(true);
    expect(r1.index).toBe((limit - 1) % range);
    const r2 = selectIndexFromDigest(hex(limit) + hex(5) + "0".repeat(48), range, () => "0".repeat(64));
    expect(r2.steps[0].accepted).toBe(false);
    expect(r2.index).toBe(5);
  });
  it("maps index to outcome by cumulative weights", () => {
    expect(mapIndexToOutcome(0, [1, 9, 90])).toEqual({ outcomeIndex: 0, offsetWithinOutcome: 0 });
    expect(mapIndexToOutcome(1, [1, 9, 90])).toEqual({ outcomeIndex: 1, offsetWithinOutcome: 0 });
    expect(mapIndexToOutcome(99, [1, 9, 90])).toEqual({ outcomeIndex: 2, offsetWithinOutcome: 89 });
    expect(() => mapIndexToOutcome(100, [1, 9, 90])).toThrow();
    expect(mapIndexToOutcome(1, [1, 0, 5]).outcomeIndex).toBe(2); // zero-weight outcomes are skipped
  });

  it("property: index always within range", () => {
    fc.assert(
      fc.property(fc.uint8Array({ minLength: 32, maxLength: 32 }).map((a) => Buffer.from(a).toString("hex")), fc.integer({ min: 1, max: 1_000_000 }), (digest, range) => {
        const r = selectIndexFromDigest(digest, range, (e) => createHmac("sha256", "k").update(`${digest}:${e}`).digest("hex"));
        return r.index >= 0 && r.index < range && Number.isInteger(r.index);
      }),
      { numRuns: 500 },
    );
  });

  it("property: distribution is unbiased within statistical tolerance (chi-square)", () => {
    const range = 7;
    const trials = 70_000;
    const counts = new Array(range).fill(0);
    const seed = "ab".repeat(32);
    for (let n = 0; n < trials; n++) {
      const r = draw({ serverSeed: seed, clientSeed: "dist", nonce: n, scopeId: "pv", manifestHash: "m", range });
      counts[r.index]++;
    }
    const expected = trials / range;
    const chi = counts.reduce((a, c) => a + (c - expected) ** 2 / expected, 0);
    // df = 6, critical value at p=0.001 is 22.46
    expect(chi).toBeLessThan(22.46);
  });

  it("published test vectors reproduce", async () => {
    for (const v of vectors.openings) {
      expect(serverSeedHash(v.serverSeed)).toBe(v.serverSeedHash);
      const d = draw({ serverSeed: v.serverSeed, clientSeed: v.clientSeed, nonce: v.nonce, scopeId: v.packVersionId, manifestHash: v.manifestHash, range: v.remainingQuantities.reduce((a, b) => a + b, 0) });
      expect(d.message).toBe(v.message);
      expect(d.digest).toBe(v.digest);
      expect(d.index).toBe(v.selectedIndex);
      expect(mapIndexToOutcome(d.index, v.remainingQuantities).outcomeIndex).toBe(v.outcomePosition);
      const verified = await verifyOpening({ ...v, expectedDigest: v.digest, expectedIndex: v.selectedIndex, expectedOutcomePosition: v.outcomePosition });
      expect(verified.ok).toBe(true);
    }
    for (const v of vectors.raffles) {
      const out = await verifyRaffle({ ...v, expectedWinners: v.winningTickets });
      expect(out.ok).toBe(true);
      expect(out.winners.map((w) => w.ticketNumber)).toEqual(v.winningTickets);
    }
  });

  it("verifier detects a tampered seed", async () => {
    const v = vectors.openings[0];
    const bad = await verifyOpening({ ...v, serverSeed: "00".repeat(32), expectedDigest: v.digest });
    expect(bad.ok).toBe(false);
  });

  it("signs and verifies receipts, rejecting tampering", () => {
    process.env.DATA_ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY ?? "11".repeat(32);
    const { canonical, signature } = signReceipt({ b: 2, a: 1n });
    expect(canonical).toBe('{"a":"1","b":2}');
    expect(verifyReceiptSignature(canonical, signature)).toBe(true);
    expect(verifyReceiptSignature(canonical.replace("2", "3"), signature)).toBe(false);
  });
});
