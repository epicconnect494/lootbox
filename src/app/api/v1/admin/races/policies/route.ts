import { route, ok } from "@/lib/api";
import { scoringPolicyBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { createScoringPolicy } from "@/domain/races";

export const POST = route({ auth: "admin", permission: "races.write", body: scoringPolicyBody }, async ({ body, session }) => {
  return ok({ policy: await createScoringPolicy(getDb(), session!.user.id, body.name, body.rules) }, 201);
});
