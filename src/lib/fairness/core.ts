/**
 * Pure provably-fair primitives. No I/O, no database, safe to run in the browser verifier.
 *
 * Message format (locked): `${clientSeed}:${nonce}:${packVersionId}:${manifestHash}`
 * Digest: HMAC-SHA-256(serverSeed, message) — serverSeed is the raw 32-byte seed encoded as hex; the HMAC key is the hex string's bytes.
 * Selection: rejection sampling over 32-bit windows of the digest (and HMAC-extended digests if exhausted) to map to [0, range) without modulo bias.
 */

export const SAMPLE_BITS = 32;
export const SAMPLE_SPACE = 2 ** SAMPLE_BITS; // 4294967296

export interface SamplingStep {
  /** which 32-bit window of the (extended) digest was read: window w of extension e */
  extension: number;
  window: number;
  value: number;
  accepted: boolean;
}

export interface SelectionResult {
  index: number;
  steps: SamplingStep[];
  digest: string;
  /** rejection threshold: largest multiple of `range` that fits in 2^32 */
  limit: number;
}

export function buildMessage(clientSeed: string, nonce: number, scopeId: string, manifestHash: string): string {
  return `${clientSeed}:${nonce}:${scopeId}:${manifestHash}`;
}

function u32At(hex: string, window: number): number | null {
  const start = window * 8;
  if (start + 8 > hex.length) return null;
  return parseInt(hex.slice(start, start + 8), 16) >>> 0;
}

/**
 * Map a digest to an index in [0, range) with rejection sampling.
 * `extend(i)` must return the i-th extension digest (HMAC of message + ":" + i) when the primary digest is exhausted.
 */
export function selectIndexFromDigest(digest: string, range: number, extend: (extension: number) => string): SelectionResult {
  if (!Number.isInteger(range) || range <= 0) throw new Error("range must be a positive integer");
  if (range > SAMPLE_SPACE) throw new Error("range exceeds 32-bit sample space");
  const limit = SAMPLE_SPACE - (SAMPLE_SPACE % range); // values >= limit are rejected
  const steps: SamplingStep[] = [];
  let ext = 0;
  let hex = digest;
  for (let guard = 0; guard < 10_000; guard++) {
    for (let w = 0; w * 8 + 8 <= hex.length; w++) {
      const v = u32At(hex, w)!;
      const accepted = v < limit;
      steps.push({ extension: ext, window: w, value: v, accepted });
      if (accepted) return { index: v % range, steps, digest, limit };
    }
    ext += 1;
    hex = extend(ext);
  }
  throw new Error("rejection sampling did not converge");
}

/** Weighted selection: map a uniform index in [0, totalWeight) to an outcome by cumulative remaining quantities. */
export function mapIndexToOutcome(index: number, weights: number[]): { outcomeIndex: number; offsetWithinOutcome: number } {
  let acc = 0;
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (w < 0 || !Number.isInteger(w)) throw new Error("weights must be non-negative integers");
    if (index < acc + w) return { outcomeIndex: i, offsetWithinOutcome: index - acc };
    acc += w;
  }
  throw new Error(`index ${index} out of range for total weight ${acc}`);
}

/** Canonical remaining-inventory commitment: hash of ordered remaining quantities. */
export function remainingInventoryCommitmentInput(remaining: Array<{ outcomeId: string; remaining: number }>): string {
  return remaining.map((r) => `${r.outcomeId}=${r.remaining}`).join("|");
}
