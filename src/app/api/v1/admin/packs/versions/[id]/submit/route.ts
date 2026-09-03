import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { submitForApproval } from "@/domain/packs";

export const POST = route({ auth: "admin", permission: "packs.write", params: idParam }, async ({ params, session, requestId }) => {
  const actor = { userId: session!.user.id, role: session!.user.roles.join(","), correlationId: requestId };
  const result = await submitForApproval(getDb(), actor, params.id);
  return ok({ result: result ?? null });
});
