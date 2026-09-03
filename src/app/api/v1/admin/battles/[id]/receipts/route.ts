import { eq, asc } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { battlePull, fairnessReceipt, fairnessSeed, battle } from "@/db/schema";
import { verifyReceiptSignature } from "@/lib/fairness/node";
import { verifyOpening } from "@/lib/fairness/verify";
import { err } from "@/lib/errors";

/** Verifies every receipt in a battle: signature + recomputation with the revealed battle seed. */
export const GET = route({ auth: "admin", permission: "battles.read", params: idParam }, async ({ params }) => {
  const db = getDb();
  const b = await db.query.battle.findFirst({ where: eq(battle.id, params.id) });
  if (!b) throw err.notFound("Battle");
  const seed = b.seedId ? await db.query.fairnessSeed.findFirst({ where: eq(fairnessSeed.id, b.seedId) }) : null;
  const pulls = await db.select({ p: battlePull, r: fairnessReceipt }).from(battlePull).innerJoin(fairnessReceipt, eq(fairnessReceipt.openingId, battlePull.openingId)).where(eq(battlePull.battleId, params.id)).orderBy(asc(battlePull.pullIndex));
  const results = [];
  for (const { p, r } of pulls) {
    const signatureValid = verifyReceiptSignature(r.payloadCanonical, r.signature);
    const snapshot = r.valueSnapshot as { remainingQuantities: number[] };
    const recomputation = seed?.revealedServerSeed ? await verifyOpening({ serverSeed: seed.revealedServerSeed, serverSeedHash: r.serverSeedHash, clientSeed: r.clientSeed, nonce: r.nonce, packVersionId: r.packVersionId, manifestHash: r.manifestHash, remainingQuantities: snapshot.remainingQuantities, expectedDigest: r.digest, expectedIndex: r.selectedIndex }) : null;
    results.push({ pullIndex: p.pullIndex, openingId: p.openingId, nonce: r.nonce, signatureValid, recomputationOk: recomputation?.ok ?? null, digest: r.digest });
  }
  return ok({ battleId: b.id, serverSeedHash: b.serverSeedHash, revealed: !!seed?.revealedServerSeed, allValid: results.every((x) => x.signatureValid && x.recomputationOk !== false), pulls: results, tieBreak: b.tieBreakReceipt });
});
