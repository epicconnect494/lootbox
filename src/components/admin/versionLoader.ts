import { eq } from "drizzle-orm";
import type { DbOrTx } from "@/db/client";
import { inventoryItem, pack, packManifestCommitment, productSku } from "@/db/schema";
import { evaluateVersionHealth, versionEconomics } from "@/domain/packs";
import { searchAudit } from "@/domain/admin";
import { ser } from "./serialize";

/** Same shape as GET /admin/packs/versions/{id}, computed in-process for the server page. */
export async function loadVersion(db: DbOrTx, id: string) {
  const eco = await versionEconomics(db, id);
  const p = await db.query.pack.findFirst({ where: eq(pack.id, eco.version.packId) });
  const commitment = await db.query.packManifestCommitment.findFirst({ where: eq(packManifestCommitment.packVersionId, id) });
  const health = eco.version.status === "PUBLISHED" || eco.version.status === "PAUSED" ? await evaluateVersionHealth(db, id) : null;
  const outcomes = [];
  for (const o of eco.outcomes) {
    const sku = await db.query.productSku.findFirst({ where: eq(productSku.id, o.skuId) });
    const item = o.inventoryItemId ? await db.query.inventoryItem.findFirst({ where: eq(inventoryItem.id, o.inventoryItemId) }) : null;
    outcomes.push({
      ...o,
      sku: sku ? { sku: sku.sku, name: sku.name, isUnique: sku.isUnique, accent: sku.accent, imageKey: sku.imageKey, shippingRestricted: sku.shippingRestricted, shippingRestrictionNote: sku.shippingRestrictionNote } : null,
      item: item ? { itemCode: item.itemCode, status: item.status, grade: item.grade, grader: item.grader } : null,
    });
  }
  return ser({
    ...eco,
    outcomes,
    pack: p ?? null,
    commitment: commitment ? { manifestHash: commitment.manifestHash, createdAt: commitment.createdAt, publishedBy: commitment.publishedBy, canonicalManifest: commitment.canonicalManifest } : null,
    health,
  });
}
export type VersionData = Awaited<ReturnType<typeof loadVersion>>;

export async function loadVersionAudit(db: DbOrTx, id: string) {
  const rows = await searchAudit(db, { entityType: "pack_version", q: id, limit: 100 });
  return ser(rows.map(({ e, actorName }) => ({ ...e, actorName })));
}
export type VersionAuditRow = Awaited<ReturnType<typeof loadVersionAudit>>[number];
