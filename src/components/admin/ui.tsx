import type { ReactNode } from "react";
import { Badge, cx } from "@/components/ui/primitives";
import { fmtDate } from "@/lib/format";

type BadgeTone = "neutral" | "violet" | "cyan" | "lime" | "crazy" | "amber" | "danger";

const TONES: Record<string, BadgeTone> = {
  DRAFT: "neutral",
  PENDING_APPROVAL: "amber",
  APPROVED: "cyan",
  SCHEDULED: "cyan",
  PUBLISHED: "violet",
  PAUSED: "amber",
  CLOSED: "neutral",
  REJECTED: "danger",
  OPEN: "cyan",
  IN_PROGRESS: "violet",
  SETTLED: "neutral",
  VOIDED: "danger",
  CANCELLED: "neutral",
  ACTIVE: "violet",
  LOCKED: "amber",
  REVIEW: "amber",
  UPCOMING: "cyan",
  DRAWN: "violet",
  CLAIMED: "neutral",
  INTAKE: "amber",
  IN_STOCK: "cyan",
  RESERVED: "violet",
  IN_VAULT: "violet",
  LISTED: "cyan",
  SHIP_REQUESTED: "amber",
  SHIPPED: "cyan",
  DELIVERED: "neutral",
  SOLD_BACK: "neutral",
  RETURNED: "amber",
  LOST: "danger",
  RETIRED: "neutral",
  REQUESTED: "amber",
  ADDRESS_VERIFIED: "cyan",
  PACKED: "cyan",
  DISPUTED: "danger",
  SUSPENDED: "danger",
  PENDING: "amber",
  SUCCEEDED: "neutral",
  FAILED: "danger",
  EXPIRED: "neutral",
  ACCEPTED: "neutral",
  SOLD: "neutral",
  WON: "neutral",
  LOST_CB: "danger",
  LOW: "neutral",
  MEDIUM: "amber",
  HIGH: "danger",
  CRITICAL: "danger",
  VALID: "violet",
  SUPERSEDED: "neutral",
};

/** Status chip. Never uses lime (reserved for verified/passing) or pink (Crazy Mode). */
export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={TONES[status] ?? "neutral"}>{status.replace(/_/g, " ")}</Badge>;
}

export function ModeBadge({ mode }: { mode: string }) {
  return <Badge tone={mode === "CRAZY" ? "crazy" : mode === "SHARED" ? "cyan" : mode === "KEEP" ? "violet" : "neutral"}>{mode === "CRAZY" ? "Crazy Mode" : mode.charAt(0) + mode.slice(1).toLowerCase()}</Badge>;
}

export function PageHeader({ title, sub, action }: { title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink-100 md:text-3xl">{title}</h1>
        {sub && <p className="mt-1 max-w-2xl text-sm text-ink-300">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "danger" | "ok"; children: ReactNode }) {
  const cls = tone === "warn" ? "border-amber-400/40 bg-amber-400/10 text-amber-400" : tone === "danger" ? "border-danger/40 bg-danger/10 text-danger" : tone === "ok" ? "border-lime-400/40 bg-lime-400/10 text-lime-300" : "border-cyan-400/30 bg-cyan-500/10 text-cyan-300";
  return (
    <div role={tone === "danger" ? "alert" : "note"} className={cx("rounded-xl border px-3 py-2 text-sm", cls)}>
      {children}
    </div>
  );
}

/** Compact definition list. */
export function KV({ items, className }: { items: Array<[string, ReactNode]>; className?: string }) {
  return (
    <dl className={cx("grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm", className)}>
      {items.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-xs font-semibold uppercase tracking-wider text-ink-400">{k}</dt>
          <dd className="min-w-0 break-words text-ink-100">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function JsonBlock({ value, label }: { value: unknown; label?: string }) {
  return (
    <pre aria-label={label} className="max-h-80 overflow-auto rounded-xl border border-white/8 bg-ink-900/70 p-3 font-mono text-[12px] leading-relaxed text-ink-200">
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function Collapsible({ title, children, defaultOpen }: { title: ReactNode; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group rounded-xl border border-white/8 bg-white/3" open={defaultOpen}>
      <summary className="tap flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-sm font-semibold text-ink-200 hover:bg-white/5">
        {title}
        <span aria-hidden className="text-ink-400 transition group-open:rotate-90">
          ▸
        </span>
      </summary>
      <div className="border-t border-white/8 p-3">{children}</div>
    </details>
  );
}

export function When({ value }: { value: string | null | undefined }) {
  return <span className="whitespace-nowrap text-ink-200">{fmtDate(value)}</span>;
}

/** Pure-CSS mini bar chart (no chart library). */
export function MiniBars({ data, label }: { data: Array<{ label: string; value: number; title: string }>; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (!data.length) return <p className="text-sm text-ink-400">No settled openings in the last 7 days.</p>;
  return (
    <div role="img" aria-label={label} className="flex h-36 items-end gap-2">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1" title={d.title}>
          <div className="flex h-28 w-full items-end">
            <div className="w-full rounded-t-md bg-gradient-to-t from-violet-500 to-cyan-400" style={{ height: `${Math.max(3, (d.value / max) * 100)}%` }} />
          </div>
          <div className="truncate text-[10px] text-ink-400">{d.label}</div>
        </div>
      ))}
    </div>
  );
}

export function Permission({ granted, children }: { granted: boolean; children: ReactNode }) {
  return granted ? <>{children}</> : null;
}
