import { route, ok } from "@/lib/api";
import { idParam, promoEntryBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { promoEntry } from "@/domain/races";
import { parseDecimalToMinor } from "@/lib/money";

export const POST = route({ auth: "admin", permission: "races.write", params: idParam, body: promoEntryBody }, async ({ body, session }) => {
  return ok({ result: await promoEntry(getDb(), session!.user.id, body.userId, parseDecimalToMinor(body.units), body.ref) }, 201);
});
