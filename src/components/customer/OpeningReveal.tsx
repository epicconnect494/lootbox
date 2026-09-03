"use client";
/** Presentation of a settled opening. The result is already final and signed; the reel only visualizes it. */
import Link from "next/link";
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { Reel, type ReelOutcome } from "@/components/reel/Reel";
import { Badge, ButtonLink, Button, Panel, cx, tierTone } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { moneyStr, tierLabel } from "@/lib/format";
import { FairnessReceipt } from "./FairnessReceipt";
import type { OpeningView } from "./types";

function conditionLabel(c: string): string {
  return c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

export function OpeningReveal({ view }: { view: OpeningView }) {
  const alreadyRevealed = !!view.opening.revealedAt;
  const [landed, setLanded] = useState(alreadyRevealed);
  const [showReceipt, setShowReceipt] = useState(false);
  const outcomes: ReelOutcome[] = view.reelOutcomes;
  const winner = outcomes.find((o) => o.id === view.outcome.id) ?? { id: view.outcome.id, label: view.outcome.label, tier: view.outcome.tier, quantityTotal: view.outcome.quantityTotal, referenceValueMinor: view.outcome.referenceValueMinor, accent: view.outcome.sku.accent, imageKey: view.outcome.sku.imageKey, name: view.outcome.sku.name };
  const holdingId = view.holding?.id ?? null;
  const item = view.item;
  const o = view.outcome;

  const onComplete = () => {
    setLanded(true);
    if (!alreadyRevealed) api(`/openings/${view.opening.id}/revealed`, { method: "POST" }).catch(() => undefined);
  };

  return (
    <div className="flex flex-col gap-5">
      <Reel openingId={view.opening.id} outcomes={outcomes} winner={winner} autoplay skipAnimation={alreadyRevealed} onComplete={onComplete} currency={view.pack.currency} />

      <div aria-live="polite" aria-atomic="true">
        {landed && (
          <Panel strong as="section" aria-labelledby="result-title" className={cx("rise border-lime-400/40", "shadow-[var(--shadow-glow-lime)]")}>
            <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
              <ItemArt name={o.sku.name} accent={o.sku.accent} imageKey={o.sku.imageKey} size="xl" className="ring-2 ring-lime-400/60" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
                  <Badge tone="lime">In your vault</Badge>
                  <Badge tone={tierTone(o.tier)}>{tierLabel(o.tier)}</Badge>
                </div>
                <h2 id="result-title" className="font-display mt-2 text-2xl font-extrabold text-ink-100 md:text-3xl">
                  {o.label}
                </h2>
                <p className="mt-1 text-sm text-ink-300">
                  {o.sku.brand ? `${o.sku.brand} · ` : ""}
                  {o.sku.name}
                  {item ? ` · ${conditionLabel(item.condition)}` : ""}
                </p>
                {item && (
                  <dl className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-ink-300 sm:justify-start">
                    <div>
                      <dt className="inline text-ink-400">Item </dt>
                      <dd className="inline font-mono text-ink-200">{item.itemCode}</dd>
                    </div>
                    {item.grader && (
                      <div>
                        <dt className="inline text-ink-400">Grade </dt>
                        <dd className="inline font-mono text-ink-200">
                          {item.grader} {item.grade}
                        </dd>
                      </div>
                    )}
                    {item.certificationId && (
                      <div>
                        <dt className="inline text-ink-400">Cert </dt>
                        <dd className="inline font-mono text-ink-200">{item.certificationId}</dd>
                      </div>
                    )}
                    {item.serialNumber && (
                      <div>
                        <dt className="inline text-ink-400">Serial </dt>
                        <dd className="inline font-mono text-ink-200">{item.serialNumber}</dd>
                      </div>
                    )}
                    <div>
                      <dt className="inline text-ink-400">Custody </dt>
                      <dd className="inline font-mono text-ink-200">{item.custody.replace(/_/g, " ").toLowerCase()}</dd>
                    </div>
                  </dl>
                )}
                <div className="mt-3 grid grid-cols-2 gap-3 text-left">
                  <div className="rounded-xl bg-white/4 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Reference value</div>
                    <div className="font-display text-lg font-bold text-ink-100">{moneyStr(view.opening.referenceValueMinor, view.opening.currency)}</div>
                  </div>
                  <div className="rounded-xl bg-white/4 px-3 py-2">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Sell-now offer</div>
                    <div className="font-display text-lg font-bold text-lime-300">{moneyStr(view.opening.sellbackOfferMinor, view.opening.currency)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <ButtonLink href="/vault" tone="lime">
                Keep in Vault
              </ButtonLink>
              <ButtonLink href={holdingId ? `/vault?ship=${holdingId}` : "/vault"} tone="secondary">
                Ship
              </ButtonLink>
              <ButtonLink href={holdingId ? `/vault?sell=${holdingId}` : "/vault"} tone="secondary">
                Sell now
              </ButtonLink>
              <ButtonLink href={holdingId ? `/vault?list=${holdingId}` : "/vault"} tone="secondary">
                List
              </ButtonLink>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <Button tone="ghost" size="sm" onClick={() => setShowReceipt((s) => !s)} aria-expanded={showReceipt} aria-controls="receipt-panel">
                Verify result {showReceipt ? <ChevronUp size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
              </Button>
              <Link href={`/packs/${view.pack.slug}`} className="tap inline-flex items-center rounded-xl px-3 text-sm text-ink-300 hover:bg-white/5">
                Back to {view.pack.name}
              </Link>
            </div>
          </Panel>
        )}
      </div>

      <div id="receipt-panel" hidden={!showReceipt}>
        {showReceipt && (
          <Panel as="section" aria-label="Fairness receipt">
            <FairnessReceipt view={view} />
          </Panel>
        )}
      </div>
    </div>
  );
}
