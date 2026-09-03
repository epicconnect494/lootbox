import { route, ok } from "@/lib/api";
import { adminExclusionBody, idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { selfExclusion, userSession } from "@/db/schema";
import { audit } from "@/lib/audit";
import { eq } from "drizzle-orm";

export const POST = route({ auth: "admin", permission: "risk.write", params: idParam, body: adminExclusionBody }, async ({ params, body, session, requestId }) => {
  const db = getDb();
  const row = await db.transaction(async (tx) => {
    const [r] = await tx.insert(selfExclusion).values({ userId: params.id, type: "OPERATOR_EXCLUSION", endsAt: body.days ? new Date(Date.now() + body.days * 86_400_000) : null, reason: body.reason, createdBy: session!.user.id }).returning();
    await tx.update(userSession).set({ revokedAt: new Date() }).where(eq(userSession.userId, params.id));
    await audit(tx, { actorUserId: session!.user.id, action: "user.operator_exclusion", entityType: "self_exclusion", entityId: r.id, reason: body.reason, after: r, correlationId: requestId });
    return r;
  });
  return ok({ exclusion: row }, 201);
});
