import { route, ok } from "@/lib/api";
import { auditQuery } from "@/api/schemas";
import { getDb } from "@/db/client";
import { searchAudit } from "@/domain/admin";

export const GET = route({ auth: "admin", permission: "audit.read", query: auditQuery }, async ({ query }) => {
  const rows = await searchAudit(getDb(), query);
  return ok({ items: rows.map(({ e, actorName }) => ({ ...e, actorName })) });
});
