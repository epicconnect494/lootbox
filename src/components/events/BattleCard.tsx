import Link from "next/link";
import { Lock, Users, Zap } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { Badge, CrazyBanner, cx } from "@/components/ui/primitives";
import { fmtDate, moneyStr } from "@/lib/format";
import type { listBattles, MODE_RULES } from "@/domain/battles";
import type { Json } from "./json-types";

export type BattleListItem = Json<Awaited<ReturnType<typeof listBattles>>[number]>;
type Rules = typeof MODE_RULES;

export function battleStatusTone(status: string): "neutral" | "cyan" | "lime" | "danger" | "amber" | "violet" {
  switch (status) {
    case "OPEN":
      return "cyan";
    case "IN_PROGRESS":
      return "violet";
    case "SETTLED":
      return "neutral";
    case "VOIDED":
    case "CANCELLED":
      return "danger";
    default:
      return "neutral";
  }
}

export function statusLabel(status: string): string {
  return status.replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
}

export function BattleCard({ b, rules, viewerUserId }: { b: BattleListItem; rules: Rules; viewerUserId: string | null }) {
  const crazy = b.mode === "CRAZY";
  const winners = b.players.filter((p) => b.winnerUserIds.includes(p.userId));
  const isHistory = b.status === "SETTLED" || b.status === "VOIDED" || b.status === "CANCELLED";
  return (
    <article className={cx("glass flex flex-col gap-3 p-4 transition hover:bg-white/[0.04]", crazy && "border-crazy-500/50 shadow-[var(--shadow-glow-crazy)]")}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={crazy ? "crazy" : "violet"}>{rules[b.mode].title}</Badge>
        <Badge tone={battleStatusTone(b.status)}>{statusLabel(b.status)}</Badge>
        <Badge tone="neutral">
          <Zap size={11} aria-hidden /> {b.speed === "FAST" ? "Fast" : "Normal"}
        </Badge>
        {b.isPrivate && (
          <Badge tone="amber">
            <Lock size={11} aria-hidden /> Private
          </Badge>
        )}
        <span className="ml-auto font-mono text-[11px] text-ink-400">#{b.code}</span>
      </div>
      {crazy && <CrazyBanner compact />}
      <div className="flex items-center gap-3">
        <div className="flex -space-x-3" aria-label={`${b.packs.length} pack${b.packs.length === 1 ? "" : "s"} in sequence`} role="group">
          {b.packs.slice(0, 5).map((p, i) => (
            <div key={i} className="rounded-2xl ring-2 ring-ink-950" style={{ zIndex: 10 - i }}>
              <ItemArt name={p.name} accent={p.accent} size="sm" label={`${i + 1}. ${p.name}`} />
            </div>
          ))}
          {b.packs.length > 5 && <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-800 text-xs font-semibold text-ink-300 ring-2 ring-ink-950">+{b.packs.length - 5}</div>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold text-ink-100">{b.packs.map((p) => p.name).join(" → ")}</div>
          <div className="mt-0.5 text-xs text-ink-400">
            {b.packs.length} round{b.packs.length === 1 ? "" : "s"} · entry <span className="font-mono text-ink-200">{moneyStr(b.entryCostMinor, b.currency)}</span>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1 text-ink-300">
          <Users size={14} aria-hidden />
          <span className="font-display font-bold text-ink-100">
            {b.players.length}/{b.seats}
          </span>{" "}
          seats
        </span>
        <span className="truncate text-ink-400">
          {b.players.map((p, i) => (
            <span key={p.userId}>
              {i > 0 && ", "}
              <span className={cx(p.userId === viewerUserId && "text-cyan-300")}>{p.displayName}</span>
            </span>
          ))}
          {b.players.length === 0 && "No players yet"}
        </span>
      </div>
      {isHistory && (
        <div className="text-sm">
          {b.status === "SETTLED" && b.mode === "KEEP" && <span className="text-ink-300">Everyone kept their pulls.</span>}
          {b.status === "SETTLED" && b.mode !== "KEEP" && winners.length > 0 && (
            <span>
              <span className="text-ink-400">{b.mode === "SHARED" ? "Ranked: " : "Winner: "}</span>
              <span className="font-semibold text-lime-300">{winners.map((w) => w.displayName).join(", ")}</span>
            </span>
          )}
          {(b.status === "VOIDED" || b.status === "CANCELLED") && <span className="text-ink-400">Entries refunded.</span>}
          <span className="ml-2 text-xs text-ink-500">{fmtDate(b.settledAt ?? b.createdAt)}</span>
        </div>
      )}
      <Link href={`/battles/${b.id}`} className={cx("tap mt-auto inline-flex items-center justify-center rounded-xl text-sm font-semibold", crazy ? "bg-crazy-500 text-white hover:bg-crazy-400" : "glass glass-strong text-ink-100 hover:bg-white/10")}>
        {b.status === "OPEN" ? (b.players.length < b.seats ? "View & join" : "View") : isHistory ? "View result" : "Watch"}
      </Link>
    </article>
  );
}
