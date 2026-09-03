"use client";
import { useState, type FormEvent } from "react";
import { Button, Field, Input, Select, Panel, SectionTitle } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { useAction } from "./hooks";
import { ACCENTS, useSkus } from "./useSkus";

export function SkuForm() {
  const { categories, error: catError } = useSkus();
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ sku: "", categoryId: "", name: "", brand: "", isUnique: "true", pooledQuantity: "0", referenceValue: "", sellbackOffer: "", accent: "violet", shippingRestricted: "false", shippingRestrictionNote: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { sku: f.sku, categoryId: f.categoryId, name: f.name, isUnique: f.isUnique === "true", pooledQuantity: Number(f.pooledQuantity || 0), referenceValue: f.referenceValue, sellbackOffer: f.sellbackOffer, accent: f.accent, shippingRestricted: f.shippingRestricted === "true" };
    if (f.brand) body.brand = f.brand;
    if (f.shippingRestrictionNote) body.shippingRestrictionNote = f.shippingRestrictionNote;
    await run(() => api("/admin/skus", { method: "POST", body }), { success: "SKU created", onSuccess: () => setF((s) => ({ ...s, sku: "", name: "", brand: "" })) });
  }

  return (
    <Panel as="section">
      <SectionTitle title="Create SKU" sub="A SKU is the product kind; unique items reference it, pooled SKUs hold fungible stock." />
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <Field label="SKU code">
          <Input required minLength={2} value={f.sku} onChange={set("sku")} placeholder="PSA10-CHARIZARD-4" />
        </Field>
        <Field label="Category" error={catError}>
          <Select required value={f.categoryId} onChange={set("categoryId")}>
            <option value="">Select…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Name">
          <Input required minLength={2} value={f.name} onChange={set("name")} />
        </Field>
        <Field label="Brand">
          <Input value={f.brand} onChange={set("brand")} />
        </Field>
        <Field label="Kind">
          <Select value={f.isUnique} onChange={set("isUnique")}>
            <option value="true">Unique items (graded / serialized)</option>
            <option value="false">Pooled stock (fungible)</option>
          </Select>
        </Field>
        <Field label="Pooled quantity" hint="Only for pooled SKUs">
          <Input type="number" min={0} step={1} value={f.pooledQuantity} onChange={set("pooledQuantity")} disabled={f.isUnique === "true"} />
        </Field>
        <Field label="Default reference value">
          <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.referenceValue} onChange={set("referenceValue")} placeholder="0.00" />
        </Field>
        <Field label="Default sell-back offer">
          <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.sellbackOffer} onChange={set("sellbackOffer")} placeholder="0.00" />
        </Field>
        <Field label="Accent">
          <Select value={f.accent} onChange={set("accent")}>
            {ACCENTS.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Shipping">
          <Select value={f.shippingRestricted} onChange={set("shippingRestricted")}>
            <option value="false">Ships normally</option>
            <option value="true">Shipping restricted</option>
          </Select>
        </Field>
        {f.shippingRestricted === "true" && (
          <div className="md:col-span-2">
            <Field label="Restriction note" hint="Shown to customers on the pack page">
              <Input value={f.shippingRestrictionNote} onChange={set("shippingRestrictionNote")} maxLength={300} />
            </Field>
          </div>
        )}
        {error && (
          <p role="alert" className="text-sm text-danger md:col-span-2">
            {error}
          </p>
        )}
        <div className="md:col-span-2">
          <Button type="submit" tone="secondary" disabled={busy}>
            {busy ? "Saving…" : "Create SKU"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
