"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button, Field, Select, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { errorMessage } from "@/components/events/GateErrors";
import type { AccountOverview } from "./types";

type VType = "AGE" | "IDENTITY" | "ADDRESS";
const TYPES: Array<{ type: VType; title: string; body: string }> = [
  { type: "AGE", title: "Age", body: "Required for every paid or free chance-based feature." },
  { type: "IDENTITY", title: "Identity", body: "Required for paid openings, battles, marketplace and sell-back." },
  { type: "ADDRESS", title: "Address", body: "Required before physical items can be shipped." },
];

function tone(status: string | undefined): "lime" | "amber" | "danger" | "neutral" {
  if (status === "APPROVED") return "lime";
  if (status === "PENDING") return "amber";
  if (status === "REJECTED" || status === "EXPIRED") return "danger";
  return "neutral";
}

export function VerificationPanel({ verifications }: { verifications: AccountOverview["verifications"] }) {
  const router = useRouter();
  const toast = useToast();
  const [simulate, setSimulate] = useState<"approve" | "pending" | "reject">("approve");
  const [busy, setBusy] = useState<VType | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(type: VType) {
    setBusy(type);
    setError(null);
    try {
      const r = await api<{ verification: { status: string } }>("/account/verifications", { method: "POST", body: { type, payload: { method: "document", simulate } } });
      toast.push({ title: `${type.toLowerCase()} verification ${r.verification.status.toLowerCase()}`, tone: r.verification.status === "APPROVED" ? "success" : "default" });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3">
        {TYPES.map((t) => {
          const latest = verifications.find((v) => v.type === t.type);
          const approved = latest?.status === "APPROVED";
          return (
            <div key={t.type} className={cx("flex flex-col gap-2 rounded-xl border p-3", approved ? "border-lime-400/40 bg-lime-400/5" : "border-white/10")}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-display font-bold">{t.title}</span>
                <Badge tone={tone(latest?.status)}>{latest ? latest.status.toLowerCase() : "not started"}</Badge>
              </div>
              <p className="text-xs text-ink-400">{t.body}</p>
              {latest && (
                <p className="text-xs text-ink-500">
                  {latest.provider} · {fmtDate(latest.createdAt)}
                  {latest.reason ? ` · ${latest.reason}` : ""}
                </p>
              )}
              {!approved && (
                <Button size="sm" tone="secondary" onClick={() => void submit(t.type)} disabled={busy !== null} className="mt-auto">
                  {busy === t.type ? "Submitting…" : latest?.status === "PENDING" ? "Resubmit" : "Verify with document"}
                </Button>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 rounded-xl border border-dashed border-amber-400/40 p-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Field label="Mock provider outcome (local development only)" htmlFor="kyc-sim" hint="The bundled KYC adapter is a fake. This selector only exists so developers can exercise each outcome; it has no effect with a real provider.">
            <Select id="kyc-sim" value={simulate} onChange={(e) => setSimulate(e.target.value as typeof simulate)}>
              <option value="approve">approve</option>
              <option value="pending">pending</option>
              <option value="reject">reject</option>
            </Select>
          </Field>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
