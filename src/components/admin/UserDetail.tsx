"use client";
import { useState, type FormEvent } from "react";
import type { userDetail } from "@/domain/admin";
import { Badge, Button, Field, Input, Mono, Panel, SectionTitle, Select } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDate, moneyStr } from "@/lib/format";
import { useAction } from "./hooks";
import { KV, Notice, StatusBadge } from "./ui";
import { RiskEventsPanel } from "./RiskEventsPanel";
import type { Json } from "./serialize";

export type UserDetailData = Json<Awaited<ReturnType<typeof userDetail>>>;
const ROLE_KEYS = ["SUPPORT", "RISK", "CATALOG_MANAGER", "FINANCE", "SUPER_ADMIN"];
const REGIONS = ["", "DEMO", "GB", "US-NY", "CA-ON", "DE"];

export function UserDetail({ data, permissions, roles, selfId }: { data: UserDetailData; permissions: string[]; roles: string[]; selfId: string }) {
  const u = data.user;
  const has = (p: string) => permissions.includes(p);
  const isSuper = roles.includes("SUPER_ADMIN");
  const canWrite = has("users.write");
  const base = `/admin/users/${u.id}`;

  const patch = useAction();
  const [pf, setPf] = useState({ status: u.status, jurisdictionCode: u.jurisdictionCode ?? "", riskScore: String(u.riskScore), linkedAccountGroup: u.linkedAccountGroup ?? "", reason: "" });
  async function savePatch(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { reason: pf.reason };
    if (pf.status !== u.status) body.status = pf.status;
    if (pf.jurisdictionCode !== (u.jurisdictionCode ?? "")) body.jurisdictionCode = pf.jurisdictionCode || null;
    if (Number(pf.riskScore) !== u.riskScore) body.riskScore = Number(pf.riskScore);
    if (pf.linkedAccountGroup !== (u.linkedAccountGroup ?? "")) body.linkedAccountGroup = pf.linkedAccountGroup || null;
    await patch.run(() => api(base, { method: "PATCH", body }), { success: "User updated", onSuccess: () => setPf((s) => ({ ...s, reason: "" })) });
  }

  const roleAction = useAction();
  const [rf, setRf] = useState<{ roles: string[]; reason: string }>({ roles: data.roles.filter((r) => r !== "CUSTOMER"), reason: "" });
  async function saveRoles(e: FormEvent) {
    e.preventDefault();
    await roleAction.run(() => api(base, { method: "PATCH", body: { roles: rf.roles, reason: rf.reason } }), { success: "Roles updated", onSuccess: () => setRf((s) => ({ ...s, reason: "" })) });
  }

  const verify = useAction();
  const [vReason, setVReason] = useState<Record<string, string>>({});
  const exclusion = useAction();
  const [xf, setXf] = useState({ days: "30", indefinite: false, reason: "" });

  return (
    <div className="space-y-6">
      <Panel strong>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-extrabold">{u.displayName}</h1>
              <StatusBadge status={u.status} />
              {u.isBot && <Badge tone="amber">House bot</Badge>}
              {data.roles.filter((r) => r !== "CUSTOMER").map((r) => (
                <Badge key={r} tone="violet">
                  {r}
                </Badge>
              ))}
            </div>
            <div className="mt-1 text-sm text-ink-300">
              {u.email} · <Mono>{u.id}</Mono>
            </div>
          </div>
          <KV
            items={[
              ["Region", u.jurisdictionCode ?? "—"],
              ["Risk score", String(u.riskScore)],
              ["Linked group", u.linkedAccountGroup ? <Mono key="g">{u.linkedAccountGroup.slice(0, 8)}</Mono> : "—"],
              ["Timezone", u.timezone],
              ["Email verified", fmtDate(u.emailVerifiedAt)],
              ["Last login", fmtDate(u.lastLoginAt)],
              ["Joined", fmtDate(u.createdAt)],
            ]}
          />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel as="section">
          <SectionTitle title="Balances" />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Currency</th>
                  <th>Balance</th>
                </tr>
              </thead>
              <tbody>
                {data.accounts.map((a) => (
                  <tr key={a.id}>
                    <td>{a.kind.replace(/_/g, " ")}</td>
                    <td>{a.currency}</td>
                    <td className="font-display font-bold">{moneyStr(a.balanceMinor, a.currency)}</td>
                  </tr>
                ))}
                {data.accounts.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-ink-400">
                      No wallet accounts.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {data.linked.length > 0 && (
            <div className="mt-4">
              <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Linked accounts</div>
              <ul className="space-y-1 text-sm">
                {data.linked.map((l) => (
                  <li key={l.id}>
                    <a href={`/admin/users/${l.id}`} className="text-cyan-300 hover:underline">
                      {l.displayName}
                    </a>{" "}
                    <span className="text-ink-400">{l.email}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>

        {canWrite && (
          <Panel as="section">
            <SectionTitle title="Edit account" sub="Every change requires a reason and is audited. Suspending revokes sessions." />
            <form onSubmit={savePatch} className="grid gap-3 md:grid-cols-2">
              <Field label="Status">
                <Select value={pf.status} onChange={(e) => setPf((s) => ({ ...s, status: e.target.value as typeof u.status }))}>
                  {["ACTIVE", "SUSPENDED", "CLOSED"].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Region">
                <Select value={pf.jurisdictionCode} onChange={(e) => setPf((s) => ({ ...s, jurisdictionCode: e.target.value }))}>
                  {REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r || "— none —"}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Risk score (0–100)">
                <Input type="number" min={0} max={100} value={pf.riskScore} onChange={(e) => setPf((s) => ({ ...s, riskScore: e.target.value }))} />
              </Field>
              <Field label="Linked account group" hint="UUID shared by linked accounts; blank to unlink">
                <Input value={pf.linkedAccountGroup} onChange={(e) => setPf((s) => ({ ...s, linkedAccountGroup: e.target.value }))} placeholder="uuid" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Reason" error={patch.error}>
                  <Input required minLength={3} value={pf.reason} onChange={(e) => setPf((s) => ({ ...s, reason: e.target.value }))} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" tone="secondary" disabled={patch.busy}>
                  {patch.busy ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Panel>
        )}

        {isSuper && (
          <Panel as="section">
            <SectionTitle title="Roles" sub="Super admin only. CUSTOMER is always kept. You cannot change your own roles." />
            {u.id === selfId ? (
              <Notice tone="warn">This is your own account; role changes are blocked.</Notice>
            ) : (
              <form onSubmit={saveRoles} className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {ROLE_KEYS.map((r) => (
                    <label key={r} className="tap inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 text-sm">
                      <input type="checkbox" checked={rf.roles.includes(r)} onChange={(e) => setRf((s) => ({ ...s, roles: e.target.checked ? [...s.roles, r] : s.roles.filter((x) => x !== r) }))} />
                      {r}
                    </label>
                  ))}
                </div>
                <Field label="Reason" error={roleAction.error}>
                  <Input required minLength={3} value={rf.reason} onChange={(e) => setRf((s) => ({ ...s, reason: e.target.value }))} />
                </Field>
                <Button type="submit" tone="secondary" disabled={roleAction.busy}>
                  {roleAction.busy ? "Saving…" : "Save roles"}
                </Button>
              </form>
            )}
          </Panel>
        )}

        {has("risk.write") && (
          <Panel as="section">
            <SectionTitle title="Operator exclusion" sub="Blocks play for the period and revokes all sessions. Indefinite when no duration is set." />
            <form
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                void exclusion.run(() => api(`${base}/exclusions`, { method: "POST", body: { days: xf.indefinite ? null : Number(xf.days), reason: xf.reason } }), { success: "Exclusion applied" });
              }}
              className="grid gap-3 md:grid-cols-2"
            >
              <Field label="Days">
                <Input type="number" min={1} max={3650} value={xf.days} disabled={xf.indefinite} onChange={(e) => setXf((s) => ({ ...s, days: e.target.value }))} />
              </Field>
              <label className="tap flex items-center gap-2 self-end text-sm">
                <input type="checkbox" checked={xf.indefinite} onChange={(e) => setXf((s) => ({ ...s, indefinite: e.target.checked }))} /> Indefinite
              </label>
              <div className="md:col-span-2">
                <Field label="Reason" error={exclusion.error}>
                  <Input required minLength={3} value={xf.reason} onChange={(e) => setXf((s) => ({ ...s, reason: e.target.value }))} />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Button type="submit" tone="danger" disabled={exclusion.busy}>
                  {exclusion.busy ? "Applying…" : "Apply exclusion"}
                </Button>
              </div>
            </form>
          </Panel>
        )}
      </div>

      <Panel as="section">
        <SectionTitle title="Verifications" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Status</th>
                <th>Provider</th>
                <th>Submitted</th>
                <th>Expires</th>
                <th>Reason</th>
                {canWrite && (
                  <th>
                    <span className="sr-only">Review</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {data.verifications.map((v) => (
                <tr key={v.id}>
                  <td>{v.type.replace(/_/g, " ")}</td>
                  <td>{v.status === "APPROVED" ? <Badge tone="lime">Approved</Badge> : <StatusBadge status={v.status} />}</td>
                  <td className="text-xs">
                    {v.provider}
                    {v.providerRef ? ` · ${v.providerRef}` : ""}
                  </td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(v.createdAt)}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(v.expiresAt)}</td>
                  <td className="text-xs text-ink-300">{v.reason ?? "—"}</td>
                  {canWrite && (
                    <td>
                      {v.status === "PENDING" && (
                        <div className="flex flex-wrap items-end gap-2">
                          <Input aria-label="Review reason" placeholder="Reason" minLength={3} value={vReason[v.id] ?? ""} onChange={(e) => setVReason((s) => ({ ...s, [v.id]: e.target.value }))} className="w-44" />
                          <Button size="sm" className="tap" tone="lime" disabled={verify.busy || (vReason[v.id] ?? "").length < 3} onClick={() => verify.run(() => api(`${base}/verifications/${v.id}`, { method: "POST", body: { status: "APPROVED", reason: vReason[v.id] } }), { success: "Verification approved" })}>
                            Approve
                          </Button>
                          <Button size="sm" className="tap" tone="danger" disabled={verify.busy || (vReason[v.id] ?? "").length < 3} onClick={() => verify.run(() => api(`${base}/verifications/${v.id}`, { method: "POST", body: { status: "REJECTED", reason: vReason[v.id] } }), { success: "Verification rejected" })}>
                            Reject
                          </Button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
              {data.verifications.length === 0 && (
                <tr>
                  <td colSpan={canWrite ? 7 : 6} className="text-ink-400">
                    No verifications submitted.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {verify.error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {verify.error}
          </p>
        )}
      </Panel>

      <Panel as="section">
        <SectionTitle title="Risk events" />
        <RiskEventsPanel rows={data.risks} permissions={permissions} defaultUserId={u.id} compact />
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel as="section">
          <SectionTitle title="Openings" sub="Most recent 50" />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Price</th>
                  <th>Reference</th>
                  <th>Sell-back</th>
                </tr>
              </thead>
              <tbody>
                {data.openings.map((o) => (
                  <tr key={o.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDate(o.createdAt)}</td>
                    <td>{o.source}</td>
                    <td>
                      <StatusBadge status={o.status} />
                    </td>
                    <td>{moneyStr(o.priceMinor)}</td>
                    <td>{moneyStr(o.referenceValueMinor)}</td>
                    <td>{moneyStr(o.sellbackOfferMinor)}</td>
                  </tr>
                ))}
                {data.openings.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-ink-400">
                      No openings.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel as="section">
          <SectionTitle title="Vault holdings" sub="Active" />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>Acquired</th>
                  <th>Via</th>
                  <th>Item</th>
                  <th>Reference</th>
                  <th>Sell-back</th>
                </tr>
              </thead>
              <tbody>
                {data.holdings.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDate(h.createdAt)}</td>
                    <td>{h.acquiredVia.replace(/_/g, " ")}</td>
                    <td className="text-xs">{h.inventoryItemId.slice(0, 8)}</td>
                    <td>{moneyStr(h.referenceValueMinor)}</td>
                    <td>{moneyStr(h.sellbackOfferMinor)}</td>
                  </tr>
                ))}
                {data.holdings.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-ink-400">
                      Vault is empty.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <Panel as="section">
        <SectionTitle title="Payments" sub="Most recent 50 · IDs are needed for refunds and chargebacks in Finance" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Payment ID</th>
                <th>Provider</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Fee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap text-xs">{fmtDate(p.createdAt)}</td>
                  <td>
                    <Mono>{p.id}</Mono>
                  </td>
                  <td className="text-xs">
                    {p.provider}
                    {p.providerRef ? ` · ${p.providerRef}` : ""}
                  </td>
                  <td>{p.method}</td>
                  <td>{moneyStr(p.amountMinor, p.currency)}</td>
                  <td>{moneyStr(p.feeMinor, p.currency)}</td>
                  <td>
                    <StatusBadge status={p.status} />
                    {p.failureReason && <div className="text-xs text-danger">{p.failureReason}</div>}
                  </td>
                </tr>
              ))}
              {data.payments.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-ink-400">
                    No payments.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel as="section">
          <SectionTitle title="Refunds" />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.refunds.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDate(r.createdAt)}</td>
                    <td>{moneyStr(r.amountMinor, r.currency)}</td>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="text-xs text-ink-300">{r.reason}</td>
                  </tr>
                ))}
                {data.refunds.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-ink-400">
                      None.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel as="section">
          <SectionTitle title="Chargebacks" />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Reason code</th>
                </tr>
              </thead>
              <tbody>
                {data.chargebacks.map((c) => (
                  <tr key={c.id}>
                    <td className="whitespace-nowrap text-xs">{fmtDate(c.createdAt)}</td>
                    <td>{moneyStr(c.amountMinor, c.currency)}</td>
                    <td>
                      <StatusBadge status={c.status === "LOST" ? "LOST_CB" : c.status} />
                    </td>
                    <td className="text-xs text-ink-300">{c.reasonCode ?? "—"}</td>
                  </tr>
                ))}
                {data.chargebacks.length === 0 && (
                  <tr>
                    <td colSpan={4} className="text-ink-400">
                      None.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
