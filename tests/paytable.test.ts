import { PRIZES, ENTRY_COST, TARGET_RTP, TARGET_EV } from '../src/config/prizes';
import { calibrateWeights, verifyRTP } from '../src/engine/paytable';
import { PrizeTier } from '../src/models/types';

describe('Paytable Engine', () => {
  const calibrated = calibrateWeights(PRIZES);
  const stats = verifyRTP(calibrated);

  test('should have exactly 15 prizes', () => {
    expect(calibrated).toHaveLength(15);
  });

  test('probabilities should sum to 1.0', () => {
    expect(stats.probabilitySum).toBeCloseTo(1.0, 10);
  });

  test('all probabilities should be positive', () => {
    for (const prize of calibrated) {
      expect(prize.probability).toBeGreaterThan(0);
    }
  });

  test('cumulative probabilities should be monotonically increasing', () => {
    for (let i = 1; i < calibrated.length; i++) {
      expect(calibrated[i].cumulativeProb).toBeGreaterThan(
        calibrated[i - 1].cumulativeProb
      );
    }
  });

  test('last cumulative probability should be ~1.0', () => {
    expect(calibrated[calibrated.length - 1].cumulativeProb).toBeCloseTo(1.0, 10);
  });

  test('expected value should equal target EV ($1.88)', () => {
    expect(stats.expectedValue).toBeCloseTo(TARGET_EV, 4);
  });

  test('RTP should be exactly 94%', () => {
    expect(stats.rtp).toBeCloseTo(TARGET_RTP, 4);
  });

  test('entry cost should be $2.00', () => {
    expect(stats.entryCost).toBe(ENTRY_COST);
  });

  test('should have correct tier distribution', () => {
    expect(stats.tierBreakdown[PrizeTier.HIGH].count).toBe(3);
    expect(stats.tierBreakdown[PrizeTier.MEDIUM].count).toBe(3);
    expect(stats.tierBreakdown[PrizeTier.AVERAGE].count).toBe(6);
    expect(stats.tierBreakdown[PrizeTier.LOW].count).toBe(3);
  });

  test('HIGH tier should have lowest combined probability', () => {
    const highProb = stats.tierBreakdown[PrizeTier.HIGH].combinedProbability;
    const medProb = stats.tierBreakdown[PrizeTier.MEDIUM].combinedProbability;
    const avgProb = stats.tierBreakdown[PrizeTier.AVERAGE].combinedProbability;
    const lowProb = stats.tierBreakdown[PrizeTier.LOW].combinedProbability;

    expect(highProb).toBeLessThan(medProb);
    expect(medProb).toBeLessThan(avgProb);
    expect(avgProb).toBeLessThan(lowProb);
  });

  test('prize values should decrease by tier', () => {
    const highMin = Math.min(
      ...calibrated.filter((p) => p.tier === PrizeTier.HIGH).map((p) => p.value)
    );
    const medMax = Math.max(
      ...calibrated.filter((p) => p.tier === PrizeTier.MEDIUM).map((p) => p.value)
    );
    expect(highMin).toBeGreaterThan(medMax);
  });

  test('auto-calibrated prize (id 15) should have a positive weight', () => {
    const prize15 = calibrated.find((p) => p.id === 15);
    expect(prize15).toBeDefined();
    expect(prize15!.weight).toBeGreaterThan(0);
  });
});
