"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Ticket } from "lucide-react";
import { Button, Field, Input, Panel, SectionTitle, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, newIdempotencyKey, subscribeSse } from "@/lib/client/api";
import { moneyStr } from "@/lib/format";
import { GateErrors, errorMessage, gateReasons, type GateReason } from "./GateErrors";

export interface RaffleEntryProps {
  raffleId: string;
  status: string;
  entryMode: "FREE" | "PROMOTIONAL" | "PURCHASE_LINKED";
  ticketPriceMinor: string;
  currency: string;
  maxTickets: number;
  maxTicketsPerUser: number;
  issued: number;
  myCount: number;
  signedIn: boolean;
  opensAt: string;
  closesAt: string;
}

/** Entry form plus the realtime subscription for the raffle page (refreshes the server-rendered page on events). */
export function RaffleEntry(p: RaffleEntryProps) {
  const router = useRouter();
  const toast = useToast();
  const [liveIssued, setLiveIssued] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const issued = Math.max(p.issued, liveIssued ?? 0);
  const [count, setCount] = useState(1);
  const [source, setSource] = useState<"FREE" | "PURCHASE">(p.entryMode === "PURCHASE_LINKED" ? "PURCHASE" : "FREE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<GateReason[]>([]);
  const [issuedNow, setIssuedNow] = useState<Array<{ ticketNumber: number; ticketId: string }>>([]);

  useEffect(() => {
    const refresh = () => router.refresh();
    return subscribeSse(`/raffles/${p.raffleId}/events`, {
      "tickets.issued": (d) => {
        const n = (d as { issued?: number } | null)?.issued;
        if (typeof n === "number") setLiveIssued(n);
        refresh();
      },
      closed: refresh,
      drawn: refresh,
    });
  }, [p.raffleId, router]);

  const openWindow = p.status === "OPEN" && now >= new Date(p.opensAt).getTime() && now < new Date(p.closesAt).getTime();
  const remainingForMe = Math.max(0, p.maxTicketsPerUser - p.myCount);
  const remainingTotal = Math.max(0, p.maxTickets - issued);
  const max = Math.min(remainingForMe, remainingTotal, 100);
  const pricePer = BigInt(p.ticketPriceMinor);
  const total = source === "PURCHASE" ? pricePer * BigInt(Math.max(1, count)) : 0n;

  async function enter(ev: React.FormEvent) {
    ev.preventDefault();
    setBusy(true);
    setError(null);
    setReasons([]);
    try {
      const res = await api<{ tickets: Array<{ ticketNumber: number; ticketId: string }> }>(`/raffles/${p.raffleId}/enter`, { method: "POST", idempotencyKey: newIdempotencyKey(), body: { count, source } });
      setIssuedNow(res.tickets);
      toast.push({ title: `${res.tickets.length} ticket${res.tickets.length === 1 ? "" : "s"} issued`, body: res.tickets.map((t) => `#${t.ticketNumber}`).join(", "), tone: "success" });
      router.refresh();
    } catch (e) {
      const rs = gateReasons(e);
      setReasons(rs);
      setError(rs.length ? null : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel as="section" aria-labelledby="enter-title" strong>
      <SectionTitle title="Enter" sub={`${issued.toLocaleString("en-US")} / ${p.maxTickets.toLocaleString("en-US")} tickets issued`} />
      <div className="mb-3 h-1.5 w-full overflow-hidden rounded-full bg-white/8" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${Math.min(100, (issued / Math.max(1, p.maxTickets)) * 100)}%` }} />
      </div>
      {!openWindow ? (
        <p className="text-sm text-ink-400">{p.status === "UPCOMING" ? "Entries open soon." : "Entries are closed."}</p>
      ) : !p.signedIn ? (
        <Link href={`/login?next=/raffles/${p.raffleId}`} className="tap inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-ink-950">
          Sign in to enter
        </Link>
      ) : max === 0 ? (
        <p className="text-sm text-ink-300">{remainingTotal === 0 ? "All tickets have been issued." : `You hold the maximum of ${p.maxTicketsPerUser} tickets for this raffle.`}</p>
      ) : (
        <form onSubmit={enter} className="space-y-3">
          {p.entryMode === "PURCHASE_LINKED" && (
            <Field label="Entry route" htmlFor="entry-source" hint="A free alternative method of entry is always available; both routes issue identical tickets.">
              <Select id="entry-source" value={source} onChange={(e) => setSource(e.target.value as "FREE" | "PURCHASE")}>
                <option value="PURCHASE">Purchase-linked ({moneyStr(p.ticketPriceMinor, p.currency)} per ticket)</option>
                <option value="FREE">Free entry (no purchase necessary)</option>
              </Select>
            </Field>
          )}
          <Field label={`Tickets (1–${max})`} htmlFor="ticket-count" hint={`Up to ${p.maxTicketsPerUser} per person; you hold ${p.myCount}.`}>
            <Input id="ticket-count" type="number" inputMode="numeric" min={1} max={max} value={count} onChange={(e) => setCount(Math.max(1, Math.min(max, Number(e.target.value) || 1)))} />
          </Field>
          <div className="flex items-center justify-between text-sm" aria-live="polite">
            <span className="text-ink-400">Total</span>
            <span className="font-display font-bold">{total === 0n ? "Free" : moneyStr(total, p.currency)}</span>
          </div>
          <GateErrors reasons={reasons} title="You cannot enter yet" />
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            <Ticket size={16} aria-hidden /> {busy ? "Issuing…" : `Get ${count} ticket${count === 1 ? "" : "s"}`}
          </Button>
          {issuedNow.length > 0 && (
            <p role="status" className="text-xs text-ink-300">
              Just issued: {issuedNow.map((t) => `#${t.ticketNumber} (${t.ticketId})`).join(", ")}
            </p>
          )}
        </form>
      )}
    </Panel>
  );
}
