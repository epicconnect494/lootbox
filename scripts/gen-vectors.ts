/** Generates docs/fairness-test-vectors.json from fixed seeds so third parties can reproduce the algorithm. */
import fs from "node:fs";
import { createHmac } from "node:crypto";
import { draw, mapIndexToOutcome, serverSeedHash } from "../src/lib/fairness/node";
import { selectIndexFromDigest, buildMessage } from "../src/lib/fairness/core";
import { sha256Hex } from "../src/lib/crypto";

const openings = [
  { serverSeed: "0f".repeat(32), clientSeed: "collector-seed", nonce: 0, packVersionId: "11111111-1111-4111-8111-111111111111", manifestHash: sha256Hex("manifest-a"), remainingQuantities: [1, 9, 90] },
  { serverSeed: "a3b1c2d3e4f5061728394a5b6c7d8e9f0a1b2c3d4e5f60718293a4b5c6d7e8f9", clientSeed: "x", nonce: 41, packVersionId: "22222222-2222-4222-8222-222222222222", manifestHash: sha256Hex("manifest-b"), remainingQuantities: [0, 3, 7, 40] },
  { serverSeed: "ff".repeat(32), clientSeed: "edge", nonce: 999999, packVersionId: "33333333-3333-4333-8333-333333333333", manifestHash: sha256Hex("manifest-c"), remainingQuantities: [1] },
].map((v) => {
  const range = v.remainingQuantities.reduce((a, b) => a + b, 0);
  const d = draw({ serverSeed: v.serverSeed, clientSeed: v.clientSeed, nonce: v.nonce, scopeId: v.packVersionId, manifestHash: v.manifestHash, range });
  return { ...v, serverSeedHash: serverSeedHash(v.serverSeed), message: d.message, digest: d.digest, range, limit: d.limit, samplingSteps: d.steps, selectedIndex: d.index, outcomePosition: mapIndexToOutcome(d.index, v.remainingQuantities).outcomeIndex };
});

function raffleVector(serverSeed: string, publicRandomness: string, raffleId: string, tickets: string[], winnersCount: number) {
  const canonicalManifest = JSON.stringify(tickets);
  const manifestHash = sha256Hex(canonicalManifest);
  const winners: number[] = [];
  const detail: unknown[] = [];
  let nonce = 0;
  while (winners.length < winnersCount) {
    const message = buildMessage(publicRandomness, nonce, raffleId, manifestHash);
    const digest = createHmac("sha256", serverSeed).update(message).digest("hex");
    const sel = selectIndexFromDigest(digest, tickets.length, (e) => createHmac("sha256", serverSeed).update(`${message}:${e}`).digest("hex"));
    const t = sel.index + 1;
    if (!winners.includes(t)) {
      winners.push(t);
      detail.push({ nonce, message, digest, index: sel.index, ticketNumber: t, ticketId: tickets[sel.index] });
    }
    nonce++;
  }
  return { serverSeed, serverSeedHash: serverSeedHash(serverSeed), publicRandomness, publicRandomnessSource: "test-vector:fixed", raffleId, canonicalManifest, manifestHash, ticketCount: tickets.length, winnersCount, winningTickets: winners, detail };
}

const raffles = [
  raffleVector("5e".repeat(32), "0000000000000000000a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60", "44444444-4444-4444-8444-444444444444", Array.from({ length: 25 }, (_, i) => `TKT-${String(i + 1).padStart(4, "0")}`), 1),
  raffleVector("9c".repeat(32), "btc-block-900000:00000000000000000001c8f2e5a6b7c8d9e0f1a2b3c4d5e6f708192a3b4c5d", "55555555-5555-4555-8555-555555555555", Array.from({ length: 12 }, (_, i) => `TKT-${String(i + 1).padStart(4, "0")}`), 3),
];

const doc = {
  description: "Deterministic provably-fair test vectors. message = clientSeed:nonce:scopeId:manifestHash; digest = HMAC-SHA256(key=serverSeedHex, message); index via rejection sampling over 32-bit big-endian windows (extension digests = HMAC(serverSeed, message:ext)). Raffles use publicRandomness as clientSeed and raffleId as scopeId; winners drawn without replacement by incrementing nonce.",
  algorithmVersion: 1,
  openings,
  raffles,
};
fs.writeFileSync("docs/fairness-test-vectors.json", JSON.stringify(doc, null, 2));
console.log("wrote docs/fairness-test-vectors.json", openings.map((o) => o.selectedIndex), raffles.map((r) => r.winningTickets));
