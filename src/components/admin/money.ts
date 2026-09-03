/** Client-safe money helpers for admin forms. Minor units are strings (bigint-safe); form inputs are decimal strings. */
export function toDecimal(minor: string | number | bigint | null | undefined): string {
  if (minor === null || minor === undefined) return "";
  const n = BigInt(minor);
  const neg = n < 0n;
  const abs = neg ? -n : n;
  return `${neg ? "-" : ""}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0")}`;
}

export function isDecimal(s: string): boolean {
  return /^\d+(\.\d{1,2})?$/.test(s.trim());
}

export function decimalToMinor(s: string): bigint {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s.trim());
  if (!m) return 0n;
  return BigInt(m[1]) * 100n + BigInt((m[2] ?? "").padEnd(2, "0"));
}

/** value * 10000 / base, rounded half-up. */
export function bpOf(value: bigint, base: bigint): number {
  if (base <= 0n) return 0;
  const num = value * 10000n;
  const q = num / base;
  const r = num % base;
  return Number(r * 2n >= base ? q + 1n : q);
}

/** Local datetime-local input value → ISO string (or null when empty). */
export function toIso(local: string): string | null {
  if (!local) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** ISO/Date → value for a datetime-local input (local time). */
export function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
