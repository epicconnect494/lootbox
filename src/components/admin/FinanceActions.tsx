"use client";
import { useState, type FormEvent } from "react";
import { Badge, Button, Field, Input, Panel, SectionTitle } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { useAction } from "./hooks";
import { JsonBlock, Notice } from "./ui";

type Reconcile = { ok: boolean; problems: Array<{ check: string; detail: unknown }>; checkedAt: string };
const CHECKS = ["ledger.balanced", "ledger.global_zero", "ledger.materialized_balance", "ledger.user_non_negative", "vault.single_owner", "vault.owner_matches_item", "pack.remaining_matches_outcomes", "pack.openings_match_consumption", "opening.has_receipt", "battle.pull_count", "race.settlement_totals"];

export function ReconcilePanel() {
  const { run, busy, error } = useAction();
  const [result, setResult] = useState<Reconcile | null>(null);
  return (
    <Panel as="section">
      <SectionTitle
        title="Reconciliation"
        sub="Runs every ledger, vault, manifest and settlement invariant. The run itself is audited."
        action={
          <Button tone="secondary" disabled={busy} onClick={() => run(() => api<Reconcile>("/admin/finance/reconcile", { method: "POST" }), { refresh: false, onSuccess: setResult })}>
            {busy ? "Checking…" : "Run reconciliation"}
          </Button>
        }
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {result && (
        <div className="space-y-3" aria-live="polite">
          {result.ok ? <Notice tone="ok">All invariants hold · checked {fmtDate(result.checkedAt)}</Notice> : <Notice tone="danger">{result.problems.length} invariant{result.problems.length === 1 ? "" : "s"} failed · checked {fmtDate(result.checkedAt)}</Notice>}
          <ul className="grid gap-2 md:grid-cols-2">
            {CHECKS.map((c) => {
              const p = result.problems.find((x) => x.check === c);
              return (
                <li key={c} className="rounded-xl border border-white/8 bg-white/3 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-xs text-ink-200">{c}</code>
                    {p ? <Badge tone="danger">FAIL</Badge> : <Badge tone="lime">OK</Badge>}
                  </div>
                  {p && (
                    <div className="mt-2">
                      <JsonBlock value={p.detail} label={`${c} details`} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Panel>
  );
}

export function RefundForm() {
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ userId: "", paymentId: "", amount: "", reason: "", referenceType: "", referenceId: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { userId: f.userId, amount: f.amount, reason: f.reason, paymentId: f.paymentId || null };
    if (f.referenceType) body.referenceType = f.referenceType;
    if (f.referenceId) body.referenceId = f.referenceId;
    await run(() => api("/admin/finance/refunds", { method: "POST", body }), { success: "Refund posted", onSuccess: () => setF({ userId: "", paymentId: "", amount: "", reason: "", referenceType: "", referenceId: "" }) });
  }
  return (
    <Panel as="section">
      <SectionTitle title="Issue refund" sub="Credits the customer balance from the refunds account; reverses race points for the referenced payment." />
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <Field label="User ID">
          <Input required value={f.userId} onChange={set("userId")} placeholder="uuid" />
        </Field>
        <Field label="Payment ID" hint="Optional">
          <Input value={f.paymentId} onChange={set("paymentId")} placeholder="uuid" />
        </Field>
        <Field label="Amount">
          <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.amount} onChange={set("amount")} placeholder="0.00" />
        </Field>
        <Field label="Reason">
          <Input required minLength={3} value={f.reason} onChange={set("reason")} />
        </Field>
        <Field label="Reference type" hint="Optional, e.g. opening">
          <Input maxLength={48} value={f.referenceType} onChange={set("referenceType")} />
        </Field>
        <Field label="Reference ID" error={error}>
          <Input value={f.referenceId} onChange={set("referenceId")} placeholder="uuid" />
        </Field>
        <div className="md:col-span-2">
          <Button type="submit" tone="secondary" disabled={busy}>
            {busy ? "Posting…" : "Post refund"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}

export function ChargebackForm() {
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ paymentId: "", amount: "", providerRef: "", reasonCode: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { paymentId: f.paymentId, amount: f.amount };
    if (f.providerRef) body.providerRef = f.providerRef;
    if (f.reasonCode) body.reasonCode = f.reasonCode;
    await run(() => api("/admin/finance/chargebacks", { method: "POST", body }), { success: "Chargeback recorded", onSuccess: () => setF({ paymentId: "", amount: "", providerRef: "", reasonCode: "" }) });
  }
  return (
    <Panel as="section">
      <SectionTitle title="Record chargeback" sub="Debits the customer (unrecoverable remainder is booked as loss), raises a HIGH risk event and excludes race points." />
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <Field label="Payment ID">
          <Input required value={f.paymentId} onChange={set("paymentId")} placeholder="uuid" />
        </Field>
        <Field label="Amount">
          <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.amount} onChange={set("amount")} placeholder="0.00" />
        </Field>
        <Field label="Provider reference">
          <Input maxLength={160} value={f.providerRef} onChange={set("providerRef")} />
        </Field>
        <Field label="Reason code" error={error}>
          <Input maxLength={32} value={f.reasonCode} onChange={set("reasonCode")} placeholder="10.4" />
        </Field>
        <div className="md:col-span-2">
          <Button type="submit" tone="danger" disabled={busy}>
            {busy ? "Recording…" : "Record chargeback"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
