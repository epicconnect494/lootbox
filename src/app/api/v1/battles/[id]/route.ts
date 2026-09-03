import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { getBattleView } from "@/domain/battles";
import { err } from "@/lib/errors";

export const GET = route({ auth: "optional", params: idParam }, async ({ params, session }) => {
  const view = await getBattleView(getDb(), params.id, session?.user.id ?? null);
  if (!view) throw err.notFound("Battle");
  return ok(view);
});
