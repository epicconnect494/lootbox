import { injectStyles } from './styles';
import { initParticles, burstParticles } from './particles';
import { createSession, spin, collectPrize, sellBack, getSellBackPreview, getCalibratedPrizes } from '../engine/lootbox';
import { getAnimationConfig } from '../animation/reel';
import { GameSession, SpinResult, PrizeTier, CalibratedPrize } from '../models/types';

// ─── Prize Icons (mapped by imageSlug prefix) ─────────────────────────────
const PRIZE_ICONS: Record<string, string> = {
  'amazon': '🛒',
  'steam': '🎮',
  'netflix': '🎬',
  'spotify': '🎵',
  'itunes': '🎧',
  'starbucks': '☕',
  'doordash': '🍔',
  'ubereats': '🍕',
  'googleplay': '📱',
  'appstore': '📲',
  'gamecurrency': '🎯',
  'bonus': '⭐',
  'token': '🪙',
};

const TIER_LABELS: Record<PrizeTier, string> = {
  [PrizeTier.HIGH]: 'LEGENDARY',
  [PrizeTier.MEDIUM]: 'EPIC',
  [PrizeTier.AVERAGE]: 'COMMON',
  [PrizeTier.LOW]: 'BASIC',
};

// ─── State ─────────────────────────────────────────────────────────────────
let session: GameSession;
let currentSpin: SpinResult | null = null;
let isSpinning = false;

// ─── DOM Elements ──────────────────────────────────────────────────────────
let elBalance: HTMLElement;
let elBtnSpin: HTMLButtonElement;
let elSpinText: HTMLElement;
let elLootboxSection: HTMLElement;
let elReelSection: HTMLElement;
let elReelStrip: HTMLElement;
let elResultSection: HTMLElement;
let elResultCard: HTMLElement;
let elResultTier: HTMLElement;
let elResultIcon: HTMLElement;
let elResultName: HTMLElement;
let elResultValue: HTMLElement;
let elBtnCollect: HTMLButtonElement;
let elBtnSell: HTMLButtonElement;
let elSellLabel: HTMLElement;
let elBoxContainer: HTMLElement;
let elBoxLid: HTMLElement;
let elStatSpins: HTMLElement;
let elStatSpent: HTMLElement;
let elStatWon: HTMLElement;
let elStatInventory: HTMLElement;
let elHistoryList: HTMLElement;
let elActionSection: HTMLElement;
let elToast: HTMLElement;

// ─── Boot ──────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  injectStyles();
  initParticles();
  cacheDOM();
  session = createSession(20.00);
  updateUI();
  bindEvents();
});

function cacheDOM(): void {
  elBalance = document.getElementById('balance-amount')!;
  elBtnSpin = document.getElementById('btn-spin') as HTMLButtonElement;
  elSpinText = elBtnSpin.querySelector('.spin-text')!;
  elLootboxSection = document.getElementById('lootbox-section')!;
  elReelSection = document.getElementById('reel-section')!;
  elReelStrip = document.getElementById('reel-strip')!;
  elResultSection = document.getElementById('result-section')!;
  elResultCard = document.getElementById('result-card')!;
  elResultTier = document.getElementById('result-tier')!;
  elResultIcon = document.getElementById('result-icon')!;
  elResultName = document.getElementById('result-name')!;
  elResultValue = document.getElementById('result-value')!;
  elBtnCollect = document.getElementById('btn-collect') as HTMLButtonElement;
  elBtnSell = document.getElementById('btn-sell') as HTMLButtonElement;
  elSellLabel = document.getElementById('sell-label')!;
  elBoxContainer = document.getElementById('box-container')!;
  elBoxLid = document.getElementById('box-lid')!;
  elStatSpins = document.getElementById('stat-spins')!;
  elStatSpent = document.getElementById('stat-spent')!;
  elStatWon = document.getElementById('stat-won')!;
  elStatInventory = document.getElementById('stat-inventory')!;
  elHistoryList = document.getElementById('history-list')!;
  elActionSection = document.getElementById('action-section')!;
  elToast = document.getElementById('toast')!;
}

function bindEvents(): void {
  elBtnSpin.addEventListener('click', handleSpin);
  elBtnCollect.addEventListener('click', handleCollect);
  elBtnSell.addEventListener('click', handleSell);
}

// ─── Spin Handler ──────────────────────────────────────────────────────────
async function handleSpin(): Promise<void> {
  if (isSpinning) return;
  if (session.balance < 2.00) {
    showToast('Insufficient balance! Need $2.00 to spin.');
    return;
  }

  isSpinning = true;
  currentSpin = null;

  // Hide previous results
  elResultSection.classList.add('hidden');
  elReelSection.classList.add('hidden');

  // Button state
  elBtnSpin.classList.add('spinning');
  elSpinText.textContent = 'SPINNING...';
  elBtnSpin.disabled = true;

  // Box shake animation
  elBoxContainer.classList.add('shaking');
  await delay(500);
  elBoxContainer.classList.remove('shaking');

  // Open the lid
  elBoxLid.classList.add('open');
  await delay(600);

  // Execute the spin (RNG + reel generation)
  try {
    currentSpin = spin(session);
  } catch {
    showToast('Something went wrong. Try again.');
    resetSpinState();
    return;
  }

  // Update balance immediately
  updateBalance();

  // Show reel and animate
  elLootboxSection.classList.add('hidden');
  elReelSection.classList.remove('hidden');
  buildReelStrip(currentSpin);
  await animateReel(currentSpin);

  // Show result
  await delay(300);
  showResult(currentSpin);

  // Reset spin button
  resetSpinState();
}

function resetSpinState(): void {
  isSpinning = false;
  elBtnSpin.classList.remove('spinning');
  elBtnSpin.disabled = false;
  elSpinText.textContent = 'OPEN LOOTBOX';
  elBoxLid.classList.remove('open');
}

// ─── Build Reel Strip ──────────────────────────────────────────────────────
function buildReelStrip(spinResult: SpinResult): void {
  elReelStrip.innerHTML = '';
  elReelStrip.style.transform = 'translateX(0)';

  const { items } = spinResult.reelSequence;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const div = document.createElement('div');
    div.className = `reel-item tier-${item.tier}`;

    const icon = getIconForSlug(item.imageSlug);
    div.innerHTML = `
      <span class="item-icon">${icon}</span>
      <span class="item-name">${item.name}</span>
      <span class="item-value">$${getPrizeValue(item.prizeId).toFixed(2)}</span>
    `;

    elReelStrip.appendChild(div);
  }
}

// ─── Animate Reel ──────────────────────────────────────────────────────────
function animateReel(spinResult: SpinResult): Promise<void> {
  return new Promise((resolve) => {
    const config = getAnimationConfig();
    const itemWidth = getReelItemWidth();
    const winnerIndex = spinResult.reelSequence.winnerIndex;
    const reelWindow = elReelStrip.parentElement!;
    const windowWidth = reelWindow.offsetWidth;

    // Calculate final position: winner centered in viewport
    const targetX = -(winnerIndex * itemWidth) + (windowWidth / 2) - (itemWidth / 2);

    // Add extra loops for drama (3 full passes through the strip)
    const totalStripWidth = spinResult.reelSequence.totalItems * itemWidth;
    const extraDistance = totalStripWidth * 2;
    const startX = targetX + extraDistance;

    // Start position (far right, off-screen)
    elReelStrip.style.transition = 'none';
    elReelStrip.style.transform = `translateX(${startX}px)`;

    // Force reflow
    void elReelStrip.offsetHeight;

    // Animate to final position
    elReelStrip.style.transition = `transform ${config.totalDurationMs}ms cubic-bezier(0.15, 0.0, 0.15, 1.0)`;
    elReelStrip.style.transform = `translateX(${targetX}px)`;

    // Mark winner after animation
    setTimeout(() => {
      const reelItems = elReelStrip.querySelectorAll('.reel-item');
      if (reelItems[winnerIndex]) {
        reelItems[winnerIndex].classList.add('winner');
      }
      resolve();
    }, config.totalDurationMs + 100);
  });
}

function getReelItemWidth(): number {
  const firstItem = elReelStrip.querySelector('.reel-item');
  if (firstItem) return (firstItem as HTMLElement).offsetWidth;
  return window.innerWidth <= 480 ? 90 : 120;
}

// ─── Show Result ───────────────────────────────────────────────────────────
function showResult(spinResult: SpinResult): void {
  const prize = spinResult.selectedPrize;
  const tier = prize.tier;
  const sellPreview = getSellBackPreview(spinResult);

  // Set tier class on card
  elResultCard.className = `result-card tier-${tier}`;

  // Populate
  elResultTier.textContent = TIER_LABELS[tier];
  elResultIcon.textContent = getIconForSlug(prize.imageSlug);
  elResultName.textContent = prize.name;
  elResultValue.textContent = `$${prize.value.toFixed(2)}`;
  elSellLabel.textContent = `Sell for $${sellPreview.creditAmount.toFixed(2)}`;

  // Show result section, hide spin button
  elResultSection.classList.remove('hidden');
  elActionSection.classList.add('hidden');

  // Particle burst
  burstParticles(tier);
}

// ─── Collect Handler ───────────────────────────────────────────────────────
function handleCollect(): void {
  if (!currentSpin) return;

  collectPrize(session, currentSpin);
  addHistoryEntry(currentSpin, 'collect');
  showToast(`Collected: ${currentSpin.selectedPrize.name}!`);

  finishRound();
}

// ─── Sell Handler ──────────────────────────────────────────────────────────
function handleSell(): void {
  if (!currentSpin) return;

  const result = sellBack(session, currentSpin);
  addHistoryEntry(currentSpin, 'sell', result.creditAmount);
  showToast(`Sold for $${result.creditAmount.toFixed(2)} (+$${result.creditAmount.toFixed(2)} to balance)`);

  finishRound();
}

// ─── Finish Round ──────────────────────────────────────────────────────────
function finishRound(): void {
  currentSpin = null;

  // Hide result, show lootbox again
  elResultSection.classList.add('hidden');
  elReelSection.classList.add('hidden');
  elLootboxSection.classList.remove('hidden');
  elActionSection.classList.remove('hidden');

  updateUI();
}

// ─── UI Updates ────────────────────────────────────────────────────────────
function updateUI(): void {
  updateBalance();
  updateStats();

  // Disable spin if insufficient balance
  if (session.balance < 2.00) {
    elBtnSpin.disabled = true;
    elSpinText.textContent = 'INSUFFICIENT FUNDS';
  }
}

function updateBalance(): void {
  elBalance.textContent = `$${session.balance.toFixed(2)}`;
  elBalance.classList.add('flash');
  setTimeout(() => elBalance.classList.remove('flash'), 500);
}

function updateStats(): void {
  elStatSpins.textContent = `${session.totalSpins}`;
  elStatSpent.textContent = `$${session.totalSpent.toFixed(2)}`;
  elStatWon.textContent = `$${session.totalWonValue.toFixed(2)}`;
  elStatInventory.textContent = `${session.inventory.length}`;
}

// ─── History ───────────────────────────────────────────────────────────────
function addHistoryEntry(spinResult: SpinResult, action: 'collect' | 'sell', sellAmount?: number): void {
  const prize = spinResult.selectedPrize;

  // Remove empty message
  const emptyMsg = elHistoryList.querySelector('.history-empty');
  if (emptyMsg) emptyMsg.remove();

  const el = document.createElement('div');
  el.className = `history-item tier-${prize.tier}`;

  const icon = getIconForSlug(prize.imageSlug);
  const actionBadge = action === 'collect'
    ? '<span class="history-action collected">Collected</span>'
    : `<span class="history-action sold">Sold $${sellAmount!.toFixed(2)}</span>`;

  el.innerHTML = `
    <span class="history-icon">${icon}</span>
    <div class="history-info">
      <div class="history-name">${prize.name}</div>
      <div class="history-meta">$${prize.value.toFixed(2)} &middot; ${TIER_LABELS[prize.tier]}</div>
    </div>
    ${actionBadge}
  `;

  // Prepend (newest first)
  elHistoryList.prepend(el);

  // Limit to 20 entries
  while (elHistoryList.children.length > 20) {
    elHistoryList.removeChild(elHistoryList.lastChild!);
  }
}

// ─── Toast ─────────────────────────────────────────────────────────────────
function showToast(message: string): void {
  elToast.textContent = message;
  elToast.classList.remove('hidden');
  elToast.classList.add('show');

  setTimeout(() => {
    elToast.classList.remove('show');
    setTimeout(() => elToast.classList.add('hidden'), 300);
  }, 2500);
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function getIconForSlug(slug: string): string {
  const prefix = slug.split('-')[0];
  return PRIZE_ICONS[prefix] || '🎁';
}

function getPrizeValue(prizeId: number): number {
  const prizes = getCalibratedPrizes();
  const prize = prizes.find((p) => p.id === prizeId);
  return prize?.value ?? 0;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
