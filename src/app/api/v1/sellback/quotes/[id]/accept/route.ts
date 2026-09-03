import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { acceptSellbackQuote } from "@/domain/vault";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "user", params: idParam, idempotent: "sellback.accept" }, async ({ params, session, idempotencyKey }) => {
  const db = getDb();
  const q = await acceptSellbackQuote(db, session!.user.id, params.id, idempotencyKey!);
  drainOutbox(db, 10).catch(() => undefined);
  return ok({ quote: q });
});
