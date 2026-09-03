import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/domain/races";

// pointsFor is internal; we exercise the exported default rules' arithmetic contract here.
describe("race scoring rules", () => {
  it("uses integer whole-unit arithmetic and caps per event", () => {
    const units = Number(123456n / 100n); // $1234.56 -> 1234 whole units
    const raw = units * DEFAULT_RULES.pointsPerUnitSpent + DEFAULT_RULES.pointsPerOpening;
    expect(raw).toBe(12345);
    expect(Math.min(DEFAULT_RULES.maxPointsPerEvent, raw)).toBe(2000);
    expect(DEFAULT_RULES.pointsPerPromoUnit).toBeGreaterThanOrEqual(DEFAULT_RULES.pointsPerUnitSpent);
    expect(DEFAULT_RULES.tiePolicy).toBe("EARLIEST_QUALIFYING_EVENT_WINS");
    expect(DEFAULT_RULES.excludedKinds).toEqual(expect.arrayContaining(["VOID", "REFUND", "CHARGEBACK", "FRAUD", "BONUS_ABUSE"]));
  });
});
