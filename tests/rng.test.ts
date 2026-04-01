import { generateRandomFloat, selectPrize, generateSpinId } from '../src/engine/rng';
import { calibrateWeights } from '../src/engine/paytable';
import { PRIZES } from '../src/config/prizes';

describe('RNG Engine', () => {
  describe('generateRandomFloat', () => {
    test('should return values in [0, 1)', () => {
      for (let i = 0; i < 1000; i++) {
        const val = generateRandomFloat();
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(1);
      }
    });

    test('should produce varied results (not constant)', () => {
      const values = new Set<number>();
      for (let i = 0; i < 100; i++) {
        values.add(generateRandomFloat());
      }
      // At least 95 unique values out of 100 (cryptographic quality)
      expect(values.size).toBeGreaterThan(95);
    });
  });

  describe('selectPrize', () => {
    const calibrated = calibrateWeights(PRIZES);

    test('should return first prize for random value 0', () => {
      const result = selectPrize(calibrated, 0);
      expect(result.id).toBe(1);
    });

    test('should return last prize for random value near 1', () => {
      const result = selectPrize(calibrated, 0.9999999);
      expect(result.id).toBe(15);
    });

    test('should return a valid prize for any random value', () => {
      for (let i = 0; i < 100; i++) {
        const result = selectPrize(calibrated);
        expect(result.id).toBeGreaterThanOrEqual(1);
        expect(result.id).toBeLessThanOrEqual(15);
        expect(result.value).toBeGreaterThan(0);
      }
    });

    test('should select prizes according to cumulative distribution', () => {
      // A value just above first prize's cumulative should give prize 2
      const prize1CumProb = calibrated[0].cumulativeProb;
      const result = selectPrize(calibrated, prize1CumProb + 0.0001);
      expect(result.id).toBe(2);
    });
  });

  describe('generateSpinId', () => {
    test('should return a 32-character hex string', () => {
      const id = generateSpinId();
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    test('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateSpinId());
      }
      expect(ids.size).toBe(100);
    });
  });
});
