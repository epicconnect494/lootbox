import { route, ok } from "@/lib/api";
import { idParam, packVersionPatchBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { updateDraftVersion, versionEconomics, evaluateVersionHealth } from "@/domain/packs";
import { parseDecimalToMinor } from "@/lib/money";
import { eq } from "drizzle-orm";
import { pack, packManifestCommitment, inventoryItem, productSku } from "@/db/schema";

export const GET = route({ auth: "admin", permission: "packs.read", params: idParam }, async ({ params }) => {
  const db = getDb();
  const eco = await versionEconomics(db, params.id);
  const p = await db.query.pack.findFirst({ where: eq(pack.id, eco.version.packId) });
  const commitment = await db.query.packManifestCommitment.findFirst({ where: eq(packManifestCommitment.packVersionId, params.id) });
  const health = eco.version.status === "PUBLISHED" || eco.version.status === "PAUSED" ? await evaluateVersionHealth(db, params.id) : null;
  const outcomes = [];
  for (const o of eco.outcomes) {
    const sku = await db.query.productSku.findFirst({ where: eq(productSku.id, o.skuId) });
    const item = o.inventoryItemId ? await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, o.inventoryItemId) }) : null;
    outcomes.push({ ...o, sku: sku ? { sku: sku.sku, name: sku.name, isUnique: sku.isUnique, accent: sku.accent } : null, item: item ? { itemCode: item.itemCode, status: item.status, grade: item.grade, grader: item.grader } : null });
  }
  return ok({ ...eco, outcomes, pack: p, commitment: commitment ? { manifestHash: commitment.manifestHash, createdAt: commitment.createdAt, publishedBy: commitment.publishedBy, canonicalManifest: commitment.canonicalManifest } : null, health });
});

export const PATCH = route({ auth: "admin", permission: "packs.write", params: idParam, body: packVersionPatchBody }, async ({ params, body, session, requestId }) => {
  const v = await updateDraftVersion(getDb(), { userId: session!.user.id, role: session!.user.roles.join(","), correlationId: requestId }, params.id, {
    priceMinor: body.price ? parseDecimalToMinor(body.price) : undefined,
    notes: body.notes,
    liabilityLimitMinor: body.liabilityLimit === undefined ? undefined : body.liabilityLimit ? parseDecimalToMinor(body.liabilityLimit) : null,
    scheduledAt: body.scheduledAt === undefined ? undefined : body.scheduledAt ? new Date(body.scheduledAt) : null,
    name: body.name, tagline: body.tagline, description: body.description, accent: body.accent, tags: body.tags,
  });
  return ok({ version: v });
});
