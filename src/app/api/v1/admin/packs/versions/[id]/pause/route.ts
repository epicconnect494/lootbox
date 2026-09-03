import { route, ok } from "@/lib/api";
import { idParam, reasonBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { pauseVersion } from "@/domain/packs";

export const POST = route({ auth: "admin", permission: "packs.publish", params: idParam, body: reasonBody }, async ({ params, body, session, requestId }) => {
  const actor = { userId: session!.user.id, role: session!.user.roles.join(","), correlationId: requestId };
  const result = await pauseVersion(getDb(), actor, params.id, body.reason);
  return ok({ result: result ?? null });
});
