import { CalibratedPrize } from '../models/types';

/**
 * Generate a cryptographically secure random float in [0, 1).
 * Uses Web Crypto API (works in browsers and Node 19+).
 * Falls back to Node.js crypto for older Node versions.
 */
export function generateRandomFloat(): number {
  const array = new Uint32Array(1);

  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(array);
  } else {
    // Node.js fallback for environments without Web Crypto
    try {
      const nodeCrypto = eval('require')('crypto');
      const bytes = nodeCrypto.randomBytes(4);
      array[0] = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    } catch {
      // Last resort — should never happen in production
      array[0] = Math.floor(Math.random() * 0x100000000);
    }
  }

  return array[0] / 0x100000000; // Divide by 2^32 for [0, 1)
}

/**
 * Select a prize using the cumulative probability distribution.
 * Binary search on the cumulative probabilities for O(log n) lookup.
 */
export function selectPrize(
  calibratedPrizes: CalibratedPrize[],
  randomValue?: number
): CalibratedPrize {
  const roll = randomValue ?? generateRandomFloat();

  let lo = 0;
  let hi = calibratedPrizes.length - 1;

  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (calibratedPrizes[mid].cumulativeProb <= roll) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return calibratedPrizes[lo];
}

/**
 * Generate a unique spin ID.
 */
export function generateSpinId(): string {
  const array = new Uint8Array(16);

  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.getRandomValues) {
    globalThis.crypto.getRandomValues(array);
  } else {
    try {
      const nodeCrypto = eval('require')('crypto');
      const bytes = nodeCrypto.randomBytes(16);
      for (let i = 0; i < 16; i++) array[i] = bytes[i];
    } catch {
      for (let i = 0; i < 16; i++) array[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
}
