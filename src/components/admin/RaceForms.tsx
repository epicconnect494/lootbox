"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { raceScoringPolicy } from "@/db/schema";
import { Button, Field, Input, Select, Panel, SectionTitle, Mono } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { useAction } from "./hooks";
import { toIso } from "./money";
import type { Json } from "./serialize";

export type PolicyRow = Json<typeof raceScoringPolicy.$inferSelect>;
type Prize = { rank: number; amount: string; label: string };

/** Descending ladder: geometric interpolation from top to floor across n ranks, 2-decimal strings. */
function ladder(n: number, top: number, floor: number): Prize[] {
  const count = Math.max(1, Math.min(100, Math.floor(n)));
  const t = Math.max(0, top);
  const f = Math.max(0, Math.min(floor, t));
  return Array.from({ length: count }, (_, i) => {
    const ratio = count === 1 ? 1 : i / (count - 1);
    const amt = f > 0 && t > 0 ? t * Math.pow(f / t, ratio) : t * (1 - ratio) + f * ratio;
    return { rank: i + 1, amount: amt.toFixed(2), label: i === 0 ? "Champion" : "" };
  });
}

export function RaceCreateForm({ policies }: { policies: PolicyRow[] }) {
  const router = useRouter();
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ slug: "", name: "", timezone: "UTC", startsAt: "", scoringPolicyId: policies[0]?.id ?? "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const [preset, setPreset] = useState({ n: "10", top: "500.00", floor: "10.00" });
  const [prizes, setPrizes] = useState<Prize[]>(ladder(10, 500, 10));
  const total = prizes.reduce((a, p) => a + (Number(p.amount) || 0), 0);

  function updatePrize(i: number, patch: Partial<Prize>) {
    setPrizes((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const startsAt = toIso(f.startsAt);
    if (!startsAt) return;
    const body = { slug: f.slug, name: f.name, timezone: f.timezone, startsAt, scoringPolicyId: f.scoringPolicyId, prizes: prizes.map((p) => ({ rank: p.rank, amount: Number(p.amount).toFixed(2), ...(p.label ? { label: p.label } : {}) })) };
    await run(() => api<{ race: { id: string } }>("/admin/races", { method: "POST", body }), { success: "Race created", refresh: false, onSuccess: (r) => router.push(`/admin/races/${r.race.id}`) });
  }

  return (
    <Panel as="section">
      <SectionTitle title="Create race" sub="Weekly race: ends exactly seven days after the start. Prizes are paid from the prizes account at settlement." />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Slug">
            <Input required pattern="^[a-z0-9-]{3,64}$" value={f.slug} onChange={set("slug")} placeholder="weekly-race-2026-w36" />
          </Field>
          <Field label="Name">
            <Input required minLength={2} value={f.name} onChange={set("name")} />
          </Field>
          <Field label="Timezone" hint="Display timezone for the window">
            <Input value={f.timezone} onChange={set("timezone")} placeholder="UTC" />
          </Field>
          <Field label="Starts at" hint="Ends automatically 7 days later">
            <Input type="datetime-local" required value={f.startsAt} onChange={set("startsAt")} />
          </Field>
          <Field label="Scoring policy">
            <Select required value={f.scoringPolicyId} onChange={set("scoringPolicyId")}>
              <option value="">Select…</option>
              {policies.map((p) => (
                <option key={p.id} value={p.id}>
                  v{p.version} · {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="glass p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-300">Prize ladder</legend>
          <div className="mb-3 grid gap-3 md:grid-cols-[auto_auto_auto_auto] md:items-end">
            <Field label="Positions (1–100)">
              <Input type="number" min={1} max={100} value={preset.n} onChange={(e) => setPreset((s) => ({ ...s, n: e.target.value }))} className="w-28" />
            </Field>
            <Field label="Top prize">
              <Input inputMode="decimal" value={preset.top} onChange={(e) => setPreset((s) => ({ ...s, top: e.target.value }))} className="w-32" />
            </Field>
            <Field label="Last prize">
              <Input inputMode="decimal" value={preset.floor} onChange={(e) => setPreset((s) => ({ ...s, floor: e.target.value }))} className="w-32" />
            </Field>
            <Button type="button" tone="secondary" onClick={() => setPrizes(ladder(Number(preset.n), Number(preset.top), Number(preset.floor)))}>
              Fill preset
            </Button>
          </div>
          <div className="table-wrap max-h-80 overflow-y-auto">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Amount</th>
                  <th>Label</th>
                  <th>
                    <span className="sr-only">Remove</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {prizes.map((p, i) => (
                  <tr key={p.rank}>
                    <td className="font-semibold">#{p.rank}</td>
                    <td>
                      <Input aria-label={`Rank ${p.rank} amount`} inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" required value={p.amount} onChange={(e) => updatePrize(i, { amount: e.target.value })} className="w-32" />
                    </td>
                    <td>
                      <Input aria-label={`Rank ${p.rank} label`} maxLength={80} value={p.label} onChange={(e) => updatePrize(i, { label: e.target.value })} />
                    </td>
                    <td>
                      <Button type="button" tone="ghost" size="sm" className="tap" onClick={() => setPrizes((ps) => ps.filter((_, j) => j !== i).map((x, j) => ({ ...x, rank: j + 1 })))}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-ink-300">
            <span>
              {prizes.length} positions · total pool <strong className="text-ink-100">${total.toFixed(2)}</strong>
            </span>
            <Button type="button" tone="ghost" size="sm" className="tap" disabled={prizes.length >= 100} onClick={() => setPrizes((ps) => [...ps, { rank: ps.length + 1, amount: "0.00", label: "" }])}>
              Add position
            </Button>
          </div>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !f.scoringPolicyId}>
          {busy ? "Creating…" : "Create race"}
        </Button>
      </form>
    </Panel>
  );
}

export function ScoringPolicyForm({ latest }: { latest: PolicyRow | null }) {
  const { run, busy, error } = useAction();
  const r = latest?.rules;
  const [f, setF] = useState({ name: latest ? `${latest.name} (rev)` : "Standard scoring", pointsPerUnitSpent: String(r?.pointsPerUnitSpent ?? 10), pointsPerOpening: String(r?.pointsPerOpening ?? 5), pointsPerBattleEntry: String(r?.pointsPerBattleEntry ?? 5), pointsPerPromoUnit: String(r?.pointsPerPromoUnit ?? 10), maxPointsPerEvent: String(r?.maxPointsPerEvent ?? 2000), excludedKinds: (r?.excludedKinds ?? ["VOID", "REFUND", "CHARGEBACK", "FRAUD", "BONUS_ABUSE"]).join(", ") });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    const body = { name: f.name, rules: { pointsPerUnitSpent: Number(f.pointsPerUnitSpent), pointsPerOpening: Number(f.pointsPerOpening), pointsPerBattleEntry: Number(f.pointsPerBattleEntry), pointsPerPromoUnit: Number(f.pointsPerPromoUnit), maxPointsPerEvent: Number(f.maxPointsPerEvent), tiePolicy: "EARLIEST_QUALIFYING_EVENT_WINS", excludedKinds: f.excludedKinds.split(",").map((s) => s.trim()).filter(Boolean) } };
    await run(() => api("/admin/races/policies", { method: "POST", body }), { success: "Scoring policy version created" });
  }
  return (
    <Panel as="section">
      <SectionTitle title="New scoring policy version" sub={latest ? `Defaults from v${latest.version} · hash ${latest.policyHash.slice(0, 12)}…` : "No policy exists yet"} />
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="Name">
            <Input required minLength={2} value={f.name} onChange={set("name")} />
          </Field>
        </div>
        <Field label="Points per unit spent">
          <Input type="number" min={0} max={1000} required value={f.pointsPerUnitSpent} onChange={set("pointsPerUnitSpent")} />
        </Field>
        <Field label="Points per opening">
          <Input type="number" min={0} max={1000} required value={f.pointsPerOpening} onChange={set("pointsPerOpening")} />
        </Field>
        <Field label="Points per battle entry">
          <Input type="number" min={0} max={1000} required value={f.pointsPerBattleEntry} onChange={set("pointsPerBattleEntry")} />
        </Field>
        <Field label="Points per promo unit" hint="No-purchase entries must not score below paid entries where required">
          <Input type="number" min={0} max={1000} required value={f.pointsPerPromoUnit} onChange={set("pointsPerPromoUnit")} />
        </Field>
        <Field label="Max points per event" hint="Cap to discourage loss-chasing">
          <Input type="number" min={1} max={1000000} required value={f.maxPointsPerEvent} onChange={set("maxPointsPerEvent")} />
        </Field>
        <Field label="Excluded kinds" hint="Comma-separated">
          <Input value={f.excludedKinds} onChange={set("excludedKinds")} />
        </Field>
        <p className="text-xs text-ink-400 md:col-span-2">
          Tie policy: <Mono>EARLIEST_QUALIFYING_EVENT_WINS</Mono> (fixed).
        </p>
        {error && (
          <p role="alert" className="text-sm text-danger md:col-span-2">
            {error}
          </p>
        )}
        <div className="md:col-span-2">
          <Button type="submit" tone="secondary" disabled={busy}>
            {busy ? "Saving…" : "Create policy version"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
