"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Lock, ShieldCheck, Users } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { Reel, type ReelOutcome } from "@/components/reel/Reel";
import { Badge, Button, CrazyBanner, Input, Mono, Panel, SectionTitle, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, newIdempotencyKey, subscribeSse } from "@/lib/client/api";
import { fmtDate, moneyStr, shortHash, tierLabel } from "@/lib/format";
import type { getBattleView } from "@/domain/battles";
import { GateErrors, errorMessage, gateReasons, type GateReason } from "./GateErrors";
import { battleStatusTone, statusLabel } from "./BattleCard";
import type { Json } from "./json-types";

export type BattleView = Json<NonNullable<Awaited<ReturnType<typeof getBattleView>>>>;
type Pull = BattleView["pulls"][number];
type Seat = BattleView["seats"][number];

type PackDetail = { outcomes: Array<{ id: string; label: string; tier: string; quantityTotal: number; referenceValueMinor: string; sku: { name: string; accent: string; imageKey: string | null } }> };
const outcomeCache = new Map<string, Promise<ReelOutcome[]>>();
function loadOutcomes(slug: string): Promise<ReelOutcome[]> {
  let p = outcomeCache.get(slug);
  if (!p) {
    p = api<PackDetail>(`/packs/${encodeURIComponent(slug)}`)
      .then((d) => d.outcomes.map((o) => ({ id: o.id, label: o.label, tier: o.tier, quantityTotal: o.quantityTotal, referenceValueMinor: o.referenceValueMinor, accent: o.sku.accent, imageKey: o.sku.imageKey, name: o.sku.name })))
      .catch(() => [] as ReelOutcome[]);
    outcomeCache.set(slug, p);
  }
  return p;
}

function seenKey(id: string) {
  return `battle-seen-${id}`;
}
function readSeen(id: string): boolean {
  try {
    return window.localStorage.getItem(seenKey(id)) === "1";
  } catch {
    return false;
  }
}
const noSubscribe = () => () => undefined;
/** Hydration-safe read of the "already watched" flag: false on the server, the stored value on the client. */
function useSeen(id: string): boolean {
  return useSyncExternalStore(noSubscribe, () => readSeen(id), () => false);
}
function writeSeen(id: string) {
  try {
    window.localStorage.setItem(seenKey(id), "1");
  } catch {
    /* storage unavailable */
  }
}

export function BattleRoom({ initial, viewerUserId }: { initial: BattleView; viewerUserId: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [view, setView] = useState<BattleView>(initial);
  const [joinCode, setJoinCode] = useState("");
  const [busy, setBusy] = useState<"join" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<GateReason[]>([]);
  const id = initial.battle.id;

  const refetch = useCallback(async () => {
    try {
      const v = await api<BattleView>(`/battles/${id}`);
      setView(v);
    } catch {
      /* transient */
    }
  }, [id]);

  useEffect(() => {
    const onEvent = () => void refetch();
    return subscribeSse(`/battles/${id}/events`, {
      snapshot: (data) => {
        if (data && typeof data === "object" && "battle" in (data as object)) setView(data as BattleView);
      },
      "seat.joined": onEvent,
      settled: onEvent,
      cancelled: onEvent,
      voided: onEvent,
    });
  }, [id, refetch]);

  // Polling fallback while the battle is not terminal: a missed SSE event can never strand the room.
  const terminal = view.battle.status === "SETTLED" || view.battle.status === "VOIDED" || view.battle.status === "CANCELLED";
  useEffect(() => {
    if (terminal) return;
    const t = setInterval(() => void refetch(), 4000);
    return () => clearInterval(t);
  }, [terminal, refetch]);

  const { battle, rules, seats, sequence } = view;
  const crazy = battle.mode === "CRAZY";
  const viewerSeated = seats.some((s) => s.isViewer);
  const isCreator = viewerUserId === battle.createdBy;
  const open = battle.status === "OPEN";
  const showPlayback = (battle.status === "SETTLED" || battle.status === "IN_PROGRESS") && view.pulls.length > 0;

  async function join() {
    setBusy("join");
    setError(null);
    setReasons([]);
    try {
      const v = await api<BattleView>(`/battles/${id}/join`, { method: "POST", idempotencyKey: newIdempotencyKey(), body: battle.isPrivate ? { joinCode: joinCode.trim().toUpperCase() } : {} });
      setView(v);
      toast.push({ title: "Seat taken", body: v.battle.status === "SETTLED" ? "The battle is full and has been settled." : "Waiting for the remaining players.", tone: "success" });
      router.refresh();
    } catch (e) {
      const rs = gateReasons(e);
      setReasons(rs);
      setError(rs.length ? null : errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!window.confirm("Cancel this battle and refund every seat?")) return;
    setBusy("cancel");
    setError(null);
    try {
      await api(`/battles/${id}/cancel`, { method: "POST" });
      await refetch();
      toast.push({ title: "Battle cancelled", body: "All entries were refunded." });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-5">
      {crazy ? (
        <CrazyBanner />
      ) : (
        <div role="note" aria-label={`${rules.title} rule`} className="glass flex flex-col items-center justify-center gap-1 px-4 py-3 text-center">
          <div className="font-display text-sm font-extrabold tracking-[0.18em] text-ink-100 md:text-base">{rules.banner}</div>
          <div className="text-xs text-ink-400">{rules.summary}</div>
        </div>
      )}
      {crazy && <p className="text-center text-xs text-crazy-400">{rules.summary}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={crazy ? "crazy" : "violet"}>{rules.title}</Badge>
        <Badge tone={battleStatusTone(battle.status)}>{statusLabel(battle.status)}</Badge>
        <Badge tone="neutral">{battle.speed === "FAST" ? "Fast" : "Normal"} speed</Badge>
        {battle.isPrivate && (
          <Badge tone="amber">
            <Lock size={11} aria-hidden /> Private
          </Badge>
        )}
        <span className="ml-auto font-mono text-xs text-ink-400">#{battle.code}</span>
      </div>

      {(battle.status === "VOIDED" || battle.status === "CANCELLED") && (
        <div role="status" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm text-ink-200">
          This battle was {battle.status.toLowerCase()}
          {battle.voidReason ? `: ${battle.voidReason}` : ""}. Every entry was refunded.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel as="section" aria-labelledby="seats-title">
            <SectionTitle title="Seats" sub={`${seats.length}/${battle.seats} filled · entry ${moneyStr(battle.entryCostMinor, battle.currency)} per player`} />
            <div className={cx("grid gap-2", battle.seats >= 3 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2")}>
              {Array.from({ length: battle.seats }, (_, i) => {
                const s = seats.find((x) => x.seatIndex === i);
                const winner = !!s && battle.winnerUserIds.includes(s.userId) && battle.mode !== "SHARED";
                return (
                  <div key={i} className={cx("flex min-h-24 flex-col justify-between rounded-xl border p-3", s ? (s.isViewer ? "border-cyan-400/50 bg-cyan-400/5" : "border-white/10 bg-ink-900/40") : "border-dashed border-white/15", winner && "border-lime-400/60 bg-lime-400/10")}>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Seat {i + 1}</div>
                    {s ? (
                      <div>
                        <div className={cx("truncate text-sm font-semibold", winner ? "text-lime-300" : "text-ink-100")}>{s.displayName}</div>
                        {s.isViewer && <div className="text-[11px] text-cyan-300">You</div>}
                        {s.finalRank && <div className="text-xs text-ink-400">Rank #{s.finalRank}</div>}
                      </div>
                    ) : (
                      <div className="text-sm text-ink-500">Empty</div>
                    )}
                  </div>
                );
              })}
            </div>

            {open && !viewerSeated && seats.length < battle.seats && (
              <div className="mt-4 space-y-2">
                {viewerUserId ? (
                  <>
                    {battle.isPrivate && (
                      <label className="block">
                        <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-300">Join code</span>
                        <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="e.g. 3F9A1C" autoCapitalize="characters" maxLength={16} className="font-mono uppercase" />
                      </label>
                    )}
                    <Button tone={crazy ? "crazy" : "primary"} onClick={() => void join()} disabled={busy !== null || (battle.isPrivate && !joinCode.trim())} className="w-full sm:w-auto">
                      <Users size={16} aria-hidden /> {busy === "join" ? "Joining…" : `Join for ${moneyStr(battle.entryCostMinor, battle.currency)}`}
                    </Button>
                    <p className="text-xs text-ink-500">Your balance is charged when you take the seat. The battle runs and settles automatically the moment the last seat fills.</p>
                  </>
                ) : (
                  <Link href={`/login?next=/battles/${id}`} className="tap inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-ink-950">
                    Sign in to join
                  </Link>
                )}
              </div>
            )}
            {open && battle.isPrivate && battle.joinCode && (
              <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-sm">
                <span className="text-ink-300">Join code</span>
                <Mono className="text-base text-amber-400">{battle.joinCode}</Mono>
                <button
                  type="button"
                  className="tap inline-flex items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-200 hover:bg-white/8"
                  onClick={() => {
                    void navigator.clipboard?.writeText(`${window.location.origin}/battles/${id} · code ${battle.joinCode}`);
                    toast.push({ title: "Invite copied" });
                  }}
                >
                  <Copy size={14} aria-hidden /> Copy invite
                </button>
              </div>
            )}
            {open && isCreator && (
              <div className="mt-3">
                <Button tone="danger" size="sm" onClick={() => void cancel()} disabled={busy !== null}>
                  {busy === "cancel" ? "Cancelling…" : "Cancel battle & refund"}
                </Button>
              </div>
            )}
            <div className="mt-3">
              <GateErrors reasons={reasons} title="You cannot join yet" />
              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          </Panel>

          {showPlayback && <BattlePlayback view={view} />}
        </div>

        <aside className="space-y-4">
          <Panel as="section" aria-labelledby="sequence-title">
            <SectionTitle title="Pack sequence" sub={`${sequence.length} round${sequence.length === 1 ? "" : "s"} · identical for every player`} />
            <ol className="space-y-2">
              {sequence.map((p, i) => (
                <li key={`${p.packVersionId}-${i}`} className="flex items-center gap-3">
                  <span className="font-display w-5 text-center text-xs font-bold text-ink-400">{i + 1}</span>
                  <ItemArt name={p.name} accent={p.accent} size="sm" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/packs/${p.slug}`} className="block truncate text-sm font-semibold hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-ink-400">{moneyStr(p.priceMinor, battle.currency)}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>
          <FairnessPanel view={view} />
        </aside>
      </div>
    </div>
  );
}

// ---- Playback ---------------------------------------------------------------------------------
function BattlePlayback({ view }: { view: BattleView }) {
  const { battle, seats, rounds, sequence } = view;
  const pulls = useMemo(() => [...view.pulls].sort((a, b) => a.pullIndex - b.pullIndex), [view.pulls]);
  const roundIndexById = useMemo(() => new Map(rounds.map((r) => [r.id, r.roundIndex])), [rounds]);
  const seatById = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const seen = useSeen(battle.id);
  const [landedState, setLanded] = useState(0);
  const [currentState, setCurrent] = useState(0);
  const landed = seen ? pulls.length : landedState;
  const current = seen ? pulls.length : currentState;
  const [outcomes, setOutcomes] = useState<Record<string, ReelOutcome[]>>({});
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const done = landed >= pulls.length;

  useEffect(() => {
    let alive = true;
    const slugs = [...new Set(sequence.map((s) => s.slug))];
    Promise.all(slugs.map(async (slug) => [slug, await loadOutcomes(slug)] as const)).then((entries) => {
      if (alive) setOutcomes(Object.fromEntries(entries));
    });
    return () => {
      alive = false;
    };
  }, [sequence]);

  useEffect(() => {
    if (done) writeSeen(battle.id);
  }, [done, battle.id]);

  useEffect(
    () => () => {
      if (advanceTimer.current) clearTimeout(advanceTimer.current);
    },
    [],
  );

  const skip = () => {
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setLanded(pulls.length);
    setCurrent(pulls.length);
  };

  const onComplete = (i: number) => {
    setLanded((l) => Math.max(l, i + 1));
    advanceTimer.current = setTimeout(() => setCurrent((c) => Math.max(c, i + 1)), 450);
  };

  const outcomesFor = (roundIndex: number, pull: Pull): { list: ReelOutcome[]; winner: ReelOutcome } => {
    const pack = sequence[roundIndex];
    const fetched = pack ? (outcomes[pack.slug] ?? []) : [];
    const fromPull: ReelOutcome = { id: pull.outcome.id, label: pull.outcome.label, tier: pull.outcome.tier, quantityTotal: 1, referenceValueMinor: pull.valueMinor, accent: pull.outcome.accent, imageKey: pull.outcome.imageKey, name: pull.outcome.name };
    const winner = fetched.find((o) => o.id === pull.outcome.id) ?? fromPull;
    let list = fetched.length ? fetched : [];
    if (!list.length) {
      const seen = new Map<string, ReelOutcome>();
      for (const p of pulls) if (roundIndexById.get(p.roundId) === roundIndex) seen.set(p.outcome.id, { id: p.outcome.id, label: p.outcome.label, tier: p.outcome.tier, quantityTotal: 1, referenceValueMinor: p.valueMinor, accent: p.outcome.accent, imageKey: p.outcome.imageKey, name: p.outcome.name });
      list = [...seen.values()];
    }
    if (!list.some((o) => o.id === winner.id)) list = [...list, winner];
    return { list, winner };
  };

  const totals = useMemo(() => {
    const t = new Map<string, bigint>(seats.map((s) => [s.id, 0n]));
    pulls.slice(0, landed).forEach((p) => t.set(p.seatId, (t.get(p.seatId) ?? 0n) + BigInt(p.valueMinor)));
    return t;
  }, [pulls, landed, seats]);

  const orderedSeats = [...seats].sort((a, b) => a.seatIndex - b.seatIndex);
  const cols = battle.seats >= 3 ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-2";

  return (
    <Panel as="section" aria-labelledby="playback-title" className={cx(crazyOf(battle.mode) && "border-crazy-500/40")}>
      <SectionTitle
        title="Playback"
        sub="Every pull was settled and signed before this replay started. The reel only illustrates the stored result."
        action={
          !done ? (
            <Button tone="secondary" size="sm" onClick={skip}>
              Skip to result
            </Button>
          ) : undefined
        }
      />

      <div className={cx("mb-3 grid gap-2", cols)} aria-live="polite" aria-atomic="true">
        {orderedSeats.map((s) => {
          const total = totals.get(s.id) ?? 0n;
          const winner = done && battle.winnerUserIds.includes(s.userId) && battle.mode !== "SHARED";
          return (
            <div key={s.id} className={cx("rounded-xl border px-3 py-2", winner ? "border-lime-400/60 bg-lime-400/10" : s.isViewer ? "border-cyan-400/40" : "border-white/10")}>
              <div className="truncate text-xs text-ink-400">{s.displayName}</div>
              <div className={cx("font-display text-lg font-extrabold", winner ? "text-lime-300" : "text-ink-100")}>{moneyStr(total, battle.currency)}</div>
              <span className="sr-only">{`${s.displayName} running total ${moneyStr(total, battle.currency)}`}</span>
            </div>
          );
        })}
      </div>

      <div className="space-y-4">
        {rounds.map((r) => {
          const pack = sequence[r.roundIndex];
          return (
            <div key={r.id}>
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="font-display font-bold">Round {r.roundIndex + 1}</span>
                <span className="text-ink-400">· {pack?.name ?? "Pack"}</span>
              </div>
              <div className={cx("grid gap-2", cols)}>
                {orderedSeats.map((s) => {
                  const pull = pulls.find((p) => p.roundId === r.id && p.seatId === s.id);
                  if (!pull) return <div key={s.id} className="glass h-32 shimmer" aria-hidden />;
                  const i = pulls.indexOf(pull);
                  const isLanded = i < landed;
                  const isCurrent = i === current && !isLanded;
                  if (!isLanded && !isCurrent) {
                    return (
                      <div key={s.id} className="glass flex h-32 flex-col items-center justify-center gap-1 text-xs text-ink-500">
                        <ItemArt name={pack?.name ?? "Pack"} accent={pack?.accent ?? "violet"} size="sm" label="" />
                        Waiting
                      </div>
                    );
                  }
                  const { list, winner } = outcomesFor(r.roundIndex, pull);
                  return (
                    <div key={s.id} className="space-y-1">
                      <Reel key={`${pull.id}-${isLanded ? "done" : "play"}`} openingId={pull.openingId} outcomes={list} winner={winner} speed={battle.speed} compact autoplay skipAnimation={isLanded} onComplete={() => onComplete(i)} currency={battle.currency} />
                      {isLanded && (
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate text-ink-200">{pull.outcome.label}</span>
                          <span className="shrink-0 font-mono text-ink-300">{moneyStr(pull.valueMinor, battle.currency)}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {done && <FinalOwnership view={view} pulls={pulls} seatById={seatById} />}
    </Panel>
  );
}

function crazyOf(mode: string) {
  return mode === "CRAZY";
}

function FinalOwnership({ view, pulls, seatById }: { view: BattleView; pulls: Pull[]; seatById: Map<string, Seat> }) {
  const { battle, seats } = view;
  const ranked = useMemo(() => [...seats].sort((a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99) || a.seatIndex - b.seatIndex), [seats]);
  const winners = battle.winnerUserIds;
  const sharedAssignments = useMemo(() => {
    if (battle.mode !== "SHARED") return [];
    const pool = [...pulls].sort((a, c) => (a.valueMinor === c.valueMinor ? a.pullIndex - c.pullIndex : BigInt(a.valueMinor) > BigInt(c.valueMinor) ? -1 : 1));
    const order = ranked;
    return pool.map((p, i) => {
      const lap = Math.floor(i / order.length);
      const pos = i % order.length;
      const target = lap % 2 === 0 ? order[pos] : order[order.length - 1 - pos];
      return { pull: p, to: target };
    });
  }, [battle.mode, pulls, ranked]);

  return (
    <div className="rise mt-5 space-y-3" role="region" aria-labelledby="final-title" aria-live="polite">
      <h3 id="final-title" className="font-display text-lg font-bold">
        Result
      </h3>
      <div className="grid gap-2 sm:grid-cols-2">
        {ranked.map((s) => {
          const won = winners.includes(s.userId) && battle.mode !== "SHARED";
          return (
            <div key={s.id} className={cx("rounded-xl border p-3", won ? "win-pulse border-lime-400/70 bg-lime-400/10" : "border-white/10 bg-ink-900/40")}>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className={cx("truncate font-semibold", won ? "text-lime-300" : "text-ink-100")}>{s.displayName}</div>
                  <div className="text-xs text-ink-400">Rank #{s.finalRank ?? "—"}</div>
                </div>
                {won && <Badge tone="lime">Winner</Badge>}
              </div>
              <dl className="mt-2 grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-400">Pulled total</dt>
                  <dd className="font-display font-bold">{moneyStr(s.totalValueMinor, battle.currency)}</dd>
                </div>
                <div>
                  <dt className="text-[11px] uppercase tracking-wider text-ink-400">Awarded</dt>
                  <dd className={cx("font-display font-bold", won && "text-lime-300")}>{moneyStr(s.awardedValueMinor ?? "0", battle.currency)}</dd>
                </div>
              </dl>
            </div>
          );
        })}
      </div>
      {battle.mode === "KEEP" && <p className="text-sm text-ink-300">Keep mode: everyone keeps their own pulls. Items are already in each player&apos;s vault.</p>}
      {(battle.mode === "CLASSIC" || battle.mode === "CRAZY") && (
        <p className="text-sm text-ink-300">
          {battle.mode === "CRAZY" ? <span className="text-crazy-400">Lowest total wins.</span> : "Highest total wins."} The winner receives every item pulled in this battle ({pulls.length} item{pulls.length === 1 ? "" : "s"}).
        </p>
      )}
      {battle.mode === "SHARED" && (
        <div>
          <p className="mb-2 text-sm text-ink-300">Shared pool dealt in snake order by rank (pool sorted by disclosed value):</p>
          <div className="table-wrap rounded-xl border border-white/8">
            <table>
              <thead>
                <tr>
                  <th scope="col">Item</th>
                  <th scope="col">Value</th>
                  <th scope="col">Pulled by</th>
                  <th scope="col">Goes to</th>
                </tr>
              </thead>
              <tbody>
                {sharedAssignments.map(({ pull, to }) => (
                  <tr key={pull.id}>
                    <td>
                      <span className="flex items-center gap-2">
                        <ItemArt name={pull.outcome.name} accent={pull.outcome.accent} imageKey={pull.outcome.imageKey} size="sm" className="!h-8 !w-8" label="" />
                        <span>
                          {pull.outcome.label} <Badge tone="neutral">{tierLabel(pull.outcome.tier)}</Badge>
                        </span>
                      </span>
                    </td>
                    <td className="font-mono">{moneyStr(pull.valueMinor, battle.currency)}</td>
                    <td>{seatById.get(pull.seatId)?.displayName}</td>
                    <td className={cx(to.isViewer && "text-cyan-300")}>{to.displayName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Fairness ---------------------------------------------------------------------------------
function FairnessPanel({ view }: { view: BattleView }) {
  const { battle, fairness, rounds, seats, pulls } = view;
  const tie = fairness?.tieBreak as null | { nonce: number; message: string; digest: string; range: number; selectedIndex: number; steps: Array<{ extension: number; window: number; value: number; accepted: boolean }>; candidates: Array<{ seatIndex: number; userId: string }> };
  const seatByIdx = new Map(seats.map((s) => [s.seatIndex, s]));
  return (
    <Panel as="section" aria-labelledby="fair-title">
      <div className="mb-3 flex items-center gap-2">
        <ShieldCheck size={18} className="text-cyan-300" aria-hidden />
        <h2 id="fair-title" className="font-display text-lg font-bold">
          Fairness
        </h2>
      </div>
      {!fairness ? (
        <p className="text-sm text-ink-400">Seed commitment pending.</p>
      ) : (
        <dl className="space-y-2 text-sm">
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-ink-400">Server seed hash (committed at creation)</dt>
            <dd>
              <Mono>{fairness.serverSeedHash}</Mono>
            </dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-ink-400">Revealed server seed</dt>
            <dd>{fairness.revealedServerSeed ? <Mono className="text-lime-300">{fairness.revealedServerSeed}</Mono> : <span className="text-ink-400">Revealed when the battle settles.</span>}</dd>
          </div>
          <div>
            <dt className="text-[11px] uppercase tracking-wider text-ink-400">Combined client seed (all seats, joined with |)</dt>
            <dd>{fairness.combinedClientSeed ? <Mono>{fairness.combinedClientSeed}</Mono> : <span className="text-ink-400">Formed when the last seat fills.</span>}</dd>
          </div>
        </dl>
      )}
      {pulls.length > 0 && (
        <details className="mt-3">
          <summary className="tap flex cursor-pointer items-center text-sm font-semibold text-ink-200">Per-pull nonces ({pulls.length})</summary>
          <p className="mt-1 text-xs text-ink-400">nonce = roundIndex × seats + seatIndex. Each pull is a normal opening with its own signed receipt.</p>
          <div className="table-wrap mt-2 rounded-xl border border-white/8">
            <table>
              <thead>
                <tr>
                  <th scope="col">#</th>
                  <th scope="col">Round</th>
                  <th scope="col">Seat</th>
                  <th scope="col">Nonce</th>
                  <th scope="col">Opening</th>
                </tr>
              </thead>
              <tbody>
                {[...pulls]
                  .sort((a, b) => a.pullIndex - b.pullIndex)
                  .map((p) => {
                    const r = rounds.find((x) => x.id === p.roundId);
                    const s = seats.find((x) => x.id === p.seatId);
                    const nonce = r && s ? r.roundIndex * battle.seats + s.seatIndex : "—";
                    return (
                      <tr key={p.id}>
                        <td className="font-mono">{p.pullIndex}</td>
                        <td>{r ? r.roundIndex + 1 : "—"}</td>
                        <td>{s ? `${s.seatIndex + 1} · ${s.displayName}` : "—"}</td>
                        <td className="font-mono">{nonce}</td>
                        <td>{s?.isViewer ? <Link href={`/openings/${p.openingId}`} className="text-cyan-300 hover:underline">{shortHash(p.openingId, 6)}</Link> : <Mono>{shortHash(p.openingId, 6)}</Mono>}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </details>
      )}
      {tie && (
        <details className="mt-3" open>
          <summary className="tap flex cursor-pointer items-center text-sm font-semibold text-ink-200">Tie-break receipt</summary>
          <dl className="mt-2 space-y-2 text-xs">
            <div>
              <dt className="uppercase tracking-wider text-ink-400">Candidates</dt>
              <dd>{tie.candidates.map((c) => seatByIdx.get(c.seatIndex)?.displayName ?? `Seat ${c.seatIndex + 1}`).join(", ")}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wider text-ink-400">Nonce · range</dt>
              <dd className="font-mono">
                {tie.nonce} · {tie.range}
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-wider text-ink-400">Message</dt>
              <dd>
                <Mono>{tie.message}</Mono>
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-wider text-ink-400">Digest</dt>
              <dd>
                <Mono>{tie.digest}</Mono>
              </dd>
            </div>
            <div>
              <dt className="uppercase tracking-wider text-ink-400">Sampling steps</dt>
              <dd className="font-mono">{tie.steps.map((s) => `e${s.extension}w${s.window}=${s.value}${s.accepted ? " ✓" : " ✗"}`).join(", ")}</dd>
            </div>
            <div>
              <dt className="uppercase tracking-wider text-ink-400">Selected index</dt>
              <dd className="font-mono">
                {tie.selectedIndex} → {seatByIdx.get(tie.candidates[tie.selectedIndex]?.seatIndex ?? -1)?.displayName ?? "—"}
              </dd>
            </div>
          </dl>
        </details>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-ink-400">
        <span>Created {fmtDate(battle.createdAt)}</span>
        {battle.settledAt && <span>Settled {fmtDate(battle.settledAt)}</span>}
      </div>
      <Link href="/fairness" className="tap mt-2 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:underline">
        How verification works →
      </Link>
    </Panel>
  );
}
