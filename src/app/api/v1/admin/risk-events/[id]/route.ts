import { eq } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { idParam, riskResolveBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { riskEvent } from "@/db/schema";
import { audit } from "@/lib/audit";

export const PATCH = route({ auth: "admin", permission: "risk.write", params: idParam, body: riskResolveBody }, async ({ params, body, session, requestId }) => {
  const db = getDb();
  const [r] = await db.update(riskEvent).set({ resolvedAt: new Date(), resolvedBy: session!.user.id, resolution: body.resolution }).where(eq(riskEvent.id, params.id)).returning();
  await audit(db, { actorUserId: session!.user.id, action: "risk.event.resolve", entityType: "risk_event", entityId: params.id, reason: body.resolution, correlationId: requestId });
  return ok({ event: r });
});
