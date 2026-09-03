"use client";
import Link from "next/link";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Field, Input, Mono, Panel, ProbabilityBar, SectionTitle, Textarea, cx, tierTone } from "@/components/ui/primitives";
import { ItemArt } from "@/components/art/ItemArt";
import { api } from "@/lib/client/api";
import { fmtDate, moneyStr, pct, probability, shortHash, tierLabel } from "@/lib/format";
import { Drawer } from "./Drawer";
import { useAction } from "./hooks";
import { Collapsible, JsonBlock, KV, Notice, StatusBadge } from "./ui";
import { bpOf, toDecimal, toIso, toLocalInput } from "./money";
import type { VersionAuditRow, VersionData } from "./versionLoader";
import { OutcomeForm, type OutcomeDraft } from "./OutcomeForm";

type Outcome = VersionData["outcomes"][number];
const EDITABLE = new Set(["DRAFT", "REJECTED"]);

export function VersionEditor({ data, audit, permissions, userId }: { data: VersionData; audit: VersionAuditRow[]; permissions: string[]; userId: string }) {
  const { version: v, outcomes, validation, suggestions, economics, pack, commitment, health } = data;
  const has = (p: string) => permissions.includes(p);
  const editable = EDITABLE.has(v.status) && has("packs.write");
  const isLive = v.status === "PUBLISHED" || v.status === "PAUSED";

  // Live computed table: exact integer math from the serialized outcome rows.
  const totals = useMemo(() => {
    const N = outcomes.reduce((a, o) => a + o.quantityTotal, 0);
    const price = BigInt(v.priceMinor);
    const gross = BigInt(N) * price;
    let merch = 0n;
    let sell = 0n;
    for (const o of outcomes) {
      merch += BigInt(o.quantityTotal) * BigInt(o.referenceValueMinor);
      sell += BigInt(o.quantityTotal) * BigInt(o.sellbackOfferMinor);
    }
    const merchBp = bpOf(merch, gross);
    const sellBp = bpOf(sell, gross);
    const pass = N > 0 && Math.abs(sellBp - v.targetRtpBp) <= v.rtpToleranceBp;
    return { N, merchBp, sellBp, pass, merch, sell };
  }, [outcomes, v.priceMinor, v.targetRtpBp, v.rtpToleranceBp]);

  return (
    <div className="space-y-6">
      <Header v={v} pack={pack} editable={editable} totals={totals} />
      {v.status === "REJECTED" && v.notes && <Notice tone="danger">Rejected: {v.notes}</Notice>}
      {v.status === "PAUSED" && <Notice tone="warn">Paused{v.pauseReason ? `: ${v.pauseReason}` : ""}.</Notice>}
      {isLive && <Notice>Published manifests are immutable. Outcomes and price are read-only; clone to a new version to make changes.</Notice>}

      <Workflow v={v} permissions={permissions} userId={userId} validationOk={validation.ok} />

      <OutcomesPanel v={v} outcomes={outcomes} editable={editable} totals={totals} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel as="section" aria-labelledby="validation-title">
          <SectionTitle title="Validation" sub={`Sell-back RTP target ${pct(v.targetRtpBp)} ± ${pct(v.rtpToleranceBp)}`} />
          {validation.ok ? <Notice tone="ok">All checks pass. Submit for approval when ready.</Notice> : null}
          {validation.errors.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-danger" aria-label="Validation errors">
              {validation.errors.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
          {validation.warnings.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-amber-400" aria-label="Validation warnings">
              {validation.warnings.map((e) => (
                <li key={e}>• {e}</li>
              ))}
            </ul>
          )}
        </Panel>
        <SolverPanel v={v} outcomes={outcomes} suggestions={suggestions} editable={editable} />
      </div>

      <EconomicsPanel economics={economics} />

      <PreviewPanel v={v} pack={pack} outcomes={outcomes} totals={totals} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel as="section" aria-labelledby="commitment-title">
          <SectionTitle title="Manifest commitment" sub="Hash of the canonical manifest, locked at publish" />
          {commitment ? (
            <div className="space-y-3">
              <KV items={[["Hash", <Mono key="h">{commitment.manifestHash}</Mono>], ["Committed", fmtDate(commitment.createdAt)], ["Published by", commitment.publishedBy ?? "—"]]} />
              <Collapsible title="Canonical manifest">
                <JsonBlock value={commitment.canonicalManifest} label="Canonical manifest" />
              </Collapsible>
            </div>
          ) : (
            <p className="text-sm text-ink-400">Not published yet — the commitment is created when the version is published.</p>
          )}
        </Panel>
        <Panel as="section" aria-labelledby="health-title">
          <SectionTitle title="Health check" sub="Stale valuations, unavailable inventory, liability limit" />
          {health === null ? (
            <p className="text-sm text-ink-400">Health is evaluated for published and paused versions.</p>
          ) : health.ok ? (
            <Notice tone="ok">Healthy: inventory reserved, valuations fresh, liability within limit.</Notice>
          ) : (
            <ul className="space-y-1 text-sm text-danger">
              {health.reasons.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel as="section" aria-labelledby="audit-title">
        <SectionTitle title="Audit trail" sub="Actions recorded against this version" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Reason</th>
                <th>Correlation</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="whitespace-nowrap text-xs">{fmtDate(a.createdAt)}</td>
                  <td className="text-xs">{a.actorName ?? a.actorRole ?? "system"}</td>
                  <td>
                    <Mono>{a.action}</Mono>
                  </td>
                  <td className="text-ink-300">{a.reason ?? "—"}</td>
                  <td>
                    <Mono>{shortHash(a.correlationId, 6)}</Mono>
                  </td>
                </tr>
              ))}
              {audit.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-ink-400">
                    No audit entries visible (requires audit.read).
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ---- Header -----------------------------------------------------------------------------------
function Header({ v, pack, editable, totals }: { v: VersionData["version"]; pack: VersionData["pack"]; editable: boolean; totals: { N: number; merchBp: number; sellBp: number; pass: boolean } }) {
  const { run, busy, error } = useAction();
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({ name: pack?.name ?? "", tagline: pack?.tagline ?? "", price: toDecimal(v.priceMinor), notes: v.notes ?? "", liabilityLimit: v.liabilityLimitMinor ? toDecimal(v.liabilityLimitMinor) : "", scheduledAt: toLocalInput(v.scheduledAt) });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function save(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { name: f.name, tagline: f.tagline || null, price: f.price, notes: f.notes || null, liabilityLimit: f.liabilityLimit || null, scheduledAt: toIso(f.scheduledAt) };
    await run(() => api(`/admin/packs/versions/${v.id}`, { method: "PATCH", body }), { success: "Version updated", onSuccess: () => setEdit(false) });
  }
  return (
    <Panel strong>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-extrabold text-ink-100">{pack?.name ?? "Pack"}</h1>
            <Badge tone="violet">v{v.version}</Badge>
            <StatusBadge status={v.status} />
          </div>
          {pack?.tagline && <p className="mt-1 text-sm text-ink-300">{pack.tagline}</p>}
          <div className="mt-1 text-xs text-ink-400">
            <Mono>{pack?.slug}</Mono> · target sell-back RTP {pct(v.targetRtpBp)} ± {pct(v.rtpToleranceBp)}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-4">
          <Metric label="Price" value={moneyStr(v.priceMinor)} />
          <Metric label="Openings (N)" value={`${v.remainingOpenings} / ${totals.N}`} />
          <Metric label="Merchandise RTP" value={pct(totals.merchBp)} />
          <Metric label="Sell-back RTP" value={pct(totals.sellBp)} tone={totals.pass ? "lime" : "danger"} />
        </div>
      </div>
      {v.notes && !edit && <p className="mt-3 text-sm text-ink-300">Notes: {v.notes}</p>}
      {v.scheduledAt && <p className="mt-1 text-sm text-ink-300">Scheduled: {fmtDate(v.scheduledAt)}</p>}
      {v.liabilityLimitMinor && <p className="mt-1 text-sm text-ink-300">Liability limit: {moneyStr(v.liabilityLimitMinor)}</p>}
      {editable && !edit && (
        <div className="mt-3">
          <Button tone="secondary" size="sm" className="tap" onClick={() => setEdit(true)}>
            Edit details
          </Button>
        </div>
      )}
      {edit && (
        <form onSubmit={save} className="mt-4 grid gap-3 md:grid-cols-3">
          <Field label="Name">
            <Input required minLength={2} value={f.name} onChange={set("name")} />
          </Field>
          <Field label="Tagline">
            <Input maxLength={200} value={f.tagline} onChange={set("tagline")} />
          </Field>
          <Field label="Price" hint="Decimal, e.g. 25.00">
            <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.price} onChange={set("price")} />
          </Field>
          <Field label="Liability limit" hint="Optional merchandise liability cap">
            <Input inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.liabilityLimit} onChange={set("liabilityLimit")} placeholder="Platform default" />
          </Field>
          <Field label="Scheduled at" hint="Optional; used when publishing as scheduled">
            <Input type="datetime-local" value={f.scheduledAt} onChange={set("scheduledAt")} />
          </Field>
          <div className="md:col-span-3">
            <Field label="Notes" error={error}>
              <Textarea value={f.notes} onChange={set("notes")} className="min-h-16" />
            </Field>
          </div>
          <div className="flex gap-2 md:col-span-3">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
            <Button type="button" tone="ghost" onClick={() => setEdit(false)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: "lime" | "danger" }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      <div className={cx("font-display text-lg font-bold", tone === "lime" ? "text-lime-300" : tone === "danger" ? "text-danger" : "text-ink-100")}>{value}</div>
    </div>
  );
}

// ---- Workflow ---------------------------------------------------------------------------------
function Workflow({ v, permissions, userId, validationOk }: { v: VersionData["version"]; permissions: string[]; userId: string; validationOk: boolean }) {
  const router = useRouter();
  const { run, busy, error } = useAction();
  const has = (p: string) => permissions.includes(p);
  const [mode, setMode] = useState<null | "reject" | "approve" | "pause" | "close" | "schedule">(null);
  const [reason, setReason] = useState("");
  const [when, setWhen] = useState(toLocalInput(v.scheduledAt));
  const base = `/admin/packs/versions/${v.id}`;
  const isSubmitter = v.submittedBy === userId;

  const act = (path: string, body?: unknown, success?: string) => run(() => api(`${base}/${path}`, { method: "POST", body }), { success, onSuccess: () => setMode(null) });

  const buttons: ReactNode[] = [];
  if (EDITABLE.has(v.status) && has("packs.write")) {
    buttons.push(
      <Button key="submit" onClick={() => act("submit", undefined, "Submitted for approval")} disabled={busy || !validationOk} title={validationOk ? undefined : "Fix validation errors first"}>
        Submit for approval
      </Button>,
    );
  }
  if (v.status === "PENDING_APPROVAL" && has("packs.approve")) {
    buttons.push(
      <Button key="approve" tone="secondary" onClick={() => setMode("approve")} disabled={busy || isSubmitter} title={isSubmitter ? "Separation of duties: the submitter cannot approve" : undefined}>
        Approve…
      </Button>,
      <Button key="reject" tone="danger" onClick={() => setMode("reject")} disabled={busy}>
        Reject…
      </Button>,
    );
  }
  if ((v.status === "APPROVED" || v.status === "SCHEDULED") && has("packs.publish")) {
    buttons.push(
      <Button key="publish" onClick={() => act("publish", {}, "Published — manifest locked")} disabled={busy}>
        Publish now
      </Button>,
      <Button key="schedule" tone="secondary" onClick={() => setMode("schedule")} disabled={busy}>
        Schedule…
      </Button>,
    );
  }
  if (v.status === "PUBLISHED" && has("packs.publish")) {
    buttons.push(
      <Button key="pause" tone="danger" onClick={() => setMode("pause")} disabled={busy}>
        Pause…
      </Button>,
    );
  }
  if (v.status === "PAUSED" && has("packs.publish")) {
    buttons.push(
      <Button key="resume" onClick={() => act("resume", undefined, "Resumed")} disabled={busy}>
        Resume
      </Button>,
    );
  }
  if ((v.status === "PUBLISHED" || v.status === "PAUSED" || v.status === "SCHEDULED" || v.status === "APPROVED") && has("packs.publish")) {
    buttons.push(
      <Button key="close" tone="danger" onClick={() => setMode("close")} disabled={busy}>
        Close…
      </Button>,
    );
  }
  if (has("packs.write")) {
    buttons.push(
      <Button key="clone" tone="ghost" onClick={() => run(() => api<{ result: { id: string } | null }>(`${base}/clone`, { method: "POST" }), { success: "Cloned to a new draft", refresh: false, onSuccess: (r) => r?.result && router.push(`/admin/packs/versions/${r.result.id}`) })} disabled={busy}>
        Clone to new version
      </Button>,
    );
  }

  return (
    <Panel as="section" aria-labelledby="workflow-title">
      <SectionTitle title="Workflow" sub="Draft → Pending approval → Approved → Published. Publishing needs a second person to approve (separation of duties) and locks the manifest." />
      <div className="flex flex-wrap gap-2">{buttons.length ? buttons : <p className="text-sm text-ink-400">No actions available for your role in status {v.status}.</p>}</div>
      {v.status === "PENDING_APPROVAL" && <p className="mt-2 text-xs text-ink-400">Submitted by {isSubmitter ? "you — someone else must approve" : (v.submittedBy?.slice(0, 8) ?? "—")}.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
      {mode && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (mode === "approve") void act("review", { decision: "APPROVED", reason }, "Approved");
            else if (mode === "reject") void act("review", { decision: "REJECTED", reason }, "Rejected");
            else if (mode === "pause") void act("pause", { reason }, "Paused");
            else if (mode === "close") void act("close", { reason }, "Closed — remaining inventory released");
            else if (mode === "schedule") void act("publish", { scheduledAt: toIso(when) ?? undefined }, "Scheduled");
          }}
          className="mt-4 grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end"
        >
          {mode === "schedule" ? (
            <Field label="Publish at" hint="Local time; must be in the future or it publishes immediately">
              <Input type="datetime-local" required value={when} onChange={(e) => setWhen(e.target.value)} />
            </Field>
          ) : (
            <Field label={`Reason to ${mode}`} hint="Recorded in the audit log (min 3 characters)">
              <Input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          )}
          <Button type="submit" tone={mode === "reject" || mode === "pause" || mode === "close" ? "danger" : "primary"} disabled={busy}>
            {busy ? "Working…" : `Confirm ${mode}`}
          </Button>
          <Button type="button" tone="ghost" onClick={() => setMode(null)}>
            Cancel
          </Button>
        </form>
      )}
    </Panel>
  );
}

// ---- Outcomes ---------------------------------------------------------------------------------
function OutcomesPanel({ v, outcomes, editable, totals }: { v: VersionData["version"]; outcomes: Outcome[]; editable: boolean; totals: { N: number; merchBp: number; sellBp: number; pass: boolean; merch: bigint; sell: bigint } }) {
  const { run, busy } = useAction();
  const [editing, setEditing] = useState<null | { draft: OutcomeDraft | null }>(null);
  const N = totals.N;
  const price = BigInt(v.priceMinor);
  const sumQ = outcomes.reduce((a, o) => a + o.quantityTotal, 0);

  function startEdit(o?: Outcome) {
    setEditing({ draft: o ? { id: o.id, label: o.label, tier: o.tier, skuId: o.skuId, inventoryItemId: o.inventoryItemId, quantity: o.quantityTotal, referenceValue: toDecimal(o.referenceValueMinor), sellbackOffer: toDecimal(o.sellbackOfferMinor), condition: o.condition, shippingEligible: o.shippingEligible } : null });
  }

  return (
    <Panel as="section" aria-labelledby="outcomes-title">
      <SectionTitle
        title="Outcomes"
        sub="Probability is exact: quantity ÷ total openings. EV columns are each outcome's contribution to expected value per opening."
        action={
          editable ? (
            <Button size="sm" className="tap" onClick={() => startEdit()}>
              Add outcome
            </Button>
          ) : undefined
        }
      />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Outcome</th>
              <th>Tier</th>
              <th>SKU / item</th>
              <th>Qty</th>
              <th>Probability</th>
              <th>Reference</th>
              <th>Sell-back</th>
              <th>EV merch</th>
              <th>EV sell-back</th>
              <th>Ship</th>
              {editable && (
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {outcomes.map((o, i) => {
              const q = BigInt(o.quantityTotal);
              const evM = N > 0 ? (q * BigInt(o.referenceValueMinor)) / BigInt(N) : 0n;
              const evS = N > 0 ? (q * BigInt(o.sellbackOfferMinor)) / BigInt(N) : 0n;
              return (
                <tr key={o.id}>
                  <td className="text-ink-400">{i + 1}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <ItemArt name={o.sku?.name ?? o.label} accent={o.sku?.accent ?? "violet"} imageKey={o.sku?.imageKey} size="sm" />
                      <div className="font-medium text-ink-100">{o.label}</div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={tierTone(o.tier)}>{tierLabel(o.tier)}</Badge>
                  </td>
                  <td className="text-xs text-ink-300">
                    <div>{o.sku?.sku ?? o.skuId.slice(0, 8)}</div>
                    {o.item ? (
                      <div>
                        <Mono>{o.item.itemCode}</Mono> {o.item.grader} {o.item.grade} · {o.item.status}
                      </div>
                    ) : (
                      <div>pooled</div>
                    )}
                    {o.sku?.shippingRestricted && <div className="text-amber-400">ship restricted</div>}
                  </td>
                  <td>
                    {o.quantityTotal}
                    {o.quantityRemaining !== o.quantityTotal && <span className="text-xs text-ink-400"> ({o.quantityRemaining} left)</span>}
                  </td>
                  <td>
                    <div className="whitespace-nowrap">
                      {o.quantityTotal}/{N} · {probability(o.quantityTotal, N)}
                    </div>
                    <ProbabilityBar num={o.quantityTotal} den={N} />
                  </td>
                  <td>{moneyStr(o.referenceValueMinor)}</td>
                  <td>{moneyStr(o.sellbackOfferMinor)}</td>
                  <td className="text-ink-300">{moneyStr(evM)}</td>
                  <td className="text-ink-300">{moneyStr(evS)}</td>
                  <td>{o.shippingEligible ? "Yes" : "No"}</td>
                  {editable && (
                    <td>
                      <div className="flex gap-1">
                        <Button tone="secondary" size="sm" className="tap" onClick={() => startEdit(o)}>
                          Edit
                        </Button>
                        <Button tone="danger" size="sm" className="tap" disabled={busy} onClick={() => confirm(`Remove outcome "${o.label}"?`) && run(() => api(`/admin/packs/versions/${v.id}/outcomes/${o.id}`, { method: "DELETE" }), { success: "Outcome removed" })}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
            {outcomes.length === 0 && (
              <tr>
                <td colSpan={editable ? 12 : 11} className="text-ink-400">
                  No outcomes yet.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="font-semibold">
              <td colSpan={4} className="text-ink-200">
                Totals · N = {N} · Σq = {sumQ}
              </td>
              <td>{sumQ}</td>
              <td>{N > 0 ? "100%" : "—"}</td>
              <td className="text-xs text-ink-300">Σ {moneyStr(totals.merch)}</td>
              <td className="text-xs text-ink-300">Σ {moneyStr(totals.sell)}</td>
              <td>
                <div className="text-[11px] uppercase tracking-wider text-ink-400">Merch RTP</div>
                {pct(totals.merchBp)}
              </td>
              <td>
                <div className="text-[11px] uppercase tracking-wider text-ink-400">Sell-back RTP</div>
                <span className={totals.pass ? "text-lime-300" : "text-danger"}>
                  {pct(totals.sellBp)} {totals.pass ? "PASS" : "FAIL"}
                </span>
                <div className="text-[11px] text-ink-400">
                  target {pct(v.targetRtpBp)} ± {pct(v.rtpToleranceBp)} · price {moneyStr(price)}
                </div>
              </td>
              <td colSpan={editable ? 2 : 1} />
            </tr>
          </tfoot>
        </table>
      </div>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?.draft ? "Edit outcome" : "Add outcome"} wide>
        {editing && <OutcomeForm versionId={v.id} draft={editing.draft} onDone={() => setEditing(null)} />}
      </Drawer>
    </Panel>
  );
}

// ---- Solver -----------------------------------------------------------------------------------
function SolverPanel({ v, outcomes, suggestions, editable }: { v: VersionData["version"]; outcomes: Outcome[]; suggestions: VersionData["suggestions"]; editable: boolean }) {
  const { run, busy, error } = useAction();
  async function apply(s: VersionData["suggestions"][number]) {
    if (s.outcomeIndex === undefined) return;
    const o = outcomes[s.outcomeIndex];
    if (!o) return;
    const body = {
      id: o.id,
      label: o.label,
      tier: o.tier,
      skuId: o.skuId,
      inventoryItemId: o.inventoryItemId,
      quantity: s.kind === "ADJUST_COMMON_QUANTITY" && s.newQuantity ? s.newQuantity : o.quantityTotal,
      referenceValue: s.kind === "ADJUST_COMMON_VALUE" && s.newReferenceValueMinor ? toDecimal(s.newReferenceValueMinor) : toDecimal(o.referenceValueMinor),
      sellbackOffer: s.kind === "ADJUST_COMMON_VALUE" && s.newSellbackOfferMinor ? toDecimal(s.newSellbackOfferMinor) : toDecimal(o.sellbackOfferMinor),
      condition: o.condition,
      shippingEligible: o.shippingEligible,
    };
    await run(() => api(`/admin/packs/versions/${v.id}/outcomes`, { method: "POST", body }), { success: "Suggestion applied to the draft" });
  }
  return (
    <Panel as="section" aria-labelledby="solver-title">
      <SectionTitle title="Solver" sub="Suggestions adjust the most common outcome so sell-back RTP lands on target. Applying edits the draft only; nothing is published without approval." />
      {suggestions.length === 0 && <p className="text-sm text-ink-400">Add outcomes to get suggestions.</p>}
      <ul className="space-y-3">
        {suggestions.map((s, i) => (
          <li key={i} className="rounded-xl border border-white/8 bg-white/3 p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <Badge tone={s.kind === "ALREADY_ON_TARGET" ? "lime" : s.kind === "NO_SOLUTION" ? "danger" : "cyan"}>{s.kind.replace(/_/g, " ")}</Badge>
                <p className="mt-1 text-sm text-ink-200">{describeSuggestion(s)}</p>
                {s.projected && (
                  <p className="mt-1 text-xs text-ink-400">
                    Projected: N {s.projected.totalOpenings} · merch RTP {pct(s.projected.merchandiseRtpBp)} · sell-back RTP {pct(s.projected.sellbackRtpBp)}
                  </p>
                )}
              </div>
              {editable && (s.kind === "ADJUST_COMMON_QUANTITY" || s.kind === "ADJUST_COMMON_VALUE") && (
                <Button size="sm" className="tap" tone="secondary" disabled={busy} onClick={() => apply(s)}>
                  Apply suggestion
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </Panel>
  );
}

function describeSuggestion(s: VersionData["suggestions"][number]): string {
  if (s.kind === "ADJUST_COMMON_VALUE" && s.newSellbackOfferMinor) return `${s.description.split(" to ")[0]} to ${moneyStr(s.newSellbackOfferMinor)} sell-back (reference ${moneyStr(s.newReferenceValueMinor ?? s.newSellbackOfferMinor)}).`;
  return s.description;
}

// ---- Economics --------------------------------------------------------------------------------
function EconomicsPanel({ economics }: { economics: VersionData["economics"] }) {
  return (
    <Panel as="section" aria-labelledby="economics-title">
      <SectionTitle title="Economics scenario" sub="Full sell-through of the manifest at the current price. Fees and allocations use platform configuration; acquisition uses item cost (pooled: sell-back offer as a conservative proxy)." />
      {!economics ? (
        <p className="text-sm text-ink-400">Available once validation passes.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
          <Metric label="Gross sales" value={moneyStr(economics.grossSalesMinor)} />
          <Metric label="Acquisition cost" value={moneyStr(economics.acquisitionCostMinor)} />
          <Metric label="Merch liability" value={moneyStr(economics.merchandiseLiabilityMinor)} />
          <Metric label="Sell-back liability" value={moneyStr(economics.sellbackLiabilityMinor)} />
          <Metric label="Payment fees" value={moneyStr(economics.paymentFeesMinor)} />
          <Metric label="Rewards / race / raffle" value={moneyStr(economics.rewardsAllocationMinor)} />
          <Metric label="Shipping subsidy" value={moneyStr(economics.shippingSubsidyMinor)} />
          <Metric label="Fraud reserve" value={moneyStr(economics.fraudReserveMinor)} />
          <Metric label="Contribution margin" value={moneyStr(economics.contributionMarginMinor)} tone={BigInt(economics.contributionMarginMinor) < 0n ? "danger" : undefined} />
          <Metric label="Margin (bp)" value={pct(economics.contributionMarginBp)} tone={economics.contributionMarginBp < 0 ? "danger" : undefined} />
          <Metric label="All-sell-back margin" value={moneyStr(economics.allSellbackMarginMinor)} tone={BigInt(economics.allSellbackMarginMinor) < 0n ? "danger" : undefined} />
        </div>
      )}
    </Panel>
  );
}

// ---- Preview ----------------------------------------------------------------------------------
function PreviewPanel({ v, pack, outcomes, totals }: { v: VersionData["version"]; pack: VersionData["pack"]; outcomes: Outcome[]; totals: { N: number; merchBp: number; sellBp: number } }) {
  const live = v.status === "PUBLISHED" || v.status === "PAUSED";
  return (
    <Panel as="section" aria-labelledby="preview-title">
      <SectionTitle
        title="Customer preview"
        sub={live ? "This version is live on the customer pack page." : "The customer page only renders once published; this is an in-page preview of the disclosed odds table."}
        action={
          pack ? (
            <Link href={`/packs/${pack.slug}`} className="tap inline-flex items-center text-sm text-cyan-300 hover:underline" target="_blank" rel="noreferrer">
              Preview customer page ↗
            </Link>
          ) : undefined
        }
      />
      <div className="mb-3 flex flex-wrap gap-4 text-sm text-ink-300">
        <span>
          Price <strong className="text-ink-100">{moneyStr(v.priceMinor)}</strong>
        </span>
        <span>
          Merchandise RTP <strong className="text-ink-100">{pct(totals.merchBp)}</strong>
        </span>
        <span>
          Sell-back RTP <strong className="text-ink-100">{pct(totals.sellBp)}</strong>
        </span>
        <span>
          {totals.N} openings · manifest {v.manifestHash ? <Mono>{shortHash(v.manifestHash, 8)}</Mono> : "not yet committed"}
        </span>
      </div>
      <ul className="grid gap-2 md:grid-cols-2">
        {outcomes.map((o) => (
          <li key={o.id} className="glass flex items-center gap-3 p-3">
            <ItemArt name={o.sku?.name ?? o.label} accent={o.sku?.accent ?? pack?.accent ?? "violet"} imageKey={o.sku?.imageKey} size="sm" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-ink-100">{o.label}</span>
                <Badge tone={tierTone(o.tier)}>{tierLabel(o.tier)}</Badge>
              </div>
              <div className="mt-0.5 text-xs text-ink-300">
                {o.quantityTotal}/{totals.N} · {probability(o.quantityTotal, totals.N)} · ref {moneyStr(o.referenceValueMinor)} · sell-back {moneyStr(o.sellbackOfferMinor)}
                {!o.shippingEligible || o.sku?.shippingRestricted ? " · vault only" : ""}
              </div>
              <div className="mt-1">
                <ProbabilityBar num={o.quantityTotal} den={totals.N} tone={o.tier === "GRAIL" ? "cyan" : "violet"} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      {outcomes.length === 0 && <p className="text-sm text-ink-400">Nothing to preview yet.</p>}
    </Panel>
  );
}


