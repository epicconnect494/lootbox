import { and, asc, eq, isNull } from "drizzle-orm";
import { CalendarClock } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { PackCard } from "@/components/customer/PackCard";
import { Badge, Empty, Panel, SectionTitle } from "@/components/ui/primitives";
import { category, pack, packVersion } from "@/db/schema";
import { listCatalog } from "@/domain/packs";
import { fmtDate, moneyStr } from "@/lib/format";
import { viewer } from "@/lib/server/data";
import { serialize } from "@/components/customer/serialize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Drops" };

export default async function DropsPage() {
  const { db } = await viewer();
  const [live, ending, scheduled] = await Promise.all([
    listCatalog(db, { tag: "live" }),
    listCatalog(db, { tag: "ending-soon" }),
    db
      .select({ pack, version: packVersion, category })
      .from(packVersion)
      .innerJoin(pack, eq(pack.id, packVersion.packId))
      .innerJoin(category, eq(category.id, pack.categoryId))
      .where(and(eq(packVersion.status, "SCHEDULED"), isNull(pack.deletedAt)))
      .orderBy(asc(packVersion.scheduledAt)),
  ]);
  const liveItems = serialize(live);
  const endingItems = serialize(ending.filter((e) => !live.some((l) => l.id === e.id)));

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink-100 md:text-3xl">Drops</h1>
        <p className="mt-1 text-sm text-ink-300">Every drop is a finite manifest. Quantities and odds are committed before the first opening and never change.</p>
      </header>

      <section aria-labelledby="live-title">
        <SectionTitle title="Live now" sub={`${liveItems.length} pack${liveItems.length === 1 ? "" : "s"} opening`} />
        {liveItems.length ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {liveItems.map((item) => (
              <PackCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <Empty title="Nothing live right now" body="New drops are announced here first." />
        )}
        <h2 id="live-title" className="sr-only">
          Live now
        </h2>
      </section>

      {endingItems.length > 0 && (
        <section aria-label="Ending soon">
          <SectionTitle title="Ending soon" sub="Low remaining inventory" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {endingItems.map((item) => (
              <PackCard key={item.id} item={item} />
            ))}
          </div>
        </section>
      )}

      <section aria-label="Upcoming">
        <SectionTitle title="Upcoming" sub="Scheduled drops with a locked manifest" />
        {scheduled.length ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {scheduled.map(({ pack: p, version: v, category: c }) => (
              <li key={v.id} className="glass flex items-center gap-3 p-3">
                <ItemArt name={p.name} accent={p.accent} imageKey={p.heroImageKey} size="sm" label="" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-display truncate font-bold text-ink-100">{p.name}</span>
                    <Badge tone="cyan">Scheduled</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-300">
                    {c.name} · {moneyStr(v.priceMinor, v.currency)} · {v.totalOpenings.toLocaleString("en-US")} openings
                  </div>
                  <div className="mt-1 flex items-center gap-1 text-xs text-ink-400">
                    <CalendarClock size={12} aria-hidden /> {v.scheduledAt ? fmtDate(v.scheduledAt) : "Date to be announced"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <Empty title="No scheduled drops" body="When a drop is scheduled its manifest hash is published here before it opens." />
        )}
      </section>

      <Panel as="section" aria-labelledby="how-title">
        <h2 id="how-title" className="font-display text-lg font-bold text-ink-100">
          How drops work
        </h2>
        <ol className="mt-3 grid gap-3 text-sm text-ink-300 md:grid-cols-3">
          <li className="glass p-3">
            <div className="font-semibold text-ink-100">1. Finite manifest</div>
            Each drop lists every item and its exact quantity. When the last one is opened, the drop is sold out. Nothing is added mid-run.
          </li>
          <li className="glass p-3">
            <div className="font-semibold text-ink-100">2. Immutable odds</div>
            Odds are quantity ÷ remaining openings. They are the same for everyone and change only as items leave the manifest. We publish a hash of the manifest at commit time.
          </li>
          <li className="glass p-3">
            <div className="font-semibold text-ink-100">3. Provably fair result</div>
            Every opening is drawn from a committed server seed, your client seed and a nonce, then signed. You can recompute it on the Fairness page.
          </li>
        </ol>
      </Panel>
    </div>
  );
}
