import { route, ok } from "@/lib/api";
import { idParam, reasonBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { cancelListing } from "@/domain/vault";

export const DELETE = route({ auth: "admin", permission: "marketplace.write", params: idParam, body: reasonBody }, async ({ params, body, session }) => {
  await cancelListing(getDb(), session!.user.id, params.id, { adminUserId: session!.user.id, reason: body.reason });
  return ok({ ok: true });
});
