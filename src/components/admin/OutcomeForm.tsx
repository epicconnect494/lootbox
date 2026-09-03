"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { moneyStr } from "@/lib/format";
import { describeError, useAction } from "./hooks";
import { CONDITIONS, useSkus } from "./useSkus";
import { toDecimal } from "./money";
import type { InventoryRow } from "./InventoryTable";

export type OutcomeDraft = { id?: string; label: string; tier: string; skuId: string; inventoryItemId: string | null; quantity: number; referenceValue: string; sellbackOffer: string; condition: string; shippingEligible: boolean };

const TIERS = ["GRAIL", "RARE", "UNCOMMON", "COMMON"];

export function OutcomeForm({ versionId, draft, onDone }: { versionId: string; draft: OutcomeDraft | null; onDone: () => void }) {
  const { skus, error: skuError } = useSkus();
  const { run, busy, error } = useAction();
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [f, setF] = useState<OutcomeDraft>(draft ?? { label: "", tier: "COMMON", skuId: "", inventoryItemId: null, quantity: 1, referenceValue: "", sellbackOffer: "", condition: "NEAR_MINT", shippingEligible: true });
  const set = <K extends keyof OutcomeDraft>(k: K, v: OutcomeDraft[K]) => setF((s) => ({ ...s, [k]: v }));

  useEffect(() => {
    let alive = true;
    api<{ items: InventoryRow[] }>("/admin/inventory?status=IN_STOCK")
      .then((r) => alive && setItems(r.items))
      .catch((e) => alive && setItemsError(describeError(e)));
    return () => {
      alive = false;
    };
  }, []);

  const sku = skus.find((s) => s.id === f.skuId);
  const skuItems = useMemo(() => items.filter((i) => i.skuId === f.skuId), [items, f.skuId]);
  const unique = !!f.inventoryItemId;

  function pickSku(id: string) {
    const s = skus.find((x) => x.id === id);
    setF((prev) => ({ ...prev, skuId: id, inventoryItemId: null, quantity: prev.quantity || 1, label: prev.label || s?.name || "", referenceValue: s ? toDecimal(s.defaultReferenceValueMinor) : prev.referenceValue, sellbackOffer: s ? toDecimal(s.defaultSellbackOfferMinor) : prev.sellbackOffer }));
  }
  function pickItem(id: string) {
    const it = items.find((x) => x.id === id);
    setF((prev) => ({ ...prev, inventoryItemId: id || null, quantity: id ? 1 : prev.quantity, condition: it ? it.condition : prev.condition, label: prev.label || (it ? `${it.sku.name}${it.grade ? ` ${it.grader ?? ""} ${it.grade}` : ""}`.trim() : prev.label) }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { label: f.label, tier: f.tier, skuId: f.skuId, inventoryItemId: f.inventoryItemId, quantity: unique ? 1 : Number(f.quantity), referenceValue: f.referenceValue, sellbackOffer: f.sellbackOffer, condition: f.condition, shippingEligible: f.shippingEligible };
    if (f.id) body.id = f.id;
    await run(() => api(`/admin/packs/versions/${versionId}/outcomes`, { method: "POST", body }), { success: f.id ? "Outcome updated" : "Outcome added", onSuccess: onDone });
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Field label="SKU" error={skuError}>
        <Select required value={f.skuId} onChange={(e) => pickSku(e.target.value)}>
          <option value="">Select SKU…</option>
          {skus.map((s) => (
            <option key={s.id} value={s.id}>
              {s.sku} · {s.name} {s.isUnique ? "(unique)" : `(pooled, ${s.pooledQuantity - s.pooledReserved} free)`}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Unique inventory item" hint={sku?.isUnique ? "IN_STOCK items of this SKU; quantity is forced to 1" : "Leave empty for pooled quantity"} error={itemsError}>
        <Select value={f.inventoryItemId ?? ""} onChange={(e) => pickItem(e.target.value)} disabled={!f.skuId}>
          <option value="">Pooled (no specific item)</option>
          {draft?.inventoryItemId && !skuItems.some((i) => i.id === draft.inventoryItemId) && <option value={draft.inventoryItemId}>Current item ({draft.inventoryItemId.slice(0, 8)}…)</option>}
          {skuItems.map((i) => (
            <option key={i.id} value={i.id}>
              {i.itemCode} · {i.grader ?? ""} {i.grade ?? ""} {i.certificationId ? `#${i.certificationId}` : ""} · cost {moneyStr(i.acquisitionCostMinor)}
            </option>
          ))}
        </Select>
      </Field>
      <div className="md:col-span-2">
        <Field label="Label" hint="Shown to customers in the odds table">
          <Input required minLength={1} maxLength={160} value={f.label} onChange={(e) => set("label", e.target.value)} />
        </Field>
      </div>
      <Field label="Tier">
        <Select value={f.tier} onChange={(e) => set("tier", e.target.value)}>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Quantity" hint={unique ? "Unique item: fixed at 1" : "Number of openings that yield this outcome"}>
        <Input type="number" min={1} step={1} required value={unique ? 1 : f.quantity} disabled={unique} onChange={(e) => set("quantity", Math.max(1, Number(e.target.value)))} />
      </Field>
      <Field label="Reference value" hint={sku ? `SKU default ${moneyStr(sku.defaultReferenceValueMinor)}` : undefined}>
        <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.referenceValue} onChange={(e) => set("referenceValue", e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Sell-back offer" hint="Disclosed offer; must not exceed reference value">
        <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.sellbackOffer} onChange={(e) => set("sellbackOffer", e.target.value)} placeholder="0.00" />
      </Field>
      <Field label="Condition">
        <Select value={f.condition} onChange={(e) => set("condition", e.target.value)}>
          {CONDITIONS.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, " ")}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Shipping" hint={sku?.shippingRestricted ? `SKU is shipping-restricted: ${sku.shippingRestrictionNote ?? ""}` : undefined}>
        <Select value={f.shippingEligible ? "yes" : "no"} onChange={(e) => set("shippingEligible", e.target.value === "yes")}>
          <option value="yes">Eligible to ship</option>
          <option value="no">Vault only</option>
        </Select>
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger md:col-span-2">
          {error}
        </p>
      )}
      <div className="flex gap-2 md:col-span-2">
        <Button type="submit" disabled={busy || !f.skuId}>
          {busy ? "Saving…" : f.id ? "Save outcome" : "Add outcome"}
        </Button>
        <Button type="button" tone="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
