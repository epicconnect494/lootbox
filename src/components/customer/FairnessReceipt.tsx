"use client";
/** Full fairness receipt with copy buttons, server-side verification and a prefilled link to the public verifier. */
import Link from "next/link";
import { useState } from "react";
import { Check, ExternalLink, ShieldCheck, X } from "lucide-react";
import { Badge, Button, Mono, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError, api } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { CopyButton } from "./CopyButton";
import type { OpeningView } from "./types";

interface SamplingStep {
  extension: number;
  window: number;
  value: number;
  accepted: boolean;
}
interface VerifyResult {
  signatureValid: boolean;
  signingKeyId: string;
  publicKeyPem: string;
  seedRevealed: boolean;
  recomputation: { ok: boolean; checks: Array<{ name: string; ok: boolean; detail: string }>; digest: string; index: number; outcomePosition: number } | null;
}

export function FairnessReceipt({ view }: { view: OpeningView }) {
  const toast = useToast();
  const r = view.receipt;
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!r) return <p className="text-sm text-ink-300">No receipt was stored for this opening.</p>;

  const snapshot = (r.valueSnapshot ?? {}) as { remainingQuantities?: number[]; referenceValueMinor?: string; sellbackOfferMinor?: string; currency?: string; valuationSnapshotId?: string | null };
  const steps = (Array.isArray(r.samplingSteps) ? r.samplingSteps : []) as SamplingStep[];
  const remaining = snapshot.remainingQuantities ?? [];

  const verifierParams = new URLSearchParams({
    serverSeedHash: r.serverSeedHash,
    clientSeed: r.clientSeed,
    nonce: String(r.nonce),
    packVersionId: r.packVersionId,
    manifestHash: r.manifestHash,
    remaining: remaining.join(","),
    expectedIndex: String(r.selectedIndex),
  });
  if (r.revealedServerSeed) verifierParams.set("serverSeed", r.revealedServerSeed);
  const verifierHref = `/fairness?${verifierParams.toString()}#verifier`;

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(await api<VerifyResult>(`/openings/${view.opening.id}/verify`, { method: "POST" }));
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Verification request failed.";
      setError(msg);
      toast.push({ title: "Verification failed", body: msg, tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const fields: Array<{ label: string; value: string | null; copy?: boolean; note?: string }> = [
    { label: "Opening id", value: view.opening.id },
    { label: "Opened at", value: fmtDate(view.opening.createdAt, { dateStyle: "medium", timeStyle: "long" }), copy: false },
    { label: "Pack / version", value: `${view.pack.name} · v${view.pack.version}`, copy: false },
    { label: "Pack version id", value: r.packVersionId },
    { label: "Manifest hash", value: r.manifestHash },
    { label: "Remaining-inventory commitment", value: r.remainingInventoryCommitment },
    { label: "Server seed hash (commitment)", value: r.serverSeedHash },
    { label: "Server seed (revealed)", value: r.revealedServerSeed, note: r.revealedServerSeed ? undefined : `Not yet revealed. ${r.seedRevealPolicy}` },
    { label: "Client seed", value: r.clientSeed },
    { label: "Nonce", value: String(r.nonce) },
    { label: "Message", value: r.message },
    { label: "Digest (HMAC-SHA-256)", value: r.digest },
    { label: "Range", value: String(r.rangeSize), copy: false },
    { label: "Selected index", value: String(r.selectedIndex), copy: false },
    { label: "Outcome id", value: r.outcomeId },
    { label: "Outcome position", value: String(view.outcome.position), copy: false },
    { label: "Item id", value: r.inventoryItemId },
    { label: "Ledger transaction id", value: r.ledgerTransactionId },
    { label: "Ownership transfer id", value: r.ownershipTransferId },
    { label: "Signing key id", value: r.signingKeyId },
    { label: "Signature", value: r.signature },
  ];

  return (
    <div className="flex flex-col gap-4" id="receipt">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} aria-hidden className="text-cyan-300" />
          <h3 className="font-display text-base font-bold">Fairness receipt</h3>
          <Badge tone={r.revealedServerSeed ? "lime" : "neutral"}>{r.revealedServerSeed ? "Seed revealed" : "Seed committed"}</Badge>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={r.payloadCanonical} label="canonical receipt payload" className="glass glass-strong px-3 text-sm" />
          <Button tone="secondary" size="sm" onClick={verify} disabled={busy} aria-busy={busy}>
            {busy ? "Verifying…" : "Verify"}
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="flex flex-col gap-2">
        {error && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {result && (
          <div className={cx("rounded-xl border px-3 py-3 text-sm", result.signatureValid && (result.recomputation ? result.recomputation.ok : true) ? "border-lime-400/40 bg-lime-400/8" : "border-danger/40 bg-danger/10")}>
            <ul className="flex flex-col gap-1.5">
              <CheckRow ok={result.signatureValid} name="Signature valid" detail={`Ed25519 signature over the canonical payload, key ${result.signingKeyId}`} />
              {result.recomputation ? (
                result.recomputation.checks.map((c) => <CheckRow key={c.name} ok={c.ok} name={c.name} detail={c.detail} />)
              ) : (
                <li className="flex items-start gap-2 text-ink-300">
                  <span className="mt-0.5 inline-block h-4 w-4 shrink-0 rounded-full border border-ink-500" aria-hidden />
                  <span>
                    Recomputation pending: the server seed is still committed, not revealed. {r.seedRevealPolicy} Until then, the signature and the commitment hash are what you can check.
                  </span>
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-x-4 gap-y-2 md:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="min-w-0 rounded-xl bg-white/3 px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{f.label}</dt>
            <dd className="flex items-start justify-between gap-2">
              {f.value ? <Mono>{f.value}</Mono> : <span className="text-sm text-ink-300">—</span>}
              {f.value && f.copy !== false && <CopyButton value={f.value} label={f.label} />}
            </dd>
            {f.note && <p className="mt-1 text-xs text-ink-400">{f.note}</p>}
          </div>
        ))}
        <div className="min-w-0 rounded-xl bg-white/3 px-3 py-2 md:col-span-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Value snapshot</dt>
          <dd className="text-sm text-ink-200">
            Reference <Mono>{snapshot.referenceValueMinor ?? "—"}</Mono> · Sell-back <Mono>{snapshot.sellbackOfferMinor ?? "—"}</Mono> {snapshot.currency ?? ""} (minor units)
            {snapshot.valuationSnapshotId && (
              <>
                {" "}
                · Valuation <Mono>{snapshot.valuationSnapshotId}</Mono>
              </>
            )}
          </dd>
          <dd className="mt-1 text-sm text-ink-200">
            Remaining quantities at draw: <Mono>[{remaining.join(", ")}]</Mono>
          </dd>
        </div>
      </dl>

      <div>
        <h4 className="mb-2 text-sm font-semibold text-ink-200">Rejection-sampling steps</h4>
        <div className="table-wrap glass">
          <table>
            <thead>
              <tr>
                <th scope="col">Extension</th>
                <th scope="col">Window</th>
                <th scope="col">32-bit value</th>
                <th scope="col">Accepted</th>
              </tr>
            </thead>
            <tbody>
              {steps.map((s, i) => (
                <tr key={i}>
                  <td className="font-mono">{s.extension}</td>
                  <td className="font-mono">{s.window}</td>
                  <td className="font-mono">{s.value}</td>
                  <td>{s.accepted ? <span className="inline-flex items-center gap-1 text-lime-300">Accepted → index {s.value % r.rangeSize}</span> : <span className="text-ink-400">Rejected (≥ limit)</span>}</td>
                </tr>
              ))}
              {steps.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-ink-400">
                    No steps recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Link href={verifierHref} className="tap inline-flex w-fit items-center gap-2 rounded-xl px-3 text-sm font-semibold text-cyan-300 hover:bg-white/5">
        Open in the public verifier <ExternalLink size={14} aria-hidden />
      </Link>
    </div>
  );
}

function CheckRow({ ok, name, detail }: { ok: boolean; name: string; detail: string }) {
  return (
    <li className="flex items-start gap-2">
      {ok ? <Check size={16} aria-hidden className="mt-0.5 shrink-0 text-lime-400" /> : <X size={16} aria-hidden className="mt-0.5 shrink-0 text-danger" />}
      <span className="min-w-0">
        <span className={cx("font-semibold", ok ? "text-lime-300" : "text-danger")}>
          {name}
          <span className="sr-only">{ok ? " passed" : " failed"}</span>
        </span>
        <span className="block break-all font-mono text-xs text-ink-300">{detail}</span>
      </span>
    </li>
  );
}
