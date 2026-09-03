"use client";
import { useEffect, useState } from "react";
import { RefreshCw, Save } from "lucide-react";
import { Button, Field, Input, Mono, Panel, SectionTitle, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { errorMessage } from "./GateErrors";

interface SeedResponse {
  active: { id: string; serverSeedHash: string; clientSeed: string; nonce: number; useCount: number; createdAt: string };
  history: Array<{ id: string; serverSeedHash: string; revealedServerSeed: string | null; status: string; useCount: number; createdAt: string; revealedAt: string | null; clientSeed: string }>;
}
interface RotateResponse {
  retired: { id: string; serverSeedHash: string; revealedServerSeed: string; uses: number };
  next: { id: string; serverSeedHash: string; clientSeed: string };
}

/** "Your seeds": active commitment, editable client seed, nonce, rotation with reveal, and history. */
export function SeedPanel() {
  const toast = useToast();
  const [data, setData] = useState<SeedResponse | null>(null);
  const [clientSeed, setClientSeed] = useState("");
  const [busy, setBusy] = useState<"save" | "rotate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<RotateResponse["retired"] | null>(null);

  const load = async () => {
    try {
      const d = await api<SeedResponse>("/fairness/seed");
      setData(d);
      setClientSeed(d.active.clientSeed);
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  useEffect(() => {
    api<SeedResponse>("/fairness/seed")
      .then((d) => {
        setData(d);
        setClientSeed(d.active.clientSeed);
      })
      .catch((e) => setError(errorMessage(e)));
  }, []);

  async function save() {
    setBusy("save");
    setError(null);
    try {
      await api("/fairness/seed", { method: "PUT", body: { clientSeed: clientSeed.trim() } });
      toast.push({ title: "Client seed updated", body: "It applies to your next opening." });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  async function rotate() {
    if (!window.confirm("Rotate your server seed? The current seed is revealed so past openings can be verified, and a fresh commitment is created.")) return;
    setBusy("rotate");
    setError(null);
    try {
      const r = await api<RotateResponse>("/fairness/seed/rotate", { method: "POST", body: {} });
      setRevealed(r.retired);
      toast.push({ title: "Seed rotated", body: "The previous server seed is now revealed.", tone: "success" });
      await load();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Panel as="section" aria-labelledby="seeds-title">
      <SectionTitle title="Your seeds" sub="Your active server-seed commitment and the client seed you contribute to every opening." />
      {!data ? (
        <p className="text-sm text-ink-400">{error ?? "Loading…"}</p>
      ) : (
        <div className="space-y-4">
          <dl className="grid gap-3 text-sm md:grid-cols-3">
            <div className="md:col-span-2">
              <dt className="text-xs uppercase tracking-wider text-ink-400">Active server seed hash</dt>
              <dd>
                <Mono>{data.active.serverSeedHash}</Mono>
              </dd>
              <dd className="text-xs text-ink-500">Committed {fmtDate(data.active.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-ink-400">Next nonce · uses</dt>
              <dd className="font-mono">
                {data.active.nonce} · {data.active.useCount}
              </dd>
            </div>
          </dl>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <Field label="Client seed" htmlFor="client-seed" hint="1–64 characters: letters, digits, _ or -. Change it any time; the server cannot predict it.">
                <Input id="client-seed" value={clientSeed} onChange={(e) => setClientSeed(e.target.value)} maxLength={64} pattern="[A-Za-z0-9_-]{1,64}" className="font-mono" autoComplete="off" spellCheck={false} />
              </Field>
            </div>
            <Button type="submit" tone="secondary" disabled={busy !== null || clientSeed.trim() === data.active.clientSeed}>
              <Save size={16} aria-hidden /> {busy === "save" ? "Saving…" : "Save seed"}
            </Button>
            <Button type="button" tone="secondary" onClick={() => void rotate()} disabled={busy !== null}>
              <RefreshCw size={16} aria-hidden /> {busy === "rotate" ? "Rotating…" : "Rotate & reveal"}
            </Button>
          </form>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          {revealed && (
            <div role="status" className="rounded-xl border border-lime-400/50 bg-lime-400/10 p-3 text-sm">
              <div className="font-semibold text-lime-300">Revealed server seed</div>
              <Mono className="block">{revealed.revealedServerSeed}</Mono>
              <div className="mt-1 text-xs text-ink-400">
                SHA-256 of this value must equal <Mono>{revealed.serverSeedHash}</Mono> · used for {revealed.uses} opening{revealed.uses === 1 ? "" : "s"}.
              </div>
            </div>
          )}
          <details>
            <summary className="tap flex cursor-pointer items-center text-sm font-semibold text-ink-200">Seed history ({data.history.length})</summary>
            <div className="table-wrap mt-2 rounded-xl border border-white/8">
              <table>
                <thead>
                  <tr>
                    <th scope="col">Status</th>
                    <th scope="col">Server seed hash</th>
                    <th scope="col">Revealed seed</th>
                    <th scope="col">Client seed</th>
                    <th scope="col">Uses</th>
                    <th scope="col">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {data.history.map((h) => (
                    <tr key={h.id}>
                      <td className={cx(h.status === "REVEALED" ? "text-lime-300" : h.status === "ACTIVE" ? "text-cyan-300" : "text-ink-300")}>{h.status.toLowerCase()}</td>
                      <td>
                        <Mono>{h.serverSeedHash}</Mono>
                      </td>
                      <td>{h.revealedServerSeed ? <Mono>{h.revealedServerSeed}</Mono> : <span className="text-ink-500">not yet</span>}</td>
                      <td>
                        <Mono>{h.clientSeed}</Mono>
                      </td>
                      <td className="font-mono">{h.useCount}</td>
                      <td className="text-ink-400">{fmtDate(h.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </div>
      )}
    </Panel>
  );
}
