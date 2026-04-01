import * as crypto from 'crypto';
import { CalibratedPrize } from '../models/types';

/**
 * Generate a cryptographically secure random float in [0, 1).
 * Uses crypto.randomBytes for fairness — never Math.random().
 */
export function generateRandomFloat(): number {
  const bytes = crypto.randomBytes(4);
  const uint32 = bytes.readUInt32BE(0);
  return uint32 / 0x100000000; // Divide by 2^32 for [0, 1)
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

  // Binary search on cumulative probabilities
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
 * Generate a unique spin ID using crypto.
 */
export function generateSpinId(): string {
  return crypto.randomBytes(16).toString('hex');
}
