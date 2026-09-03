"use client";
import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { Badge, Button, CrazyBanner, Field, Panel, Select, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { moneyStr } from "@/lib/format";
import type { BattleMode, MODE_RULES } from "@/domain/battles";
import { GateErrors, errorMessage, gateReasons, type GateReason } from "./GateErrors";

export interface LivePack {
  packVersionId: string;
  slug: string;
  name: string;
  accent: string;
  heroImageKey: string | null;
  priceMinor: string;
  currency: string;
  remainingOpenings: number;
}

const MODES: BattleMode[] = ["CLASSIC", "CRAZY", "SHARED", "KEEP"];
const SHARED_RULE_TEXT = "EQUAL_SPLIT_VALUE: after every round, all pulled items are pooled and sorted by disclosed value (highest first). They are then dealt in snake order by rank: the highest total picks first, then down the ranking, then back up. Fully deterministic; disclosed before entry.";

export function BattleCreateForm({ packs, rules }: { packs: LivePack[]; rules: typeof MODE_RULES }) {
  const router = useRouter();
  const toast = useToast();
  const [sequence, setSequence] = useState<string[]>([]);
  const [seats, setSeats] = useState(2);
  const [isPrivate, setIsPrivate] = useState(false);
  const [speed, setSpeed] = useState<"NORMAL" | "FAST">("NORMAL");
  const [mode, setMode] = useState<BattleMode>("CLASSIC");
  const [sharedRule, setSharedRule] = useState<"EQUAL_SPLIT_VALUE">("EQUAL_SPLIT_VALUE");
  const [picker, setPicker] = useState(packs[0]?.packVersionId ?? "");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<GateReason[]>([]);

  const byId = useMemo(() => new Map(packs.map((p) => [p.packVersionId, p])), [packs]);
  const entryCost = useMemo(() => sequence.reduce((a, id) => a + BigInt(byId.get(id)?.priceMinor ?? "0"), 0n), [sequence, byId]);
  const currency = byId.get(sequence[0] ?? "")?.currency ?? packs[0]?.currency ?? "USD";
  const crazy = mode === "CRAZY";

  const stockWarnings = useMemo(() => {
    const counts = new Map<string, number>();
    for (const id of sequence) counts.set(id, (counts.get(id) ?? 0) + 1);
    const out: string[] = [];
    for (const [id, n] of counts) {
      const p = byId.get(id);
      if (p && p.remainingOpenings < n * seats) out.push(`${p.name}: needs ${n * seats} openings for ${seats} players, only ${p.remainingOpenings} remain.`);
    }
    return out;
  }, [sequence, seats, byId]);

  const mixedCurrency = useMemo(() => new Set(sequence.map((id) => byId.get(id)?.currency)).size > 1, [sequence, byId]);
  const canSubmit = sequence.length >= 1 && sequence.length <= 10 && stockWarnings.length === 0 && !mixedCurrency && !busy;

  const move = (i: number, dir: -1 | 1) =>
    setSequence((s) => {
      const j = i + dir;
      if (j < 0 || j >= s.length) return s;
      const next = [...s];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  async function submit() {
    setBusy(true);
    setError(null);
    setReasons([]);
    try {
      const res = await api<{ battle: { id: string } }>("/battles", {
        method: "POST",
        idempotencyKey: newIdempotencyKey(),
        body: { mode, speed, isPrivate, seats, packVersionIds: sequence, sharedRule: mode === "SHARED" ? { type: sharedRule } : undefined },
      });
      toast.push({ title: "Battle created", body: crazy ? "Crazy Mode: lowest total wins." : "Share the link so others can join.", tone: crazy ? "crazy" : "success" });
      router.push(`/battles/${res.battle.id}`);
      router.refresh();
    } catch (e) {
      const rs = gateReasons(e);
      setReasons(rs);
      setError(rs.length ? null : errorMessage(e));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!canSubmit) return;
    if (crazy) setConfirming(true);
    else void submit();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        {crazy && <CrazyBanner />}

        <Panel as="section" aria-labelledby="seq-title">
          <h2 id="seq-title" className="font-display text-lg font-bold">
            1. Pack sequence
          </h2>
          <p className="mt-1 text-sm text-ink-400">Every player opens this exact ordered sequence. Add the same pack more than once if you want repeat rounds (max 10).</p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
            <Field label="Live pack" htmlFor="pack-picker">
              <Select id="pack-picker" value={picker} onChange={(e) => setPicker(e.target.value)} disabled={!packs.length}>
                {packs.map((p) => (
                  <option key={p.packVersionId} value={p.packVersionId}>
                    {p.name} · {moneyStr(p.priceMinor, p.currency)} · {p.remainingOpenings} left
                  </option>
                ))}
              </Select>
            </Field>
            <Button type="button" tone="secondary" onClick={() => picker && sequence.length < 10 && setSequence((s) => [...s, picker])} disabled={!picker || sequence.length >= 10}>
              <Plus size={16} aria-hidden /> Add round
            </Button>
          </div>
          {!packs.length && <p className="mt-3 text-sm text-amber-400">No live packs are available right now.</p>}
          <ol className="mt-4 space-y-2" aria-label="Selected sequence">
            {sequence.map((id, i) => {
              const p = byId.get(id)!;
              return (
                <li key={`${id}-${i}`} className="flex items-center gap-3 rounded-xl border border-white/8 bg-ink-900/50 p-2">
                  <span className="font-display w-6 text-center text-sm font-bold text-ink-400">{i + 1}</span>
                  <ItemArt name={p.name} accent={p.accent} imageKey={p.heroImageKey} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{p.name}</div>
                    <div className="text-xs text-ink-400">{moneyStr(p.priceMinor, p.currency)}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" className="tap inline-flex items-center justify-center rounded-lg text-ink-300 hover:bg-white/8 disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move round ${i + 1} up`}>
                      <ArrowUp size={16} aria-hidden />
                    </button>
                    <button type="button" className="tap inline-flex items-center justify-center rounded-lg text-ink-300 hover:bg-white/8 disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === sequence.length - 1} aria-label={`Move round ${i + 1} down`}>
                      <ArrowDown size={16} aria-hidden />
                    </button>
                    <button type="button" className="tap inline-flex items-center justify-center rounded-lg text-ink-300 hover:bg-danger/20 hover:text-danger" onClick={() => setSequence((s) => s.filter((_, k) => k !== i))} aria-label={`Remove round ${i + 1}`}>
                      <X size={16} aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
            {sequence.length === 0 && <li className="rounded-xl border border-dashed border-white/10 p-4 text-center text-sm text-ink-400">Add at least one pack to start.</li>}
          </ol>
          {stockWarnings.map((w) => (
            <p key={w} role="alert" className="mt-2 text-sm text-amber-400">
              {w}
            </p>
          ))}
          {mixedCurrency && (
            <p role="alert" className="mt-2 text-sm text-amber-400">
              All packs in a battle must share a currency.
            </p>
          )}
        </Panel>

        <Panel as="section" aria-labelledby="players-title">
          <h2 id="players-title" className="font-display text-lg font-bold">
            2. Players & pace
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <fieldset>
              <legend className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-300">Players</legend>
              <div className="flex gap-1" role="radiogroup">
                {[2, 3, 4].map((n) => (
                  <button key={n} type="button" role="radio" aria-checked={seats === n} onClick={() => setSeats(n)} className={cx("tap flex-1 rounded-xl border text-sm font-semibold", seats === n ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-ink-300 hover:bg-white/5")}>
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-300">Speed</legend>
              <div className="flex gap-1" role="radiogroup">
                {(["NORMAL", "FAST"] as const).map((s) => (
                  <button key={s} type="button" role="radio" aria-checked={speed === s} onClick={() => setSpeed(s)} className={cx("tap flex-1 rounded-xl border text-sm font-semibold", speed === s ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-ink-300 hover:bg-white/5")}>
                    {s === "NORMAL" ? "Normal" : "Fast"}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-300">Visibility</legend>
              <div className="flex gap-1" role="radiogroup">
                {[false, true].map((v) => (
                  <button key={String(v)} type="button" role="radio" aria-checked={isPrivate === v} onClick={() => setIsPrivate(v)} className={cx("tap flex-1 rounded-xl border text-sm font-semibold", isPrivate === v ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-ink-300 hover:bg-white/5")}>
                    {v ? "Private" : "Public"}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
          {isPrivate && <p className="mt-2 text-xs text-ink-400">Private battles get a join code shown on the battle page; only players with the code can take a seat.</p>}
        </Panel>

        <Panel as="section" aria-labelledby="mode-title">
          <h2 id="mode-title" className="font-display text-lg font-bold">
            3. Mode
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Battle mode">
            {MODES.map((m) => {
              const active = mode === m;
              const isCrazy = m === "CRAZY";
              return (
                <button key={m} type="button" role="radio" aria-checked={active} onClick={() => setMode(m)} className={cx("tap rounded-xl border p-3 text-left transition", active ? (isCrazy ? "border-crazy-500 bg-crazy-600/15 shadow-[var(--shadow-glow-crazy)]" : "border-cyan-400/60 bg-cyan-400/10") : "border-white/10 hover:bg-white/5")}>
                  <div className="flex items-center gap-2">
                    <Badge tone={isCrazy ? "crazy" : active ? "cyan" : "neutral"}>{rules[m].title}</Badge>
                    <span className={cx("font-display text-xs font-bold tracking-wider", isCrazy ? "text-crazy-400" : "text-ink-300")}>{rules[m].banner}</span>
                  </div>
                  <p className="mt-1.5 text-xs text-ink-300">{rules[m].summary}</p>
                </button>
              );
            })}
          </div>
          {mode === "SHARED" && (
            <div className="mt-3">
              <Field label="Disclosed split rule" htmlFor="shared-rule" hint={SHARED_RULE_TEXT}>
                <Select id="shared-rule" value={sharedRule} onChange={(e) => setSharedRule(e.target.value as "EQUAL_SPLIT_VALUE")}>
                  <option value="EQUAL_SPLIT_VALUE">Equal split by value (snake order)</option>
                </Select>
              </Field>
            </div>
          )}
          {mode === "KEEP" && <p className="mt-3 text-sm text-ink-300">Keep mode is a synchronized social opening. Nothing changes hands; each player keeps exactly what they pull.</p>}
        </Panel>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Panel strong className="space-y-3">
          <h2 className="font-display text-lg font-bold">Summary</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-400">Mode</dt>
              <dd>
                <Badge tone={crazy ? "crazy" : "violet"}>{rules[mode].title}</Badge>
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-400">Rounds</dt>
              <dd className="font-mono">{sequence.length}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-400">Players</dt>
              <dd className="font-mono">{seats}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-400">Speed · visibility</dt>
              <dd className="text-ink-200">
                {speed === "FAST" ? "Fast" : "Normal"} · {isPrivate ? "Private" : "Public"}
              </dd>
            </div>
          </dl>
          <div className="rounded-xl border border-white/10 bg-ink-900/60 p-3" aria-live="polite">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Entry cost per player</div>
            <div className="font-display text-2xl font-extrabold">{moneyStr(entryCost, currency)}</div>
            <div className="text-xs text-ink-400">Sum of the disclosed pack prices. Charged when you take your seat.</div>
          </div>
          <div className={cx("rounded-xl border px-3 py-2 text-xs", crazy ? "border-crazy-500/50 text-crazy-400" : "border-white/10 text-ink-300")}>
            <span className="font-display font-bold tracking-wider">{rules[mode].banner}</span>
          </div>
          <GateErrors reasons={reasons} />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" tone={crazy ? "crazy" : "primary"} className="w-full" disabled={!canSubmit}>
            {busy ? "Creating…" : crazy ? "Review Crazy Mode battle" : "Create battle"}
          </Button>
          <p className="text-[11px] leading-relaxed text-ink-500">Creating a battle takes the first seat and charges your balance. Availability depends on your region and verification status.</p>
        </Panel>
      </aside>

      {/* Portaled to <body> so the sheet always stacks above the fixed mobile navigation. `confirming` can only become true after mount. */}
      {confirming &&
        createPortal(
        <div role="dialog" aria-modal="true" aria-labelledby="crazy-confirm-title" className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/80 p-4 backdrop-blur-sm md:items-center" onKeyDown={(e) => e.key === "Escape" && !busy && setConfirming(false)}>
          <div className="glass glass-strong rise w-full max-w-md space-y-4 border-crazy-500/60 p-5 shadow-[var(--shadow-glow-crazy)]">
            <CrazyBanner />
            <h2 id="crazy-confirm-title" className="font-display text-xl font-extrabold text-crazy-400">
              You are creating a Crazy Mode battle: LOWEST TOTAL WINS
            </h2>
            <p className="text-sm text-ink-200">In Crazy Mode the player with the <strong className="text-crazy-400">lowest</strong> combined disclosed item value takes the entire pool. Valuations are fixed at the manifest snapshot. Entry: {moneyStr(entryCost, currency)} for {sequence.length} round{sequence.length === 1 ? "" : "s"}, {seats} players.</p>
            <div className="flex gap-2">
              <Button type="button" tone="secondary" className="flex-1" onClick={() => setConfirming(false)} disabled={busy} autoFocus>
                Back
              </Button>
              <Button type="button" tone="crazy" className="flex-1" onClick={() => void submit()} disabled={busy}>
                {busy ? "Creating…" : "Confirm Crazy Mode"}
              </Button>
            </div>
          </div>
        </div>,
          document.body,
        )}
    </form>
  );
}
