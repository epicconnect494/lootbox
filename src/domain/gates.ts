import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { jurisdiction, responsiblePlayLimit, selfExclusion, user, userVerification } from "@/db/schema";
import { config } from "@/lib/config";
import { err } from "@/lib/errors";
import type { Minor } from "@/lib/money";
import { sumUserCredits, sumUserDebits } from "./ledger";

export type GatedAction = "OPEN" | "BATTLE" | "RAFFLE_PAID" | "RAFFLE_FREE" | "SELLBACK" | "DEPOSIT" | "MARKETPLACE" | "RACE";

export interface GateResult {
  ok: boolean;
  reasons: Array<{ code: string; message: string }>;
  jurisdictionCode: string | null;
}

const LIMIT_WINDOWS: Record<string, number> = { DAILY: 1, WEEKLY: 7, MONTHLY: 30 };

/**
 * Age, identity, jurisdiction and responsible-play gates. Returns every failing reason so the UI can explain.
 * Odds are never affected by anything here: this only decides whether an action may proceed.
 */
export async function checkEligibility(db: DbOrTx, userId: string, action: GatedAction, amountMinor: Minor = 0n): Promise<GateResult> {
  const reasons: GateResult["reasons"] = [];
  const u = await db.query.user.findFirst({ where: eq(user.id, userId) });
  if (!u) throw err.notFound("User");
  if (u.status !== "ACTIVE") reasons.push({ code: "ACCOUNT_STATUS", message: "Account is not active." });

  const j = u.jurisdictionCode ? await db.query.jurisdiction.findFirst({ where: eq(jurisdiction.code, u.jurisdictionCode) }) : null;
  if (!j) reasons.push({ code: "JURISDICTION_UNKNOWN", message: "Set your region in Account before continuing." });

  const isPaid = action === "OPEN" || action === "BATTLE" || action === "RAFFLE_PAID" || action === "MARKETPLACE";
  if (j) {
    if ((action === "OPEN" || action === "BATTLE") && (!config.features.paidChance || !j.paidChanceEnabled)) reasons.push({ code: "PAID_CHANCE_DISABLED", message: "Paid pack opening is not enabled in your region." });
    if (action === "BATTLE" && (!config.features.battles || !j.battlesEnabled)) reasons.push({ code: "BATTLES_DISABLED", message: "Battles are not enabled in your region." });
    if ((action === "RAFFLE_PAID" || action === "RAFFLE_FREE") && (!config.features.raffles || !j.rafflesEnabled)) reasons.push({ code: "RAFFLES_DISABLED", message: "Raffles are not enabled in your region." });
    if (action === "SELLBACK" && (!config.features.cashConversion || !j.cashConversionEnabled)) reasons.push({ code: "CASH_CONVERSION_DISABLED", message: "Sell-back to cash is not enabled in your region." });
  }

  // Age: approved AGE verification or DOB >= min age.
  const minAge = j?.minAge ?? 18;
  const ageVerified = await db.query.userVerification.findFirst({ where: and(eq(userVerification.userId, userId), eq(userVerification.type, "AGE"), eq(userVerification.status, "APPROVED")) });
  let ageOk = !!ageVerified;
  if (!ageOk && u.dateOfBirth) {
    const dob = new Date(u.dateOfBirth);
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - minAge);
    ageOk = dob <= cutoff;
  }
  if (!ageOk && action !== "RACE") reasons.push({ code: "AGE_UNVERIFIED", message: `You must be ${minAge}+ and age-verified.` });

  if (isPaid || action === "SELLBACK") {
    const kyc = await db.query.userVerification.findFirst({ where: and(eq(userVerification.userId, userId), eq(userVerification.type, "IDENTITY"), eq(userVerification.status, "APPROVED")) });
    if (!kyc) reasons.push({ code: "IDENTITY_UNVERIFIED", message: "Identity verification is required." });
  }

  const now = new Date();
  const exclusion = await db.query.selfExclusion.findFirst({
    where: and(eq(selfExclusion.userId, userId), or(isNull(selfExclusion.endsAt), gt(selfExclusion.endsAt, now))),
    orderBy: desc(selfExclusion.createdAt),
  });
  if (exclusion && exclusion.startsAt <= now && action !== "SELLBACK") {
    reasons.push({ code: exclusion.type, message: exclusion.type === "COOLING_OFF" ? `Cooling-off period active until ${exclusion.endsAt?.toISOString() ?? "further notice"}.` : "Self-exclusion is active." });
  }

  // Spend / deposit limits.
  if (isPaid || action === "DEPOSIT") {
    const family = action === "DEPOSIT" ? "DEPOSIT" : "SPEND";
    const limits = await db.query.responsiblePlayLimit.findMany({ where: and(eq(responsiblePlayLimit.userId, userId), isNull(responsiblePlayLimit.supersededAt)) });
    for (const l of limits) {
      if (!l.type.startsWith(family) || l.effectiveAt > now) continue;
      const window = l.type.split("_")[1];
      const since = new Date(now.getTime() - LIMIT_WINDOWS[window] * 86_400_000);
      const used = family === "DEPOSIT" ? await sumUserCredits(db, userId, ["DEPOSIT"], since) : await sumUserDebits(db, userId, ["PACK_PURCHASE", "BATTLE_ENTRY", "MARKETPLACE_PURCHASE"], since);
      if (used + amountMinor > l.amountMinor) reasons.push({ code: `LIMIT_${l.type}`, message: `This would exceed your ${window.toLowerCase()} ${family.toLowerCase()} limit.` });
    }
  }
  return { ok: reasons.length === 0, reasons, jurisdictionCode: u.jurisdictionCode };
}

export async function assertEligible(db: DbOrTx, userId: string, action: GatedAction, amountMinor: Minor = 0n): Promise<void> {
  const r = await checkEligibility(db, userId, action, amountMinor);
  if (!r.ok) throw err.gate(r.reasons[0].message, { reasons: r.reasons });
}
