import { route, ok } from "@/lib/api";
import { drawBody, idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { drawRaffle } from "@/domain/raffles";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "admin", permission: "raffles.draw", params: idParam, body: drawBody }, async ({ params, body, session }) => {
  const db = getDb();
  const d = await drawRaffle(db, session!.user.id, params.id, body.publicRandomness, body.publicRandomnessSource);
  drainOutbox(db, 50).catch(() => undefined);
  return ok({ draw: d }, 201);
});
