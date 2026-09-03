import { eq, and } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { idParam, userPatchBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { role, user, userRole, userSession } from "@/db/schema";
import { userDetail } from "@/domain/admin";
import { audit } from "@/lib/audit";
import { err } from "@/lib/errors";

export const GET = route({ auth: "admin", permission: "users.read", params: idParam }, async ({ params }) => ok(await userDetail(getDb(), params.id)));

export const PATCH = route({ auth: "admin", permission: "users.write", params: idParam, body: userPatchBody }, async ({ params, body, session, requestId }) => {
  const db = getDb();
  await db.transaction(async (tx) => {
    const [before] = await tx.select().from(user).where(eq(user.id, params.id)).for("update");
    if (!before) throw err.notFound("User");
    if (body.roles && !session!.user.permissions.has("finance.write") && !session!.user.roles.includes("SUPER_ADMIN")) throw err.forbidden("Only super admins can change roles");
    if (body.roles && params.id === session!.user.id) throw err.forbidden("You cannot change your own roles");
    const [after] = await tx.update(user).set({ status: body.status, jurisdictionCode: body.jurisdictionCode, linkedAccountGroup: body.linkedAccountGroup, riskScore: body.riskScore }).where(eq(user.id, params.id)).returning();
    if (body.status && body.status !== "ACTIVE") await tx.update(userSession).set({ revokedAt: new Date() }).where(and(eq(userSession.userId, params.id)));
    if (body.roles) {
      const all = await tx.select().from(role);
      await tx.delete(userRole).where(eq(userRole.userId, params.id));
      const keys = new Set(["CUSTOMER", ...body.roles]);
      await tx.insert(userRole).values([...keys].map((k) => ({ userId: params.id, roleId: all.find((r) => r.key === k)!.id, grantedBy: session!.user.id })));
    }
    await audit(tx, { actorUserId: session!.user.id, actorRole: session!.user.roles.join(","), action: "user.admin_update", entityType: "user", entityId: params.id, reason: body.reason, before: { status: before.status, jurisdictionCode: before.jurisdictionCode, riskScore: before.riskScore, linkedAccountGroup: before.linkedAccountGroup }, after: { status: after.status, jurisdictionCode: after.jurisdictionCode, riskScore: after.riskScore, linkedAccountGroup: after.linkedAccountGroup, roles: body.roles }, correlationId: requestId });
  });
  return ok(await userDetail(db, params.id));
});
