import { route, ok } from "@/lib/api";
import { idParam, redrawBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { redrawRaffle } from "@/domain/raffles";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "admin", permission: "raffles.draw", params: idParam, body: redrawBody }, async ({ params, body, session }) => {
  const db = getDb();
  const d = await redrawRaffle(db, session!.user.id, params.id, body.reason, body.publicRandomness, body.publicRandomnessSource);
  drainOutbox(db, 50).catch(() => undefined);
  return ok({ draw: d }, 201);
});
