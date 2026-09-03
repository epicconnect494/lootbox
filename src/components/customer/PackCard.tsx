import Link from "next/link";
import { ItemArt } from "@/components/art/ItemArt";
import { Badge, cx } from "@/components/ui/primitives";
import { moneyStr, pct } from "@/lib/format";
import type { CatalogItem } from "./types";

export function packStatus(v: { status: string; remainingOpenings: number }): { label: "Live" | "Paused" | "Sold out"; tone: "lime" | "amber" | "neutral" } {
  if (v.remainingOpenings <= 0) return { label: "Sold out", tone: "neutral" };
  if (v.status === "PAUSED") return { label: "Paused", tone: "amber" };
  return { label: "Live", tone: "lime" };
}

export function RemainingBar({ remaining, total, className }: { remaining: number; total: number; className?: string }) {
  const p = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;
  return (
    <div className={cx("h-1 w-full overflow-hidden rounded-full bg-white/8", className)} aria-hidden>
      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${p}%` }} />
    </div>
  );
}

/** Catalog tile. Server-safe (no hooks) so rails and grids can render it directly. */
export function PackCard({ item, className, priority }: { item: CatalogItem; className?: string; priority?: boolean }) {
  const v = item.version;
  const status = packStatus(v);
  return (
    <Link href={`/packs/${item.slug}`} className={cx("glass group flex h-full flex-col gap-3 p-3 transition hover:bg-white/8 focus-visible:bg-white/8", className)}>
      <div className="relative flex justify-center">
        <ItemArt name={item.name} accent={item.accent} imageKey={item.heroImageKey} size={priority ? "lg" : "md"} className="transition group-hover:scale-[1.02]" label="" />
        <span className="absolute top-0 right-0">
          <Badge tone={status.tone}>{status.label}</Badge>
        </span>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{item.category.name}</div>
        <div className="font-display truncate text-base font-bold text-ink-100">{item.name}</div>
        <div className="font-display mt-0.5 text-lg font-extrabold text-ink-100">{moneyStr(v.priceMinor, v.currency)}</div>
      </div>
      <div className="mt-auto">
        <div className="mb-1 flex items-center justify-between text-xs text-ink-300">
          <span>
            <span className="font-mono text-ink-100">{v.remainingOpenings.toLocaleString("en-US")}</span> / {v.totalOpenings.toLocaleString("en-US")} left
          </span>
        </div>
        <RemainingBar remaining={v.remainingOpenings} total={v.totalOpenings} />
        <div className="mt-2 text-[11px] leading-snug text-ink-300">
          Sell-back RTP <span className="font-mono text-ink-200">{pct(v.sellbackRtpBp)}</span> · Merch RTP <span className="font-mono text-ink-200">{pct(v.merchandiseRtpBp)}</span>
        </div>
      </div>
    </Link>
  );
}
