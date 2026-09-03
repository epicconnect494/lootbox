import { z } from "zod";
import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { removeOutcome } from "@/domain/packs";

const params = z.object({ id: z.string().uuid(), outcomeId: z.string().uuid() });
export const DELETE = route({ auth: "admin", permission: "packs.write", params }, async ({ params, session, requestId }) => {
  await removeOutcome(getDb(), { userId: session!.user.id, role: session!.user.roles.join(","), correlationId: requestId }, params.id, params.outcomeId);
  return ok({ ok: true });
});
