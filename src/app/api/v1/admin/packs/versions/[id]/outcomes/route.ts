import { route, ok } from "@/lib/api";
import { idParam, outcomeBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { upsertOutcome } from "@/domain/packs";
import { parseDecimalToMinor } from "@/lib/money";

export const POST = route({ auth: "admin", permission: "packs.write", params: idParam, body: outcomeBody }, async ({ params, body, session, requestId }) => {
  const o = await upsertOutcome(getDb(), { userId: session!.user.id, role: session!.user.roles.join(","), correlationId: requestId }, params.id, { ...body, referenceValueMinor: parseDecimalToMinor(body.referenceValue), sellbackOfferMinor: parseDecimalToMinor(body.sellbackOffer) });
  return ok({ outcome: o }, body.id ? 200 : 201);
});
