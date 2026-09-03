import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { buyListing } from "@/domain/vault";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "user", params: idParam, idempotent: "marketplace.buy" }, async ({ params, session, idempotencyKey }) => {
  const db = getDb();
  const order = await buyListing(db, session!.user.id, params.id, idempotencyKey!);
  drainOutbox(db, 10).catch(() => undefined);
  return ok({ order }, 201);
});
