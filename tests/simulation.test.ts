import { PRIZES, ENTRY_COST, TARGET_RTP } from '../src/config/prizes';
import { calibrateWeights } from '../src/engine/paytable';
import { selectPrize } from '../src/engine/rng';

describe('Monte Carlo RTP Simulation', () => {
  const calibrated = calibrateWeights(PRIZES);

  test('empirical RTP should converge to 94% over 500K spins (within ±0.5%)', () => {
    const SPINS = 500_000;
    let totalWon = 0;
    const totalSpent = SPINS * ENTRY_COST;

    for (let i = 0; i < SPINS; i++) {
      const prize = selectPrize(calibrated);
      totalWon += prize.value;
    }

    const empiricalRTP = totalWon / totalSpent;
    const deviation = Math.abs(empiricalRTP - TARGET_RTP);

    console.log(`  Empirical RTP: ${(empiricalRTP * 100).toFixed(4)}%`);
    console.log(`  Target RTP:    ${(TARGET_RTP * 100).toFixed(4)}%`);
    console.log(`  Deviation:     ${(deviation * 100).toFixed(4)}%`);

    expect(deviation).toBeLessThan(0.005); // Within ±0.5%
  }, 30000); // 30 second timeout for simulation

  test('all 15 prizes should be hit in a large sample', () => {
    const SPINS = 100_000;
    const hitCounts = new Map<number, number>();

    for (let i = 0; i < SPINS; i++) {
      const prize = selectPrize(calibrated);
      hitCounts.set(prize.id, (hitCounts.get(prize.id) || 0) + 1);
    }

    // Every prize should be hit at least once
    for (let id = 1; id <= 15; id++) {
      expect(hitCounts.get(id)).toBeGreaterThan(0);
    }

    // High-tier prizes should be hit less than low-tier
    const highHits = (hitCounts.get(1) || 0) + (hitCounts.get(2) || 0) + (hitCounts.get(3) || 0);
    const lowHits = (hitCounts.get(13) || 0) + (hitCounts.get(14) || 0) + (hitCounts.get(15) || 0);
    expect(lowHits).toBeGreaterThan(highHits);
  }, 15000);

  test('prize distribution should roughly match theoretical probabilities', () => {
    const SPINS = 200_000;
    const hitCounts = new Map<number, number>();

    for (let i = 0; i < SPINS; i++) {
      const prize = selectPrize(calibrated);
      hitCounts.set(prize.id, (hitCounts.get(prize.id) || 0) + 1);
    }

    // Each prize's empirical probability should be within 20% of theoretical
    for (const prize of calibrated) {
      const empiricalProb = (hitCounts.get(prize.id) || 0) / SPINS;
      const theoreticalProb = prize.probability;

      if (theoreticalProb > 0.01) {
        // Only check prizes with >1% probability (small probs have high variance)
        const ratio = empiricalProb / theoreticalProb;
        expect(ratio).toBeGreaterThan(0.8);
        expect(ratio).toBeLessThan(1.2);
      }
    }
  }, 15000);
});
