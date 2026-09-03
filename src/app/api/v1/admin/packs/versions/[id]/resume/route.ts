import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { resumeVersion } from "@/domain/packs";

export const POST = route({ auth: "admin", permission: "packs.publish", params: idParam }, async ({ params, session, requestId }) => {
  const actor = { userId: session!.user.id, role: session!.user.roles.join(","), correlationId: requestId };
  const result = await resumeVersion(getDb(), actor, params.id);
  return ok({ result: result ?? null });
});
