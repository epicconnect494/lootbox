"use client";
/** Plain GET form so filtering works without JavaScript; selects auto-submit when JS is available. */
import { useRef } from "react";
import { Search } from "lucide-react";
import { Button, ButtonLink, Field, Input, Select } from "@/components/ui/primitives";

export interface CatalogFilterValues {
  q: string;
  category: string;
  sort: string;
  maxPrice: string;
}

const SORTS = [
  { value: "", label: "Newest" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "value", label: "Best value (merch RTP)" },
  { value: "ending", label: "Ending soon" },
];

export function CatalogFilters({ values, categories }: { values: CatalogFilterValues; categories: Array<{ slug: string; name: string }> }) {
  const formRef = useRef<HTMLFormElement>(null);
  const submit = () => formRef.current?.requestSubmit();
  const active = values.q || values.category || values.sort || values.maxPrice;
  return (
    <form ref={formRef} method="get" action="/packs" role="search" aria-label="Filter packs" className="glass grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto] lg:items-end">
      <Field label="Search" htmlFor="q">
        <div className="relative">
          <Input id="q" name="q" type="search" defaultValue={values.q} placeholder="Pack name, tag or tagline" maxLength={80} className="pr-10" />
          <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ink-400" />
        </div>
      </Field>
      <Field label="Category" htmlFor="category">
        <Select id="category" name="category" defaultValue={values.category} onChange={submit}>
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Sort" htmlFor="sort">
        <Select id="sort" name="sort" defaultValue={values.sort} onChange={submit}>
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Max price" htmlFor="maxPrice">
        <Select id="maxPrice" name="maxPrice" defaultValue={values.maxPrice} onChange={submit}>
          <option value="">Any price</option>
          <option value="5">Up to $5</option>
          <option value="10">Up to $10</option>
          <option value="25">Up to $25</option>
          <option value="50">Up to $50</option>
          <option value="100">Up to $100</option>
        </Select>
      </Field>
      <div className="flex gap-2">
        <Button type="submit" tone="secondary" className="flex-1 lg:flex-none">
          Apply
        </Button>
        {active && (
          <ButtonLink href="/packs" tone="ghost">
            Clear
          </ButtonLink>
        )}
      </div>
    </form>
  );
}
