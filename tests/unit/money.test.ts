import { describe, expect, it } from "vitest";
import { applyBp, divRound, formatMinor, parseDecimalToMinor, ratioBp } from "@/lib/money";

describe("money", () => {
  it("parses decimals exactly", () => {
    expect(parseDecimalToMinor("12.50")).toBe(1250n);
    expect(parseDecimalToMinor("0.1")).toBe(10n);
    expect(parseDecimalToMinor("250")).toBe(25000n);
    expect(() => parseDecimalToMinor("1.234")).toThrow();
    expect(() => parseDecimalToMinor("abc")).toThrow();
  });
  it("rounds half-up in integer division", () => {
    expect(divRound(5n, 2n)).toBe(3n);
    expect(divRound(-5n, 2n)).toBe(-3n);
    expect(divRound(4n, 2n)).toBe(2n);
    expect(divRound(7n, 3n)).toBe(2n);
  });
  it("applies basis points without floats", () => {
    expect(applyBp(10000n, 290)).toBe(290n);
    expect(applyBp(1n, 5000)).toBe(1n); // 0.5 rounds up
    expect(ratioBp(9000n, 10000n)).toBe(9000);
  });
  it("formats", () => {
    expect(formatMinor(123456n)).toBe("$1,234.56");
    expect(formatMinor(-5n)).toBe("-$0.05");
    expect(formatMinor(25000n, "USD", { compact: true })).toBe("$250");
  });
});
