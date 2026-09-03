import { route, ok } from "@/lib/api";
import { rotateSeedBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { rotateUserSeed } from "@/domain/openings";

export const POST = route({ auth: "user", body: rotateSeedBody, rateLimit: { max: 10, windowSec: 60, key: "user" } }, async ({ body, session }) => {
  return ok(await rotateUserSeed(getDb(), session!.user.id, body.clientSeed));
});
