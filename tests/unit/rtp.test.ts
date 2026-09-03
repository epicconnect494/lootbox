import { describe, expect, it } from "vitest";
import { computeEconomics, computeRtp, suggestRtpAdjustments, validatePackEconomics, type OutcomeInput } from "@/lib/rtp";

const price = 1000n; // $10
const outcomes: OutcomeInput[] = [
  { label: "Grail", quantity: 1, referenceValueMinor: 50000n, sellbackOfferMinor: 40000n, isUniqueItem: true },
  { label: "Rare", quantity: 9, referenceValueMinor: 5000n, sellbackOfferMinor: 4000n },
  { label: "Common", quantity: 90, referenceValueMinor: 700n, sellbackOfferMinor: 600n },
];

describe("rtp", () => {
  it("computes exact RTP in basis points", () => {
    const r = computeRtp(price, outcomes);
    // merchandise: 50000 + 45000 + 63000 = 158000 / (100*1000=100000) = 158.00%
    expect(r.totalOpenings).toBe(100);
    expect(r.merchandiseRtpBp).toBe(15800);
    // sellback: 40000 + 36000 + 54000 = 130000 / 100000 = 130.00%
    expect(r.sellbackRtpBp).toBe(13000);
    expect(r.probabilities[0].exact).toBe("1/100");
    expect(r.probabilities[2].bp).toBe(9000);
  });
  it("validates against 90% target with tolerance", () => {
    const good: OutcomeInput[] = [
      { quantity: 1, referenceValueMinor: 20000n, sellbackOfferMinor: 16000n },
      { quantity: 99, referenceValueMinor: 900n, sellbackOfferMinor: 747n },
    ];
    // sellback: 16000 + 99*747 = 16000 + 73953 = 89953 / 100000 = 89.95%
    const v = validatePackEconomics(price, good, { targetRtpBp: 9000, toleranceBp: 50, basis: "SELLBACK", expectedTotalOpenings: 100 });
    expect(v.ok).toBe(true);
    expect(v.result?.sellbackRtpBp).toBe(8995);
    const bad = validatePackEconomics(price, outcomes, { targetRtpBp: 9000, toleranceBp: 50, basis: "SELLBACK" });
    expect(bad.ok).toBe(false);
    expect(bad.errors.join(" ")).toMatch(/outside/);
  });
  it("rejects invalid quantities and sellback > reference", () => {
    const v = validatePackEconomics(price, [{ quantity: 0, referenceValueMinor: 1n, sellbackOfferMinor: 2n }], { targetRtpBp: 9000, toleranceBp: 50, basis: "SELLBACK" });
    expect(v.ok).toBe(false);
    expect(v.errors.length).toBeGreaterThanOrEqual(2);
    const u = validatePackEconomics(price, [{ quantity: 2, referenceValueMinor: 100n, sellbackOfferMinor: 50n, isUniqueItem: true }], { targetRtpBp: 9000, toleranceBp: 50, basis: "SELLBACK" });
    expect(u.errors.join(" ")).toMatch(/unique/);
    const sum = validatePackEconomics(price, outcomes, { targetRtpBp: 9000, toleranceBp: 50, basis: "SELLBACK", expectedTotalOpenings: 99 });
    expect(sum.errors.join(" ")).toMatch(/must equal total openings/);
  });
  it("solver suggests a common-outcome adjustment that lands on target", () => {
    const s = suggestRtpAdjustments(price, outcomes, { targetRtpBp: 9000, toleranceBp: 50, basis: "SELLBACK" });
    const value = s.find((x) => x.kind === "ADJUST_COMMON_VALUE");
    expect(value).toBeDefined();
    expect(Math.abs((value!.projected!.sellbackRtpBp ?? 0) - 9000)).toBeLessThanOrEqual(50);
    const qty = s.find((x) => x.kind === "ADJUST_COMMON_QUANTITY");
    expect(qty).toBeDefined();
    expect(Math.abs(qty!.projected!.sellbackRtpBp - 9000)).toBeLessThanOrEqual(50);
    expect(qty!.projected!.totalOpenings).toBe(qty!.newTotalOpenings);
    const onTarget = suggestRtpAdjustments(price, [{ quantity: 10, referenceValueMinor: 1000n, sellbackOfferMinor: 900n }], { targetRtpBp: 9000, toleranceBp: 50, basis: "SELLBACK" });
    expect(onTarget[0].kind).toBe("ALREADY_ON_TARGET");
  });
  it("economics scenarios use exact integers", () => {
    const r = computeRtp(price, outcomes);
    const e = computeEconomics(r, { paymentFeeBp: 290, paymentFeeFixedMinor: 30n, fraudReserveBp: 100, rewardsAllocationBp: 200, shippingSubsidyMinor: 600n, shipRateBp: 3000, acquisitionCostMinor: 60000n });
    expect(e.grossSalesMinor).toBe(100000n);
    expect(e.paymentFeesMinor).toBe(2900n + 3000n);
    expect(e.shippingSubsidyMinor).toBe(18000n); // 100 * 600 * 0.3
    expect(e.contributionMarginMinor).toBe(100000n - 60000n - 5900n - 2000n - 18000n - 1000n);
  });
});
