import { route, ok } from "@/lib/api";
import { riskEventBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { listRiskEvents } from "@/domain/admin";
import { recordRiskEvent } from "@/domain/users";
import { audit } from "@/lib/audit";

export const GET = route({ auth: "admin", permission: "users.read" }, async () => ok({ items: (await listRiskEvents(getDb())).map(({ r, email }) => ({ ...r, email })) }));

export const POST = route({ auth: "admin", permission: "risk.write", body: riskEventBody }, async ({ body, session, requestId }) => {
  const db = getDb();
  const r = await recordRiskEvent(db, { ...body, correlationId: requestId });
  await audit(db, { actorUserId: session!.user.id, action: "risk.event.create", entityType: "risk_event", entityId: r.id, after: r, correlationId: requestId });
  return ok({ event: r }, 201);
});
