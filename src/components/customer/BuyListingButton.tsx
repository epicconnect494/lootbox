"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, newIdempotencyKey } from "@/lib/client/api";
import { moneyStr } from "@/lib/format";
import { gateFix, type GateReason } from "./types";

export function BuyListingButton({ listingId, askMinor, currency, name, signedIn, own }: { listingId: string; askMinor: string; currency: string; name: string; signedIn: boolean; own: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<{ message: string; reasons: GateReason[] } | null>(null);

  if (!signedIn)
    return (
      <ButtonLink href={`/login?next=${encodeURIComponent("/marketplace")}`} tone="secondary" className="w-full">
        Sign in to buy
      </ButtonLink>
    );
  if (own)
    return (
      <ButtonLink href="/vault" tone="ghost" className="w-full">
        Your listing · manage in Vault
      </ButtonLink>
    );

  const buy = async () => {
    setBusy(true);
    setError(null);
    try {
      await api(`/marketplace/listings/${listingId}/buy`, { method: "POST", idempotencyKey: newIdempotencyKey() });
      toast.push({ title: "Purchased", body: `${name} is now in your vault.`, tone: "success" });
      router.refresh();
      router.push("/vault");
    } catch (e) {
      const ae = e instanceof ApiError ? e : null;
      const msg = ae?.message ?? "Purchase failed.";
      setError({ message: msg, reasons: (ae?.details as { reasons?: GateReason[] } | undefined)?.reasons ?? [] });
      toast.push({ title: "Could not buy", body: msg, tone: "error" });
      if (ae?.code === "INVALID_STATE" || ae?.code === "NOT_FOUND") router.refresh();
      setBusy(false);
      setConfirm(false);
    }
  };

  return (
    <div className="flex flex-col gap-2" aria-live="polite">
      {confirm ? (
        <div className="flex gap-2">
          <Button onClick={buy} disabled={busy} aria-busy={busy} className="flex-1">
            {busy ? "Buying…" : `Confirm ${moneyStr(askMinor, currency)}`}
          </Button>
          <Button tone="ghost" onClick={() => setConfirm(false)} disabled={busy}>
            Cancel
          </Button>
        </div>
      ) : (
        <Button onClick={() => setConfirm(true)} className="w-full">
          Buy · {moneyStr(askMinor, currency)}
        </Button>
      )}
      {error && (
        <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error.message}
          {error.reasons.map((r) => (
            <div key={r.code} className="text-ink-200">
              {r.message}{" "}
              <Link href={gateFix(r.code).href} className="font-semibold text-cyan-300 hover:underline">
                {gateFix(r.code).label}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
