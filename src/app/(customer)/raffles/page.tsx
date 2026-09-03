import Link from "next/link";
import type { Metadata } from "next";
import { Ticket } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { Badge, Empty, SectionTitle, cx } from "@/components/ui/primitives";
import { entryModeLabel, raffleStatusTone } from "@/components/events/raffleMeta";
import { listRaffles } from "@/domain/raffles";
import { fmtDate, moneyStr } from "@/lib/format";
import { viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Raffles" };

type Row = Awaited<ReturnType<typeof listRaffles>>[number];

function RaffleCard({ r }: { r: Row }) {
  const pct = Math.min(100, (r.issued / Math.max(1, r.maxTickets)) * 100);
  return (
    <article className={cx("glass flex gap-4 p-4 transition hover:bg-white/[0.04]", r.status === "OPEN" && "ring-iris")}>
      <ItemArt name={r.prize?.title ?? r.name} accent="cyan" size="md" label={r.prize ? `Prize: ${r.prize.title}` : r.name} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={raffleStatusTone(r.status)}>{r.status.toLowerCase()}</Badge>
          <Badge tone="neutral">{entryModeLabel(r.entryMode)}</Badge>
        </div>
        <h3 className="font-display mt-1 truncate text-lg font-bold">
          <Link href={`/raffles/${r.id}`} className="hover:underline">
            {r.name}
          </Link>
        </h3>
        {r.prize && (
          <p className="truncate text-sm text-ink-300">
            {r.prize.title} · ref. value <span className="font-mono text-ink-100">{moneyStr(r.prize.referenceValueMinor, r.prize.currency)}</span>
            {r.winnersCount > 1 && <span className="text-ink-400"> · {r.winnersCount} winners</span>}
          </p>
        )}
        <div className="mt-2 flex items-center gap-2 text-xs text-ink-400">
          <Ticket size={12} aria-hidden />
          <span>
            <span className="font-mono text-ink-200">{r.issued.toLocaleString("en-US")}</span> / {r.maxTickets.toLocaleString("en-US")} tickets
          </span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/8" aria-hidden>
          <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${pct}%` }} />
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-3 text-xs">
          <div>
            <dt className="text-ink-500">{r.status === "UPCOMING" ? "Opens" : "Closes"}</dt>
            <dd className="text-ink-300">{fmtDate(r.status === "UPCOMING" ? r.opensAt : r.closesAt)}</dd>
          </div>
          <div>
            <dt className="text-ink-500">Draw</dt>
            <dd className="text-ink-300">{fmtDate(r.drawsAt)}</dd>
          </div>
        </dl>
      </div>
    </article>
  );
}

function Section({ title, sub, items }: { title: string; sub: string; items: Row[] }) {
  return (
    <section aria-label={title}>
      <SectionTitle title={title} sub={sub} />
      {items.length === 0 ? (
        <p className="text-sm text-ink-500">Nothing here right now.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {items.map((r) => (
            <RaffleCard key={r.id} r={r} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function RafflesPage() {
  const { db } = await viewer();
  const rows = await listRaffles(db);
  const active = rows.filter((r) => r.status === "OPEN");
  const upcoming = rows.filter((r) => r.status === "UPCOMING").sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime());
  const completed = rows.filter((r) => r.status === "CLOSED" || r.status === "DRAWN" || r.status === "CLAIMED");
  return (
    <div className="space-y-7">
      <div>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">Raffles</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-400">Server seed hash committed at creation, ticket manifest published at close, winners drawn from independent public randomness. Every draw can be recomputed in your browser. No purchase necessary where required.</p>
      </div>
      {rows.length === 0 ? (
        <Empty title="No raffles yet" body="Upcoming raffles will be listed here with their prize, entry rules and draw time." />
      ) : (
        <>
          <Section title="Active" sub="Accepting entries now" items={active} />
          <Section title="Upcoming" sub="Entries open at the listed time" items={upcoming} />
          <Section title="Completed" sub="Closed, drawn or claimed" items={completed} />
        </>
      )}
    </div>
  );
}
