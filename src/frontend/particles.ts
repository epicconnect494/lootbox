import { PrizeTier } from '../models/types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  shape: 'circle' | 'star' | 'square';
}

const TIER_PARTICLES: Record<PrizeTier, string[]> = {
  [PrizeTier.HIGH]: ['#ffd700', '#ffec80', '#fff4b3', '#ffa500', '#ff8c00'],
  [PrizeTier.MEDIUM]: ['#a855f7', '#c084fc', '#d8b4fe', '#9333ea', '#7c3aed'],
  [PrizeTier.AVERAGE]: ['#3b82f6', '#60a5fa', '#93c5fd', '#2563eb', '#1d4ed8'],
  [PrizeTier.LOW]: ['#9ca3af', '#d1d5db', '#6b7280', '#4b5563'],
};

let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let particles: Particle[] = [];
let animFrameId: number | null = null;

export function initParticles(): void {
  canvas = document.getElementById('particles-canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  resize();
  window.addEventListener('resize', resize);
}

function resize(): void {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

export function burstParticles(tier: PrizeTier, originX?: number, originY?: number): void {
  const colors = TIER_PARTICLES[tier];
  const count = tier === PrizeTier.HIGH ? 80 : tier === PrizeTier.MEDIUM ? 50 : 30;
  const cx = originX ?? canvas.width / 2;
  const cy = originY ?? canvas.height / 2;

  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
    const speed = 2 + Math.random() * 6;
    particles.push({
      x: cx,
      y: cy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 3 + Math.random() * 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      alpha: 1,
      decay: 0.01 + Math.random() * 0.02,
      shape: ['circle', 'star', 'square'][Math.floor(Math.random() * 3)] as Particle['shape'],
    });
  }

  if (!animFrameId) {
    animateParticles();
  }
}

function animateParticles(): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  particles = particles.filter((p) => p.alpha > 0);

  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.1; // gravity
    p.alpha -= p.decay;
    p.size *= 0.99;

    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle = p.color;

    if (p.shape === 'circle') {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.shape === 'square') {
      ctx.translate(p.x, p.y);
      ctx.rotate(p.vx * 0.1);
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
    } else {
      drawStar(ctx, p.x, p.y, p.size);
    }

    ctx.restore();
  }

  if (particles.length > 0) {
    animFrameId = requestAnimationFrame(animateParticles);
  } else {
    animFrameId = null;
  }
}

function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (Math.PI * 2 * i) / 5 - Math.PI / 2;
    const outerX = x + Math.cos(angle) * r;
    const outerY = y + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(outerX, outerY);
    else ctx.lineTo(outerX, outerY);

    const innerAngle = angle + Math.PI / 5;
    ctx.lineTo(
      x + Math.cos(innerAngle) * r * 0.4,
      y + Math.sin(innerAngle) * r * 0.4
    );
  }
  ctx.closePath();
  ctx.fill();
}
