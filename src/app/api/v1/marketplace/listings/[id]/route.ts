import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { cancelListing } from "@/domain/vault";

export const DELETE = route({ auth: "user", params: idParam }, async ({ params, session }) => {
  await cancelListing(getDb(), session!.user.id, params.id);
  return ok({ ok: true });
});
