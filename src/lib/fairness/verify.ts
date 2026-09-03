/**
 * Standalone pure verification. Works in Node and in the browser (uses WebCrypto).
 * Given the published receipt inputs, recomputes the digest and selected index.
 */
import { buildMessage, mapIndexToOutcome, selectIndexFromDigest, type SamplingStep } from "./core";

export interface VerifyOpeningInput {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  packVersionId: string;
  manifestHash: string;
  /** ordered remaining quantities at the time of the opening (from the receipt's value snapshot) */
  remainingQuantities: number[];
  expectedDigest?: string;
  expectedIndex?: number;
  expectedOutcomePosition?: number;
}

export interface VerifyOpeningOutput {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  message: string;
  digest: string;
  range: number;
  index: number;
  outcomePosition: number;
  steps: SamplingStep[];
}

async function sha256HexAsync(s: string): Promise<string> {
  const data = new TextEncoder().encode(s);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(buf));
}

async function hmacHexAsync(keyStr: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(keyStr), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(msg));
  return toHex(new Uint8Array(sig));
}

function toHex(bytes: Uint8Array): string {
  let out = "";
  for (const b of bytes) out += b.toString(16).padStart(2, "0");
  return out;
}

export async function verifyOpening(input: VerifyOpeningInput): Promise<VerifyOpeningOutput> {
  const checks: VerifyOpeningOutput["checks"] = [];
  const seedHash = await sha256HexAsync(input.serverSeed);
  checks.push({ name: "Server seed matches commitment", ok: seedHash === input.serverSeedHash.toLowerCase(), detail: `SHA-256(serverSeed) = ${seedHash}` });
  const message = buildMessage(input.clientSeed, input.nonce, input.packVersionId, input.manifestHash);
  const digest = await hmacHexAsync(input.serverSeed, message);
  if (input.expectedDigest) checks.push({ name: "Digest matches receipt", ok: digest === input.expectedDigest.toLowerCase(), detail: digest });
  const range = input.remainingQuantities.reduce((a, b) => a + b, 0);
  // pre-compute extension digests lazily but synchronously: gather up to a few extensions ahead.
  const extensions: string[] = [];
  for (let i = 1; i <= 8; i++) extensions.push(await hmacHexAsync(input.serverSeed, `${message}:${i}`));
  const sel = selectIndexFromDigest(digest, range, (ext) => {
    if (ext - 1 < extensions.length) return extensions[ext - 1];
    throw new Error("verifier extension limit reached");
  });
  if (input.expectedIndex !== undefined) checks.push({ name: "Selected index matches receipt", ok: sel.index === input.expectedIndex, detail: `index ${sel.index} of range ${range}` });
  const mapped = mapIndexToOutcome(sel.index, input.remainingQuantities);
  if (input.expectedOutcomePosition !== undefined) checks.push({ name: "Outcome matches receipt", ok: mapped.outcomeIndex === input.expectedOutcomePosition, detail: `outcome position ${mapped.outcomeIndex}` });
  return { ok: checks.every((c) => c.ok), checks, message, digest, range, index: sel.index, outcomePosition: mapped.outcomeIndex, steps: sel.steps };
}

export interface VerifyRaffleInput {
  serverSeed: string;
  serverSeedHash: string;
  publicRandomness: string;
  raffleId: string;
  manifestHash: string;
  ticketCount: number;
  winnersCount: number;
  /** canonical serialized manifest (optional: if provided, its hash is checked) */
  canonicalManifest?: string;
  expectedWinners?: number[]; // ticket numbers, 1-based
}

export interface VerifyRaffleOutput {
  ok: boolean;
  checks: Array<{ name: string; ok: boolean; detail: string }>;
  winners: Array<{ rank: number; nonce: number; message: string; digest: string; index: number; ticketNumber: number; steps: SamplingStep[] }>;
}

/**
 * Raffle draw: clientSeed := publicRandomness, scope := raffleId, nonce starts at 0 and increments per winner.
 * Winners are sampled without replacement: a ticket already drawn is skipped by incrementing the nonce.
 */
export async function verifyRaffle(input: VerifyRaffleInput): Promise<VerifyRaffleOutput> {
  const checks: VerifyRaffleOutput["checks"] = [];
  const seedHash = await sha256HexAsync(input.serverSeed);
  checks.push({ name: "Server seed matches commitment", ok: seedHash === input.serverSeedHash.toLowerCase(), detail: seedHash });
  if (input.canonicalManifest !== undefined) {
    const mh = await sha256HexAsync(input.canonicalManifest);
    checks.push({ name: "Manifest hash matches", ok: mh === input.manifestHash.toLowerCase(), detail: mh });
  }
  const winners: VerifyRaffleOutput["winners"] = [];
  const taken = new Set<number>();
  let nonce = 0;
  let guard = 0;
  while (winners.length < input.winnersCount && guard++ < 10_000) {
    const message = buildMessage(input.publicRandomness, nonce, input.raffleId, input.manifestHash);
    const digest = await hmacHexAsync(input.serverSeed, message);
    const exts: string[] = [];
    for (let i = 1; i <= 8; i++) exts.push(await hmacHexAsync(input.serverSeed, `${message}:${i}`));
    const sel = selectIndexFromDigest(digest, input.ticketCount, (e) => exts[e - 1]);
    const ticketNumber = sel.index + 1;
    if (!taken.has(ticketNumber)) {
      taken.add(ticketNumber);
      winners.push({ rank: winners.length + 1, nonce, message, digest, index: sel.index, ticketNumber, steps: sel.steps });
    }
    nonce += 1;
  }
  if (input.expectedWinners) {
    const ok = input.expectedWinners.length === winners.length && input.expectedWinners.every((t, i) => winners[i].ticketNumber === t);
    checks.push({ name: "Winning tickets match published draw", ok, detail: winners.map((w) => `#${w.ticketNumber}`).join(", ") });
  }
  return { ok: checks.every((c) => c.ok), checks, winners };
}
