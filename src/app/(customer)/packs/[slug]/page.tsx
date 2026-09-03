import Link from "next/link";
import { notFound } from "next/navigation";
import { ShieldCheck, Truck, TruckElectric } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { OpenPackControls } from "@/components/customer/OpenPackControls";
import { RemainingBar, packStatus } from "@/components/customer/PackCard";
import { serialize } from "@/components/customer/serialize";
import type { PackOutcome } from "@/components/customer/types";
import { Badge, Mono, Panel, ProbabilityBar, Stat, cx, tierTone } from "@/components/ui/primitives";
import { getPackDetail } from "@/domain/packs";
import { fmtDate, moneyStr, pct, probability, tierLabel } from "@/lib/format";
import { viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detail = await getPackDetail((await viewer()).db, slug);
  return { title: detail ? detail.pack.name : "Pack" };
}

function conditionLabel(c: string): string {
  return c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function PackPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db, session } = await viewer();
  const raw = await getPackDetail(db, slug);
  if (!raw) notFound();
  const d = serialize(raw);
  const v = d.version;
  const status = packStatus(v);
  const outcomes = [...d.outcomes].sort((a, b) => a.position - b.position);
  const unique = outcomes.some((o) => o.item);

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Breadcrumb" className="text-xs text-ink-400">
        <Link href="/packs" className="hover:text-ink-200">
          Packs
        </Link>{" "}
        / <span className="text-ink-300">{d.pack.name}</span>
      </nav>

      <div className="grid gap-5 lg:grid-cols-3">
        {/* Hero + summary */}
        <Panel strong as="section" aria-labelledby="pack-title" className="ring-iris lg:col-span-2">
          <div className="flex flex-col gap-5 sm:flex-row">
            <ItemArt name={d.pack.name} accent={d.pack.accent} imageKey={d.pack.heroImageKey} size="xl" className="self-center" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={status.tone}>{status.label}</Badge>
                {d.category && <Badge tone="violet">{d.category.name}</Badge>}
                {d.pack.tags.map((t) => (
                  <Badge key={t}>{t}</Badge>
                ))}
              </div>
              <h1 id="pack-title" className="font-display mt-2 text-2xl font-extrabold text-ink-100 md:text-3xl">
                {d.pack.name}
              </h1>
              {d.pack.tagline && <p className="mt-1 text-sm text-ink-300">{d.pack.tagline}</p>}
              {d.pack.description && <p className="mt-2 text-sm text-ink-300">{d.pack.description}</p>}
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Stat label="Price" value={moneyStr(v.priceMinor, v.currency)} />
                <Stat label="Remaining" value={`${v.remainingOpenings.toLocaleString("en-US")} / ${v.totalOpenings.toLocaleString("en-US")}`} hint="Finite run" />
                <Stat label="Version" value={`v${v.version}`} hint={v.publishedAt ? `Published ${fmtDate(v.publishedAt, { dateStyle: "medium" })}` : undefined} />
              </div>
              <RemainingBar remaining={v.remainingOpenings} total={v.totalOpenings} className="mt-3" />
              {v.status === "PAUSED" && v.pauseReason && <p className="mt-2 text-xs text-amber-400">Paused: {v.pauseReason}</p>}
            </div>
          </div>
        </Panel>

        <div className="flex flex-col gap-5">
          <OpenPackControls packVersionId={v.id} slug={d.pack.slug} priceMinor={v.priceMinor} currency={v.currency} status={v.status} remaining={v.remainingOpenings} signedIn={!!session} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {/* RTP */}
        <Panel as="section" aria-labelledby="rtp-title">
          <h2 id="rtp-title" className="font-display text-lg font-bold">
            Return to player (RTP)
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-4">
            <Stat label="Sell-back RTP" value={pct(v.sellbackRtpBp)} hint="Cash offer basis" />
            <Stat label="Merchandise RTP" value={pct(v.merchandiseRtpBp)} hint="Reference value basis" />
          </div>
          <p className="mt-3 text-sm text-ink-300">
            <strong className="text-ink-100">Sell-back RTP</strong> is the expected instant cash offer per {moneyStr(v.priceMinor, v.currency)} spent, using the disclosed sell-now offer of every outcome. <strong className="text-ink-100">Merchandise RTP</strong> uses each item&apos;s reference market value instead, which is not a cash amount. Packs target a sell-back RTP of{" "}
            <span className="font-mono text-ink-100">{pct(v.targetRtpBp)}</span> (±{pct(v.rtpToleranceBp)}); this version&apos;s computed figure is shown above. Both figures are computed over the full manifest at publish time.
          </p>
        </Panel>

        {/* Manifest commitment */}
        <Panel as="section" aria-labelledby="manifest-title">
          <h2 id="manifest-title" className="font-display flex items-center gap-2 text-lg font-bold">
            <ShieldCheck size={18} aria-hidden className="text-cyan-300" /> Manifest commitment
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">SHA-256 of canonical manifest</dt>
              <dd>
                <Mono>{d.manifestHash ?? "—"}</Mono>
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Committed</dt>
              <dd className="font-mono text-ink-200">{d.commitmentAt ? fmtDate(d.commitmentAt, { dateStyle: "medium", timeStyle: "long" }) : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Pack version id</dt>
              <dd>
                <Mono>{v.id}</Mono>
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-ink-400">The manifest (every outcome, quantity and value) was hashed when this version was published and is bound into every opening receipt.</p>
          <Link href="/fairness" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-cyan-300 hover:underline">
            How verification works →
          </Link>
        </Panel>
      </div>

      {/* Outcomes */}
      <section aria-labelledby="outcomes-title">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="outcomes-title" className="font-display text-lg font-bold md:text-xl">
              All outcomes
            </h2>
            <p className="mt-0.5 text-sm text-ink-400">
              {outcomes.length} outcomes · {v.totalOpenings.toLocaleString("en-US")} total openings · initial odds are quantity ÷ {v.totalOpenings.toLocaleString("en-US")}; live odds are remaining ÷ {v.remainingOpenings.toLocaleString("en-US")}.
            </p>
          </div>
        </div>

        {/* Card list on small screens */}
        <ul className="flex flex-col gap-3 md:hidden">
          {outcomes.map((o) => (
            <li key={o.id}>
              <OutcomeCard o={o} total={v.totalOpenings} remainingTotal={v.remainingOpenings} />
            </li>
          ))}
        </ul>

        {/* Table on md+ */}
        <div className="table-wrap glass hidden md:block">
          <table>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col">Tier</th>
                <th scope="col">Detail</th>
                <th scope="col">Qty left</th>
                <th scope="col">Initial odds</th>
                <th scope="col">Live odds</th>
                <th scope="col">Reference value</th>
                <th scope="col">Sell-now offer</th>
                <th scope="col">Shipping</th>
              </tr>
            </thead>
            <tbody>
              {outcomes.map((o) => (
                <tr key={o.id} className={cx(o.quantityRemaining === 0 && "opacity-60")}>
                  <td>
                    <div className="flex items-center gap-3">
                      <ItemArt name={o.sku.name} accent={o.sku.accent} imageKey={o.sku.imageKey} size="sm" label="" />
                      <div className="min-w-0">
                        <div className="font-semibold text-ink-100">{o.label}</div>
                        <div className="text-xs text-ink-400">
                          {o.sku.brand ? `${o.sku.brand} · ` : ""}
                          {o.sku.name}
                        </div>
                        <div className="text-xs text-ink-400">Condition: {conditionLabel(o.condition)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tone={tierTone(o.tier)}>{tierLabel(o.tier)}</Badge>
                  </td>
                  <td>
                    <ItemDetail o={o} />
                  </td>
                  <td>
                    <span className="font-mono text-ink-100">{o.quantityRemaining}</span> <span className="text-ink-400">/ {o.quantityTotal}</span>
                  </td>
                  <td>
                    <div className="font-mono text-ink-100">{probability(o.initialProbability.num, o.initialProbability.den)}</div>
                    <div className="text-xs text-ink-400">
                      {o.initialProbability.num}/{o.initialProbability.den}
                    </div>
                    <ProbabilityBar num={o.initialProbability.num} den={o.initialProbability.den} />
                  </td>
                  <td>
                    <div className="font-mono text-ink-100">{o.quantityRemaining > 0 ? probability(o.liveProbability.num, o.liveProbability.den) : "0%"}</div>
                    <div className="text-xs text-ink-400">
                      {o.liveProbability.num}/{o.liveProbability.den}
                    </div>
                    <ProbabilityBar num={o.liveProbability.num} den={o.liveProbability.den} tone="cyan" />
                  </td>
                  <td>
                    <div className="font-mono text-ink-100">{moneyStr(o.referenceValueMinor, o.currency)}</div>
                    <Valuation o={o} />
                  </td>
                  <td className="font-mono text-ink-100">{moneyStr(o.sellbackOfferMinor, o.currency)}</td>
                  <td>
                    <Shipping o={o} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-ink-400">
          {unique ? "Graded and serialized items are one-of-one: once opened they leave the manifest. " : ""}
          Reference values are observed market figures, not guarantees. The sell-now offer is fixed at the value shown when you open.
        </p>
      </section>
    </div>
  );
}

function ItemDetail({ o }: { o: PackOutcome }) {
  const it = o.item;
  if (!it) return <span className="text-xs text-ink-400">{o.sku.isUnique ? "Unique item" : "Pooled stock"}</span>;
  const rows: Array<[string, string | null]> = [
    ["Grader", it.grader],
    ["Grade", it.grade],
    ["Cert", it.certificationId],
    ["Serial", it.serialNumber],
    ["Size", it.size],
  ];
  return (
    <dl className="flex flex-col gap-0.5 text-xs">
      <div>
        <dt className="inline text-ink-400">Item </dt>
        <dd className="inline font-mono text-ink-200">{it.itemCode}</dd>
      </div>
      {rows
        .filter(([, val]) => !!val)
        .map(([k, val]) => (
          <div key={k}>
            <dt className="inline text-ink-400">{k} </dt>
            <dd className="inline font-mono text-ink-200">{val}</dd>
          </div>
        ))}
    </dl>
  );
}

function Valuation({ o }: { o: PackOutcome }) {
  if (!o.valuation) return <div className="text-xs text-ink-400">Source: pack manifest</div>;
  return (
    <div className="text-xs text-ink-400">
      {o.valuation.source}
      {o.valuation.sourceRef ? ` (${o.valuation.sourceRef})` : ""} · {fmtDate(o.valuation.observedAt, { dateStyle: "medium" })}
    </div>
  );
}

function Shipping({ o }: { o: PackOutcome }) {
  return o.shippingEligible ? (
    <span className="inline-flex items-center gap-1 text-xs text-ink-200">
      <Truck size={14} aria-hidden className="text-emerald-400" /> Ships
    </span>
  ) : (
    <span className="text-xs text-ink-300">
      <span className="inline-flex items-center gap-1">
        <TruckElectric size={14} aria-hidden className="text-amber-400" /> Vault only
      </span>
      {o.shippingNote && <span className="block text-ink-400">{o.shippingNote}</span>}
    </span>
  );
}

function OutcomeCard({ o, total, remainingTotal }: { o: PackOutcome; total: number; remainingTotal: number }) {
  return (
    <article className={cx("glass flex flex-col gap-3 p-3", o.quantityRemaining === 0 && "opacity-60")} aria-label={o.label}>
      <div className="flex items-center gap-3">
        <ItemArt name={o.sku.name} accent={o.sku.accent} imageKey={o.sku.imageKey} size="md" label="" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={tierTone(o.tier)}>{tierLabel(o.tier)}</Badge>
            <span className="text-xs text-ink-400">
              <span className="font-mono text-ink-100">{o.quantityRemaining}</span> / {o.quantityTotal} left
            </span>
          </div>
          <div className="font-display mt-1 font-bold text-ink-100">{o.label}</div>
          <div className="text-xs text-ink-400">
            {o.sku.brand ? `${o.sku.brand} · ` : ""}
            {o.sku.name} · {conditionLabel(o.condition)}
          </div>
        </div>
      </div>
      <ItemDetail o={o} />
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Initial odds</div>
          <div className="font-mono text-ink-100">
            {probability(o.quantityTotal, total)} <span className="text-xs text-ink-400">({o.quantityTotal}/{total})</span>
          </div>
          <ProbabilityBar num={o.quantityTotal} den={total} />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Live odds</div>
          <div className="font-mono text-ink-100">
            {o.quantityRemaining > 0 ? probability(o.quantityRemaining, remainingTotal) : "0%"} <span className="text-xs text-ink-400">({o.quantityRemaining}/{remainingTotal})</span>
          </div>
          <ProbabilityBar num={o.quantityRemaining} den={remainingTotal} tone="cyan" />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Reference value</div>
          <div className="font-mono text-ink-100">{moneyStr(o.referenceValueMinor, o.currency)}</div>
          <Valuation o={o} />
        </div>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Sell-now offer</div>
          <div className="font-mono text-ink-100">{moneyStr(o.sellbackOfferMinor, o.currency)}</div>
          <Shipping o={o} />
        </div>
      </div>
    </article>
  );
}
