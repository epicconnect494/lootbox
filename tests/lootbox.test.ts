import {
  createSession,
  spin,
  collectPrize,
  sellBack,
  getSellBackPreview,
} from '../src/engine/lootbox';
import { ENTRY_COST, SELLBACK_RATE } from '../src/config/prizes';

describe('Lootbox Game Logic', () => {
  describe('createSession', () => {
    test('should create a session with correct initial balance', () => {
      const session = createSession(10.00);
      expect(session.balance).toBe(10.00);
      expect(session.totalSpins).toBe(0);
      expect(session.totalSpent).toBe(0);
      expect(session.inventory).toHaveLength(0);
      expect(session.history).toHaveLength(0);
      expect(session.sessionId).toBeTruthy();
    });

    test('should reject negative balance', () => {
      expect(() => createSession(-5)).toThrow('Initial balance cannot be negative');
    });

    test('should allow zero balance', () => {
      const session = createSession(0);
      expect(session.balance).toBe(0);
    });
  });

  describe('spin', () => {
    test('should deduct entry cost from balance', () => {
      const session = createSession(10.00);
      spin(session);
      expect(session.balance).toBe(10.00 - ENTRY_COST);
    });

    test('should increment spin counter', () => {
      const session = createSession(10.00);
      spin(session);
      spin(session);
      expect(session.totalSpins).toBe(2);
      expect(session.totalSpent).toBe(ENTRY_COST * 2);
    });

    test('should throw on insufficient balance', () => {
      const session = createSession(1.00);
      expect(() => spin(session)).toThrow('Insufficient balance');
    });

    test('should return a valid spin result', () => {
      const session = createSession(10.00);
      const result = spin(session);

      expect(result.selectedPrize).toBeDefined();
      expect(result.selectedPrize.id).toBeGreaterThanOrEqual(1);
      expect(result.selectedPrize.id).toBeLessThanOrEqual(15);
      expect(result.reelSequence).toBeDefined();
      expect(result.reelSequence.items.length).toBeGreaterThanOrEqual(20);
      expect(result.spinId).toBeTruthy();
      expect(result.timestamp).toBeGreaterThan(0);
    });

    test('should place winning prize at end of reel', () => {
      const session = createSession(10.00);
      const result = spin(session);
      const lastItem = result.reelSequence.items[result.reelSequence.winnerIndex];
      expect(lastItem.prizeId).toBe(result.selectedPrize.id);
    });
  });

  describe('collectPrize', () => {
    test('should add prize to inventory', () => {
      const session = createSession(10.00);
      const result = spin(session);
      const collectResult = collectPrize(session, result);

      expect(collectResult.addedToInventory).toBe(true);
      expect(session.inventory).toHaveLength(1);
      expect(session.inventory[0].prize.id).toBe(result.selectedPrize.id);
    });

    test('should record in history as collect action', () => {
      const session = createSession(10.00);
      const result = spin(session);
      collectPrize(session, result);

      expect(session.history).toHaveLength(1);
      expect(session.history[0].action).toBe('collect');
    });

    test('should track total won value', () => {
      const session = createSession(10.00);
      const result = spin(session);
      collectPrize(session, result);

      expect(session.totalWonValue).toBe(result.selectedPrize.value);
    });
  });

  describe('sellBack', () => {
    test('should credit 90% of prize value to balance', () => {
      const session = createSession(10.00);
      const result = spin(session);
      const balanceAfterSpin = session.balance;
      const sellResult = sellBack(session, result);

      const expectedCredit = Math.round(result.selectedPrize.value * SELLBACK_RATE * 100) / 100;
      expect(sellResult.creditAmount).toBe(expectedCredit);
      expect(session.balance).toBe(
        Math.round((balanceAfterSpin + expectedCredit) * 100) / 100
      );
    });

    test('should calculate 10% commission', () => {
      const session = createSession(10.00);
      const result = spin(session);
      const sellResult = sellBack(session, result);

      expect(sellResult.originalValue).toBe(result.selectedPrize.value);
      expect(sellResult.creditAmount + sellResult.commission).toBeCloseTo(
        sellResult.originalValue,
        2
      );
    });

    test('should record in history as sell action', () => {
      const session = createSession(10.00);
      const result = spin(session);
      sellBack(session, result);

      expect(session.history).toHaveLength(1);
      expect(session.history[0].action).toBe('sell');
      expect(session.history[0].sellBackResult).toBeDefined();
    });
  });

  describe('getSellBackPreview', () => {
    test('should return preview without modifying session', () => {
      const session = createSession(10.00);
      const result = spin(session);
      const balanceBefore = session.balance;

      const preview = getSellBackPreview(result);
      expect(preview.originalValue).toBe(result.selectedPrize.value);
      expect(preview.creditAmount).toBeGreaterThan(0);
      expect(session.balance).toBe(balanceBefore); // No change
      expect(session.history).toHaveLength(0);      // No record
    });
  });
});
