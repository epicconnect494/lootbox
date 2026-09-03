import { route, ok } from "@/lib/api";
import { limitBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { setLimit } from "@/domain/users";
import { parseDecimalToMinor } from "@/lib/money";

export const POST = route({ auth: "user", body: limitBody }, async ({ body, session }) => {
  return ok({ limit: await setLimit(getDb(), session!.user.id, body.type, parseDecimalToMinor(body.amount)) }, 201);
});
