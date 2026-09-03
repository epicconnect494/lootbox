import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { reconcile } from "@/domain/admin";
import { audit } from "@/lib/audit";

export const POST = route({ auth: "admin", permission: "finance.read" }, async ({ session, requestId }) => {
  const db = getDb();
  const r = await reconcile(db);
  await audit(db, { actorUserId: session!.user.id, action: "finance.reconcile", entityType: "system", entityId: "ledger", after: { ok: r.ok, problems: r.problems.length }, correlationId: requestId });
  return ok(r);
});
