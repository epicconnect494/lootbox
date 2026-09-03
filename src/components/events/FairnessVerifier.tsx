"use client";
import { useEffect, useMemo, useState } from "react";
import { KeyRound, Play, ShieldCheck } from "lucide-react";
import { Button, Field, Input, Mono, Panel, SectionTitle, Textarea, cx } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { verifyOpening, verifyRaffle, type VerifyOpeningOutput, type VerifyRaffleOutput } from "@/lib/fairness/verify";
import type { SamplingStep } from "@/lib/fairness/core";

export type VerifierPrefill = Partial<Record<"tab" | "serverSeed" | "serverSeedHash" | "clientSeed" | "nonce" | "packVersionId" | "manifestHash" | "remainingQuantities" | "expectedIndex" | "expectedOutcomePosition" | "expectedDigest" | "publicRandomness" | "raffleId" | "ticketCount" | "winnersCount" | "canonicalManifest" | "expectedWinners", string>>;

interface OpeningVector {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  packVersionId: string;
  manifestHash: string;
  remainingQuantities: number[];
  digest: string;
  selectedIndex: number;
  outcomePosition: number;
}
interface RaffleVector {
  serverSeed: string;
  serverSeedHash: string;
  publicRandomness: string;
  raffleId: string;
  canonicalManifest: string;
  manifestHash: string;
  ticketCount: number;
  winnersCount: number;
  winningTickets: number[];
}
interface PublicKeyResponse {
  keyId: string;
  publicKeyPem: string;
  algorithm: string;
  testVectors: { description: string; algorithmVersion: number; openings: OpeningVector[]; raffles: RaffleVector[] };
}

const EMPTY_OPENING = { serverSeed: "", serverSeedHash: "", clientSeed: "", nonce: "0", packVersionId: "", manifestHash: "", remainingQuantities: "", expectedDigest: "", expectedIndex: "", expectedOutcomePosition: "" };
const EMPTY_RAFFLE = { serverSeed: "", serverSeedHash: "", publicRandomness: "", raffleId: "", manifestHash: "", ticketCount: "", winnersCount: "1", canonicalManifest: "", expectedWinners: "" };

export function FairnessVerifier({ prefill = {} }: { prefill?: VerifierPrefill }) {
  const [tab, setTab] = useState<"opening" | "raffle">(prefill.tab === "raffle" ? "raffle" : "opening");
  const [o, setO] = useState({ ...EMPTY_OPENING, ...pick(prefill, Object.keys(EMPTY_OPENING)) });
  const [r, setR] = useState({ ...EMPTY_RAFFLE, ...pick(prefill, Object.keys(EMPTY_RAFFLE)) });
  const [oRes, setORes] = useState<VerifyOpeningOutput | null>(null);
  const [rRes, setRRes] = useState<VerifyRaffleOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pk, setPk] = useState<PublicKeyResponse | null>(null);
  const [pkError, setPkError] = useState(false);

  useEffect(() => {
    api<PublicKeyResponse>("/fairness/public-key")
      .then(setPk)
      .catch(() => setPkError(true));
  }, []);

  const messagePreview = useMemo(() => (tab === "opening" ? `${o.clientSeed || "clientSeed"}:${o.nonce || "nonce"}:${o.packVersionId || "packVersionId"}:${o.manifestHash || "manifestHash"}` : `${r.publicRandomness || "publicRandomness"}:0:${r.raffleId || "raffleId"}:${r.manifestHash || "manifestHash"}`), [tab, o, r]);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      if (tab === "opening") {
        const remaining = o.remainingQuantities
          .split(/[,\s]+/)
          .filter(Boolean)
          .map((x) => Number(x));
        if (!remaining.length || remaining.some((n) => !Number.isInteger(n) || n < 0)) throw new Error("Remaining quantities must be a comma-separated list of non-negative integers");
        setORes(
          await verifyOpening({
            serverSeed: o.serverSeed.trim(),
            serverSeedHash: o.serverSeedHash.trim(),
            clientSeed: o.clientSeed,
            nonce: Number(o.nonce),
            packVersionId: o.packVersionId.trim(),
            manifestHash: o.manifestHash.trim(),
            remainingQuantities: remaining,
            expectedDigest: o.expectedDigest.trim() || undefined,
            expectedIndex: o.expectedIndex.trim() === "" ? undefined : Number(o.expectedIndex),
            expectedOutcomePosition: o.expectedOutcomePosition.trim() === "" ? undefined : Number(o.expectedOutcomePosition),
          }),
        );
      } else {
        const ticketCount = Number(r.ticketCount);
        const winnersCount = Number(r.winnersCount);
        if (!Number.isInteger(ticketCount) || ticketCount < 1) throw new Error("Ticket count must be a positive integer");
        if (!Number.isInteger(winnersCount) || winnersCount < 1 || winnersCount > ticketCount) throw new Error("Winners count must be between 1 and the ticket count");
        const expected = r.expectedWinners
          .split(/[,\s]+/)
          .filter(Boolean)
          .map((x) => Number(x));
        setRRes(
          await verifyRaffle({
            serverSeed: r.serverSeed.trim(),
            serverSeedHash: r.serverSeedHash.trim(),
            publicRandomness: r.publicRandomness.trim(),
            raffleId: r.raffleId.trim(),
            manifestHash: r.manifestHash.trim(),
            ticketCount,
            winnersCount,
            canonicalManifest: r.canonicalManifest.trim() ? r.canonicalManifest : undefined,
            expectedWinners: expected.length ? expected : undefined,
          }),
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  }

  function loadOpening(v: OpeningVector) {
    setTab("opening");
    setORes(null);
    setO({ serverSeed: v.serverSeed, serverSeedHash: v.serverSeedHash, clientSeed: v.clientSeed, nonce: String(v.nonce), packVersionId: v.packVersionId, manifestHash: v.manifestHash, remainingQuantities: v.remainingQuantities.join(","), expectedDigest: v.digest, expectedIndex: String(v.selectedIndex), expectedOutcomePosition: String(v.outcomePosition) });
    document.getElementById("verifier")?.scrollIntoView({ block: "start" });
  }
  function loadRaffle(v: RaffleVector) {
    setTab("raffle");
    setRRes(null);
    setR({ serverSeed: v.serverSeed, serverSeedHash: v.serverSeedHash, publicRandomness: v.publicRandomness, raffleId: v.raffleId, manifestHash: v.manifestHash, ticketCount: String(v.ticketCount), winnersCount: String(v.winnersCount), canonicalManifest: v.canonicalManifest, expectedWinners: v.winningTickets.join(",") });
    document.getElementById("verifier")?.scrollIntoView({ block: "start" });
  }

  const tabBtn = (key: "opening" | "raffle", label: string) => (
    <button type="button" role="tab" aria-selected={tab === key} aria-controls={`panel-${key}`} id={`tab-${key}`} onClick={() => setTab(key)} className={cx("tap flex-1 rounded-xl px-3 text-sm font-semibold transition", tab === key ? "bg-white/10 text-ink-100" : "text-ink-300 hover:bg-white/5")}>
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <Panel as="section" id="verifier" aria-labelledby="verifier-title" strong className="scroll-mt-20">
        <SectionTitle title="Interactive verifier" sub="Runs entirely in your browser with WebCrypto. Nothing is sent to the server." />
        <div role="tablist" aria-label="Verifier type" className="glass mb-4 flex gap-1 p-1">
          {tabBtn("opening", "Opening")}
          {tabBtn("raffle", "Raffle draw")}
        </div>

        {tab === "opening" ? (
          <div role="tabpanel" id="panel-opening" aria-labelledby="tab-opening" className="grid gap-3 md:grid-cols-2">
            <Field label="Revealed server seed (hex)" htmlFor="o-serverSeed">
              <Input id="o-serverSeed" value={o.serverSeed} onChange={(e) => setO({ ...o, serverSeed: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Server seed hash (commitment)" htmlFor="o-serverSeedHash">
              <Input id="o-serverSeedHash" value={o.serverSeedHash} onChange={(e) => setO({ ...o, serverSeedHash: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Client seed" htmlFor="o-clientSeed">
              <Input id="o-clientSeed" value={o.clientSeed} onChange={(e) => setO({ ...o, clientSeed: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Nonce" htmlFor="o-nonce">
              <Input id="o-nonce" type="number" inputMode="numeric" min={0} value={o.nonce} onChange={(e) => setO({ ...o, nonce: e.target.value })} className="font-mono" />
            </Field>
            <Field label="Pack version id" htmlFor="o-packVersionId">
              <Input id="o-packVersionId" value={o.packVersionId} onChange={(e) => setO({ ...o, packVersionId: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Manifest hash" htmlFor="o-manifestHash">
              <Input id="o-manifestHash" value={o.manifestHash} onChange={(e) => setO({ ...o, manifestHash: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Remaining quantities at the time of the opening (comma-separated, in manifest order)" htmlFor="o-remaining" hint="From the receipt's value snapshot. The sum is the sampling range.">
                <Input id="o-remaining" value={o.remainingQuantities} onChange={(e) => setO({ ...o, remainingQuantities: e.target.value })} className="font-mono" placeholder="1, 9, 90" autoComplete="off" />
              </Field>
            </div>
            <Field label="Expected digest (optional)" htmlFor="o-expectedDigest">
              <Input id="o-expectedDigest" value={o.expectedDigest} onChange={(e) => setO({ ...o, expectedDigest: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Expected index (optional)" htmlFor="o-expectedIndex">
                <Input id="o-expectedIndex" type="number" inputMode="numeric" value={o.expectedIndex} onChange={(e) => setO({ ...o, expectedIndex: e.target.value })} className="font-mono" />
              </Field>
              <Field label="Expected outcome position (optional)" htmlFor="o-expectedPos">
                <Input id="o-expectedPos" type="number" inputMode="numeric" value={o.expectedOutcomePosition} onChange={(e) => setO({ ...o, expectedOutcomePosition: e.target.value })} className="font-mono" />
              </Field>
            </div>
          </div>
        ) : (
          <div role="tabpanel" id="panel-raffle" aria-labelledby="tab-raffle" className="grid gap-3 md:grid-cols-2">
            <Field label="Revealed server seed (hex)" htmlFor="r-serverSeed">
              <Input id="r-serverSeed" value={r.serverSeed} onChange={(e) => setR({ ...r, serverSeed: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Server seed hash (commitment)" htmlFor="r-serverSeedHash">
              <Input id="r-serverSeedHash" value={r.serverSeedHash} onChange={(e) => setR({ ...r, serverSeedHash: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Public randomness (used as the client seed)" htmlFor="r-publicRandomness">
                <Input id="r-publicRandomness" value={r.publicRandomness} onChange={(e) => setR({ ...r, publicRandomness: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
              </Field>
            </div>
            <Field label="Raffle id (scope)" htmlFor="r-raffleId">
              <Input id="r-raffleId" value={r.raffleId} onChange={(e) => setR({ ...r, raffleId: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Manifest hash" htmlFor="r-manifestHash">
              <Input id="r-manifestHash" value={r.manifestHash} onChange={(e) => setR({ ...r, manifestHash: e.target.value })} className="font-mono" autoComplete="off" spellCheck={false} />
            </Field>
            <Field label="Ticket count" htmlFor="r-ticketCount">
              <Input id="r-ticketCount" type="number" inputMode="numeric" min={1} value={r.ticketCount} onChange={(e) => setR({ ...r, ticketCount: e.target.value })} className="font-mono" />
            </Field>
            <Field label="Winners count" htmlFor="r-winnersCount">
              <Input id="r-winnersCount" type="number" inputMode="numeric" min={1} value={r.winnersCount} onChange={(e) => setR({ ...r, winnersCount: e.target.value })} className="font-mono" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Canonical manifest (optional; JSON array of ticket ids)" htmlFor="r-manifest" hint="If provided, SHA-256 of this exact text is compared with the manifest hash.">
                <Textarea id="r-manifest" value={r.canonicalManifest} onChange={(e) => setR({ ...r, canonicalManifest: e.target.value })} className="font-mono text-xs" spellCheck={false} />
              </Field>
            </div>
            <div className="md:col-span-2">
              <Field label="Expected winning ticket numbers (optional, comma-separated, in rank order)" htmlFor="r-expected">
                <Input id="r-expected" value={r.expectedWinners} onChange={(e) => setR({ ...r, expectedWinners: e.target.value })} className="font-mono" placeholder="11, 2, 1" autoComplete="off" />
              </Field>
            </div>
          </div>
        )}

        <div className="mt-3 rounded-xl border border-white/8 bg-ink-900/50 p-3 text-xs">
          <div className="uppercase tracking-wider text-ink-400">Message that will be HMAC-signed</div>
          <Mono className="mt-1 block">{messagePreview}</Mono>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => void run()} disabled={busy}>
            <Play size={16} aria-hidden /> {busy ? "Verifying…" : "Run verification"}
          </Button>
          <Button
            tone="ghost"
            onClick={() => {
              if (tab === "opening") {
                setO(EMPTY_OPENING);
                setORes(null);
              } else {
                setR(EMPTY_RAFFLE);
                setRRes(null);
              }
              setError(null);
            }}
          >
            Clear
          </Button>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {error}
          </p>
        )}

        <div aria-live="polite" className="mt-4">
          {tab === "opening" && oRes && <OpeningResult res={oRes} />}
          {tab === "raffle" && rRes && <RaffleResult res={rRes} />}
        </div>
      </Panel>

      <Panel as="section" aria-labelledby="pk-title">
        <div className="mb-3 flex items-center gap-2">
          <KeyRound size={18} className="text-cyan-300" aria-hidden />
          <h2 id="pk-title" className="font-display text-lg font-bold">
            Receipt signing key & test vectors
          </h2>
        </div>
        {pkError && <p className="text-sm text-danger">Could not load the public key.</p>}
        {!pk && !pkError && <p className="text-sm text-ink-400">Loading…</p>}
        {pk && (
          <>
            <dl className="text-sm">
              <dt className="text-xs uppercase tracking-wider text-ink-400">Key id · algorithm</dt>
              <dd>
                <Mono>{pk.keyId}</Mono> <span className="text-ink-300">· {pk.algorithm}</span>
              </dd>
              <dt className="mt-2 text-xs uppercase tracking-wider text-ink-400">Public key (PEM)</dt>
              <dd>
                <pre className="mt-1 overflow-x-auto rounded-xl border border-white/8 bg-ink-900/60 p-3 font-mono text-[11px] leading-relaxed text-ink-200">{pk.publicKeyPem}</pre>
              </dd>
            </dl>
            <p className="mt-3 text-xs text-ink-400">{pk.testVectors.description}</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <h3 className="text-sm font-semibold text-ink-200">Opening vectors</h3>
                <ul className="mt-1 space-y-1">
                  {pk.testVectors.openings.map((v, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 px-2 py-1.5 text-xs">
                      <span className="min-w-0 truncate text-ink-300">
                        seed {v.clientSeed} · nonce {v.nonce} · range {v.remainingQuantities.reduce((a, b) => a + b, 0)} → index {v.selectedIndex}
                      </span>
                      <Button size="sm" tone="secondary" onClick={() => loadOpening(v)}>
                        Load vector
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink-200">Raffle vectors</h3>
                <ul className="mt-1 space-y-1">
                  {pk.testVectors.raffles.map((v, i) => (
                    <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-white/8 px-2 py-1.5 text-xs">
                      <span className="min-w-0 truncate text-ink-300">
                        {v.ticketCount} tickets · {v.winnersCount} winner{v.winnersCount === 1 ? "" : "s"} → {v.winningTickets.map((t) => `#${t}`).join(", ")}
                      </span>
                      <Button size="sm" tone="secondary" onClick={() => loadRaffle(v)}>
                        Load vector
                      </Button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

function pick<T extends Record<string, string | undefined>>(src: T, keys: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const k of keys) if (typeof src[k] === "string") out[k] = src[k] as string;
  return out;
}

function Checks({ checks, ok }: { checks: Array<{ name: string; ok: boolean; detail: string }>; ok: boolean }) {
  return (
    <div role="status" className={cx("rounded-xl border p-3", ok ? "border-lime-400/50 bg-lime-400/10" : "border-danger/40 bg-danger/10")}>
      <div className={cx("font-display flex items-center gap-2 font-bold", ok ? "text-lime-300" : "text-danger")}>
        <ShieldCheck size={16} aria-hidden /> {ok ? "All checks passed" : "One or more checks failed"}
      </div>
      <ul className="mt-2 space-y-1.5 text-sm">
        {checks.map((c) => (
          <li key={c.name}>
            <span className={c.ok ? "text-lime-300" : "text-danger"} aria-hidden>
              {c.ok ? "✓" : "✗"}
            </span>{" "}
            <span className="text-ink-100">{c.name}</span>
            <span className="sr-only">{c.ok ? " passed" : " failed"}</span>
            <Mono className="block text-ink-400">{c.detail}</Mono>
          </li>
        ))}
        {checks.length === 0 && <li className="text-ink-400">No comparison targets supplied; see the recomputed values below.</li>}
      </ul>
    </div>
  );
}

function Steps({ steps }: { steps: SamplingStep[] }) {
  return (
    <div className="table-wrap mt-2 rounded-lg border border-white/8">
      <table>
        <thead>
          <tr>
            <th scope="col">Extension</th>
            <th scope="col">Window</th>
            <th scope="col">32-bit value</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={i}>
              <td className="font-mono">{s.extension}</td>
              <td className="font-mono">{s.window}</td>
              <td className="font-mono">{s.value}</td>
              <td className={s.accepted ? "text-lime-300" : "text-amber-400"}>{s.accepted ? "accepted" : "rejected (≥ limit), next window"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OpeningResult({ res }: { res: VerifyOpeningOutput }) {
  return (
    <div className="space-y-3">
      <Checks checks={res.checks} ok={res.ok} />
      <dl className="grid gap-2 text-sm md:grid-cols-2">
        <div className="md:col-span-2">
          <dt className="text-xs uppercase tracking-wider text-ink-400">Message</dt>
          <dd>
            <Mono>{res.message}</Mono>
          </dd>
        </div>
        <div className="md:col-span-2">
          <dt className="text-xs uppercase tracking-wider text-ink-400">HMAC-SHA-256 digest</dt>
          <dd>
            <Mono>{res.digest}</Mono>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-ink-400">Range (sum of remaining)</dt>
          <dd className="font-mono">{res.range}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-ink-400">Selected index → outcome position</dt>
          <dd className="font-mono">
            {res.index} → {res.outcomePosition}
          </dd>
        </div>
      </dl>
      <div>
        <div className="text-xs uppercase tracking-wider text-ink-400">Rejection-sampling steps</div>
        <Steps steps={res.steps} />
      </div>
    </div>
  );
}

function RaffleResult({ res }: { res: VerifyRaffleOutput }) {
  return (
    <div className="space-y-3">
      <Checks checks={res.checks} ok={res.ok} />
      <ol className="space-y-2">
        {res.winners.map((w) => (
          <li key={w.rank} className="rounded-xl border border-white/8 p-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-display font-bold">Rank #{w.rank}</span>
              <span className="text-ink-300">
                → ticket <span className="font-mono text-ink-100">{w.ticketNumber}</span> (index {w.index}, nonce {w.nonce})
              </span>
            </div>
            <Mono className="mt-1 block text-ink-400">{w.message}</Mono>
            <Mono className="block">{w.digest}</Mono>
            <details className="mt-1">
              <summary className="tap flex cursor-pointer items-center text-xs font-semibold text-ink-300">Sampling steps</summary>
              <Steps steps={w.steps} />
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}
