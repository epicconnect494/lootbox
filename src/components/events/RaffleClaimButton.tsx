"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { errorMessage } from "./GateErrors";

export function RaffleClaimButton({ raffleId, prizeId, title }: { raffleId: string; prizeId: string; title: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="space-y-1">
      <Button
        tone="lime"
        onClick={async () => {
          setBusy(true);
          setError(null);
          try {
            await api(`/raffles/${raffleId}/claim`, { method: "POST", body: { prizeId } });
            toast.push({ title: "Prize claimed", body: `${title} is now in your vault.`, tone: "success" });
            router.refresh();
          } catch (e) {
            setError(errorMessage(e));
          } finally {
            setBusy(false);
          }
        }}
        disabled={busy}
      >
        <Gift size={16} aria-hidden /> {busy ? "Claiming…" : "Claim prize"}
      </Button>
      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
