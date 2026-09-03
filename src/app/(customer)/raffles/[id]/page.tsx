import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { CopyButton, DownloadButton } from "@/components/events/CopyButton";
import { RaffleClaimButton } from "@/components/events/RaffleClaimButton";
import { RaffleEntry } from "@/components/events/RaffleEntry";
import { RaffleVerifier } from "@/components/events/RaffleVerifier";
import { entryModeLabel, raffleStatusTone } from "@/components/events/raffleMeta";
import { Badge, Mono, Panel, SectionTitle, cx } from "@/components/ui/primitives";
import { raffleView } from "@/domain/raffles";
import { requestNow } from "@/components/events/json-types";
import { fmtDate, moneyStr } from "@/lib/format";
import { viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Raffle ${id.slice(0, 8)}` };
}

export default async function RafflePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, session, userId } = await viewer();
  const view = await raffleView(db, id, userId);
  if (!view) notFound();
  const { raffle, prizes, issued, myTickets, manifest, draws } = view;
  const now = requestNow();
  const claimable = raffle.status === "DRAWN" && now <= raffle.claimDeadlineAt.getTime();
  const validDraw = draws.find((d) => d.status === "VALID");
  const timeline: Array<[string, Date]> = [
    ["Opens", raffle.opensAt],
    ["Closes", raffle.closesAt],
    ["Draw", raffle.drawsAt],
    ["Claim deadline", raffle.claimDeadlineAt],
  ];

  return (
    <div className="space-y-5">
      <div>
        <Link href="/raffles" className="tap inline-flex items-center gap-1 text-sm text-ink-300 hover:text-ink-100">
          <ChevronLeft size={16} aria-hidden /> All raffles
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <Badge tone={raffleStatusTone(raffle.status)}>{raffle.status.toLowerCase()}</Badge>
          <Badge tone="neutral">{entryModeLabel(raffle.entryMode)}</Badge>
          {raffle.amoeEnabled && <Badge tone="neutral">Free route available</Badge>}
        </div>
        <h1 className="font-display mt-1 text-2xl font-extrabold md:text-3xl">{raffle.name}</h1>
        {raffle.description && <p className="mt-1 max-w-2xl text-sm text-ink-300">{raffle.description}</p>}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-4">
          <Panel as="section" aria-labelledby="prize-title">
            <SectionTitle title={prizes.length > 1 ? "Prizes" : "Prize"} sub={`${raffle.winnersCount} winner${raffle.winnersCount === 1 ? "" : "s"} drawn`} />
            <ul className="space-y-3">
              {prizes.map((p) => {
                const winnerName = validDraw?.winners.find((w) => w.rank === p.rank)?.displayName ?? null;
                return (
                  <li key={p.id} className={cx("flex gap-4 rounded-xl border p-3", p.isMine ? "border-lime-400/60 bg-lime-400/10" : "border-white/8")}>
                    <ItemArt name={p.title} accent="cyan" size="lg" className="!h-24 !w-24 md:!h-32 md:!w-32" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="neutral">Rank {p.rank}</Badge>
                        {p.isMine && <Badge tone="lime">You won</Badge>}
                        {p.claimedAt && <Badge tone="neutral">Claimed {fmtDate(p.claimedAt)}</Badge>}
                      </div>
                      <h3 className="font-display mt-1 text-lg font-bold">{p.title}</h3>
                      {p.description && <p className="text-sm text-ink-300">{p.description}</p>}
                      <dl className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-ink-500">Condition</dt>
                          <dd className="text-ink-200">{p.condition ?? "—"}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-500">Reference value</dt>
                          <dd className="font-mono text-ink-100">{moneyStr(p.referenceValueMinor, p.currency)}</dd>
                        </div>
                        <div>
                          <dt className="text-ink-500">Value source</dt>
                          <dd className="text-ink-200">
                            {p.valueSource ?? "—"}
                            {p.valueObservedAt && <span className="text-ink-500"> · observed {fmtDate(p.valueObservedAt, { dateStyle: "medium" })}</span>}
                          </dd>
                        </div>
                      </dl>
                      {winnerName && (
                        <p className="mt-2 text-sm">
                          <span className="text-ink-400">Winner:</span> <span className={p.isMine ? "text-lime-300" : "text-ink-100"}>{winnerName}</span>
                        </p>
                      )}
                      {p.isMine && !p.claimedAt && claimable && (
                        <div className="mt-3">
                          <RaffleClaimButton raffleId={raffle.id} prizeId={p.id} title={p.title} />
                          <p className="mt-1 text-xs text-ink-400">Claim before {fmtDate(raffle.claimDeadlineAt)}.</p>
                        </div>
                      )}
                      {p.isMine && !p.claimedAt && raffle.status === "DRAWN" && !claimable && <p className="mt-2 text-xs text-danger">The claim deadline has passed.</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-[11px] text-ink-500">Reference values are disclosed valuations at the time shown; they are not a guarantee of resale value.</p>
          </Panel>

          <Panel as="section" aria-labelledby="rules-title">
            <SectionTitle title="Entry rules" />
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-400">Entry mode</dt>
                <dd className="text-ink-100">
                  {entryModeLabel(raffle.entryMode)}
                  {raffle.entryMode === "PURCHASE_LINKED" && <span className="text-ink-400"> · {moneyStr(raffle.ticketPriceMinor, raffle.currency)} per ticket</span>}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-400">Max per person</dt>
                <dd className="text-ink-100">{raffle.maxTicketsPerUser} tickets</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-400">Allowed regions</dt>
                <dd className="text-ink-100">{raffle.allowedJurisdictions.length ? raffle.allowedJurisdictions.join(", ") : "All regions where raffles are enabled"}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wider text-ink-400">Free alternative method of entry</dt>
                <dd className="text-ink-100">{raffle.amoeEnabled ? "Available" : "Not offered"}</dd>
              </div>
            </dl>
            {raffle.amoeEnabled && (
              <div className="mt-3 rounded-xl border border-white/8 bg-ink-900/50 p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-ink-400">AMOE instructions</div>
                <p className="mt-1 whitespace-pre-line text-ink-200">{raffle.amoeInstructions ?? "Contact support with the raffle name to receive free tickets. Free-route tickets are identical to every other ticket."}</p>
              </div>
            )}
            <p className="mt-3 text-[11px] text-ink-500">No purchase necessary where required. Eligibility depends on your region and verification status; nothing here implies legal approval in any jurisdiction.</p>
          </Panel>

          <Panel as="section" aria-labelledby="draws-title">
            <div className="mb-3 flex items-center gap-2">
              <ShieldCheck size={18} className="text-cyan-300" aria-hidden />
              <h2 id="draws-title" className="font-display text-lg font-bold">
                Commitments & draws
              </h2>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/8 p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-ink-400">Server seed commitment</div>
                <Mono className="mt-1 block">{raffle.serverSeedHash ?? "—"}</Mono>
                <div className="mt-1 text-xs text-ink-500">Committed {fmtDate(raffle.serverSeedCommittedAt)}</div>
                {raffle.publicRandomnessSource && <div className="mt-1 text-xs text-ink-400">Public randomness source: {raffle.publicRandomnessSource}</div>}
              </div>
              <div className="rounded-xl border border-white/8 p-3 text-sm">
                <div className="text-xs uppercase tracking-wider text-ink-400">Ticket manifest</div>
                {manifest ? (
                  <>
                    <div className="mt-1 text-ink-200">
                      {manifest.ticketCount.toLocaleString("en-US")} tickets · locked {fmtDate(manifest.lockedAt)}
                    </div>
                    <Mono className="mt-1 block">{manifest.manifestHash}</Mono>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <CopyButton text={manifest.canonicalManifest} label="Copy canonical manifest" />
                      <DownloadButton text={manifest.canonicalManifest} filename={`raffle-${raffle.slug}-manifest.json`} />
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-ink-400">Published when entries close.</div>
                )}
              </div>
            </div>

            {draws.length === 0 ? (
              <p className="mt-4 text-sm text-ink-400">Not drawn yet. The draw uses the revealed server seed, the published manifest hash and the declared public randomness.</p>
            ) : (
              <ol className="mt-4 space-y-4">
                {draws.map((d) => (
                  <li key={d.id} className={cx("rounded-xl border p-3", d.status === "VALID" ? "border-white/12" : "border-white/8 opacity-80")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display font-bold">Draw #{d.drawNumber}</span>
                      <Badge tone={d.status === "VALID" ? "cyan" : "amber"}>{d.status.toLowerCase()}</Badge>
                      <span className="text-xs text-ink-400">{fmtDate(d.createdAt)}</span>
                    </div>
                    {d.reason && (
                      <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/5 p-2 text-xs text-ink-200">
                        <span className="font-semibold text-amber-400">Redraw reason:</span> {d.reason}
                      </p>
                    )}
                    <dl className="mt-2 grid gap-2 text-xs md:grid-cols-2">
                      <div>
                        <dt className="uppercase tracking-wider text-ink-400">Public randomness</dt>
                        <dd>
                          <Mono>{d.publicRandomness}</Mono>
                          <div className="text-ink-500">Source: {d.publicRandomnessSource}</div>
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wider text-ink-400">Revealed server seed</dt>
                        <dd>
                          <Mono>{d.serverSeed}</Mono>
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wider text-ink-400">Seed hash · manifest hash</dt>
                        <dd>
                          <Mono>{d.serverSeedHash}</Mono>
                          <br />
                          <Mono>{d.manifestHash}</Mono>
                        </dd>
                      </div>
                      <div>
                        <dt className="uppercase tracking-wider text-ink-400">Ticket count</dt>
                        <dd className="font-mono text-ink-100">{d.ticketCount}</dd>
                      </div>
                    </dl>
                    <div className="table-wrap mt-3 rounded-lg border border-white/8">
                      <table>
                        <thead>
                          <tr>
                            <th scope="col">Rank</th>
                            <th scope="col">Ticket</th>
                            <th scope="col">Winner</th>
                            <th scope="col">Nonce</th>
                            <th scope="col">Digest</th>
                          </tr>
                        </thead>
                        <tbody>
                          {d.winners.map((w) => {
                            const mine = w.userId === userId;
                            return (
                              <tr key={w.rank}>
                                <td className="font-display font-bold">#{w.rank}</td>
                                <td>
                                  <span className="font-mono">
                                    {w.ticketNumber} · {w.ticketId}
                                  </span>
                                </td>
                                <td className={cx(mine && d.status === "VALID" && "text-lime-300")}>
                                  {w.displayName}
                                  {mine && " (you)"}
                                </td>
                                <td className="font-mono">{w.nonce}</td>
                                <td>
                                  <Mono>{w.digest}</Mono>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-3">
                      <RaffleVerifier input={{ serverSeed: d.serverSeed, serverSeedHash: d.serverSeedHash, publicRandomness: d.publicRandomness, raffleId: raffle.id, manifestHash: d.manifestHash, ticketCount: d.ticketCount, winnersCount: Math.min(raffle.winnersCount, d.ticketCount), canonicalManifest: manifest?.canonicalManifest, expectedWinners: d.winners.map((w) => w.ticketNumber) }} />
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <Link href={`/fairness?tab=raffle&raffleId=${raffle.id}${validDraw ? `&serverSeed=${validDraw.serverSeed}&serverSeedHash=${validDraw.serverSeedHash}&publicRandomness=${encodeURIComponent(validDraw.publicRandomness)}&manifestHash=${validDraw.manifestHash}&ticketCount=${validDraw.ticketCount}&winnersCount=${Math.min(raffle.winnersCount, validDraw.ticketCount)}` : ""}`} className="tap mt-3 inline-flex items-center text-sm font-semibold text-cyan-300 hover:underline">
              Open in the standalone verifier →
            </Link>
          </Panel>
        </div>

        <aside className="space-y-4">
          <RaffleEntry raffleId={raffle.id} status={raffle.status} entryMode={raffle.entryMode} ticketPriceMinor={raffle.ticketPriceMinor.toString()} currency={raffle.currency} maxTickets={raffle.maxTickets} maxTicketsPerUser={raffle.maxTicketsPerUser} issued={issued} myCount={myTickets.length} signedIn={!!session} opensAt={raffle.opensAt.toISOString()} closesAt={raffle.closesAt.toISOString()} />

          <Panel as="section" aria-labelledby="timeline-title">
            <SectionTitle title="Timeline" />
            <ol className="space-y-2 text-sm">
              {timeline.map(([label, at]) => {
                const past = at.getTime() <= now;
                return (
                  <li key={label} className="flex items-start gap-3">
                    <span className={cx("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", past ? "bg-cyan-400" : "bg-ink-600")} aria-hidden />
                    <div>
                      <div className={cx("font-semibold", past ? "text-ink-100" : "text-ink-300")}>{label}</div>
                      <div className="text-xs text-ink-400">{fmtDate(at)}</div>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Panel>

          <Panel as="section" aria-labelledby="tickets-title">
            <SectionTitle title="My tickets" sub={session ? `${myTickets.length} of ${raffle.maxTicketsPerUser} allowed` : "Sign in to see your tickets"} />
            {myTickets.length === 0 ? (
              <p className="text-sm text-ink-400">No tickets yet.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {myTickets.map((t) => {
                  const won = validDraw?.winners.some((w) => w.ticketNumber === t.ticketNumber);
                  return (
                    <li key={t.ticketId} className={cx("flex items-center justify-between gap-2 rounded-lg border px-2 py-1.5", won ? "border-lime-400/60 bg-lime-400/10 text-lime-300" : "border-white/8")}>
                      <span className="font-mono">#{t.ticketNumber}</span>
                      <span className="font-mono text-xs text-ink-400">{t.ticketId}</span>
                      <span className="text-[10px] uppercase tracking-wider text-ink-500">{t.source.toLowerCase()}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </aside>
      </div>
    </div>
  );
}
