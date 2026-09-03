import Link from "next/link";
import { ArrowRight, ShieldCheck, Swords, Ticket, Trophy } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { PackCard, RemainingBar, packStatus } from "@/components/customer/PackCard";
import { RaceCountdown } from "@/components/customer/RaceCountdown";
import { Rail } from "@/components/customer/Rail";
import type { CatalogItem } from "@/components/customer/types";
import { Badge, ButtonLink, Panel } from "@/components/ui/primitives";
import { listBattles } from "@/domain/battles";
import { listCatalog } from "@/domain/packs";
import { currentRace } from "@/domain/races";
import { listRaffles } from "@/domain/raffles";
import { moneyStr, pct } from "@/lib/format";
import { viewer } from "@/lib/server/data";
import { serialize } from "@/components/customer/serialize";

export const dynamic = "force-dynamic";
export const metadata = { title: "Discover" };

export default async function DiscoverPage() {
  const { db, userId } = await viewer();
  const [race, live, fresh, cheap, value, tcg, sneakers, watches, gaming, ending, battles, raffles] = await Promise.all([
    currentRace(db),
    listCatalog(db, { tag: "live" }),
    listCatalog(db, { tag: "new" }),
    listCatalog(db, { maxPriceMinor: 1000n }),
    listCatalog(db, { sort: "value", limit: 8 }),
    listCatalog(db, { category: "tcg" }),
    listCatalog(db, { category: "sneakers" }),
    listCatalog(db, { category: "watches" }),
    listCatalog(db, { category: "gaming-tech" }),
    listCatalog(db, { sort: "ending", limit: 8 }),
    listBattles(db, "live", userId),
    listRaffles(db),
  ]);
  const featured = serialize((live.find((p) => p.version.status === "PUBLISHED" && p.version.remainingOpenings > 0) ?? live[0] ?? cheap[0]) ?? null);
  const rails: Array<{ title: string; sub?: string; href: string; items: CatalogItem[] }> = [
    { title: "Live drops", sub: "Finite manifests, opening now", href: "/drops", items: serialize(live) },
    { title: "New", href: "/packs?sort=new", items: serialize(fresh) },
    { title: "Under $10", href: "/packs?maxPrice=10", items: serialize(cheap) },
    { title: "Best value", sub: "Highest merchandise RTP first", href: "/packs?sort=value", items: serialize(value) },
    { title: "TCG", href: "/packs?category=tcg", items: serialize(tcg) },
    { title: "Sneakers", href: "/packs?category=sneakers", items: serialize(sneakers) },
    { title: "Watches", href: "/packs?category=watches", items: serialize(watches) },
    { title: "Gaming & Tech", href: "/packs?category=gaming-tech", items: serialize(gaming) },
    { title: "Ending soon", sub: "Lowest remaining share first", href: "/packs?sort=ending", items: serialize(ending) },
  ];
  const openRaffles = raffles.filter((r) => r.status === "OPEN").length;
  const raceTarget = race ? (race.status === "ACTIVE" ? race.endsAt : race.startsAt) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Hero */}
      <section aria-label="Featured" className="grid gap-4 md:grid-cols-5">
        <Panel strong className="ring-iris relative md:col-span-3">
          {featured ? <FeaturedPack item={featured} /> : <div className="text-ink-300">No packs are live right now. Check back soon.</div>}
        </Panel>
        <Panel className="flex flex-col justify-between gap-4 md:col-span-2">
          <div>
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-ink-400">
              <Trophy size={14} aria-hidden /> Weekly race
            </div>
            <h2 className="font-display mt-1 text-xl font-bold text-ink-100">{race ? race.name : "No race scheduled"}</h2>
            <p className="mt-1 text-sm text-ink-300">{race ? (race.status === "ACTIVE" ? "Points for every opening and battle entry. Free entry route available." : "Starts soon. Points for every opening and battle entry.") : "Races are weekly leaderboards with a published scoring policy."}</p>
          </div>
          {raceTarget && <RaceCountdown to={raceTarget.toISOString()} label={race?.status === "ACTIVE" ? "Ends in" : "Starts in"} />}
          <ButtonLink href="/race" tone="secondary" className="w-full">
            View standings <ArrowRight size={16} aria-hidden />
          </ButtonLink>
        </Panel>
      </section>

      {/* Teasers */}
      <section aria-label="More ways to play" className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Teaser href="/battles" icon={<Swords size={18} aria-hidden />} title="Battles" body={battles.length ? `${battles.length} open now` : "Open a pack head-to-head"} />
        <Teaser href="/raffles" icon={<Ticket size={18} aria-hidden />} title="Raffles" body={openRaffles ? `${openRaffles} open · free entry` : "Committed seeds, public draws"} />
        <Teaser href="/race" icon={<Trophy size={18} aria-hidden />} title="Weekly race" body={race ? (race.status === "ACTIVE" ? "Live standings" : "Starting soon") : "Published scoring policy"} />
        <Teaser href="/fairness" icon={<ShieldCheck size={18} aria-hidden />} title="Provably fair" body="Verify any opening yourself" />
      </section>

      {rails.map((r) => (
        <Rail key={r.title} title={r.title} sub={r.sub} href={r.href}>
          {r.items.map((item) => (
            <PackCard key={item.id} item={item} className="h-full" />
          ))}
        </Rail>
      ))}

      <p className="text-center text-xs text-ink-500">Packs are finite. Odds never change per person. Sell-back RTP and merchandise RTP are disclosed on every pack.</p>
    </div>
  );
}

function FeaturedPack({ item }: { item: CatalogItem }) {
  const v = item.version;
  const status = packStatus(v);
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <Link href={`/packs/${item.slug}`} className="shrink-0 self-center rounded-2xl" aria-label={`Open ${item.name}`}>
        <ItemArt name={item.name} accent={item.accent} imageKey={item.heroImageKey} size="xl" />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone="violet">{item.category.name}</Badge>
        </div>
        <h1 className="font-display mt-2 text-2xl font-extrabold text-ink-100 md:text-3xl">{item.name}</h1>
        {item.tagline && <p className="mt-1 text-sm text-ink-300">{item.tagline}</p>}
        <div className="mt-3 flex items-baseline gap-3">
          <span className="font-display text-2xl font-extrabold text-ink-100">{moneyStr(v.priceMinor, v.currency)}</span>
          <span className="text-sm text-ink-300">
            <span className="font-mono text-ink-100">{v.remainingOpenings}</span> / {v.totalOpenings} left
          </span>
        </div>
        <RemainingBar remaining={v.remainingOpenings} total={v.totalOpenings} className="mt-2" />
        <p className="mt-2 text-xs text-ink-300">
          Sell-back RTP <span className="font-mono text-ink-200">{pct(v.sellbackRtpBp)}</span> · Merch RTP <span className="font-mono text-ink-200">{pct(v.merchandiseRtpBp)}</span>
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <ButtonLink href={`/packs/${item.slug}`}>View odds & open</ButtonLink>
          <ButtonLink href="/drops" tone="ghost">
            All drops
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}

function Teaser({ href, icon, title, body }: { href: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link href={href} className="glass tap flex items-center gap-3 px-4 py-3 transition hover:bg-white/8">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/6 text-cyan-300">{icon}</span>
      <span className="min-w-0">
        <span className="font-display block text-sm font-bold text-ink-100">{title}</span>
        <span className="block truncate text-xs text-ink-300">{body}</span>
      </span>
      <ArrowRight size={16} aria-hidden className="ml-auto text-ink-400" />
    </Link>
  );
}
