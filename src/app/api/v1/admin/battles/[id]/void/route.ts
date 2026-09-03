import { route, ok } from "@/lib/api";
import { idParam, reasonBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { voidBattle } from "@/domain/battles";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "admin", permission: "battles.void", params: idParam, body: reasonBody }, async ({ params, body, session }) => {
  const db = getDb();
  await voidBattle(db, session!.user.id, params.id, body.reason);
  await drainOutbox(db, 50).catch(() => undefined);
  return ok({ ok: true });
});
