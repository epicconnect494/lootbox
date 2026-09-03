"use client";
/**
 * Presentation-only reel. The opening is already settled and signed before this component mounts;
 * the strip is built deterministically from the opening id and the winner sits at a fixed landing slot.
 * Neighbors are a representative sample weighted by disclosed quantities: no "near-miss" placement.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ItemArt } from "@/components/art/ItemArt";
import { Button, cx } from "@/components/ui/primitives";
import { moneyStr } from "@/lib/format";

export interface ReelOutcome {
  id: string;
  label: string;
  tier: string;
  quantityTotal: number;
  referenceValueMinor: string;
  accent: string;
  imageKey?: string | null;
  name: string;
}

export interface ReelProps {
  openingId: string;
  outcomes: ReelOutcome[];
  winner: ReelOutcome;
  /** NORMAL ≈ 4.2s, FAST ≈ 1.4s */
  speed?: "NORMAL" | "FAST";
  autoplay?: boolean;
  onComplete?: () => void;
  onLanding?: () => void;
  currency?: string;
  compact?: boolean;
  /** when true the reel renders the final state immediately (resume / reduced motion) */
  skipAnimation?: boolean;
  /** optional hooks for audio/haptics */
  onTick?: () => void;
}

const SLOTS = 48;
const LANDING = 40; // fixed slot where the settled item lands
const ITEM_W = 132; // px incl. gap on desktop

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFrom(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function buildStrip(openingId: string, outcomes: ReelOutcome[], winner: ReelOutcome): ReelOutcome[] {
  const rand = mulberry32(seedFrom(openingId));
  const total = outcomes.reduce((a, o) => a + o.quantityTotal, 0) || 1;
  const pick = () => {
    let r = rand() * total;
    for (const o of outcomes) {
      r -= o.quantityTotal;
      if (r < 0) return o;
    }
    return outcomes[outcomes.length - 1];
  };
  const strip: ReelOutcome[] = [];
  for (let i = 0; i < SLOTS; i++) strip.push(i === LANDING ? winner : pick());
  return strip;
}

function easeOutQuint(t: number) {
  return 1 - Math.pow(1 - t, 5);
}

export function Reel({ openingId, outcomes, winner, speed = "NORMAL", autoplay = true, onComplete, onLanding, currency = "USD", compact, skipAnimation, onTick }: ReelProps) {
  const strip = useMemo(() => buildStrip(openingId, outcomes, winner), [openingId, outcomes, winner]);
  const [phase, setPhase] = useState<"idle" | "spinning" | "done">(skipAnimation ? "done" : "idle");
  const [offset, setOffset] = useState(0);
  const [fast, setFast] = useState(speed === "FAST");
  const trackRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const reduced = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const itemW = compact ? 96 : ITEM_W;

  const finalOffset = () => {
    const width = containerRef.current?.clientWidth ?? 640;
    return LANDING * itemW + itemW / 2 - width / 2;
  };

  const finish = () => {
    setOffset(finalOffset());
    setPhase("done");
    onLanding?.();
    onComplete?.();
  };

  const spin = () => {
    if (reduced) return finish();
    setPhase("spinning");
    const duration = fast ? 1400 : 4200;
    const start = performance.now();
    const from = 0;
    const to = finalOffset();
    let lastTick = -1;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = easeOutQuint(t);
      const cur = from + (to - from) * eased;
      setOffset(cur);
      const slot = Math.floor((cur + (containerRef.current?.clientWidth ?? 640) / 2) / itemW);
      if (slot !== lastTick) {
        lastTick = slot;
        onTick?.();
        if ("vibrate" in navigator && t > 0.85) navigator.vibrate?.(4);
      }
      if (t < 1) rafRef.current = requestAnimationFrame(step);
      else {
        setPhase("done");
        onLanding?.();
        if ("vibrate" in navigator) navigator.vibrate?.([20, 30, 40]);
        onComplete?.();
      }
    };
    rafRef.current = requestAnimationFrame(step);
  };

  useEffect(() => {
    if (skipAnimation) {
      // Resume path: position the settled item under the indicator on the next frame (no animation).
      rafRef.current = requestAnimationFrame(() => setOffset(finalOffset()));
      return () => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }
    let kick: number | null = null;
    if (autoplay && phase === "idle") kick = requestAnimationFrame(() => spin());
    return () => {
      if (kick) cancelAnimationFrame(kick);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, skipAnimation]);

  useEffect(() => {
    const onResize = () => phase === "done" && setOffset(finalOffset());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  return (
    <div className="w-full">
      <div ref={containerRef} className={cx("glass reel-mask relative w-full overflow-hidden", compact ? "h-32" : "h-44 md:h-52")} role="img" aria-label={phase === "done" ? `Result: ${winner.label}` : "Revealing your pack"}>
        <div aria-hidden className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-0.5 -translate-x-1/2 bg-gradient-to-b from-cyan-300 via-white to-violet-400 shadow-[0_0_18px_2px_rgba(103,232,249,0.8)]" />
        <div aria-hidden className="pointer-events-none absolute top-0 left-1/2 z-10 h-3 w-3 -translate-x-1/2 rotate-45 bg-white" />
        <div ref={trackRef} className="absolute top-0 left-0 flex h-full items-center" style={{ transform: `translate3d(${-offset}px,0,0)`, willChange: "transform" }}>
          {strip.map((o, i) => {
            const isWin = i === LANDING && phase === "done";
            return (
              <div key={i} className="flex shrink-0 items-center justify-center" style={{ width: itemW }}>
                <div className={cx("flex flex-col items-center gap-1.5 rounded-2xl p-2 transition", isWin && "win-pulse ring-2 ring-lime-400/80 bg-lime-400/10")}>
                  <ItemArt name={o.name} accent={o.accent} imageKey={o.imageKey} size={compact ? "sm" : "md"} label="" />
                  {!compact && <div className="max-w-[112px] truncate text-center text-[11px] text-ink-300">{moneyStr(o.referenceValueMinor, currency, true)}</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {phase !== "done" && !skipAnimation && (
        <div className="mt-3 flex items-center justify-center gap-2">
          {phase === "idle" && !autoplay && (
            <Button tone="primary" onClick={spin}>
              Reveal
            </Button>
          )}
          {phase === "spinning" && (
            <>
              <Button tone="secondary" size="sm" onClick={() => setFast(true)} disabled={fast} aria-pressed={fast}>
                Fast reveal
              </Button>
              <Button
                tone="ghost"
                size="sm"
                onClick={() => {
                  if (rafRef.current) cancelAnimationFrame(rafRef.current);
                  finish();
                }}
              >
                Skip
              </Button>
            </>
          )}
        </div>
      )}
      <p className="sr-only" aria-live="polite">
        {phase === "done" ? `Your result is ${winner.label}` : ""}
      </p>
    </div>
  );
}
