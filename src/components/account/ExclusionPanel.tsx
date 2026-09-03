"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Field, Input, Select, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { errorMessage } from "@/components/events/GateErrors";
import type { AccountOverview } from "./types";

type Kind = "COOLING_OFF" | "SELF_EXCLUSION";

export function ExclusionPanel({ exclusions }: { exclusions: AccountOverview["exclusions"] }) {
  const router = useRouter();
  const [coolDays, setCoolDays] = useState(7);
  const [selfDays, setSelfDays] = useState<"180" | "365" | "indefinite">("180");
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState<Kind | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now] = useState(() => Date.now());
  const active = exclusions.filter((e) => new Date(e.startsAt).getTime() <= now && (!e.endsAt || new Date(e.endsAt).getTime() > now));

  async function submit(kind: Kind) {
    setBusy(true);
    setError(null);
    try {
      await api("/account/exclusions", { method: "POST", body: { type: kind, days: kind === "COOLING_OFF" ? coolDays : selfDays === "indefinite" ? null : Number(selfDays), reason: reason.trim() || undefined } });
      // Every session is revoked server-side; send the user to sign-in.
      router.push("/login?next=/account");
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {active.length > 0 && (
        <div role="status" className="rounded-xl border border-amber-400/40 bg-amber-400/5 p-3 text-sm">
          {active.map((e) => (
            <div key={e.id} className="flex flex-wrap items-center gap-2">
              <Badge tone="amber">{e.type.replace(/_/g, " ").toLowerCase()}</Badge>
              <span className="text-ink-200">active until {e.endsAt ? fmtDate(e.endsAt) : "further notice"}</span>
            </div>
          ))}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-white/10 p-3">
          <h3 className="font-display font-bold">Cooling-off</h3>
          <p className="mt-1 text-xs text-ink-400">Blocks openings, battles, raffles, marketplace and deposits for 1–30 days. Sell-back stays available.</p>
          <div className="mt-2">
            <Field label="Days (1–30)" htmlFor="cool-days">
              <Input id="cool-days" type="number" inputMode="numeric" min={1} max={30} value={coolDays} onChange={(e) => setCoolDays(Math.max(1, Math.min(30, Number(e.target.value) || 1)))} />
            </Field>
          </div>
          <Button tone="secondary" className="mt-3 w-full" onClick={() => setConfirm("COOLING_OFF")} disabled={busy}>
            Start cooling-off
          </Button>
        </div>
        <div className="rounded-xl border border-danger/40 p-3">
          <h3 className="font-display font-bold">Self-exclusion</h3>
          <p className="mt-1 text-xs text-ink-400">At least 180 days, or indefinite. Cannot be shortened by you once active; contact support for the reinstatement process.</p>
          <div className="mt-2">
            <Field label="Duration" htmlFor="self-days">
              <Select id="self-days" value={selfDays} onChange={(e) => setSelfDays(e.target.value as typeof selfDays)}>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
                <option value="indefinite">Indefinite</option>
              </Select>
            </Field>
          </div>
          <Button tone="danger" className="mt-3 w-full" onClick={() => setConfirm("SELF_EXCLUSION")} disabled={busy}>
            Self-exclude
          </Button>
        </div>
      </div>
      <Field label="Reason (optional, private)" htmlFor="excl-reason">
        <Textarea id="excl-reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className="min-h-16" />
      </Field>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {exclusions.length > 0 && (
        <details>
          <summary className="tap flex cursor-pointer items-center text-sm font-semibold text-ink-200">History ({exclusions.length})</summary>
          <ul className="mt-2 space-y-1 text-sm">
            {exclusions.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-2 text-ink-300">
                <Badge tone="neutral">{e.type.replace(/_/g, " ").toLowerCase()}</Badge>
                {fmtDate(e.startsAt)} → {e.endsAt ? fmtDate(e.endsAt) : "indefinite"}
              </li>
            ))}
          </ul>
        </details>
      )}

      {confirm && (
        <div role="dialog" aria-modal="true" aria-labelledby="excl-confirm-title" className="fixed inset-0 z-[80] flex items-end justify-center bg-ink-950/80 p-4 backdrop-blur-sm md:items-center" onKeyDown={(e) => e.key === "Escape" && !busy && setConfirm(null)}>
          <div className="glass glass-strong rise w-full max-w-md space-y-3 p-5">
            <h3 id="excl-confirm-title" className="font-display text-xl font-extrabold">
              {confirm === "COOLING_OFF" ? `Start a ${coolDays}-day cooling-off period?` : `Self-exclude ${selfDays === "indefinite" ? "indefinitely" : `for ${selfDays} days`}?`}
            </h3>
            <p className="text-sm text-ink-200">{confirm === "COOLING_OFF" ? "You will be signed out everywhere and unable to open packs, join battles or raffles, buy on the marketplace or deposit until the period ends. This cannot be cancelled early." : "You will be signed out everywhere. Self-exclusion cannot be shortened from your account; reinstatement requires the support process and a further waiting period. Sell-back of items you already own stays available."}</p>
            <div className="flex gap-2">
              <Button tone="secondary" className="flex-1" onClick={() => setConfirm(null)} disabled={busy} autoFocus>
                Cancel
              </Button>
              <Button tone="danger" className="flex-1" onClick={() => void submit(confirm)} disabled={busy}>
                {busy ? "Applying…" : "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
