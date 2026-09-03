/**
 * Shared types for customer pages. Server components pass domain results through `json()` (bigint → string,
 * Date → ISO string); `Serialized<T>` mirrors that conversion at the type level so client components stay honest.
 */
import type { listCatalog, getPackDetail } from "@/domain/packs";
import type { getOpeningView } from "@/domain/openings";
import type { listVault } from "@/domain/vault";

export type Serialized<T> = T extends bigint
  ? string
  : T extends Date
    ? string
    : T extends Array<infer U>
      ? Serialized<U>[]
      : T extends object
        ? { [K in keyof T]: Serialized<T[K]> }
        : T;

export type CatalogItem = Serialized<Awaited<ReturnType<typeof listCatalog>>[number]>;
export type PackDetail = Serialized<NonNullable<Awaited<ReturnType<typeof getPackDetail>>>>;
export type PackOutcome = PackDetail["outcomes"][number];
export type OpeningView = Serialized<NonNullable<Awaited<ReturnType<typeof getOpeningView>>>>;
export type VaultView = Serialized<Awaited<ReturnType<typeof listVault>>>;
export type VaultItem = VaultView["items"][number];

export interface GateReason {
  code: string;
  message: string;
}

/** Maps an eligibility reason code to the Account section that resolves it. */
export function gateFix(code: string): { href: string; label: string } {
  if (code === "JURISDICTION_UNKNOWN" || code === "PAID_CHANCE_DISABLED" || code === "CASH_CONVERSION_DISABLED" || code === "BATTLES_DISABLED" || code === "RAFFLES_DISABLED") return { href: "/account#region", label: "Set region" };
  if (code === "AGE_UNVERIFIED" || code === "IDENTITY_UNVERIFIED") return { href: "/account#verification", label: "Verify identity" };
  if (code === "INSUFFICIENT_FUNDS") return { href: "/account#wallet", label: "Deposit" };
  if (code === "COOLING_OFF" || code === "SELF_EXCLUSION" || code === "OPERATOR_EXCLUSION" || code.startsWith("LIMIT_")) return { href: "/account#responsible-play", label: "Responsible play" };
  return { href: "/account", label: "Account" };
}
