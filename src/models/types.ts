// ─── Prize Tiers ───────────────────────────────────────────────────────────
export enum PrizeTier {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  AVERAGE = 'AVERAGE',
  LOW = 'LOW',
}

// ─── Prize Definition ──────────────────────────────────────────────────────
export interface Prize {
  id: number;
  name: string;
  value: number;          // Dollar value of the prize
  tier: PrizeTier;
  imageSlug: string;      // Thumbnail identifier for frontend
  weight: number;         // Raw weight for probability calculation
}

// ─── Computed Prize (after paytable calibration) ───────────────────────────
export interface CalibratedPrize extends Prize {
  probability: number;    // Normalized probability [0, 1]
  cumulativeProb: number; // Cumulative probability for RNG lookup
  evContribution: number; // probability * value
}

// ─── Reel Animation Data ───────────────────────────────────────────────────
export interface ReelItem {
  prizeId: number;
  name: string;
  imageSlug: string;
  tier: PrizeTier;
}

export interface ReelSequence {
  items: ReelItem[];          // Ordered list of prizes on the reel strip
  winnerIndex: number;        // Index where the winning prize sits
  totalItems: number;
}

export interface AnimationConfig {
  totalDurationMs: number;    // Total animation time in milliseconds
  decelerationStart: number;  // Fraction of duration where deceleration begins (0-1)
  visibleItems: number;       // Number of items visible at once in the viewport
  easingFunction: string;     // CSS easing function name for frontend
}

// ─── Spin Result ───────────────────────────────────────────────────────────
export interface SpinResult {
  selectedPrize: CalibratedPrize;
  reelSequence: ReelSequence;
  timestamp: number;
  spinId: string;
}

// ─── Player Actions ────────────────────────────────────────────────────────
export type PlayerAction = 'collect' | 'sell';

export interface SellBackResult {
  originalValue: number;
  creditAmount: number;     // originalValue * SELLBACK_RATE
  commission: number;       // originalValue * (1 - SELLBACK_RATE)
}

export interface CollectResult {
  prize: CalibratedPrize;
  addedToInventory: true;
}

// ─── Game Session ──────────────────────────────────────────────────────────
export interface InventoryItem {
  prize: CalibratedPrize;
  collectedAt: number;
}

export interface SpinHistoryEntry {
  spinResult: SpinResult;
  action: PlayerAction;
  sellBackResult?: SellBackResult;
}

export interface GameSession {
  sessionId: string;
  balance: number;
  inventory: InventoryItem[];
  history: SpinHistoryEntry[];
  totalSpins: number;
  totalSpent: number;
  totalWonValue: number;
}

// ─── Paytable Verification ─────────────────────────────────────────────────
export interface PaytableStats {
  totalPrizes: number;
  probabilitySum: number;
  expectedValue: number;
  rtp: number;
  entryCost: number;
  tierBreakdown: Record<PrizeTier, {
    count: number;
    combinedProbability: number;
    combinedEV: number;
  }>;
}
