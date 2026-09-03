"use client";
import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, Panel, SectionTitle } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { moneyStr } from "@/lib/format";
import { describeError, useAction } from "./hooks";
import { CONDITIONS } from "./useSkus";
import { toIso } from "./money";
import { Notice } from "./ui";
import type { InventoryRow } from "./InventoryTable";

export const JURISDICTIONS = ["DEMO", "GB", "US-NY", "CA-ON", "DE"] as const;
type Prize = { rank: number; title: string; description: string; condition: string; referenceValue: string; valueSource: string; inventoryItemId: string };

export function RaffleCreateForm() {
  const router = useRouter();
  const { run, busy, error } = useAction();
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ items: InventoryRow[] }>("/admin/inventory?status=IN_STOCK")
      .then((r) => alive && setItems(r.items))
      .catch((e) => alive && setItemsError(describeError(e)));
    return () => {
      alive = false;
    };
  }, []);

  const [f, setF] = useState({ slug: "", name: "", description: "", entryMode: "FREE", maxTickets: "1000", maxTicketsPerUser: "10", ticketPrice: "0", winnersCount: "1", amoeEnabled: "true", amoeInstructions: "", opensAt: "", closesAt: "", drawsAt: "", claimDeadlineAt: "", publicRandomnessSource: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const [juris, setJuris] = useState<string[]>([]);
  const [prizes, setPrizes] = useState<Prize[]>([{ rank: 1, title: "", description: "", condition: "", referenceValue: "", valueSource: "", inventoryItemId: "" }]);
  const updatePrize = (i: number, patch: Partial<Prize>) => setPrizes((ps) => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  function pickItem(i: number, id: string) {
    const it = items.find((x) => x.id === id);
    updatePrize(i, { inventoryItemId: id, title: prizes[i].title || (it ? `${it.sku.name}${it.grade ? ` ${it.grader ?? ""} ${it.grade}` : ""}`.trim() : ""), condition: it ? it.condition : prizes[i].condition });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const dates = { opensAt: toIso(f.opensAt), closesAt: toIso(f.closesAt), drawsAt: toIso(f.drawsAt), claimDeadlineAt: toIso(f.claimDeadlineAt) };
    if (Object.values(dates).some((d) => !d)) return;
    const body: Record<string, unknown> = {
      slug: f.slug,
      name: f.name,
      entryMode: f.entryMode,
      maxTickets: Number(f.maxTickets),
      maxTicketsPerUser: Number(f.maxTicketsPerUser),
      ticketPrice: f.entryMode === "PURCHASE_LINKED" ? f.ticketPrice : "0",
      winnersCount: Number(f.winnersCount),
      amoeEnabled: f.amoeEnabled === "true",
      allowedJurisdictions: juris,
      ...dates,
      publicRandomnessSource: f.publicRandomnessSource,
      prizes: prizes.map((p) => ({ rank: p.rank, title: p.title, referenceValue: p.referenceValue, ...(p.description ? { description: p.description } : {}), ...(p.condition ? { condition: p.condition } : {}), ...(p.valueSource ? { valueSource: p.valueSource } : {}), inventoryItemId: p.inventoryItemId || null })),
    };
    if (f.description) body.description = f.description;
    if (f.amoeInstructions) body.amoeInstructions = f.amoeInstructions;
    await run(() => api<{ raffle: { id: string } }>("/admin/raffles", { method: "POST", body }), { success: "Raffle created — seed hash committed", refresh: false, onSuccess: (r) => router.push(`/admin/raffles/${r.raffle.id}`) });
  }

  return (
    <Panel as="section">
      <SectionTitle title="Create raffle" sub="The server-seed hash is generated and committed at creation, long before close; the draw combines it with independent public randomness you declare at draw time." />
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Slug">
            <Input required pattern="^[a-z0-9-]{3,64}$" value={f.slug} onChange={set("slug")} />
          </Field>
          <Field label="Name">
            <Input required minLength={2} value={f.name} onChange={set("name")} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Description">
              <Textarea value={f.description} onChange={set("description")} className="min-h-16" />
            </Field>
          </div>
          <Field label="Entry mode" hint="Purchase-linked raffles must keep the free entry route enabled">
            <Select value={f.entryMode} onChange={set("entryMode")}>
              <option value="FREE">Free</option>
              <option value="PROMOTIONAL">Promotional</option>
              <option value="PURCHASE_LINKED">Purchase-linked</option>
            </Select>
          </Field>
          <Field label="Ticket price" hint="Only purchase-linked raffles may carry a price">
            <Input inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.entryMode === "PURCHASE_LINKED" ? f.ticketPrice : "0"} disabled={f.entryMode !== "PURCHASE_LINKED"} onChange={set("ticketPrice")} />
          </Field>
          <Field label="Max tickets">
            <Input type="number" min={1} max={1000000} required value={f.maxTickets} onChange={set("maxTickets")} />
          </Field>
          <Field label="Max tickets per user">
            <Input type="number" min={1} max={1000} required value={f.maxTicketsPerUser} onChange={set("maxTicketsPerUser")} />
          </Field>
          <Field label="Winners">
            <Input type="number" min={1} max={100} required value={f.winnersCount} onChange={set("winnersCount")} />
          </Field>
          <Field label="Free entry route (AMOE)">
            <Select value={f.amoeEnabled} onChange={set("amoeEnabled")}>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </Select>
          </Field>
          <div className="md:col-span-2">
            <Field label="AMOE instructions" hint="Shown to customers; how to enter for free">
              <Textarea value={f.amoeInstructions} onChange={set("amoeInstructions")} className="min-h-16" />
            </Field>
          </div>
        </div>

        <fieldset className="glass p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-300">Jurisdictions</legend>
          <p className="mb-2 text-xs text-ink-400">Leave all unchecked to allow every enabled jurisdiction.</p>
          <div className="flex flex-wrap gap-2">
            {JURISDICTIONS.map((j) => (
              <label key={j} className="tap inline-flex cursor-pointer items-center gap-2 rounded-xl border border-white/10 px-3 text-sm">
                <input type="checkbox" checked={juris.includes(j)} onChange={(e) => setJuris((s) => (e.target.checked ? [...s, j] : s.filter((x) => x !== j)))} />
                {j}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="glass grid gap-3 p-4 md:grid-cols-2">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-300">Schedule</legend>
          <Field label="Opens at">
            <Input type="datetime-local" required value={f.opensAt} onChange={set("opensAt")} />
          </Field>
          <Field label="Closes at">
            <Input type="datetime-local" required value={f.closesAt} onChange={set("closesAt")} />
          </Field>
          <Field label="Draws at" hint="On or after close">
            <Input type="datetime-local" required value={f.drawsAt} onChange={set("drawsAt")} />
          </Field>
          <Field label="Claim deadline">
            <Input type="datetime-local" required value={f.claimDeadlineAt} onChange={set("claimDeadlineAt")} />
          </Field>
          <div className="md:col-span-2">
            <Field label="Public randomness source" hint="Declared in advance, e.g. a named lottery draw or blockchain block hash published after close">
              <Input required minLength={3} maxLength={300} value={f.publicRandomnessSource} onChange={set("publicRandomnessSource")} />
            </Field>
          </div>
        </fieldset>

        <fieldset className="glass space-y-3 p-4">
          <legend className="px-1 text-xs font-semibold uppercase tracking-wider text-ink-300">Prizes</legend>
          {itemsError && <Notice tone="danger">{itemsError}</Notice>}
          {prizes.map((p, i) => (
            <div key={i} className="grid gap-3 rounded-xl border border-white/8 p-3 md:grid-cols-3">
              <div className="text-sm font-semibold text-ink-200 md:col-span-3">Rank #{p.rank}</div>
              <Field label="Inventory item" hint="Optional; reserves an IN_STOCK item">
                <Select value={p.inventoryItemId} onChange={(e) => pickItem(i, e.target.value)}>
                  <option value="">None (described prize)</option>
                  {items.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.itemCode} · {it.sku.name} · {moneyStr(it.acquisitionCostMinor)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Title">
                <Input required value={p.title} onChange={(e) => updatePrize(i, { title: e.target.value })} />
              </Field>
              <Field label="Reference value">
                <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={p.referenceValue} onChange={(e) => updatePrize(i, { referenceValue: e.target.value })} placeholder="0.00" />
              </Field>
              <Field label="Condition">
                <Select value={p.condition} onChange={(e) => updatePrize(i, { condition: e.target.value })}>
                  <option value="">—</option>
                  {CONDITIONS.map((c) => (
                    <option key={c} value={c}>
                      {c.replace(/_/g, " ")}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Value source">
                <Input value={p.valueSource} onChange={(e) => updatePrize(i, { valueSource: e.target.value })} placeholder="market index / appraisal" />
              </Field>
              <Field label="Description">
                <Input value={p.description} onChange={(e) => updatePrize(i, { description: e.target.value })} />
              </Field>
              {prizes.length > 1 && (
                <div className="md:col-span-3">
                  <Button type="button" tone="ghost" size="sm" className="tap" onClick={() => setPrizes((ps) => ps.filter((_, j) => j !== i).map((x, j) => ({ ...x, rank: j + 1 })))}>
                    Remove prize
                  </Button>
                </div>
              )}
            </div>
          ))}
          <Button type="button" tone="ghost" size="sm" className="tap" onClick={() => setPrizes((ps) => [...ps, { rank: ps.length + 1, title: "", description: "", condition: "", referenceValue: "", valueSource: "", inventoryItemId: "" }])}>
            Add prize
          </Button>
        </fieldset>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? "Creating…" : "Create raffle & commit seed hash"}
        </Button>
      </form>
    </Panel>
  );
}


