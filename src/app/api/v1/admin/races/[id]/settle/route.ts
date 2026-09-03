import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { settleRace } from "@/domain/races";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "admin", permission: "races.settle", params: idParam }, async ({ params, session }) => {
  const db = getDb();
  const result = await settleRace(db, session!.user.id, params.id);
  drainOutbox(db, 50).catch(() => undefined);
  return ok({ result });
});
