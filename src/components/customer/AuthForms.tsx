"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError, api } from "@/lib/client/api";

const REGIONS = [
  { code: "DEMO", name: "Demo Region (all features, local dev)" },
  { code: "GB", name: "United Kingdom" },
  { code: "US-NY", name: "United States – New York" },
  { code: "CA-ON", name: "Canada – Ontario" },
  { code: "DE", name: "Germany" },
];

/** Latest date of birth that satisfies the lowest regional minimum age (computed once per module load, not per render). */
const MAX_DOB = new Date(Date.now() - 18 * 365.25 * 86_400_000).toISOString().slice(0, 10);

function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function fieldErrors(e: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (e instanceof ApiError && Array.isArray(e.details)) {
    for (const issue of e.details as Array<{ path?: Array<string | number>; message?: string }>) {
      const key = issue.path?.[0];
      if (typeof key === "string" && issue.message && !out[key]) out[key] = issue.message;
    }
  }
  return out;
}

export function LoginForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api("/auth/login", { method: "POST", body: { email: String(fd.get("email") ?? "").trim(), password: String(fd.get("password") ?? "") } });
      toast.push({ title: "Signed in", tone: "success" });
      router.push(safeNext(next));
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not sign in.");
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4" aria-describedby={error ? "login-error" : undefined}>
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" required autoComplete="email" inputMode="email" />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" required autoComplete="current-password" />
      </Field>
      <div aria-live="polite">
        {error && (
          <p id="login-error" role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={busy} aria-busy={busy} className="w-full">
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-sm text-ink-300">
        New here?{" "}
        <Link href={`/register${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-cyan-300 hover:underline">
          Create an account
        </Link>
      </p>
    </form>
  );
}

export function RegisterForm({ next }: { next?: string | null }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body = {
      email: String(fd.get("email") ?? "").trim(),
      password: String(fd.get("password") ?? ""),
      displayName: String(fd.get("displayName") ?? "").trim(),
      jurisdictionCode: String(fd.get("jurisdictionCode") ?? "") || undefined,
      dateOfBirth: String(fd.get("dateOfBirth") ?? "") || undefined,
    };
    setBusy(true);
    setError(null);
    setErrors({});
    try {
      await api("/auth/register", { method: "POST", body });
      toast.push({ title: "Welcome", body: "Your account is ready.", tone: "success" });
      router.push(safeNext(next));
      router.refresh();
    } catch (err) {
      setErrors(fieldErrors(err));
      setError(err instanceof ApiError ? err.message : "Could not create your account.");
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <Field label="Email" htmlFor="email" error={errors.email}>
        <Input id="email" name="email" type="email" required maxLength={320} autoComplete="email" inputMode="email" />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters" error={errors.password}>
        <Input id="password" name="password" type="password" required minLength={10} maxLength={200} autoComplete="new-password" />
      </Field>
      <Field label="Display name" htmlFor="displayName" error={errors.displayName}>
        <Input id="displayName" name="displayName" required minLength={2} maxLength={64} autoComplete="nickname" />
      </Field>
      <Field label="Region" htmlFor="jurisdictionCode" hint="Determines which paid features are available. No region is legally approved by default." error={errors.jurisdictionCode}>
        <Select id="jurisdictionCode" name="jurisdictionCode" defaultValue="DEMO">
          {REGIONS.map((r) => (
            <option key={r.code} value={r.code}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Date of birth" htmlFor="dateOfBirth" hint="You must meet the minimum age for your region." error={errors.dateOfBirth}>
        <Input id="dateOfBirth" name="dateOfBirth" type="date" required max={MAX_DOB} autoComplete="bday" />
      </Field>
      <div aria-live="polite">
        {error && (
          <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
      </div>
      <Button type="submit" size="lg" disabled={busy} aria-busy={busy} className="w-full">
        {busy ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm text-ink-300">
        Already have an account?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold text-cyan-300 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
