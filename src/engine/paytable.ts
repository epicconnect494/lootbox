import { Prize, CalibratedPrize, PrizeTier, PaytableStats } from '../models/types';
import { ENTRY_COST, TARGET_RTP, TARGET_EV } from '../config/prizes';

/**
 * Calibrate prize weights so that the expected value per spin equals
 * exactly TARGET_EV ($1.88 for 94% RTP on a $2.00 entry).
 *
 * The last prize (lowest value) has weight = -1 as a sentinel.
 * We use binary search to find the exact weight for that prize
 * that achieves the target EV.
 */
export function calibrateWeights(prizes: Prize[]): CalibratedPrize[] {
  const calibrateIndex = prizes.findIndex((p) => p.weight === -1);
  if (calibrateIndex === -1) {
    // No auto-calibrate prize; just normalize as-is
    return buildCalibratedPrizes(prizes, prizes.map((p) => p.weight));
  }

  const fixedWeights = prizes.map((p, i) => (i === calibrateIndex ? 0 : p.weight));
  const fixedSum = fixedWeights.reduce((a, b) => a + b, 0);
  const calibrateValue = prizes[calibrateIndex].value;

  // Binary search for the correct weight of the auto-calibrate prize
  let lo = 0.1;
  let hi = 10000;
  let bestWeight = 50;

  for (let iter = 0; iter < 200; iter++) {
    const mid = (lo + hi) / 2;
    const totalWeight = fixedSum + mid;
    const weights = [...fixedWeights];
    weights[calibrateIndex] = mid;

    // Compute EV with these weights
    let ev = 0;
    for (let i = 0; i < prizes.length; i++) {
      ev += (weights[i] / totalWeight) * prizes[i].value;
    }

    if (Math.abs(ev - TARGET_EV) < 1e-10) {
      bestWeight = mid;
      break;
    }

    // If EV is too high, we need MORE weight on the low-value calibrate prize
    // (dilutes the higher-value prizes' probabilities)
    if (ev > TARGET_EV) {
      lo = mid;
    } else {
      hi = mid;
    }
    bestWeight = mid;
  }

  const finalWeights = [...fixedWeights];
  finalWeights[calibrateIndex] = bestWeight;

  return buildCalibratedPrizes(prizes, finalWeights);
}

/**
 * Build calibrated prizes with normalized probabilities and cumulative distribution.
 */
function buildCalibratedPrizes(prizes: Prize[], weights: number[]): CalibratedPrize[] {
  const totalWeight = weights.reduce((a, b) => a + b, 0);

  let cumulative = 0;
  return prizes.map((prize, i) => {
    const probability = weights[i] / totalWeight;
    cumulative += probability;
    return {
      ...prize,
      weight: weights[i],
      probability,
      cumulativeProb: cumulative,
      evContribution: probability * prize.value,
    };
  });
}

/**
 * Verify that the calibrated paytable achieves the target RTP.
 */
export function verifyRTP(calibratedPrizes: CalibratedPrize[]): PaytableStats {
  const probabilitySum = calibratedPrizes.reduce((s, p) => s + p.probability, 0);
  const expectedValue = calibratedPrizes.reduce((s, p) => s + p.evContribution, 0);
  const rtp = expectedValue / ENTRY_COST;

  // Build tier breakdown
  const tierBreakdown = {} as PaytableStats['tierBreakdown'];
  for (const tier of Object.values(PrizeTier)) {
    const tierPrizes = calibratedPrizes.filter((p) => p.tier === tier);
    tierBreakdown[tier] = {
      count: tierPrizes.length,
      combinedProbability: tierPrizes.reduce((s, p) => s + p.probability, 0),
      combinedEV: tierPrizes.reduce((s, p) => s + p.evContribution, 0),
    };
  }

  return {
    totalPrizes: calibratedPrizes.length,
    probabilitySum,
    expectedValue,
    rtp,
    entryCost: ENTRY_COST,
    tierBreakdown,
  };
}

/**
 * Get the cumulative probability array for efficient RNG lookup.
 */
export function getCumulativeProbabilities(
  calibratedPrizes: CalibratedPrize[]
): { prize: CalibratedPrize; cumulativeProb: number }[] {
  return calibratedPrizes.map((p) => ({
    prize: p,
    cumulativeProb: p.cumulativeProb,
  }));
}
