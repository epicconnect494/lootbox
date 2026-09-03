import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";
import { BattleCard, type BattleListItem } from "@/components/events/BattleCard";
import { ButtonLink, Empty, cx } from "@/components/ui/primitives";
import { listBattles, MODE_RULES } from "@/domain/battles";
import { json, viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Battles" };

const TABS: Array<{ key: "live" | "history" | "mine"; label: string }> = [
  { key: "live", label: "Live & upcoming" },
  { key: "history", label: "History" },
  { key: "mine", label: "Mine" },
];

export default async function BattlesPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const sp = await searchParams;
  const status = sp.status === "history" || sp.status === "mine" ? sp.status : "live";
  const { db, session, userId } = await viewer();
  const items: BattleListItem[] = status === "mine" && !session ? [] : (json(await listBattles(db, status, userId)) as unknown as BattleListItem[]);
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold md:text-3xl">Battles</h1>
          <p className="mt-1 max-w-xl text-sm text-ink-400">Every player opens the same ordered pack sequence. Pulls are settled server-side and signed before the reveal plays; the animation never decides anything.</p>
        </div>
        <ButtonLink href="/battles/create" tone="primary">
          <Plus size={16} aria-hidden /> Create battle
        </ButtonLink>
      </div>

      <nav aria-label="Battle lists" className="glass flex gap-1 p-1">
        {TABS.map((t) => (
          <Link key={t.key} href={`/battles?status=${t.key}`} aria-current={status === t.key ? "page" : undefined} className={cx("tap flex flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold transition", status === t.key ? "bg-white/10 text-ink-100" : "text-ink-300 hover:bg-white/5")}>
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="grid gap-2 text-xs text-ink-400 sm:grid-cols-2 lg:grid-cols-4">
        {(Object.keys(MODE_RULES) as Array<keyof typeof MODE_RULES>).map((m) => (
          <div key={m} className={cx("rounded-xl border px-3 py-2", m === "CRAZY" ? "border-crazy-500/40 text-crazy-400" : "border-white/8")}>
            <span className={cx("font-semibold", m === "CRAZY" ? "text-crazy-400" : "text-ink-200")}>{MODE_RULES[m].title}</span> · {MODE_RULES[m].banner}
          </div>
        ))}
      </div>

      {status === "mine" && !session ? (
        <Empty title="Sign in to see your battles" body="Your seats, results and receipts are tied to your account." action={<ButtonLink href="/login?next=/battles?status=mine">Sign in</ButtonLink>} />
      ) : items.length === 0 ? (
        <Empty title={status === "live" ? "No open battles right now" : status === "history" ? "No settled battles yet" : "You have not joined a battle yet"} body={status === "live" ? "Create one and share the link, or check back soon." : undefined} action={status !== "history" ? <ButtonLink href="/battles/create">Create battle</ButtonLink> : undefined} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((b) => (
            <BattleCard key={b.id} b={b} rules={MODE_RULES} viewerUserId={userId} />
          ))}
        </div>
      )}
    </div>
  );
}
