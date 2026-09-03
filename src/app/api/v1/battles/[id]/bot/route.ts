import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { addBot, getBattleView } from "@/domain/battles";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "user", params: idParam }, async ({ params, session }) => {
  const db = getDb();
  await addBot(db, session!.user.id, params.id);
  await drainOutbox(db, 50).catch(() => undefined);
  return ok(await getBattleView(db, params.id, session!.user.id));
});
