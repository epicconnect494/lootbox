import { route, ok } from "@/lib/api";
import { packCreateBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { createPackDraft } from "@/domain/packs";
import { listPackVersions } from "@/domain/admin";
import { parseDecimalToMinor } from "@/lib/money";

export const GET = route({ auth: "admin", permission: "packs.read" }, async () => {
  const rows = await listPackVersions(getDb());
  return ok({ items: rows.map(({ v, p, category }) => ({ ...v, pack: { id: p.id, slug: p.slug, name: p.name, accent: p.accent, currentVersionId: p.currentVersionId, status: p.status }, category: category.name })) });
});

export const POST = route({ auth: "admin", permission: "packs.write", body: packCreateBody }, async ({ body, session, requestId }) => {
  const r = await createPackDraft(getDb(), { userId: session!.user.id, role: session!.user.roles.join(","), correlationId: requestId }, { ...body, priceMinor: parseDecimalToMinor(body.price) });
  return ok(r, 201);
});
