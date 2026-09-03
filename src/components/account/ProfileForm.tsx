"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Save } from "lucide-react";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { errorMessage } from "@/components/events/GateErrors";
import type { AccountOverview } from "./types";

const FALLBACK_ZONES = ["UTC", "Europe/London", "Europe/Paris", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney"];

export function ProfileForm({ user, jurisdictions }: { user: AccountOverview["user"]; jurisdictions: AccountOverview["jurisdictions"] }) {
  const router = useRouter();
  const toast = useToast();
  const [displayName, setDisplayName] = useState(user.displayName);
  const [timezone, setTimezone] = useState(user.timezone);
  const [region, setRegion] = useState(user.jurisdictionCode ?? "");
  const [dob, setDob] = useState(user.dateOfBirth ? user.dateOfBirth.slice(0, 10) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const zones = useMemo(() => {
    try {
      const list = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? FALLBACK_ZONES;
      return list.includes(timezone) ? list : [timezone, ...list];
    } catch {
      return FALLBACK_ZONES;
    }
  }, [timezone]);
  const selected = jurisdictions.find((j) => j.code === region);
  const regionChanged = region !== (user.jurisdictionCode ?? "");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/account", { method: "PATCH", body: { displayName: displayName.trim(), timezone, jurisdictionCode: region || null, dateOfBirth: dob || null } });
      toast.push({ title: "Profile saved", tone: "success" });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
      <Field label="Display name" htmlFor="displayName">
        <Input id="displayName" value={displayName} onChange={(e) => setDisplayName(e.target.value)} minLength={2} maxLength={64} required autoComplete="nickname" />
      </Field>
      <Field label="Email" htmlFor="email" hint="Contact support to change your email.">
        <Input id="email" value={user.email} readOnly disabled autoComplete="email" />
      </Field>
      <Field label="Timezone" htmlFor="timezone" hint="Used for race windows and timestamps.">
        <Select id="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {zones.map((z) => (
            <option key={z} value={z}>
              {z}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date of birth" htmlFor="dob" hint="Required for age checks where document verification is not used.">
        <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} max={new Date().toISOString().slice(0, 10)} autoComplete="bday" />
      </Field>
      <div className="md:col-span-2">
        <Field label="Region" htmlFor="region">
          <Select id="region" value={region} onChange={(e) => setRegion(e.target.value)}>
            <option value="">Select your region…</option>
            {jurisdictions.map((j) => (
              <option key={j.code} value={j.code}>
                {j.name} ({j.code})
              </option>
            ))}
          </Select>
        </Field>
        <div role="note" className="mt-2 flex items-start gap-2 rounded-xl border border-amber-400/30 bg-amber-400/5 p-3 text-xs text-ink-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden />
          <div>
            Which features you can use depends on your region. Nothing is enabled anywhere without a recorded legal basis, and declaring a region you are not in may lead to account closure.
            {selected && (
              <div className="mt-1 text-ink-300">
                {selected.name}: paid openings {selected.paidChanceEnabled ? "enabled" : "off"} · battles {selected.battlesEnabled ? "enabled" : "off"} · raffles {selected.rafflesEnabled ? "enabled" : "off"} · sell-back {selected.cashConversionEnabled ? "enabled" : "off"} · minimum age {selected.minAge}.
              </div>
            )}
            {regionChanged && <div className="mt-1 text-amber-400">Changing region re-evaluates every eligibility gate immediately.</div>}
          </div>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger md:col-span-2">
          {error}
        </p>
      )}
      <div className="md:col-span-2">
        <Button type="submit" disabled={busy}>
          <Save size={16} aria-hidden /> {busy ? "Saving…" : "Save profile"}
        </Button>
      </div>
    </form>
  );
}
