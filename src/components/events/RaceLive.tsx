"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trophy } from "lucide-react";
import { Badge, Mono, Panel, SectionTitle, cx } from "@/components/ui/primitives";
import { api, subscribeSse } from "@/lib/client/api";
import { fmtDate, moneyStr } from "@/lib/format";
import type { raceView } from "@/domain/races";
import { Countdown } from "./Countdown";
import type { Json } from "./json-types";

export type RaceView = Json<NonNullable<Awaited<ReturnType<typeof raceView>>>>;

const TIE_TEXT = "EARLIEST_QUALIFYING_EVENT_WINS: ties are broken by who reached their score first, then by user id.";

function statusTone(s: string): "cyan" | "lime" | "amber" | "neutral" | "violet" {
  if (s === "ACTIVE") return "cyan";
  if (s === "SETTLED") return "lime";
  if (s === "REVIEW") return "amber";
  if (s === "SCHEDULED") return "violet";
  return "neutral";
}

/** Groups consecutive ranks that pay the same amount: "1", "2", "3", "4–10", ... */
export function groupPrizes(prizes: RaceView["prizes"]) {
  const sorted = [...prizes].sort((a, b) => a.rank - b.rank);
  const groups: Array<{ from: number; to: number; amountMinor: string; currency: string; label: string | null }> = [];
  for (const p of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.to === p.rank - 1 && last.amountMinor === p.amountMinor && last.label === p.label && p.rank > 3) last.to = p.rank;
    else groups.push({ from: p.rank, to: p.rank, amountMinor: p.amountMinor, currency: p.currency, label: p.label });
  }
  return groups;
}

export function RaceLive({ initial, signedIn }: { initial: RaceView; signedIn: boolean }) {
  const router = useRouter();
  const [view, setView] = useState<RaceView>(initial);
  const id = initial.race.id;
  const refetch = useCallback(async () => {
    try {
      setView(await api<RaceView>(`/race/${id}`));
    } catch {
      /* transient */
    }
  }, [id]);
  useEffect(() => {
    const onEvent = () => void refetch();
    return subscribeSse(`/race/${id}/events`, { "standing.updated": onEvent, settled: () => {
      void refetch();
      router.refresh();
    } });
  }, [id, refetch, router]);

  const { race, prizes, policy, leaderboard, me } = view;
  const groups = useMemo(() => groupPrizes(prizes), [prizes]);
  const top = groups.filter((g) => g.from <= 10);
  const rest = groups.filter((g) => g.from > 10);
  const prizeFor = (rank: number) => prizes.find((p) => p.rank === rank);
  const active = race.status === "ACTIVE";
  const scheduled = race.status === "SCHEDULED";

  return (
    <div className="space-y-5">
      <Panel strong className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={statusTone(race.status)}>{race.status.toLowerCase()}</Badge>
            <span className="text-xs text-ink-400">
              {fmtDate(race.startsAt, { dateStyle: "medium" })} → {fmtDate(race.endsAt, { dateStyle: "medium" })}
            </span>
          </div>
          <h2 className="font-display mt-1 truncate text-2xl font-extrabold md:text-3xl">{race.name}</h2>
          <p className="mt-1 text-sm text-ink-400">Points from qualified openings and battle entries. No purchase necessary where required; promotional entries earn points at the disclosed rate.</p>
        </div>
        <Countdown target={active ? race.endsAt : race.startsAt} timezone={race.timezone} label={active ? "Ends in" : scheduled ? "Starts in" : "Ended"} onReach={() => void refetch()} />
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          {signedIn && (
            <Panel as="section" aria-labelledby="me-title" aria-live="polite" className={cx(me?.prizeMinor && "border-lime-400/40")}>
              <SectionTitle title="Your standing" />
              {me ? (
                <>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Rank</div>
                      <div className="font-display text-2xl font-extrabold">{me.rank ? `#${me.rank}` : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Points</div>
                      <div className="font-display text-2xl font-extrabold tabular-nums">{me.points.toLocaleString("en-US")}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Current prize</div>
                      <div className={cx("font-display text-2xl font-extrabold", me.prizeMinor && "text-lime-300")}>{me.prizeMinor ? moneyStr(me.prizeMinor, race.currency) : "—"}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">To next paid rank</div>
                      <div className="font-display text-2xl font-extrabold tabular-nums">{me.nextPaidRank && me.gapToNextPaidMinor !== null ? `${me.gapToNextPaidMinor.toLocaleString("en-US")} pts` : "—"}</div>
                      {me.nextPaidRank && <div className="text-xs text-ink-400">to reach #{me.nextPaidRank}</div>}
                    </div>
                  </div>
                  <details className="mt-3">
                    <summary className="tap flex cursor-pointer items-center text-sm font-semibold text-ink-200">How your score was calculated ({me.explanation.length} events)</summary>
                    {me.explanation.length === 0 ? (
                      <p className="mt-2 text-sm text-ink-400">No qualified events yet. Open a pack or join a battle during the race window.</p>
                    ) : (
                      <ul className="mt-2 divide-y divide-white/6 text-sm">
                        {me.explanation.map((e, i) => (
                          <li key={i} className="flex items-start justify-between gap-3 py-2">
                            <div>
                              <div className="text-ink-200">{e.explanation}</div>
                              <div className="text-xs text-ink-500">
                                {e.sourceType.replace(/_/g, " ").toLowerCase()} · {fmtDate(e.occurredAt)}
                              </div>
                            </div>
                            <span className={cx("shrink-0 font-mono", e.points < 0 ? "text-danger" : "text-ink-100")}>
                              {e.points > 0 ? "+" : ""}
                              {e.points}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </details>
                </>
              ) : (
                <p className="text-sm text-ink-400">Nothing scored yet.</p>
              )}
            </Panel>
          )}
          {!signedIn && (
            <Panel>
              <p className="text-sm text-ink-300">
                <Link href="/login?next=/race" className="font-semibold text-cyan-300 hover:underline">
                  Sign in
                </Link>{" "}
                to see your rank, points and score breakdown.
              </p>
            </Panel>
          )}

          <Panel as="section" aria-labelledby="lb-title">
            <SectionTitle title="Live leaderboard" sub="Updates in real time. Excluded standings are hidden." />
            {leaderboard.length === 0 ? (
              <p className="text-sm text-ink-400">No qualified points yet.</p>
            ) : (
              <div className="table-wrap" aria-live="polite">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Rank</th>
                      <th scope="col">Player</th>
                      <th scope="col">Points</th>
                      <th scope="col">Prize</th>
                      <th scope="col">Reached at</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row) => {
                      const rank = Number(row.rank);
                      const prize = row.prize_amount_minor ?? prizeFor(rank)?.amountMinor ?? null;
                      return (
                        <tr key={row.user_id} className={cx(rank <= 3 && "bg-white/[0.03]")}>
                          <td className="font-display font-bold">
                            {rank <= 3 && <Trophy size={12} className="mr-1 inline text-amber-400" aria-hidden />}#{rank}
                          </td>
                          <td>{row.display_name}</td>
                          <td className="font-mono tabular-nums">{Number(row.points).toLocaleString("en-US")}</td>
                          <td className={cx("font-mono", prize && "text-lime-300")}>{prize ? moneyStr(prize, race.currency) : "—"}</td>
                          <td className="text-ink-400">{row.last_qualifying_at ? fmtDate(row.last_qualifying_at) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-4">
          <Panel as="section" aria-labelledby="prizes-title">
            <SectionTitle title="Prize ladder" sub={`${prizes.length} paid position${prizes.length === 1 ? "" : "s"}`} />
            <PrizeRows groups={top} currency={race.currency} />
            {rest.length > 0 && (
              <details className="mt-2">
                <summary className="tap flex cursor-pointer items-center text-sm font-semibold text-ink-200">Show ranks 11–{Math.max(...prizes.map((p) => p.rank))}</summary>
                <div className="mt-2">
                  <PrizeRows groups={rest} currency={race.currency} />
                </div>
              </details>
            )}
          </Panel>

          <Panel as="section" aria-labelledby="policy-title">
            <SectionTitle title="Scoring policy" sub={policy ? `${policy.name} · v${policy.version}` : "Not published"} />
            {policy && (
              <>
                <ul className="space-y-1 text-sm text-ink-200">
                  <li>
                    <span className="text-ink-400">Per unit spent:</span> {policy.rules.pointsPerUnitSpent} pts
                  </li>
                  <li>
                    <span className="text-ink-400">Per opening:</span> +{policy.rules.pointsPerOpening} pts
                  </li>
                  <li>
                    <span className="text-ink-400">Per battle entry:</span> +{policy.rules.pointsPerBattleEntry} pts
                  </li>
                  <li>
                    <span className="text-ink-400">Per promo unit (no purchase):</span> {policy.rules.pointsPerPromoUnit} pts
                  </li>
                  <li>
                    <span className="text-ink-400">Cap per event:</span> {policy.rules.maxPointsPerEvent.toLocaleString("en-US")} pts
                  </li>
                </ul>
                <div className="mt-3 text-xs text-ink-400">Policy hash</div>
                <Mono>{policy.policyHash}</Mono>
                <div className="mt-3 text-xs text-ink-400">Tie policy</div>
                <p className="text-sm text-ink-200">{TIE_TEXT}</p>
                <div className="mt-3 text-xs text-ink-400">Exclusions</div>
                <p className="text-sm text-ink-200">Voids, refunds, chargebacks, fraud and bonus abuse are excluded and reversed from standings{policy.rules.excludedKinds.length ? ` (${policy.rules.excludedKinds.join(", ")})` : ""}.</p>
              </>
            )}
            <p className="mt-3 text-xs leading-relaxed text-ink-500">No purchase necessary where required by law. Promotional entries are recorded by support and score at the disclosed promo rate. Standings are locked at the end, reviewed for fraud, then settled.</p>
          </Panel>
        </aside>
      </div>
    </div>
  );
}

function PrizeRows({ groups, currency }: { groups: ReturnType<typeof groupPrizes>; currency: string }) {
  return (
    <ul className="divide-y divide-white/6 text-sm">
      {groups.map((g) => (
        <li key={g.from} className="flex items-center justify-between gap-2 py-1.5">
          <span className="text-ink-200">
            {g.from === g.to ? `#${g.from}` : `#${g.from}–${g.to}`}
            {g.label && <span className="ml-2 text-xs text-ink-400">{g.label}</span>}
          </span>
          <span className="font-mono text-ink-100">
            {moneyStr(g.amountMinor, currency)}
            {g.from !== g.to && <span className="text-xs text-ink-400"> each</span>}
          </span>
        </li>
      ))}
      {groups.length === 0 && <li className="py-1.5 text-ink-400">No prizes published.</li>}
    </ul>
  );
}
