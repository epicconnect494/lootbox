/**
 * Money helpers. All amounts are integer minor units (e.g. cents) as BigInt.
 * Floating point is never used for money. Basis points (bp) are integers where 10000 = 100%.
 */
export type Minor = bigint;
export const BP_SCALE = 10_000n;

export function minor(v: bigint | number | string): Minor {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") {
    if (!Number.isInteger(v)) throw new Error(`minor(): non-integer number ${v}`);
    return BigInt(v);
  }
  if (!/^-?\d+$/.test(v)) throw new Error(`minor(): invalid integer string "${v}"`);
  return BigInt(v);
}

/** Parse a decimal string like "12.50" into minor units exactly (2 decimal places). */
export function parseDecimalToMinor(input: string, decimals = 2): Minor {
  const s = input.trim();
  const m = /^(-)?(\d+)(?:\.(\d+))?$/.exec(s);
  if (!m) throw new Error(`invalid decimal amount "${input}"`);
  const [, neg, whole, fracRaw = ""] = m;
  if (fracRaw.length > decimals) throw new Error(`amount "${input}" has more than ${decimals} decimal places`);
  const frac = (fracRaw + "0".repeat(decimals)).slice(0, decimals);
  const value = BigInt(whole) * 10n ** BigInt(decimals) + BigInt(frac);
  return neg ? -value : value;
}

export function formatMinor(v: Minor | number | string, currency = "USD", opts: { compact?: boolean } = {}): string {
  const n = minor(v);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  const whole = abs / 100n;
  const cents = abs % 100n;
  const symbol = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : `${currency} `;
  const wholeStr = whole.toLocaleString("en-US");
  const body = opts.compact && cents === 0n ? wholeStr : `${wholeStr}.${cents.toString().padStart(2, "0")}`;
  return `${neg ? "-" : ""}${symbol}${body}`;
}

/** value * bp / 10000, rounding half-up on the absolute value. */
export function applyBp(value: Minor, bp: number | bigint): Minor {
  const b = BigInt(bp);
  const prod = value * b;
  return divRound(prod, BP_SCALE);
}

/** Integer division with round-half-up (away from zero). */
export function divRound(num: bigint, den: bigint): bigint {
  if (den === 0n) throw new Error("division by zero");
  const neg = num < 0n !== den < 0n;
  const a = num < 0n ? -num : num;
  const d = den < 0n ? -den : den;
  const q = a / d;
  const r = a % d;
  const rounded = r * 2n >= d ? q + 1n : q;
  return neg ? -rounded : rounded;
}

/** Ratio as basis points: num/den * 10000, rounded half-up. */
export function ratioBp(num: bigint, den: bigint): number {
  if (den === 0n) throw new Error("ratioBp: zero denominator");
  return Number(divRound(num * BP_SCALE, den));
}

export function formatBp(bp: number | null | undefined, digits = 2): string {
  if (bp === null || bp === undefined) return "—";
  const neg = bp < 0;
  const abs = Math.abs(bp);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const f = digits === 0 ? "" : `.${frac.toString().padStart(2, "0").slice(0, digits)}`;
  return `${neg ? "-" : ""}${whole}${f}%`;
}

export function sumMinor(values: Iterable<Minor>): Minor {
  let s = 0n;
  for (const v of values) s += v;
  return s;
}

export function assertPositive(v: Minor, label = "amount"): void {
  if (v <= 0n) throw new Error(`${label} must be positive`);
}

export function assertSameCurrency(a: string, b: string): void {
  if (a !== b) throw new Error(`currency mismatch ${a} vs ${b}`);
}

/** JSON-safe serialization of bigint fields. */
export function bigintToJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v))) as T;
}
