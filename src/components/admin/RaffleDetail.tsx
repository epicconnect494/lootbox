"use client";
import { useState, type FormEvent } from "react";
import type { raffleView } from "@/domain/raffles";
import { Badge, Button, Field, Input, Mono, Panel, SectionTitle, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDate, moneyStr, shortHash } from "@/lib/format";
import { useAction } from "./hooks";
import { Collapsible, JsonBlock, KV, Notice, StatusBadge } from "./ui";
import type { Json } from "./serialize";

export type RaffleViewData = Json<NonNullable<Awaited<ReturnType<typeof raffleView>>>>;

export function RaffleDetail({ view, permissions }: { view: RaffleViewData; permissions: string[] }) {
  const r = view.raffle;
  const has = (p: string) => permissions.includes(p);
  const base = `/admin/raffles/${r.id}`;
  const close = useAction();
  const draw = useAction();
  const redraw = useAction();
  const amoe = useAction();
  const [d, setD] = useState({ publicRandomness: "", publicRandomnessSource: r.publicRandomnessSource ?? "" });
  const [rd, setRd] = useState({ publicRandomness: "", publicRandomnessSource: r.publicRandomnessSource ?? "", reason: "" });
  const [a, setA] = useState({ userId: "", count: "1", sourceRef: "" });
  const [showRedraw, setShowRedraw] = useState(false);
  const validDraw = view.draws.find((x) => x.status === "VALID");

  return (
    <div className="space-y-6">
      <Panel strong>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold">{r.name}</h1>
              <StatusBadge status={r.status} />
              <Badge tone="neutral">{r.entryMode.replace(/_/g, " ")}</Badge>
            </div>
            <div className="mt-1 text-sm text-ink-300">
              <Mono>{r.slug}</Mono> · {view.issued}/{r.maxTickets} tickets · {r.winnersCount} winner{r.winnersCount === 1 ? "" : "s"} · max {r.maxTicketsPerUser}/user
            </div>
          </div>
          <KV
            items={[
              ["Opens", fmtDate(r.opensAt)],
              ["Closes", fmtDate(r.closesAt)],
              ["Draws", fmtDate(r.drawsAt)],
              ["Claim by", fmtDate(r.claimDeadlineAt)],
              ["Jurisdictions", r.allowedJurisdictions.length ? r.allowedJurisdictions.join(", ") : "all enabled"],
              ["AMOE", r.amoeEnabled ? "Enabled" : "Disabled"],
              ["Ticket price", moneyStr(r.ticketPriceMinor)],
            ]}
          />
        </div>
        <div className="mt-3 grid gap-2 text-sm md:grid-cols-2">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Server seed hash (committed {fmtDate(r.serverSeedCommittedAt)})</div>
            <Mono>{r.serverSeedHash ?? "—"}</Mono>
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Declared public randomness source</div>
            <span className="text-ink-200">{r.publicRandomnessSource ?? "—"}</span>
          </div>
        </div>
      </Panel>

      <Panel as="section">
        <SectionTitle title="Manifest" sub="Canonical, sorted ticket list hashed at close. The draw is bound to this hash." />
        {view.manifest ? (
          <div className="space-y-3">
            <KV items={[["Tickets", String(view.manifest.ticketCount)], ["Hash", <Mono key="h">{view.manifest.manifestHash}</Mono>], ["Locked", fmtDate(view.manifest.lockedAt)]]} />
            <Collapsible title="Canonical manifest">
              <JsonBlock value={view.manifest.canonicalManifest} label="Canonical manifest" />
            </Collapsible>
          </div>
        ) : (
          <p className="text-sm text-ink-400">Not closed yet — the manifest is published at close.</p>
        )}
      </Panel>

      <Panel as="section">
        <SectionTitle title="Prizes" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Rank</th>
                <th>Prize</th>
                <th>Reference</th>
                <th>Item</th>
                <th>Winner</th>
                <th>Claimed</th>
              </tr>
            </thead>
            <tbody>
              {view.prizes.map((p) => (
                <tr key={p.id}>
                  <td>#{p.rank}</td>
                  <td>
                    <div className="font-medium text-ink-100">{p.title}</div>
                    {p.description && <div className="text-xs text-ink-400">{p.description}</div>}
                  </td>
                  <td>
                    {moneyStr(p.referenceValueMinor)}
                    {p.valueSource && <div className="text-xs text-ink-400">{p.valueSource}</div>}
                  </td>
                  <td className="text-xs">{p.inventoryItemId ? p.inventoryItemId.slice(0, 8) : "described"}</td>
                  <td className="text-xs">{p.winnerUserId ?? "—"}</td>
                  <td className="text-xs text-ink-300">{fmtDate(p.claimedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel as="section">
        <SectionTitle title="Draws" sub="Append-only. A redraw never overwrites: the earlier draw is marked SUPERSEDED and stays on record with the reason." />
        {view.draws.length === 0 && <p className="text-sm text-ink-400">No draw yet.</p>}
        <div className="space-y-3">
          {view.draws.map((dr) => (
            <div key={dr.id} className="rounded-xl border border-white/8 bg-white/3 p-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <strong>Draw #{dr.drawNumber}</strong>
                <StatusBadge status={dr.status} />
                <span className="text-ink-400">{fmtDate(dr.createdAt)}</span>
                <span className="text-ink-400">· {dr.ticketCount} tickets</span>
              </div>
              <KV
                className="mt-2"
                items={[
                  ["Public randomness", <Mono key="r">{dr.publicRandomness}</Mono>],
                  ["Source", dr.publicRandomnessSource],
                  ["Manifest", <Mono key="m">{shortHash(dr.manifestHash, 10)}</Mono>],
                  ["Revealed seed", <Mono key="s">{dr.serverSeed}</Mono>],
                  ...(dr.reason ? ([["Reason", dr.reason]] as Array<[string, string]>) : []),
                ]}
              />
              <ul className="mt-2 flex flex-wrap gap-2">
                {dr.winners.map((w) => (
                  <li key={w.ticketId} className="rounded-lg border border-white/10 px-2 py-1 text-xs">
                    #{w.rank} · ticket {w.ticketNumber} <Mono>{w.ticketId}</Mono> · {w.displayName}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        {has("raffles.write") && (
          <Panel as="section">
            <SectionTitle title="Close entries" sub="Locks the ticket list and publishes the manifest hash." />
            <Button tone="secondary" disabled={close.busy || r.status !== "OPEN"} onClick={() => confirm("Close entries and publish the manifest?") && close.run(() => api(`${base}/close`, { method: "POST" }), { success: "Raffle closed; manifest published" })}>
              {close.busy ? "Closing…" : "Close raffle"}
            </Button>
            {r.status !== "OPEN" && <p className="mt-2 text-xs text-ink-400">Only OPEN raffles can be closed.</p>}
            {close.error && (
              <p role="alert" className="mt-2 text-sm text-danger">
                {close.error}
              </p>
            )}
          </Panel>
        )}
        {has("raffles.draw") && (
          <Panel as="section">
            <SectionTitle title="Draw" sub="Combines the committed server seed with the declared public randomness; reveals the seed." />
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void draw.run(() => api(`${base}/draw`, { method: "POST", body: d }), { success: "Drawn" });
              }}
              className="space-y-3"
            >
              <Field label="Public randomness" hint="The published value (≥ 8 characters)">
                <Input required minLength={8} maxLength={300} value={d.publicRandomness} onChange={(e) => setD((s) => ({ ...s, publicRandomness: e.target.value }))} />
              </Field>
              <Field label="Source" error={draw.error}>
                <Input required minLength={3} maxLength={300} value={d.publicRandomnessSource} onChange={(e) => setD((s) => ({ ...s, publicRandomnessSource: e.target.value }))} />
              </Field>
              <Button type="submit" disabled={draw.busy || r.status !== "CLOSED"}>
                {draw.busy ? "Drawing…" : "Run draw"}
              </Button>
              {r.status !== "CLOSED" && <p className="text-xs text-ink-400">The raffle must be CLOSED to draw.</p>}
            </form>
          </Panel>
        )}
        {has("raffles.draw") && r.status === "DRAWN" && (
          <Panel as="section">
            <SectionTitle title="Redraw (audited)" sub="Only before any prize is claimed. The original draw stays on record as SUPERSEDED — it is never overwritten." />
            {!showRedraw ? (
              <Button tone="danger" onClick={() => setShowRedraw(true)}>
                Redraw…
              </Button>
            ) : (
              <form
                onSubmit={(e: FormEvent) => {
                  e.preventDefault();
                  void redraw.run(() => api(`${base}/redraw`, { method: "POST", body: rd }), { success: `Redrawn; draw #${validDraw?.drawNumber ?? ""} superseded`, onSuccess: () => setShowRedraw(false) });
                }}
                className="space-y-3"
              >
                <Field label="Reason" hint="At least 20 characters; recorded with the draw">
                  <Textarea required minLength={20} value={rd.reason} onChange={(e) => setRd((s) => ({ ...s, reason: e.target.value }))} className="min-h-16" />
                </Field>
                <Field label="New public randomness">
                  <Input required minLength={8} maxLength={300} value={rd.publicRandomness} onChange={(e) => setRd((s) => ({ ...s, publicRandomness: e.target.value }))} />
                </Field>
                <Field label="Source" error={redraw.error}>
                  <Input required minLength={3} value={rd.publicRandomnessSource} onChange={(e) => setRd((s) => ({ ...s, publicRandomnessSource: e.target.value }))} />
                </Field>
                <div className="flex gap-2">
                  <Button type="submit" tone="danger" disabled={redraw.busy}>
                    {redraw.busy ? "Redrawing…" : "Confirm redraw"}
                  </Button>
                  <Button type="button" tone="ghost" onClick={() => setShowRedraw(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </Panel>
        )}
        {has("raffles.write") && (
          <Panel as="section">
            <SectionTitle title="Record AMOE entry" sub="Free alternative-method entry received by mail or form. Idempotent per source reference." />
            {!r.amoeEnabled && <Notice tone="warn">The free entry route is disabled for this raffle.</Notice>}
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void amoe.run(() => api(`${base}/amoe`, { method: "POST", body: { userId: a.userId, count: Number(a.count), sourceRef: a.sourceRef } }), { success: "AMOE tickets issued", onSuccess: () => setA({ userId: "", count: "1", sourceRef: "" }) });
              }}
              className="mt-3 space-y-3"
            >
              <Field label="User ID">
                <Input required value={a.userId} onChange={(e) => setA((s) => ({ ...s, userId: e.target.value }))} placeholder="uuid" />
              </Field>
              <div className="grid gap-3 md:grid-cols-2">
                <Field label="Tickets">
                  <Input type="number" min={1} max={100} required value={a.count} onChange={(e) => setA((s) => ({ ...s, count: e.target.value }))} />
                </Field>
                <Field label="Source reference" error={amoe.error}>
                  <Input required maxLength={160} value={a.sourceRef} onChange={(e) => setA((s) => ({ ...s, sourceRef: e.target.value }))} placeholder="postcard #, form id" />
                </Field>
              </div>
              <Button type="submit" tone="secondary" disabled={amoe.busy || r.status !== "OPEN" || !r.amoeEnabled}>
                {amoe.busy ? "Recording…" : "Issue tickets"}
              </Button>
            </form>
          </Panel>
        )}
      </div>
    </div>
  );
}
