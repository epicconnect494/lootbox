import { route, ok } from "@/lib/api";
import { valuationBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { recordValuation } from "@/domain/admin";
import { parseDecimalToMinor } from "@/lib/money";

export const POST = route({ auth: "admin", permission: "inventory.write", body: valuationBody }, async ({ body, session }) => {
  const v = await recordValuation(getDb(), session!.user.id, { skuId: body.skuId, inventoryItemId: body.inventoryItemId, referenceValueMinor: parseDecimalToMinor(body.referenceValue), sellbackOfferMinor: parseDecimalToMinor(body.sellbackOffer), source: body.source, sourceRef: body.sourceRef });
  return ok({ valuation: v }, 201);
});
