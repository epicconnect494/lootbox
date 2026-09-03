import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { verificationReviewBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { userVerification } from "@/db/schema";
import { audit } from "@/lib/audit";
import { err } from "@/lib/errors";

const params = z.object({ id: z.string().uuid(), vid: z.string().uuid() });
export const POST = route({ auth: "admin", permission: "users.write", params, body: verificationReviewBody }, async ({ params, body, session, requestId }) => {
  const db = getDb();
  const v = await db.transaction(async (tx) => {
    const [before] = await tx.select().from(userVerification).where(and(eq(userVerification.id, params.vid), eq(userVerification.userId, params.id))).for("update");
    if (!before) throw err.notFound("Verification");
    const [after] = await tx.update(userVerification).set({ status: body.status, reason: body.reason, reviewedBy: session!.user.id, expiresAt: body.status === "APPROVED" ? new Date(Date.now() + 365 * 86_400_000) : null }).where(eq(userVerification.id, params.vid)).returning();
    await audit(tx, { actorUserId: session!.user.id, action: "verification.review", entityType: "user_verification", entityId: params.vid, reason: body.reason, before: { status: before.status }, after: { status: after.status }, correlationId: requestId });
    return after;
  });
  return ok({ verification: { id: v.id, type: v.type, status: v.status, reason: v.reason } });
});
