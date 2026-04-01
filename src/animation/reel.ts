import { CalibratedPrize, ReelItem, ReelSequence, AnimationConfig } from '../models/types';

const DEFAULT_REEL_LENGTH = 35;
const MIN_REEL_LENGTH = 20;

/**
 * Generate a reel strip for the horizontal spin animation.
 *
 * The reel is a sequence of prize thumbnails that the frontend scrolls through.
 * The RNG outcome is already decided — the reel strip is cosmetic, with the
 * winning prize placed at the final visible position.
 *
 * Rules:
 * - No more than 2 consecutive identical prizes (visual variety)
 * - Higher-tier prizes appear less frequently on the strip (matches expectations)
 * - Winning prize is always at the predetermined final position
 */
export function generateReelSequence(
  calibratedPrizes: CalibratedPrize[],
  winningPrize: CalibratedPrize,
  length: number = DEFAULT_REEL_LENGTH
): ReelSequence {
  const reelLength = Math.max(length, MIN_REEL_LENGTH);
  const items: ReelItem[] = [];

  // Build weighted pool for reel population (visual weighting, not RNG)
  const pool = buildVisualPool(calibratedPrizes);

  // Fill reel strip (leave last slot for winner)
  for (let i = 0; i < reelLength - 1; i++) {
    let candidate: CalibratedPrize;
    let attempts = 0;

    do {
      candidate = pool[Math.floor(Math.random() * pool.length)];
      attempts++;
    } while (
      attempts < 20 &&
      hasConsecutiveDuplicates(items, candidate.id, 2)
    );

    items.push(toReelItem(candidate));
  }

  // Place winning prize at the final position
  items.push(toReelItem(winningPrize));

  return {
    items,
    winnerIndex: items.length - 1,
    totalItems: items.length,
  };
}

/**
 * Animation configuration for the frontend.
 * The frontend uses these parameters to control the reel scroll behavior.
 */
export function getAnimationConfig(): AnimationConfig {
  return {
    totalDurationMs: 4000,         // 4 seconds total spin
    decelerationStart: 0.55,       // Start slowing at 55% of duration
    visibleItems: 5,               // 5 items visible in the viewport at once
    easingFunction: 'cubic-bezier(0.25, 0.1, 0.25, 1.0)', // Smooth deceleration
  };
}

/**
 * Build a visual pool where each prize appears proportional to its probability.
 * This makes the reel "look right" — common prizes appear often, rare prizes are scarce.
 */
function buildVisualPool(calibratedPrizes: CalibratedPrize[]): CalibratedPrize[] {
  const pool: CalibratedPrize[] = [];
  const POOL_SIZE = 100;

  for (const prize of calibratedPrizes) {
    const count = Math.max(1, Math.round(prize.probability * POOL_SIZE));
    for (let i = 0; i < count; i++) {
      pool.push(prize);
    }
  }

  return pool;
}

/**
 * Check if adding a prize would create more than `maxConsecutive` identical prizes in a row.
 */
function hasConsecutiveDuplicates(
  items: ReelItem[],
  candidateId: number,
  maxConsecutive: number
): boolean {
  if (items.length < maxConsecutive) return false;

  for (let i = 1; i <= maxConsecutive; i++) {
    if (items[items.length - i].prizeId !== candidateId) {
      return false;
    }
  }

  return true;
}

/**
 * Convert a CalibratedPrize to a ReelItem (stripped-down version for animation).
 */
function toReelItem(prize: CalibratedPrize): ReelItem {
  return {
    prizeId: prize.id,
    name: prize.name,
    imageSlug: prize.imageSlug,
    tier: prize.tier,
  };
}
