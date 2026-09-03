import { route, ok } from "@/lib/api";
import { sellbackQuoteBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { createSellbackQuote, SELLBACK_POLICY_VERSION } from "@/domain/vault";

export const POST = route({ auth: "user", body: sellbackQuoteBody }, async ({ body, session }) => {
  const q = await createSellbackQuote(getDb(), session!.user.id, body.holdingId);
  return ok({ quote: q, policy: { version: SELLBACK_POLICY_VERSION, description: "The sell-back offer is the exact amount disclosed on the pack page when the item was won. It never changes after the opening." } }, 201);
});
