import { route, ok } from "@/lib/api";
import { amoeBody, idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { enterRaffle } from "@/domain/raffles";

/** Alternative method of entry adapter: staff record mailed/online free entries with a source reference. */
export const POST = route({ auth: "admin", permission: "raffles.write", params: idParam, body: amoeBody }, async ({ params, body, session }) => {
  const tickets = await enterRaffle(getDb(), body.userId, params.id, body.count, "AMOE", { idempotencyKey: `amoe:${body.sourceRef}`, sourceRef: body.sourceRef, actorUserId: session!.user.id });
  return ok({ tickets }, 201);
});
