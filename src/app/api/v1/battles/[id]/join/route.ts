import { route, ok } from "@/lib/api";
import { battleJoinBody, idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { getBattleView, joinBattle } from "@/domain/battles";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "user", params: idParam, body: battleJoinBody, idempotent: "battles.join" }, async ({ params, body, session, idempotencyKey }) => {
  const db = getDb();
  await joinBattle(db, session!.user.id, params.id, body.joinCode ?? null, idempotencyKey!);
  await drainOutbox(db, 50).catch(() => undefined);
  return ok(await getBattleView(db, params.id, session!.user.id));
});
