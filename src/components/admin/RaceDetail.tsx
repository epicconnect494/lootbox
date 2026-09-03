"use client";
import { useState, type FormEvent } from "react";
import type { raceScoreEvent, raceStanding } from "@/db/schema";
import type { raceView } from "@/domain/races";
import { Badge, Button, Field, Input, Mono, Panel, SectionTitle } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDate, moneyStr, shortHash } from "@/lib/format";
import { useAction } from "./hooks";
import { Collapsible, JsonBlock, KV, Notice, StatusBadge } from "./ui";
import type { Json } from "./serialize";

export type RaceViewData = Json<NonNullable<Awaited<ReturnType<typeof raceView>>>>;
export type StandingRow = Json<{ s: typeof raceStanding.$inferSelect; email: string; displayName: string }>;
export type ScoreEventRow = Json<typeof raceScoreEvent.$inferSelect>;

export function RaceDetail({ view, standings, events, permissions }: { view: RaceViewData; standings: StandingRow[]; events: ScoreEventRow[]; permissions: string[] }) {
  const r = view.race;
  const has = (p: string) => permissions.includes(p);
  const { run, busy, error } = useAction();
  const base = `/admin/races/${r.id}`;
  const [promo, setPromo] = useState({ userId: "", units: "", ref: "" });
  const promoAction = useAction();
  async function submitPromo(e: FormEvent) {
    e.preventDefault();
    await promoAction.run(() => api(`${base}/promo-entry`, { method: "POST", body: promo }), { success: "No-purchase entry scored", onSuccess: () => setPromo({ userId: "", units: "", ref: "" }) });
  }
  const ranked = [...standings].sort((a, b) => (a.s.rank ?? 1e9) - (b.s.rank ?? 1e9) || b.s.points - a.s.points);
  const paidTotal = standings.reduce((a, s) => a + BigInt(s.s.prizeAmountMinor ?? "0"), 0n);

  return (
    <div className="space-y-6">
      <Panel strong>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold">{r.name}</h1>
              <StatusBadge status={r.status} />
            </div>
            <div className="mt-1 text-sm text-ink-300">
              {fmtDate(r.startsAt)} → {fmtDate(r.endsAt)} · {r.timezone} · <Mono>{r.slug}</Mono>
            </div>
          </div>
          <KV
            items={[
              ["Policy", view.policy ? `v${view.policy.version} ${view.policy.name}` : "—"],
              ["Policy hash", <Mono key="p">{shortHash(view.policy?.policyHash, 8)}</Mono>],
              ["Lock snapshot", <Mono key="l">{r.lockSnapshotHash ?? "not locked"}</Mono>],
              ["Locked", fmtDate(r.lockedAt)],
              ["Settled", fmtDate(r.settledAt)],
              ["Paid", moneyStr(paidTotal)],
            ]}
          />
        </div>
      </Panel>

      <Panel as="section">
        <SectionTitle title="Actions" sub="Lock freezes standings and snapshots ranks (ACTIVE → REVIEW). Fraud review excludes flagged accounts. Settle pays the ladder; it is idempotent and safe to re-run." />
        <div className="flex flex-wrap gap-2">
          {has("races.write") && (
            <Button tone="secondary" disabled={busy || r.status !== "ACTIVE"} onClick={() => run(() => api(`${base}/lock`, { method: "POST" }), { success: "Standings locked" })}>
              Lock standings
            </Button>
          )}
          {has("races.write") && (
            <Button tone="secondary" disabled={busy || (r.status !== "REVIEW" && r.status !== "LOCKED")} onClick={() => run(() => api<{ result: string[] }>(`${base}/review`, { method: "POST" }), { success: "Fraud review complete" })}>
              Run fraud review
            </Button>
          )}
          {has("races.settle") && (
            <Button disabled={busy || (r.status !== "REVIEW" && r.status !== "SETTLED")} onClick={() => confirm("Settle prizes now? Re-running never double pays.") && run(() => api(`${base}/settle`, { method: "POST" }), { success: "Race settled" })}>
              {r.status === "SETTLED" ? "Re-run settlement (idempotent)" : "Settle prizes"}
            </Button>
          )}
          {!has("races.write") && !has("races.settle") && <p className="text-sm text-ink-400">Read-only for your role.</p>}
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}
        {r.settlementSummary != null && (
          <div className="mt-3">
            <Collapsible title="Settlement summary">
              <JsonBlock value={r.settlementSummary} label="Settlement summary" />
            </Collapsible>
          </div>
        )}
        {r.lockSnapshot != null && (
          <div className="mt-3">
            <Collapsible title={`Lock snapshot (${r.lockSnapshotHash?.slice(0, 12)}…)`}>
              <JsonBlock value={r.lockSnapshot} label="Lock snapshot" />
            </Collapsible>
          </div>
        )}
      </Panel>

      <Panel as="section">
        <SectionTitle title="Standings" sub={`${standings.length} entrants · ${view.prizes.length} paid positions`} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Entrant</th>
                <th>Points</th>
                <th>Last qualifying</th>
                <th>Excluded</th>
                <th>Prize</th>
                <th>Prize ledger tx</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map(({ s, email, displayName }) => (
                <tr key={s.id} className={s.excludedReason ? "opacity-60" : undefined}>
                  <td>{s.rank ?? "—"}</td>
                  <td>
                    <div className="font-medium text-ink-100">{displayName}</div>
                    <div className="text-xs text-ink-400">{email}</div>
                  </td>
                  <td className="font-display font-bold">{s.points}</td>
                  <td className="whitespace-nowrap text-xs text-ink-300">{fmtDate(s.lastQualifyingAt)}</td>
                  <td>{s.excludedReason ? <Badge tone="danger">{s.excludedReason}</Badge> : "—"}</td>
                  <td>{s.prizeAmountMinor ? moneyStr(s.prizeAmountMinor) : "—"}</td>
                  <td>
                    <Mono>{shortHash(s.prizeLedgerTransactionId, 8)}</Mono>
                  </td>
                </tr>
              ))}
              {ranked.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-ink-400">
                    No entrants yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel as="section">
          <SectionTitle title="Prize ladder" />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Amount</th>
                  <th>Label</th>
                </tr>
              </thead>
              <tbody>
                {view.prizes.map((p) => (
                  <tr key={p.id}>
                    <td>#{p.rank}</td>
                    <td>{moneyStr(p.amountMinor)}</td>
                    <td className="text-ink-300">{p.label ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        {has("races.write") && (
          <Panel as="section">
            <SectionTitle title="No-purchase entry" sub="Records a promotional entry and scores it with the policy's promo rate. Idempotent per (user, ref)." />
            <form onSubmit={submitPromo} className="space-y-3">
              <Field label="User ID">
                <Input required value={promo.userId} onChange={(e) => setPromo((s) => ({ ...s, userId: e.target.value }))} placeholder="uuid" />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Units" hint="Decimal currency units to credit, e.g. 25.00">
                  <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={promo.units} onChange={(e) => setPromo((s) => ({ ...s, units: e.target.value }))} />
                </Field>
                <Field label="Reference" hint="Mail-in / form reference" error={promoAction.error}>
                  <Input required maxLength={160} value={promo.ref} onChange={(e) => setPromo((s) => ({ ...s, ref: e.target.value }))} />
                </Field>
              </div>
              <Button type="submit" tone="secondary" disabled={promoAction.busy || r.status !== "ACTIVE"}>
                {promoAction.busy ? "Recording…" : "Record entry"}
              </Button>
              {r.status !== "ACTIVE" && <p className="text-xs text-ink-400">Entries are only scored while the race is ACTIVE.</p>}
            </form>
          </Panel>
        )}
      </div>

      <Panel as="section">
        <SectionTitle title="Qualified events" sub="Most recent 200 scoring rows with their explanation. Reversals appear as negative points." />
        {events.length === 0 && <Notice>No events scored yet.</Notice>}
        {events.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Occurred</th>
                  <th>User</th>
                  <th>Source</th>
                  <th>Points</th>
                  <th>Explanation</th>
                  <th>Excluded</th>
                </tr>
              </thead>
              <tbody>
                {events.map((e) => (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDate(e.occurredAt)}</td>
                    <td className="text-xs">{e.userId.slice(0, 8)}</td>
                    <td>
                      <Badge tone={e.sourceType === "REVERSAL" ? "danger" : e.sourceType === "PROMO_ENTRY" ? "cyan" : "neutral"}>{e.sourceType.replace(/_/g, " ")}</Badge>
                    </td>
                    <td className={e.points < 0 ? "text-danger" : ""}>{e.points}</td>
                    <td className="text-ink-300">{e.explanation}</td>
                    <td className="text-xs text-ink-300">{e.excluded ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
