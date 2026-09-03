import { route, ok } from "@/lib/api";
import { exclusionBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { setExclusion } from "@/domain/users";

export const POST = route({ auth: "user", body: exclusionBody }, async ({ body, session }) => {
  return ok({ exclusion: await setExclusion(getDb(), session!.user.id, body.type, body.days, body.reason) }, 201);
});
