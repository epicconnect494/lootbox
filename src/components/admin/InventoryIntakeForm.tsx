"use client";
import { useState, type FormEvent } from "react";
import { Button, Field, Input, Select, Textarea, Panel, SectionTitle } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { moneyStr } from "@/lib/format";
import { useAction } from "./hooks";
import { CONDITIONS, useSkus } from "./useSkus";
import { toDecimal } from "./money";

type Warehouse = { id: string; code: string; name: string };

export function InventoryIntakeForm({ warehouses }: { warehouses: Warehouse[] }) {
  const { skus, error: skuError } = useSkus();
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ skuId: "", warehouseId: "", serialNumber: "", certificationId: "", grader: "", grade: "", size: "", condition: "NEAR_MINT", acquisitionCost: "", referenceValue: "", sellbackOffer: "", valuationSource: "manual", valuationSourceRef: "", notes: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));
  const sku = skus.find((s) => s.id === f.skuId);

  function pickSku(id: string) {
    const s = skus.find((x) => x.id === id);
    setF((prev) => ({ ...prev, skuId: id, referenceValue: s ? toDecimal(s.defaultReferenceValueMinor) : prev.referenceValue, sellbackOffer: s ? toDecimal(s.defaultSellbackOfferMinor) : prev.sellbackOffer }));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { skuId: f.skuId, condition: f.condition, acquisitionCost: f.acquisitionCost, referenceValue: f.referenceValue, sellbackOffer: f.sellbackOffer, valuationSource: f.valuationSource || "manual" };
    for (const k of ["warehouseId", "serialNumber", "certificationId", "grader", "grade", "size", "valuationSourceRef", "notes"] as const) if (f[k]) body[k] = f[k];
    await run(() => api<{ item: { itemCode: string } }>("/admin/inventory", { method: "POST", body }), {
      success: "Item received into stock",
      onSuccess: () => setF((s) => ({ ...s, serialNumber: "", certificationId: "", grade: "", size: "", notes: "" })),
    });
  }

  return (
    <Panel as="section" aria-labelledby="intake-title">
      <SectionTitle title="Intake item" sub="Creates an IN_STOCK item and records its first valuation snapshot." />
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <Field label="SKU" error={skuError}>
          <Select required value={f.skuId} onChange={(e) => pickSku(e.target.value)}>
            <option value="">Select SKU…</option>
            {skus.map((s) => (
              <option key={s.id} value={s.id}>
                {s.sku} · {s.name} {s.isUnique ? "(unique)" : "(pooled)"}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Warehouse" hint="Optional; defaults to the first warehouse">
          <Select value={f.warehouseId} onChange={set("warehouseId")}>
            <option value="">Default</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} · {w.name}
              </option>
            ))}
          </Select>
        </Field>
        {sku?.shippingRestricted && (
          <p role="note" className="rounded-xl border border-amber-400/40 bg-amber-400/10 px-3 py-2 text-sm text-amber-400 md:col-span-2">
            Shipping restricted for this SKU: {sku.shippingRestrictionNote ?? "see SKU notes"}.
          </p>
        )}
        <Field label="Grader">
          <Input value={f.grader} onChange={set("grader")} placeholder="PSA / BGS / CGC" />
        </Field>
        <Field label="Grade">
          <Input value={f.grade} onChange={set("grade")} placeholder="10" />
        </Field>
        <Field label="Certification ID">
          <Input value={f.certificationId} onChange={set("certificationId")} />
        </Field>
        <Field label="Serial number">
          <Input value={f.serialNumber} onChange={set("serialNumber")} />
        </Field>
        <Field label="Size">
          <Input value={f.size} onChange={set("size")} placeholder="e.g. US 10" />
        </Field>
        <Field label="Condition">
          <Select value={f.condition} onChange={set("condition")}>
            {CONDITIONS.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Acquisition cost" hint="Decimal, e.g. 120.00">
          <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.acquisitionCost} onChange={set("acquisitionCost")} placeholder="0.00" />
        </Field>
        <Field label="Reference value" hint={sku ? `SKU default ${moneyStr(sku.defaultReferenceValueMinor)}` : undefined}>
          <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.referenceValue} onChange={set("referenceValue")} placeholder="0.00" />
        </Field>
        <Field label="Sell-back offer" hint="Must not exceed reference value">
          <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.sellbackOffer} onChange={set("sellbackOffer")} placeholder="0.00" />
        </Field>
        <Field label="Valuation source">
          <Input value={f.valuationSource} onChange={set("valuationSource")} placeholder="manual" />
        </Field>
        <Field label="Valuation source ref" hint="URL or index reference">
          <Input value={f.valuationSourceRef} onChange={set("valuationSourceRef")} />
        </Field>
        <div className="md:col-span-2">
          <Field label="Notes">
            <Textarea value={f.notes} onChange={set("notes")} className="min-h-16" />
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger md:col-span-2">
            {error}
          </p>
        )}
        <div className="md:col-span-2">
          <Button type="submit" disabled={busy || !f.skuId}>
            {busy ? "Saving…" : "Receive item"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
