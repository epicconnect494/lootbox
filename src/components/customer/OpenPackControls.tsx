"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertCircle, ShieldCheck } from "lucide-react";
import { Button, ButtonLink, Panel, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, newIdempotencyKey } from "@/lib/client/api";
import { moneyStr } from "@/lib/format";
import { gateFix, type GateReason } from "./types";

interface Quote {
  packVersionId: string;
  status: string;
  priceMinor: string;
  currency: string;
  remainingOpenings: number;
  totalOpenings: number;
  balanceMinor: string;
  sufficientFunds: boolean;
  eligible: boolean;
  reasons: GateReason[];
}

export function OpenPackControls({ packVersionId, slug, priceMinor, currency, status, remaining, signedIn }: { packVersionId: string; slug: string; priceMinor: string; currency: string; status: string; remaining: number; signedIn: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; reasons?: GateReason[] } | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    let cancelled = false;
    api<Quote>("/openings/quote", { method: "POST", body: { packVersionId } })
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch((e: unknown) => {
        if (!cancelled) setQuoteError(e instanceof ApiError ? e.message : "Could not load your eligibility.");
      });
    return () => {
      cancelled = true;
    };
  }, [packVersionId, signedIn]);

  const available = status === "PUBLISHED" && remaining > 0;
  const unavailableLabel = remaining <= 0 ? "Sold out" : status === "PAUSED" ? "Paused" : "Not available";

  if (!signedIn) {
    return (
      <Panel strong as="section" aria-labelledby="open-title" className="flex flex-col gap-3">
        <h2 id="open-title" className="font-display text-lg font-bold">
          Open this pack
        </h2>
        <p className="text-sm text-ink-300">
          Price <span className="font-mono text-ink-100">{moneyStr(priceMinor, currency)}</span>. Sign in to see your balance and eligibility.
        </p>
        <ButtonLink href={`/login?next=${encodeURIComponent(`/packs/${slug}`)}`} size="lg" className="w-full">
          Sign in to open
        </ButtonLink>
        <Footnote />
      </Panel>
    );
  }

  const reasons: GateReason[] = [...(quote?.reasons ?? [])];
  if (quote && !quote.sufficientFunds) reasons.push({ code: "INSUFFICIENT_FUNDS", message: `Your balance is ${moneyStr(quote.balanceMinor, quote.currency)}; this pack costs ${moneyStr(quote.priceMinor, quote.currency)}.` });
  const canOpen = available && !!quote?.eligible && !busy;

  const open = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ opening: { id: string } }>("/openings", { method: "POST", body: { packVersionId }, idempotencyKey: newIdempotencyKey() });
      router.push(`/openings/${res.opening.id}`);
    } catch (e) {
      const ae = e instanceof ApiError ? e : null;
      const gate = (ae?.details as { reasons?: GateReason[] } | undefined)?.reasons;
      const message = ae?.message ?? "Something went wrong. Nothing was charged.";
      setError({ message, reasons: gate });
      toast.push({ title: ae?.code === "SOLD_OUT" ? "Sold out" : "Could not open pack", body: message, tone: "error" });
      if (ae?.code === "SOLD_OUT" || ae?.code === "PACK_UNAVAILABLE") router.refresh();
      setBusy(false);
    }
  };

  return (
    <Panel strong as="section" aria-labelledby="open-title" className="flex flex-col gap-3">
      <h2 id="open-title" className="font-display text-lg font-bold">
        Open this pack
      </h2>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Price</dt>
          <dd className="font-display text-xl font-bold text-ink-100">{moneyStr(priceMinor, currency)}</dd>
        </div>
        <div>
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Your balance</dt>
          <dd className={cx("font-display text-xl font-bold", quote && !quote.sufficientFunds ? "text-amber-400" : "text-ink-100")}>{quote ? moneyStr(quote.balanceMinor, quote.currency) : "…"}</dd>
        </div>
      </dl>

      <div aria-live="polite">
        {quoteError && (
          <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            <AlertCircle size={16} aria-hidden className="mt-0.5 shrink-0" /> {quoteError}
          </p>
        )}
        {quote && reasons.length > 0 && (
          <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm">
            <div className="font-semibold text-amber-400">Before you can open</div>
            <ul className="mt-1 flex flex-col gap-1.5">
              {reasons.map((r) => {
                const fix = gateFix(r.code);
                return (
                  <li key={r.code} className="flex flex-wrap items-center justify-between gap-2 text-ink-200">
                    <span>{r.message}</span>
                    <Link href={fix.href} className="tap inline-flex items-center rounded-lg px-2 text-sm font-semibold text-cyan-300 hover:bg-white/5">
                      {fix.label} →
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
        {error && (
          <div role="alert" className="mt-2 rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            <div>{error.message}</div>
            {error.reasons && error.reasons.length > 0 && (
              <ul className="mt-1 text-ink-200">
                {error.reasons.map((r) => (
                  <li key={r.code}>
                    {r.message}{" "}
                    <Link href={gateFix(r.code).href} className="font-semibold text-cyan-300 underline-offset-2 hover:underline">
                      {gateFix(r.code).label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <Button size="lg" onClick={open} disabled={!canOpen} aria-busy={busy} className="w-full">
        {busy ? "Opening…" : available ? `Open pack · ${moneyStr(priceMinor, currency)}` : unavailableLabel}
      </Button>
      {available && quote && !quote.eligible && reasons.length === 0 && <p className="text-xs text-ink-400">This pack cannot be opened right now.</p>}
      <Footnote />
    </Panel>
  );
}

function Footnote() {
  return (
    <div className="flex flex-col gap-1 text-xs text-ink-400">
      <p>Packs are finite. Odds never change per person.</p>
      <Link href="/fairness" className="inline-flex items-center gap-1 font-semibold text-cyan-300 hover:underline">
        <ShieldCheck size={14} aria-hidden /> Verify fairness
      </Link>
    </div>
  );
}
