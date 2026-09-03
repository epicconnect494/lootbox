import { route, ok } from "@/lib/api";
import { collectionBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { setCollection } from "@/domain/vault";

export const POST = route({ auth: "user", body: collectionBody }, async ({ body, session }) => {
  await setCollection(getDb(), session!.user.id, body.holdingIds, body.collectionName);
  return ok({ ok: true });
});
