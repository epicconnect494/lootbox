import { eq } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { openingQuoteBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { packVersion } from "@/db/schema";
import { checkEligibility } from "@/domain/gates";
import { getUserBalance } from "@/domain/ledger";
import { err } from "@/lib/errors";

export const POST = route({ auth: "user", body: openingQuoteBody }, async ({ body, session }) => {
  const db = getDb();
  const v = await db.query.packVersion.findFirst({ where: eq(packVersion.id, body.packVersionId) });
  if (!v) throw err.notFound("Pack version");
  const balance = await getUserBalance(db, session!.user.id, v.currency);
  const gate = await checkEligibility(db, session!.user.id, "OPEN", v.priceMinor);
  return ok({
    packVersionId: v.id,
    status: v.status,
    priceMinor: v.priceMinor,
    currency: v.currency,
    remainingOpenings: v.remainingOpenings,
    totalOpenings: v.totalOpenings,
    manifestHash: v.manifestHash,
    balanceMinor: balance.cashMinor,
    sufficientFunds: balance.cashMinor >= v.priceMinor,
    eligible: gate.ok && v.status === "PUBLISHED" && v.remainingOpenings > 0 && balance.cashMinor >= v.priceMinor,
    reasons: gate.reasons,
  });
});
