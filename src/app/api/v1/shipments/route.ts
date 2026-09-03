import { route, ok } from "@/lib/api";
import { shipmentBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { requestShipment } from "@/domain/vault";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "user", body: shipmentBody }, async ({ body, session }) => {
  const db = getDb();
  const s = await requestShipment(db, session!.user.id, body.holdingId, body.address, { insured: body.insured });
  drainOutbox(db, 10).catch(() => undefined);
  return ok({ shipment: { id: s.id, status: s.status, insured: s.insured, insuredValueMinor: s.insuredValueMinor, addressCountry: s.addressCountry, createdAt: s.createdAt } }, 201);
});
