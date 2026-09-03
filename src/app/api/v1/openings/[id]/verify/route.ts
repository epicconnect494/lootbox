import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { getOpeningView } from "@/domain/openings";
import { err } from "@/lib/errors";
import { signingPublicKeyPem, verifyReceiptSignature } from "@/lib/fairness/node";
import { verifyOpening } from "@/lib/fairness/verify";

/** Server-side verification of a receipt: signature check plus full recomputation when the seed is revealed. */
export const POST = route({ auth: "user", params: idParam }, async ({ params, session }) => {
  const view = await getOpeningView(getDb(), params.id, session!.user.id, { admin: session!.user.permissions.has("battles.read") });
  if (!view || !view.receipt) throw err.notFound("Opening");
  const r = view.receipt;
  const signatureValid = verifyReceiptSignature(r.payloadCanonical, r.signature);
  const snapshot = r.valueSnapshot as { remainingQuantities: number[] };
  let recomputation = null;
  if (r.revealedServerSeed) {
    recomputation = await verifyOpening({ serverSeed: r.revealedServerSeed, serverSeedHash: r.serverSeedHash, clientSeed: r.clientSeed, nonce: r.nonce, packVersionId: r.packVersionId, manifestHash: r.manifestHash, remainingQuantities: snapshot.remainingQuantities, expectedDigest: r.digest, expectedIndex: r.selectedIndex, expectedOutcomePosition: view.outcome.position });
  }
  return ok({ signatureValid, signingKeyId: r.signingKeyId, publicKeyPem: signingPublicKeyPem(), seedRevealed: !!r.revealedServerSeed, recomputation });
});
