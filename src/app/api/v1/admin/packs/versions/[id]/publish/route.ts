import { route, ok } from "@/lib/api";
import { idParam, publishBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { publishVersion } from "@/domain/packs";

export const POST = route({ auth: "admin", permission: "packs.publish", params: idParam, body: publishBody }, async ({ params, body, session, requestId }) => {
  const r = await publishVersion(getDb(), { userId: session!.user.id, role: session!.user.roles.join(","), correlationId: requestId }, params.id, { scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null });
  return ok(r);
});
