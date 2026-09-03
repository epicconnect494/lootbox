import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { raffleView } from "@/domain/raffles";
import { err } from "@/lib/errors";

export const GET = route({ auth: "optional", params: idParam }, async ({ params, session }) => {
  const v = await raffleView(getDb(), params.id, session?.user.id ?? null);
  if (!v) throw err.notFound("Raffle");
  return ok(v);
});
