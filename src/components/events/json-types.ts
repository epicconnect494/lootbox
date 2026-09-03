/**
 * Type-level mirror of `json()` from `@/lib/server/data`: bigint and Date become strings once a
 * domain result crosses the server → client boundary. Type-only; safe to import anywhere.
 */
export type Json<T> = T extends bigint ? string : T extends Date ? string : T extends Array<infer U> ? Json<U>[] : T extends object ? { [K in keyof T]: Json<T[K]> } : T;

/** Request-time clock for server components (rendered once per request, so purity rules do not apply). */
export function requestNow(): number {
  return Date.now();
}

export function accountLinkForReason(code: string): string {
  if (code.startsWith("LIMIT_")) return "/account#limits";
  if (code === "COOLING_OFF" || code === "SELF_EXCLUSION" || code === "OPERATOR_EXCLUSION") return "/account#cooling-off";
  if (code === "AGE_UNVERIFIED" || code === "IDENTITY_UNVERIFIED") return "/account#verification";
  if (code === "JURISDICTION_UNKNOWN" || code.endsWith("_DISABLED")) return "/account#profile";
  return "/account";
}
