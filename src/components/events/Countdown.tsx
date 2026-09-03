"use client";
import { useEffect, useState } from "react";

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** Ticks once per second toward `target`; shows the absolute time in the event's timezone for clarity. */
export function Countdown({ target, timezone, label, onReach }: { target: string; timezone: string; label: string; onReach?: () => void }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const t = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(t);
    };
  }, []);
  const targetMs = new Date(target).getTime();
  const remaining = now === null ? null : targetMs - now;
  useEffect(() => {
    if (remaining !== null && remaining <= 0) onReach?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining !== null && remaining <= 0]);
  let absolute = target;
  try {
    absolute = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short", timeZone: timezone }).format(new Date(target));
  } catch {
    absolute = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(target));
  }
  const p = remaining === null ? null : parts(remaining);
  const cells: Array<[string, number | null]> = [
    ["days", p?.d ?? null],
    ["hrs", p?.h ?? null],
    ["min", p?.m ?? null],
    ["sec", p?.s ?? null],
  ];
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      <div role="timer" aria-live="off" aria-label={`${label} ${absolute} ${timezone}`} className="mt-1 flex gap-2">
        {cells.map(([u, v]) => (
          <div key={u} className="glass min-w-14 px-2 py-1.5 text-center">
            <div className="font-display text-xl font-extrabold tabular-nums text-ink-100">{v === null ? "--" : String(v).padStart(2, "0")}</div>
            <div className="text-[10px] uppercase tracking-wider text-ink-400">{u}</div>
          </div>
        ))}
      </div>
      <div className="mt-1 text-xs text-ink-400">
        {absolute} <span className="text-ink-500">({timezone})</span>
        {remaining !== null && remaining <= 0 && <span className="ml-2 text-amber-400">Reached — awaiting settlement</span>}
      </div>
    </div>
  );
}
