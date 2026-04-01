import {
  GameSession,
  SpinResult,
  SellBackResult,
  CollectResult,
  CalibratedPrize,
  SpinHistoryEntry,
} from '../models/types';
import { ENTRY_COST, SELLBACK_RATE, PRIZES } from '../config/prizes';
import { calibrateWeights } from './paytable';
import { selectPrize, generateSpinId } from './rng';
import { generateReelSequence } from '../animation/reel';

// ─── Singleton calibrated prize table ──────────────────────────────────────
let _calibratedPrizes: CalibratedPrize[] | null = null;

export function getCalibratedPrizes(): CalibratedPrize[] {
  if (!_calibratedPrizes) {
    _calibratedPrizes = calibrateWeights(PRIZES);
  }
  return _calibratedPrizes;
}

/**
 * Create a new game session with a given starting balance.
 */
export function createSession(initialBalance: number): GameSession {
  if (initialBalance < 0) {
    throw new Error('Initial balance cannot be negative');
  }

  return {
    sessionId: generateSpinId(),
    balance: initialBalance,
    inventory: [],
    history: [],
    totalSpins: 0,
    totalSpent: 0,
    totalWonValue: 0,
  };
}

/**
 * Execute a lootbox spin.
 *
 * 1. Validates balance >= ENTRY_COST
 * 2. Deducts entry cost from balance
 * 3. RNG selects the winning prize
 * 4. Generates reel animation sequence (outcome predetermined)
 * 5. Returns SpinResult for frontend to animate
 */
export function spin(session: GameSession): SpinResult {
  if (session.balance < ENTRY_COST) {
    throw new Error(
      `Insufficient balance: $${session.balance.toFixed(2)} < $${ENTRY_COST.toFixed(2)} entry cost`
    );
  }

  // Deduct entry cost
  session.balance = roundCents(session.balance - ENTRY_COST);
  session.totalSpins++;
  session.totalSpent = roundCents(session.totalSpent + ENTRY_COST);

  // RNG determines outcome FIRST
  const calibratedPrizes = getCalibratedPrizes();
  const winner = selectPrize(calibratedPrizes);

  // Generate reel strip for animation (winner at final position)
  const reelSequence = generateReelSequence(calibratedPrizes, winner);

  const result: SpinResult = {
    selectedPrize: winner,
    reelSequence,
    timestamp: Date.now(),
    spinId: generateSpinId(),
  };

  return result;
}

/**
 * Collect the prize — add it to the player's inventory.
 */
export function collectPrize(
  session: GameSession,
  spinResult: SpinResult
): CollectResult {
  session.inventory.push({
    prize: spinResult.selectedPrize,
    collectedAt: Date.now(),
  });

  session.totalWonValue = roundCents(
    session.totalWonValue + spinResult.selectedPrize.value
  );

  const entry: SpinHistoryEntry = {
    spinResult,
    action: 'collect',
  };
  session.history.push(entry);

  return {
    prize: spinResult.selectedPrize,
    addedToInventory: true,
  };
}

/**
 * Sell the prize back for 90% of its value (10% house commission).
 * Credits the sell-back amount directly to the player's balance.
 */
export function sellBack(
  session: GameSession,
  spinResult: SpinResult
): SellBackResult {
  const originalValue = spinResult.selectedPrize.value;
  const creditAmount = roundCents(originalValue * SELLBACK_RATE);
  const commission = roundCents(originalValue - creditAmount);

  session.balance = roundCents(session.balance + creditAmount);
  session.totalWonValue = roundCents(session.totalWonValue + creditAmount);

  const sellBackResult: SellBackResult = {
    originalValue,
    creditAmount,
    commission,
  };

  const entry: SpinHistoryEntry = {
    spinResult,
    action: 'sell',
    sellBackResult,
  };
  session.history.push(entry);

  return sellBackResult;
}

/**
 * Get the sell-back preview (without executing it).
 */
export function getSellBackPreview(spinResult: SpinResult): SellBackResult {
  const originalValue = spinResult.selectedPrize.value;
  const creditAmount = roundCents(originalValue * SELLBACK_RATE);
  const commission = roundCents(originalValue - creditAmount);

  return { originalValue, creditAmount, commission };
}

/**
 * Round to nearest cent to avoid floating-point drift.
 */
function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}
