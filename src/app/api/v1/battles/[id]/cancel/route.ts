import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { cancelBattle } from "@/domain/battles";

export const POST = route({ auth: "user", params: idParam }, async ({ params, session }) => {
  await cancelBattle(getDb(), session!.user.id, params.id);
  return ok({ ok: true });
});
