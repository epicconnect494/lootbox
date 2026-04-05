export function injectStyles(): void {
  const style = document.createElement('style');
  style.textContent = `
/* ─── Reset & Base ──────────────────────────────────────────────── */
*, *::before, *::after {
  margin: 0; padding: 0; box-sizing: border-box;
}

:root {
  --bg-primary: #0a0a1a;
  --bg-secondary: #12122a;
  --bg-card: #1a1a3e;
  --bg-elevated: #222255;
  --text-primary: #e8e8ff;
  --text-secondary: #8888bb;
  --text-dim: #555588;
  --accent: #ff6b35;
  --accent-glow: #ff6b3566;
  --gold: #ffd700;
  --gold-glow: #ffd70044;
  --tier-high: #ffd700;
  --tier-high-bg: #ffd70022;
  --tier-medium: #a855f7;
  --tier-medium-bg: #a855f722;
  --tier-average: #3b82f6;
  --tier-average-bg: #3b82f622;
  --tier-low: #6b7280;
  --tier-low-bg: #6b728022;
  --success: #22c55e;
  --danger: #ef4444;
  --radius: 12px;
  --radius-lg: 20px;
  --shadow-lg: 0 20px 60px rgba(0,0,0,0.5);
  --shadow-glow: 0 0 40px var(--accent-glow);
}

html { font-size: 16px; }

body {
  font-family: 'Inter', -apple-system, sans-serif;
  background: var(--bg-primary);
  color: var(--text-primary);
  min-height: 100vh;
  overflow-x: hidden;
  position: relative;
}

body::before {
  content: '';
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background:
    radial-gradient(ellipse at 20% 50%, #1a0a3a 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, #0a1a3a 0%, transparent 50%),
    radial-gradient(ellipse at 50% 80%, #1a0a2a 0%, transparent 50%);
  z-index: 0;
  pointer-events: none;
}

/* ─── Header ────────────────────────────────────────────────────── */
#top-bar {
  position: sticky;
  top: 0;
  z-index: 100;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: rgba(10, 10, 26, 0.9);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.logo {
  display: flex;
  align-items: center;
  gap: 10px;
}

.logo-icon { font-size: 28px; }

.logo-text {
  font-family: 'Orbitron', monospace;
  font-size: 24px;
  font-weight: 900;
  color: var(--text-primary);
  letter-spacing: 2px;
}

.logo-text .accent {
  color: var(--accent);
  text-shadow: 0 0 20px var(--accent-glow);
}

.balance-display {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.balance-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 2px;
  color: var(--text-dim);
  text-transform: uppercase;
}

.balance-amount {
  font-family: 'Orbitron', monospace;
  font-size: 22px;
  font-weight: 700;
  color: var(--success);
  text-shadow: 0 0 10px rgba(34,197,94,0.3);
  transition: all 0.3s ease;
}

.balance-amount.flash {
  animation: balanceFlash 0.5s ease;
}

@keyframes balanceFlash {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); color: #fff; }
}

/* ─── Main ──────────────────────────────────────────────────────── */
#app {
  position: relative;
  z-index: 1;
  max-width: 600px;
  margin: 0 auto;
  padding: 20px 16px 40px;
}

.hidden { display: none !important; }

/* ─── Lootbox Visual ────────────────────────────────────────────── */
#lootbox-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40px 0 20px;
}

.box-container {
  position: relative;
  width: 180px;
  height: 180px;
  cursor: pointer;
  transition: transform 0.3s ease;
}

.box-container:hover { transform: scale(1.05); }
.box-container.shaking { animation: boxShake 0.5s ease; }

@keyframes boxShake {
  0%, 100% { transform: rotate(0deg); }
  20% { transform: rotate(-8deg) scale(1.05); }
  40% { transform: rotate(8deg) scale(1.05); }
  60% { transform: rotate(-5deg) scale(1.03); }
  80% { transform: rotate(5deg) scale(1.03); }
}

.box-glow {
  position: absolute;
  top: 50%; left: 50%;
  transform: translate(-50%, -50%);
  width: 220px;
  height: 220px;
  border-radius: 50%;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  animation: glowPulse 2s ease-in-out infinite;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.5; transform: translate(-50%, -50%) scale(1); }
  50% { opacity: 1; transform: translate(-50%, -50%) scale(1.1); }
}

.box-body {
  position: relative;
  width: 100%;
  height: 100%;
}

.box-lid {
  position: absolute;
  top: 0; left: 10%;
  width: 80%;
  height: 35%;
  background: linear-gradient(135deg, #ff8c42, #ff6b35, #e85d26);
  border-radius: 12px 12px 4px 4px;
  z-index: 2;
  transform-origin: bottom center;
  transition: transform 0.6s cubic-bezier(0.68, -0.55, 0.27, 1.55);
  box-shadow: 0 -4px 20px rgba(255,107,53,0.3);
}

.box-lid.open {
  transform: rotateX(-120deg) translateY(-20px);
}

.lid-shine {
  position: absolute;
  top: 20%; left: 15%;
  width: 30%;
  height: 4px;
  background: rgba(255,255,255,0.4);
  border-radius: 4px;
  transform: rotate(-5deg);
}

.box-base {
  position: absolute;
  bottom: 0; left: 5%;
  width: 90%;
  height: 70%;
  background: linear-gradient(180deg, #e85d26, #cc4a1a, #b33f15);
  border-radius: 8px 8px 16px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow:
    inset 0 4px 0 rgba(255,255,255,0.1),
    0 10px 40px rgba(0,0,0,0.4);
}

.box-base::before {
  content: '';
  position: absolute;
  top: 0; left: 50%;
  transform: translateX(-50%);
  width: 60%;
  height: 100%;
  background: linear-gradient(180deg, rgba(255,255,255,0.08), transparent 40%);
  border-radius: 8px 8px 16px 16px;
}

.box-question {
  font-family: 'Orbitron', monospace;
  font-size: 60px;
  font-weight: 900;
  color: rgba(255,255,255,0.15);
  text-shadow: 0 0 20px rgba(255,255,255,0.1);
  animation: questionPulse 1.5s ease-in-out infinite;
}

@keyframes questionPulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}

.cost-badge {
  margin-top: 16px;
  padding: 8px 20px;
  background: var(--bg-card);
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 30px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  gap: 8px;
}

/* ─── Reel Section ──────────────────────────────────────────────── */
.reel-section {
  padding: 30px 0;
}

.reel-frame {
  position: relative;
  margin: 0 auto;
  overflow: hidden;
  border-radius: var(--radius-lg);
  background: var(--bg-secondary);
  border: 2px solid rgba(255,255,255,0.08);
  box-shadow: var(--shadow-lg), inset 0 0 60px rgba(0,0,0,0.3);
  height: 140px;
}

.reel-pointer {
  position: absolute;
  top: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 3px;
  height: 100%;
  background: var(--accent);
  z-index: 10;
  box-shadow: 0 0 12px var(--accent), 0 0 30px var(--accent-glow);
}

.reel-pointer::before {
  content: '';
  position: absolute;
  top: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 10px solid var(--accent);
  filter: drop-shadow(0 0 4px var(--accent));
}

.reel-pointer::after {
  content: '';
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-bottom: 10px solid var(--accent);
  filter: drop-shadow(0 0 4px var(--accent));
}

.reel-window {
  position: relative;
  height: 100%;
  overflow: hidden;
}

.reel-strip {
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  will-change: transform;
}

.reel-item {
  flex-shrink: 0;
  width: 120px;
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  border-right: 1px solid rgba(255,255,255,0.04);
  transition: opacity 0.1s;
  padding: 8px;
}

.reel-item .item-icon {
  font-size: 36px;
  line-height: 1;
}

.reel-item .item-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  text-align: center;
  line-height: 1.2;
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reel-item .item-value {
  font-family: 'Orbitron', monospace;
  font-size: 14px;
  font-weight: 700;
}

.reel-item.tier-HIGH .item-value { color: var(--tier-high); }
.reel-item.tier-MEDIUM .item-value { color: var(--tier-medium); }
.reel-item.tier-AVERAGE .item-value { color: var(--tier-average); }
.reel-item.tier-LOW .item-value { color: var(--tier-low); }

.reel-item.winner {
  background: rgba(255,107,53,0.1);
  border: 2px solid var(--accent);
  border-radius: 8px;
}

.reel-edge {
  position: absolute;
  top: 0;
  width: 60px;
  height: 100%;
  z-index: 5;
  pointer-events: none;
}

.reel-edge.left {
  left: 0;
  background: linear-gradient(90deg, var(--bg-secondary), transparent);
}

.reel-edge.right {
  right: 0;
  background: linear-gradient(-90deg, var(--bg-secondary), transparent);
}

/* ─── Result Card ───────────────────────────────────────────────── */
.result-section {
  padding: 20px 0;
  display: flex;
  justify-content: center;
}

.result-card {
  width: 100%;
  max-width: 400px;
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  padding: 32px 24px;
  text-align: center;
  border: 1px solid rgba(255,255,255,0.08);
  box-shadow: var(--shadow-lg);
  animation: resultAppear 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
}

@keyframes resultAppear {
  0% { opacity: 0; transform: scale(0.8) translateY(20px); }
  100% { opacity: 1; transform: scale(1) translateY(0); }
}

.result-card.tier-HIGH {
  border-color: var(--tier-high);
  box-shadow: var(--shadow-lg), 0 0 40px var(--gold-glow);
}
.result-card.tier-MEDIUM {
  border-color: var(--tier-medium);
  box-shadow: var(--shadow-lg), 0 0 30px rgba(168,85,247,0.2);
}
.result-card.tier-AVERAGE {
  border-color: var(--tier-average);
  box-shadow: var(--shadow-lg), 0 0 20px rgba(59,130,246,0.15);
}
.result-card.tier-LOW {
  border-color: var(--tier-low);
}

.result-tier-badge {
  display: inline-block;
  padding: 4px 16px;
  border-radius: 30px;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 2px;
  text-transform: uppercase;
  margin-bottom: 16px;
}

.result-card.tier-HIGH .result-tier-badge {
  background: var(--tier-high-bg);
  color: var(--tier-high);
  border: 1px solid rgba(255,215,0,0.3);
}
.result-card.tier-MEDIUM .result-tier-badge {
  background: var(--tier-medium-bg);
  color: var(--tier-medium);
  border: 1px solid rgba(168,85,247,0.3);
}
.result-card.tier-AVERAGE .result-tier-badge {
  background: var(--tier-average-bg);
  color: var(--tier-average);
  border: 1px solid rgba(59,130,246,0.3);
}
.result-card.tier-LOW .result-tier-badge {
  background: var(--tier-low-bg);
  color: var(--tier-low);
  border: 1px solid rgba(107,114,128,0.3);
}

.result-icon {
  font-size: 64px;
  margin-bottom: 12px;
  animation: iconBounce 0.6s ease 0.3s both;
}

@keyframes iconBounce {
  0% { transform: scale(0); }
  60% { transform: scale(1.2); }
  100% { transform: scale(1); }
}

.result-name {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 4px;
}

.result-value {
  font-family: 'Orbitron', monospace;
  font-size: 28px;
  font-weight: 900;
  margin-bottom: 24px;
}

.result-card.tier-HIGH .result-value { color: var(--tier-high); }
.result-card.tier-MEDIUM .result-value { color: var(--tier-medium); }
.result-card.tier-AVERAGE .result-value { color: var(--tier-average); }
.result-card.tier-LOW .result-value { color: var(--tier-low); }

.result-actions {
  display: flex;
  gap: 12px;
}

/* ─── Buttons ───────────────────────────────────────────────────── */
.btn {
  flex: 1;
  padding: 14px 20px;
  border: none;
  border-radius: var(--radius);
  font-family: 'Inter', sans-serif;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  transition: all 0.2s ease;
  position: relative;
  overflow: hidden;
}

.btn::after {
  content: '';
  position: absolute;
  top: 50%; left: 50%;
  width: 0; height: 0;
  background: rgba(255,255,255,0.1);
  border-radius: 50%;
  transform: translate(-50%, -50%);
  transition: width 0.4s, height 0.4s;
}

.btn:active::after {
  width: 300px;
  height: 300px;
}

.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.btn-spin {
  width: 100%;
  max-width: 400px;
  margin: 0 auto;
  display: flex;
  padding: 18px 32px;
  font-size: 18px;
  font-weight: 800;
  letter-spacing: 1px;
  background: linear-gradient(135deg, #ff6b35, #e85d26);
  color: white;
  border-radius: var(--radius-lg);
  box-shadow: 0 8px 30px rgba(255,107,53,0.3);
  justify-content: space-between;
}

.btn-spin:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 12px 40px rgba(255,107,53,0.4);
}

.btn-spin:active:not(:disabled) {
  transform: translateY(0);
}

.btn-spin.spinning {
  background: var(--bg-elevated);
  color: var(--text-dim);
  box-shadow: none;
  pointer-events: none;
}

.spin-cost {
  font-family: 'Orbitron', monospace;
  opacity: 0.9;
}

.btn-collect {
  background: linear-gradient(135deg, #22c55e, #16a34a);
  color: white;
  box-shadow: 0 4px 20px rgba(34,197,94,0.3);
}

.btn-collect:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 30px rgba(34,197,94,0.4);
}

.btn-sell {
  background: var(--bg-elevated);
  color: var(--gold);
  border: 1px solid rgba(255,215,0,0.2);
}

.btn-sell:hover {
  background: rgba(255,215,0,0.1);
  border-color: rgba(255,215,0,0.4);
  transform: translateY(-2px);
}

.btn-icon { font-size: 18px; }

#action-section {
  display: flex;
  justify-content: center;
  padding: 10px 0 20px;
}

/* ─── Stats Bar ─────────────────────────────────────────────────── */
#stats-section {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 20px 0;
}

.stat {
  background: var(--bg-card);
  border-radius: var(--radius);
  padding: 12px 8px;
  text-align: center;
  border: 1px solid rgba(255,255,255,0.04);
}

.stat-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 4px;
}

.stat-value {
  font-family: 'Orbitron', monospace;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

/* ─── History ───────────────────────────────────────────────────── */
#history-section {
  padding: 10px 0 20px;
}

.section-title {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: var(--text-dim);
  margin-bottom: 12px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}

.history-list::-webkit-scrollbar { width: 4px; }
.history-list::-webkit-scrollbar-track { background: transparent; }
.history-list::-webkit-scrollbar-thumb { background: var(--text-dim); border-radius: 4px; }

.history-empty {
  text-align: center;
  padding: 20px;
  color: var(--text-dim);
  font-size: 14px;
}

.history-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  background: var(--bg-card);
  border-radius: var(--radius);
  border-left: 3px solid var(--tier-low);
  animation: historySlide 0.3s ease;
}

@keyframes historySlide {
  0% { opacity: 0; transform: translateX(-20px); }
  100% { opacity: 1; transform: translateX(0); }
}

.history-item.tier-HIGH { border-left-color: var(--tier-high); }
.history-item.tier-MEDIUM { border-left-color: var(--tier-medium); }
.history-item.tier-AVERAGE { border-left-color: var(--tier-average); }
.history-item.tier-LOW { border-left-color: var(--tier-low); }

.history-icon { font-size: 20px; }

.history-info { flex: 1; min-width: 0; }

.history-name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.history-meta {
  font-size: 11px;
  color: var(--text-dim);
}

.history-action {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 20px;
}

.history-action.collected {
  background: rgba(34,197,94,0.15);
  color: var(--success);
}

.history-action.sold {
  background: rgba(255,215,0,0.12);
  color: var(--gold);
}

/* ─── Toast ─────────────────────────────────────────────────────── */
.toast {
  position: fixed;
  bottom: 30px;
  left: 50%;
  transform: translateX(-50%) translateY(20px);
  padding: 12px 24px;
  background: var(--bg-elevated);
  color: var(--text-primary);
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  box-shadow: var(--shadow-lg);
  border: 1px solid rgba(255,255,255,0.1);
  z-index: 200;
  opacity: 0;
  transition: all 0.3s ease;
}

.toast.show {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}

/* ─── Particles Canvas ──────────────────────────────────────────── */
#particles-canvas {
  position: fixed;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 150;
}

/* ─── Responsive ────────────────────────────────────────────────── */
@media (max-width: 480px) {
  .logo-text { font-size: 18px; }
  .balance-amount { font-size: 18px; }
  .box-container { width: 140px; height: 140px; }
  .box-question { font-size: 44px; }
  .reel-item { width: 90px; }
  .reel-item .item-icon { font-size: 28px; }
  .reel-item .item-value { font-size: 12px; }
  .result-icon { font-size: 48px; }
  .result-value { font-size: 22px; }
  .btn-spin { font-size: 16px; padding: 16px 24px; }
  #stats-section { grid-template-columns: repeat(2, 1fr); }
}
`;
  document.head.appendChild(style);
}
