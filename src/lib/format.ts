import { formatBp, formatMinor } from "./money";

export { formatMinor as money, formatBp as pct };

export function moneyStr(v: string | number | bigint | null | undefined, currency = "USD", compact = false): string {
  if (v === null || v === undefined) return "—";
  return formatMinor(typeof v === "string" ? BigInt(v) : v, currency, { compact });
}

export function probability(num: number, den: number): string {
  if (den <= 0) return "—";
  const pct = (num / den) * 100;
  if (pct >= 10) return `${pct.toFixed(1)}%`;
  if (pct >= 1) return `${pct.toFixed(2)}%`;
  return `${pct.toFixed(3)}%`;
}

export function fmtDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" }): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", opts).format(date);
}

export function relative(d: string | Date): string {
  const date = typeof d === "string" ? new Date(d) : d;
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  return rtf.format(Math.round(diff / 86_400_000), "day");
}

export function shortHash(h: string | null | undefined, n = 10): string {
  if (!h) return "—";
  return h.length > n * 2 ? `${h.slice(0, n)}…${h.slice(-6)}` : h;
}

export function tierLabel(tier: string): string {
  return tier.charAt(0) + tier.slice(1).toLowerCase();
}
