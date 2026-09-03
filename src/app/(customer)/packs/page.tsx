import { asc } from "drizzle-orm";
import { CatalogFilters } from "@/components/customer/CatalogFilters";
import { PackCard } from "@/components/customer/PackCard";
import { Empty, ButtonLink } from "@/components/ui/primitives";
import { category } from "@/db/schema";
import { listCatalog, type CatalogFilter } from "@/domain/packs";
import { parseDecimalToMinor } from "@/lib/money";
import { viewer } from "@/lib/server/data";
import { serialize } from "@/components/customer/serialize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Packs" };

const SORTS = new Set(["new", "price_asc", "price_desc", "value", "ending"]);

function first(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v) ?? "";
}

export default async function PacksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const values = { q: first(sp.q).slice(0, 80), category: first(sp.category), sort: first(sp.sort), maxPrice: first(sp.maxPrice) };
  let maxPriceMinor: bigint | undefined;
  try {
    maxPriceMinor = values.maxPrice ? parseDecimalToMinor(values.maxPrice) : undefined;
  } catch {
    maxPriceMinor = undefined;
  }
  const filter: CatalogFilter = {
    q: values.q || undefined,
    category: values.category || undefined,
    sort: SORTS.has(values.sort) ? (values.sort as CatalogFilter["sort"]) : undefined,
    maxPriceMinor,
  };
  const { db } = await viewer();
  const [items, categories] = await Promise.all([listCatalog(db, filter), db.select({ slug: category.slug, name: category.name }).from(category).orderBy(asc(category.sortOrder))]);
  const results = serialize(items);

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink-100 md:text-3xl">Packs</h1>
        <p className="mt-1 text-sm text-ink-300">Every pack discloses its full manifest, exact odds and both RTP figures before you open.</p>
      </header>
      <CatalogFilters values={values} categories={categories} />
      <p className="text-sm text-ink-400" aria-live="polite">
        {results.length} pack{results.length === 1 ? "" : "s"}
        {values.q ? ` matching “${values.q}”` : ""}
      </p>
      {results.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {results.map((item) => (
            <PackCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <Empty
          title="No packs match"
          body="Try a broader search or clear the filters."
          action={
            <ButtonLink href="/packs" tone="secondary">
              Clear filters
            </ButtonLink>
          }
        />
      )}
    </div>
  );
}
