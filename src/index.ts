import { PRIZES, ENTRY_COST, TARGET_RTP, SELLBACK_RATE } from './config/prizes';
import { calibrateWeights, verifyRTP } from './engine/paytable';
import { createSession, spin, collectPrize, sellBack, getSellBackPreview } from './engine/lootbox';
import { getAnimationConfig } from './animation/reel';
import { PrizeTier } from './models/types';

// ─── ANSI Colors for terminal output ──────────────────────────────────────
const COLORS = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

const TIER_COLORS: Record<PrizeTier, string> = {
  [PrizeTier.HIGH]: COLORS.yellow,
  [PrizeTier.MEDIUM]: COLORS.magenta,
  [PrizeTier.AVERAGE]: COLORS.cyan,
  [PrizeTier.LOW]: COLORS.dim,
};

function main() {
  console.log(`${COLORS.bold}${'='.repeat(70)}${COLORS.reset}`);
  console.log(`${COLORS.bold}  LOOTBOX SYSTEM — Structure & Paytable Demo${COLORS.reset}`);
  console.log(`${'='.repeat(70)}\n`);

  // ── Step 1: Calibrate the paytable ────────────────────────────────────
  console.log(`${COLORS.bold}[1] Calibrating Paytable...${COLORS.reset}`);
  console.log(`    Entry Cost: $${ENTRY_COST.toFixed(2)}`);
  console.log(`    Target RTP: ${(TARGET_RTP * 100).toFixed(1)}%`);
  console.log(`    Sell-back Rate: ${(SELLBACK_RATE * 100).toFixed(0)}% (${((1 - SELLBACK_RATE) * 100).toFixed(0)}% commission)\n`);

  const calibratedPrizes = calibrateWeights(PRIZES);

  // ── Step 2: Display the prize table ───────────────────────────────────
  console.log(`${COLORS.bold}[2] Prize Table (15 Prizes, 4 Tiers)${COLORS.reset}`);
  console.log(`${'─'.repeat(90)}`);
  console.log(
    padRight('#', 4) +
    padRight('Tier', 10) +
    padRight('Prize Name', 30) +
    padRight('Value', 10) +
    padRight('Prob %', 10) +
    padRight('EV Contrib', 12) +
    'Weight'
  );
  console.log(`${'─'.repeat(90)}`);

  for (const prize of calibratedPrizes) {
    const color = TIER_COLORS[prize.tier];
    console.log(
      `${color}` +
      padRight(`${prize.id}`, 4) +
      padRight(prize.tier, 10) +
      padRight(prize.name, 30) +
      padRight(`$${prize.value.toFixed(2)}`, 10) +
      padRight(`${(prize.probability * 100).toFixed(4)}%`, 10) +
      padRight(`$${prize.evContribution.toFixed(4)}`, 12) +
      `${prize.weight.toFixed(2)}` +
      `${COLORS.reset}`
    );
  }
  console.log(`${'─'.repeat(90)}\n`);

  // ── Step 3: Verify RTP ────────────────────────────────────────────────
  console.log(`${COLORS.bold}[3] RTP Verification${COLORS.reset}`);
  const stats = verifyRTP(calibratedPrizes);

  console.log(`    Total Prizes:     ${stats.totalPrizes}`);
  console.log(`    Probability Sum:  ${stats.probabilitySum.toFixed(10)} (should be 1.0)`);
  console.log(`    Expected Value:   $${stats.expectedValue.toFixed(6)}`);
  console.log(`    RTP:              ${(stats.rtp * 100).toFixed(4)}% ${stats.rtp >= 0.9399 && stats.rtp <= 0.9401 ? COLORS.green + 'PASS' : COLORS.red + 'FAIL'}${COLORS.reset}`);

  console.log(`\n    ${COLORS.bold}Tier Breakdown:${COLORS.reset}`);
  for (const [tier, data] of Object.entries(stats.tierBreakdown)) {
    const color = TIER_COLORS[tier as PrizeTier];
    console.log(
      `    ${color}${padRight(tier, 10)}${COLORS.reset}` +
      `${data.count} prizes | ` +
      `Hit rate: ${(data.combinedProbability * 100).toFixed(2)}% | ` +
      `EV: $${data.combinedEV.toFixed(4)}`
    );
  }

  // ── Step 4: Animation Config ──────────────────────────────────────────
  console.log(`\n${COLORS.bold}[4] Reel Animation Config${COLORS.reset}`);
  const animConfig = getAnimationConfig();
  console.log(`    Duration:       ${animConfig.totalDurationMs}ms`);
  console.log(`    Deceleration:   starts at ${(animConfig.decelerationStart * 100).toFixed(0)}% of duration`);
  console.log(`    Visible Items:  ${animConfig.visibleItems}`);
  console.log(`    Easing:         ${animConfig.easingFunction}`);

  // ── Step 5: Sample Spins ──────────────────────────────────────────────
  console.log(`\n${COLORS.bold}[5] Sample Spins (10 spins, $20 starting balance)${COLORS.reset}`);
  console.log(`${'─'.repeat(70)}`);

  const session = createSession(20.00);

  for (let i = 1; i <= 10; i++) {
    const result = spin(session);
    const preview = getSellBackPreview(result);
    const color = TIER_COLORS[result.selectedPrize.tier];

    // Alternate: collect odd spins, sell even spins
    if (i % 2 === 1) {
      collectPrize(session, result);
      console.log(
        `  Spin ${padRight(`#${i}`, 4)} | ` +
        `${color}${padRight(result.selectedPrize.name, 28)}${COLORS.reset} | ` +
        `$${result.selectedPrize.value.toFixed(2).padStart(6)} | ` +
        `${COLORS.green}COLLECTED${COLORS.reset} | ` +
        `Reel: ${result.reelSequence.totalItems} items`
      );
    } else {
      const sellResult = sellBack(session, result);
      console.log(
        `  Spin ${padRight(`#${i}`, 4)} | ` +
        `${color}${padRight(result.selectedPrize.name, 28)}${COLORS.reset} | ` +
        `$${result.selectedPrize.value.toFixed(2).padStart(6)} | ` +
        `${COLORS.yellow}SOLD $${sellResult.creditAmount.toFixed(2)}${COLORS.reset} (comm: $${sellResult.commission.toFixed(2)}) | ` +
        `Reel: ${result.reelSequence.totalItems} items`
      );
    }
  }

  console.log(`${'─'.repeat(70)}`);
  console.log(`\n${COLORS.bold}[6] Session Summary${COLORS.reset}`);
  console.log(`    Total Spins:    ${session.totalSpins}`);
  console.log(`    Total Spent:    $${session.totalSpent.toFixed(2)}`);
  console.log(`    Total Won:      $${session.totalWonValue.toFixed(2)}`);
  console.log(`    Balance:        $${session.balance.toFixed(2)}`);
  console.log(`    Inventory:      ${session.inventory.length} items`);
  console.log(`    Session RTP:    ${((session.totalWonValue / session.totalSpent) * 100).toFixed(2)}% (sample — will vary)`);

  // ── Step 7: Monte Carlo Simulation (if --simulate flag) ───────────────
  if (process.argv.includes('--simulate')) {
    runSimulation();
  } else {
    console.log(`\n${COLORS.dim}Run with --simulate for a 1M spin Monte Carlo RTP verification.${COLORS.reset}`);
  }

  console.log(`\n${'='.repeat(70)}`);
}

function runSimulation() {
  const SPINS = 1_000_000;
  console.log(`\n${COLORS.bold}[7] Monte Carlo Simulation (${SPINS.toLocaleString()} spins)${COLORS.reset}`);

  const calibratedPrizes = calibrateWeights(PRIZES);
  const session = createSession(SPINS * ENTRY_COST);

  const startTime = Date.now();
  for (let i = 0; i < SPINS; i++) {
    const result = spin(session);
    collectPrize(session, result);
  }
  const elapsed = Date.now() - startTime;

  const empiricalRTP = session.totalWonValue / session.totalSpent;

  console.log(`    Spins:          ${SPINS.toLocaleString()}`);
  console.log(`    Total Spent:    $${session.totalSpent.toLocaleString()}`);
  console.log(`    Total Won:      $${session.totalWonValue.toLocaleString()}`);
  console.log(`    Empirical RTP:  ${(empiricalRTP * 100).toFixed(4)}%`);
  console.log(`    Target RTP:     ${(TARGET_RTP * 100).toFixed(4)}%`);
  console.log(`    Deviation:      ${((empiricalRTP - TARGET_RTP) * 100).toFixed(4)}%`);
  console.log(`    Time:           ${elapsed}ms`);

  const pass = Math.abs(empiricalRTP - TARGET_RTP) < 0.005;
  console.log(`    Result:         ${pass ? COLORS.green + 'PASS' : COLORS.red + 'FAIL'}${COLORS.reset} (within ±0.5%)`);
}

function padRight(str: string, length: number): string {
  return str.padEnd(length);
}

main();
