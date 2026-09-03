"use client";
import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Live countdown to a timestamp. Renders a stable placeholder on the server, ticks once mounted. */
export function RaceCountdown({ to, label, className }: { to: string; label?: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, []);
  const target = new Date(to).getTime();
  const p = now === null ? null : parts(target - now);
  const cell = (v: number | null, unit: string) => (
    <div className="glass glass-strong flex min-w-14 flex-col items-center rounded-xl px-2 py-1.5">
      <span className="font-display text-xl font-extrabold tabular-nums text-ink-100">{v === null ? "--" : v.toString().padStart(2, "0")}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">{unit}</span>
    </div>
  );
  return (
    <div className={className}>
      {label && <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>}
      <div className="flex items-center gap-2" role="timer" aria-live="off" aria-label={p ? `${p.d} days ${p.h} hours ${p.m} minutes remaining` : "Countdown"}>
        {cell(p?.d ?? null, "days")}
        {cell(p?.h ?? null, "hrs")}
        {cell(p?.m ?? null, "min")}
        {cell(p?.s ?? null, "sec")}
      </div>
    </div>
  );
}
