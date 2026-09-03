import { route, ok } from "@/lib/api";
import { idParam, reviewBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { reviewVersion } from "@/domain/packs";

export const POST = route({ auth: "admin", permission: "packs.approve", params: idParam, body: reviewBody }, async ({ params, body, session, requestId }) => {
  await reviewVersion(getDb(), { userId: session!.user.id, role: session!.user.roles.join(","), correlationId: requestId }, params.id, body.decision, body.reason);
  return ok({ ok: true });
});
