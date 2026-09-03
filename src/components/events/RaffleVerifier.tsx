"use client";
import { useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Mono, cx } from "@/components/ui/primitives";
import { verifyRaffle, type VerifyRaffleOutput } from "@/lib/fairness/verify";

export interface RaffleVerifyInput {
  serverSeed: string;
  serverSeedHash: string;
  publicRandomness: string;
  raffleId: string;
  manifestHash: string;
  ticketCount: number;
  winnersCount: number;
  canonicalManifest?: string;
  expectedWinners: number[];
}

/** Recomputes a raffle draw in the browser with the published inputs; lime only when every check passes. */
export function RaffleVerifier({ input }: { input: RaffleVerifyInput }) {
  const [result, setResult] = useState<VerifyRaffleOutput | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        tone="secondary"
        size="sm"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            setResult(await verifyRaffle({ ...input }));
          } catch (e) {
            setError(e instanceof Error ? e.message : "Verification failed");
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
      >
        <ShieldCheck size={14} aria-hidden /> {busy ? "Verifying…" : result ? "Re-run verifier" : "Verify this draw in your browser"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
      {result && (
        <div role="status" aria-live="polite" className={cx("rounded-xl border p-3 text-sm", result.ok ? "border-lime-400/50 bg-lime-400/10" : "border-danger/40 bg-danger/10")}>
          <div className={cx("font-display font-bold", result.ok ? "text-lime-300" : "text-danger")}>{result.ok ? "Verified: recomputation matches the published draw" : "Mismatch: this draw does not verify"}</div>
          <ul className="mt-2 space-y-1">
            {result.checks.map((c) => (
              <li key={c.name} className="flex flex-wrap gap-x-2">
                <span className={c.ok ? "text-lime-300" : "text-danger"} aria-hidden>
                  {c.ok ? "✓" : "✗"}
                </span>
                <span className="text-ink-200">
                  {c.name}
                  <span className="sr-only">{c.ok ? " passed" : " failed"}</span>
                </span>
                <Mono className="w-full text-ink-400">{c.detail}</Mono>
              </li>
            ))}
          </ul>
          <details className="mt-2">
            <summary className="tap flex cursor-pointer items-center text-xs font-semibold text-ink-300">Recomputed winners ({result.winners.length})</summary>
            <ul className="mt-1 space-y-1 text-xs">
              {result.winners.map((w) => (
                <li key={w.rank}>
                  <span className="font-semibold text-ink-100">
                    #{w.rank} → ticket {w.ticketNumber}
                  </span>{" "}
                  <span className="text-ink-400">nonce {w.nonce}, index {w.index}</span>
                  <Mono className="block text-ink-400">{w.digest}</Mono>
                </li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
