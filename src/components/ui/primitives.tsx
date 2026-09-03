import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Tone = "primary" | "secondary" | "ghost" | "danger" | "lime" | "crazy";
const TONES: Record<Tone, string> = {
  primary: "bg-gradient-to-r from-violet-500 to-cyan-500 text-ink-950 font-semibold hover:brightness-110 shadow-[var(--shadow-glow-violet)]",
  secondary: "glass glass-strong text-ink-100 hover:bg-white/10",
  ghost: "text-ink-200 hover:bg-white/5",
  danger: "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25",
  lime: "bg-lime-400 text-ink-950 font-semibold hover:bg-lime-300 shadow-[var(--shadow-glow-lime)]",
  crazy: "bg-crazy-500 text-white font-semibold hover:bg-crazy-400 shadow-[var(--shadow-glow-crazy)]",
};
const SIZES = { sm: "h-9 px-3 text-sm rounded-lg", md: "h-11 px-4 text-sm rounded-xl", lg: "h-12 px-6 text-base rounded-xl" };

export function Button({ tone = "primary", size = "md", className, children, ...rest }: ComponentProps<"button"> & { tone?: Tone; size?: keyof typeof SIZES }) {
  return (
    <button className={cx("tap inline-flex items-center justify-center gap-2 transition disabled:cursor-not-allowed disabled:opacity-50", TONES[tone], SIZES[size], className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({ tone = "primary", size = "md", className, children, href, ...rest }: ComponentProps<typeof Link> & { tone?: Tone; size?: keyof typeof SIZES }) {
  return (
    <Link href={href} className={cx("tap inline-flex items-center justify-center gap-2 transition", TONES[tone], SIZES[size], className)} {...rest}>
      {children}
    </Link>
  );
}

export function Panel({ className, children, strong, as: As = "div", ...rest }: ComponentProps<"div"> & { strong?: boolean; as?: "div" | "section" | "article" | "aside" }) {
  return (
    <As className={cx("glass p-4 md:p-5", strong && "glass-strong", className)} {...rest}>
      {children}
    </As>
  );
}

type BadgeTone = "neutral" | "violet" | "cyan" | "lime" | "crazy" | "amber" | "danger";
const BADGES: Record<BadgeTone, string> = {
  neutral: "bg-white/6 text-ink-200 border-white/10",
  violet: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  cyan: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  lime: "bg-lime-400/15 text-lime-300 border-lime-400/40",
  crazy: "bg-crazy-500/20 text-crazy-400 border-crazy-500/50",
  amber: "bg-amber-400/15 text-amber-400 border-amber-400/30",
  danger: "bg-danger/15 text-danger border-danger/40",
};
export function Badge({ tone = "neutral", className, children }: { tone?: BadgeTone; className?: string; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide", BADGES[tone], className)}>{children}</span>;
}

export function tierTone(tier: string): BadgeTone {
  switch (tier) {
    case "GRAIL":
      return "cyan";
    case "RARE":
      return "violet";
    case "UNCOMMON":
      return "amber";
    default:
      return "neutral";
  }
}

export function Stat({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <div className={cx("min-w-0", className)}>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      <div className="font-display mt-0.5 truncate text-xl font-bold text-ink-100">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: string; hint?: string; error?: string | null; children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-ink-300">{label}</span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-ink-400">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs text-danger">
          {error}
        </span>
      )}
    </label>
  );
}

export const inputClass = "tap w-full rounded-xl border border-white/10 bg-ink-900/70 px-3 py-2.5 text-sm text-ink-100 placeholder:text-ink-500 focus:border-cyan-400/60";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={cx(inputClass, props.className)} />;
}
export function Select(props: ComponentProps<"select">) {
  return <select {...props} className={cx(inputClass, props.className)} />;
}
export function Textarea(props: ComponentProps<"textarea">) {
  return <textarea {...props} className={cx(inputClass, "min-h-24", props.className)} />;
}

export function ProbabilityBar({ num, den, tone = "violet" }: { num: number; den: number; tone?: "violet" | "cyan" | "lime" }) {
  const pct = den > 0 ? Math.max(0.5, (num / den) * 100) : 0;
  const color = tone === "cyan" ? "from-cyan-400 to-cyan-300" : tone === "lime" ? "from-lime-400 to-lime-300" : "from-violet-500 to-cyan-400";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/8" aria-hidden>
      <div className={cx("h-full rounded-full bg-gradient-to-r", color)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

export function SectionTitle({ title, action, sub }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold text-ink-100 md:text-xl">{title}</h2>
        {sub && <p className="mt-0.5 text-sm text-ink-400">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, body, action }: { title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="glass flex flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <div className="font-display text-lg font-bold">{title}</div>
      {body && <p className="max-w-sm text-sm text-ink-400">{body}</p>}
      {action}
    </div>
  );
}

export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <code className={cx("break-all font-mono text-[12px] text-ink-200", className)}>{children}</code>;
}

export function CrazyBanner({ compact }: { compact?: boolean }) {
  return (
    <div role="note" aria-label="Crazy Mode rule" className={cx("flex items-center justify-center gap-2 rounded-xl border border-crazy-500/60 bg-crazy-600/20 font-display font-extrabold tracking-[0.18em] text-crazy-400", compact ? "px-3 py-1.5 text-xs" : "px-4 py-3 text-sm md:text-base")}>
      <span aria-hidden>▼</span> LOWEST TOTAL WINS <span aria-hidden>▼</span>
    </div>
  );
}
