import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { markRevealed } from "@/domain/openings";

export const POST = route({ auth: "user", params: idParam }, async ({ params, session }) => {
  await markRevealed(getDb(), params.id, session!.user.id);
  return ok({ ok: true });
});
