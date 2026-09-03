import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { FairnessVerifier, type VerifierPrefill } from "@/components/events/FairnessVerifier";
import { SeedPanel } from "@/components/events/SeedPanel";
import { Mono, Panel } from "@/components/ui/primitives";
import { viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Fairness" };

const STEPS: Array<{ title: string; body: string }> = [
  { title: "1. Commit", body: "Before you open anything we generate a secret server seed and publish only its SHA-256 hash. The hash is the commitment: the seed cannot be changed afterwards without breaking it." },
  { title: "2. Your client seed", body: "You contribute a client seed you can change at any time. Because it is yours, the server cannot pre-compute results, and because the server seed is committed, you cannot steer them either." },
  { title: "3. Nonce", body: "Each opening under a seed pair uses the next nonce (0, 1, 2 …). Battles use nonce = roundIndex × seats + seatIndex, raffles start at 0 and increment per winner." },
  { title: "4. HMAC-SHA-256", body: "The digest is HMAC-SHA-256 keyed with the server seed over the exact message below. Changing any part of the message changes the digest completely." },
  { title: "5. Rejection sampling", body: "The digest is read in 32-bit windows. A window is accepted only if it is below the largest multiple of the range that fits in 2³²; otherwise the next window (or an HMAC extension of the message) is used. This removes modulo bias." },
  { title: "6. Mapping to remaining inventory", body: "The accepted value modulo the range is an index into the remaining quantities of the pack, in manifest order. Sold-out outcomes have zero weight, so odds are always the live, disclosed odds." },
  { title: "7. Signed receipt", body: "Every opening is stored with a receipt (seed hash, client seed, nonce, manifest hash, digest, index, remaining-inventory snapshot) signed with an Ed25519 key. The public key is published below." },
  { title: "8. Seed reveal policy", body: "Server seeds are revealed when you rotate them, or automatically after the reveal window or the maximum number of uses. Battle and raffle seeds are revealed at settlement or draw. With the revealed seed you can recompute every result yourself." },
];

export default async function FairnessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const { session } = await viewer();
  const prefill: VerifierPrefill = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string") (prefill as Record<string, string>)[k] = v;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display flex items-center gap-2 text-2xl font-extrabold md:text-3xl">
          <ShieldCheck className="text-cyan-300" aria-hidden /> Provably fair
        </h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-400">Every result is decided by cryptography before anything is shown to you. The reel animation is presentation only: it never decides, delays or influences an outcome.</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {STEPS.map((s) => (
          <Panel key={s.title} as="article">
            <h2 className="font-display text-base font-bold">{s.title}</h2>
            <p className="mt-1 text-sm text-ink-300">{s.body}</p>
          </Panel>
        ))}
      </div>

      <Panel strong>
        <h2 className="font-display text-lg font-bold">The exact message format</h2>
        <Mono className="mt-2 block text-sm text-cyan-300">clientSeed:nonce:packVersionId:manifestHash</Mono>
        <p className="mt-2 text-sm text-ink-300">
          digest = HMAC-SHA-256(key = serverSeed as hex text, message). For raffles the client seed is the declared public randomness and the scope is the raffle id. Extension digests, when needed, are HMAC over <Mono>message:1</Mono>, <Mono>message:2</Mono>, …
        </p>
        <ul className="mt-3 grid gap-1 text-sm text-ink-300 sm:grid-cols-3">
          <li>• Odds are identical for every user: there are no per-user odds, ever.</li>
          <li>• Inventory is physical and reserved at publish; the manifest hash locks it.</li>
          <li>
            • Receipts live on each opening page and in <Link href="/account#history" className="text-cyan-300 hover:underline">your history</Link>.
          </li>
        </ul>
      </Panel>

      <FairnessVerifier prefill={prefill} />

      {session ? (
        <SeedPanel />
      ) : (
        <Panel>
          <p className="text-sm text-ink-300">
            <Link href="/login?next=/fairness" className="font-semibold text-cyan-300 hover:underline">
              Sign in
            </Link>{" "}
            to see your active seed commitment, edit your client seed and rotate seeds.
          </p>
        </Panel>
      )}
    </div>
  );
}
