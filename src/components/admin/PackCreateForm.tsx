"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select, Textarea, Panel, SectionTitle } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { useAction } from "./hooks";
import { ACCENTS, useSkus } from "./useSkus";

export function PackCreateForm() {
  const router = useRouter();
  const { categories, error: catError } = useSkus();
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ slug: "", name: "", tagline: "", description: "", categoryId: "", price: "", kind: "FINITE", accent: "violet", tags: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((s) => ({ ...s, [k]: e.target.value }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { slug: f.slug, name: f.name, categoryId: f.categoryId, price: f.price, kind: f.kind, accent: f.accent, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 12) };
    if (f.tagline) body.tagline = f.tagline;
    if (f.description) body.description = f.description;
    await run(() => api<{ pack: { id: string }; version: { id: string } }>("/admin/packs", { method: "POST", body }), {
      success: "Draft created",
      refresh: false,
      onSuccess: (r) => router.push(`/admin/packs/versions/${r.version.id}`),
    });
  }

  return (
    <Panel as="section">
      <SectionTitle title="New draft" sub="Creates the pack and its first draft version. Outcomes and economics are edited in the version editor." />
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <Field label="Slug" hint="lowercase letters, digits, dashes">
          <Input required pattern="^[a-z0-9-]{3,96}$" value={f.slug} onChange={set("slug")} placeholder="vintage-grail-vault" />
        </Field>
        <Field label="Name">
          <Input required minLength={2} value={f.name} onChange={set("name")} />
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
        <Field label="Price" hint="Decimal, e.g. 25.00">
          <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={f.price} onChange={set("price")} placeholder="25.00" />
        </Field>
        <Field label="Kind">
          <Select value={f.kind} onChange={set("kind")}>
            <option value="FINITE">Finite manifest</option>
            <option value="POOLED">Pooled</option>
          </Select>
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
        <Field label="Tagline">
          <Input maxLength={200} value={f.tagline} onChange={set("tagline")} />
        </Field>
        <Field label="Tags" hint="Comma-separated, up to 12">
          <Input value={f.tags} onChange={set("tags")} placeholder="tcg, graded, vintage" />
        </Field>
        <div className="md:col-span-2">
          <Field label="Description">
            <Textarea value={f.description} onChange={set("description")} maxLength={4000} />
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger md:col-span-2">
            {error}
          </p>
        )}
        <div className="md:col-span-2">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create draft"}
          </Button>
        </div>
      </form>
    </Panel>
  );
}
