import { route, ok } from "@/lib/api";
import { verificationBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { submitVerification } from "@/domain/users";

export const POST = route({ auth: "user", body: verificationBody, rateLimit: { max: 10, windowSec: 3600, key: "user" } }, async ({ body, session }) => {
  const v = await submitVerification(getDb(), session!.user.id, body.type, body.payload);
  return ok({ verification: { id: v.id, type: v.type, status: v.status, provider: v.provider, reason: v.reason } }, 201);
});
