"use client";
/** Per-holding actions: ship, sell back, list / cancel listing, history. Each runs in a modal and refreshes the page on success. */
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { History, Package, Store, Truck } from "lucide-react";
import { Button, Field, Input, Mono, Select, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError, api, newIdempotencyKey } from "@/lib/client/api";
import { fmtDate, moneyStr } from "@/lib/format";
import { Modal } from "./Modal";
import { gateFix, type GateReason, type VaultItem } from "./types";
import Link from "next/link";

export type VaultAction = "ship" | "sell" | "list" | "history";

function errorText(e: unknown): { message: string; reasons: GateReason[] } {
  if (e instanceof ApiError) return { message: e.message, reasons: (e.details as { reasons?: GateReason[] } | undefined)?.reasons ?? [] };
  return { message: "Something went wrong.", reasons: [] };
}

function ErrorBox({ error }: { error: { message: string; reasons: GateReason[] } | null }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      {error.message}
      {error.reasons.length > 0 && (
        <ul className="mt-1 text-ink-200">
          {error.reasons.map((r) => (
            <li key={r.code}>
              {r.message}{" "}
              <Link href={gateFix(r.code).href} className="font-semibold text-cyan-300 hover:underline">
                {gateFix(r.code).label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VaultItemActions({ item, initialAction, feeBp }: { item: VaultItem; initialAction?: VaultAction | null; feeBp: number }) {
  const [action, setAction] = useState<VaultAction | null>(initialAction ?? null);
  const router = useRouter();
  const inVault = item.item.status === "IN_VAULT";
  const close = () => setAction(null);
  const done = (msg: string) => {
    close();
    router.refresh();
    return msg;
  };
  const btn = "tap inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40";
  return (
    <>
      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={`Actions for ${item.sku.name}`}>
        <button type="button" className={cx(btn, "glass glass-strong text-ink-100 hover:bg-white/10")} disabled={!inVault || item.sku.shippingRestricted} onClick={() => setAction("ship")} title={item.sku.shippingRestricted ? "This item cannot be shipped" : undefined}>
          <Truck size={14} aria-hidden /> Ship
        </button>
        <button type="button" className={cx(btn, "glass glass-strong text-ink-100 hover:bg-white/10")} disabled={!inVault} onClick={() => setAction("sell")}>
          <Package size={14} aria-hidden /> Sell
        </button>
        {item.listing ? (
          <CancelListingButton listingId={item.listing.id} className={cx(btn, "border border-amber-400/40 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20")} />
        ) : (
          <button type="button" className={cx(btn, "glass glass-strong text-ink-100 hover:bg-white/10")} disabled={!inVault} onClick={() => setAction("list")}>
            <Store size={14} aria-hidden /> List
          </button>
        )}
        <button type="button" className={cx(btn, "text-ink-300 hover:bg-white/5")} onClick={() => setAction("history")}>
          <History size={14} aria-hidden /> History
        </button>
      </div>
      <Modal open={action === "ship"} onClose={close} title="Request shipping">
        {action === "ship" && <ShipForm item={item} onDone={done} />}
      </Modal>
      <Modal open={action === "sell"} onClose={close} title="Sell now">
        {action === "sell" && <SellFlow item={item} onDone={done} />}
      </Modal>
      <Modal open={action === "list"} onClose={close} title="List on marketplace">
        {action === "list" && <ListForm item={item} feeBp={feeBp} onDone={done} />}
      </Modal>
      <Modal open={action === "history"} onClose={close} title="Chain of custody" wide>
        {action === "history" && <HistoryView item={item} />}
      </Modal>
    </>
  );
}

// ---- Ship ---------------------------------------------------------------------------------
const COUNTRIES = [
  ["US", "United States"],
  ["GB", "United Kingdom"],
  ["CA", "Canada"],
  ["DE", "Germany"],
  ["FR", "France"],
  ["AU", "Australia"],
  ["JP", "Japan"],
];

function ShipForm({ item, onDone }: { item: VaultItem; onDone: (msg: string) => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof errorText> | null>(null);
  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const address = {
      name: String(fd.get("name") ?? ""),
      line1: String(fd.get("line1") ?? ""),
      line2: String(fd.get("line2") ?? "") || undefined,
      city: String(fd.get("city") ?? ""),
      region: String(fd.get("region") ?? "") || undefined,
      postalCode: String(fd.get("postalCode") ?? ""),
      country: String(fd.get("country") ?? "US"),
      phone: String(fd.get("phone") ?? "") || undefined,
    };
    setBusy(true);
    setError(null);
    try {
      await api("/shipments", { method: "POST", body: { holdingId: item.holdingId, address, insured: fd.get("insured") === "on" } });
      toast.push({ title: "Shipping requested", body: `${item.sku.name} is queued for fulfilment.`, tone: "success" });
      onDone("shipped");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-ink-300">
        Ship <span className="font-semibold text-ink-100">{item.sku.name}</span> ({item.item.itemCode}) from the vault. Insured for {moneyStr(item.referenceValueMinor, item.currency)}. Your address is encrypted at rest.
      </p>
      <Field label="Full name" htmlFor="ship-name">
        <Input id="ship-name" name="name" required minLength={2} maxLength={96} autoComplete="name" />
      </Field>
      <Field label="Address line 1" htmlFor="ship-line1">
        <Input id="ship-line1" name="line1" required minLength={3} maxLength={120} autoComplete="address-line1" />
      </Field>
      <Field label="Address line 2" htmlFor="ship-line2">
        <Input id="ship-line2" name="line2" maxLength={120} autoComplete="address-line2" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="City" htmlFor="ship-city">
          <Input id="ship-city" name="city" required maxLength={80} autoComplete="address-level2" />
        </Field>
        <Field label="State / region" htmlFor="ship-region">
          <Input id="ship-region" name="region" maxLength={80} autoComplete="address-level1" />
        </Field>
        <Field label="Postal code" htmlFor="ship-postal">
          <Input id="ship-postal" name="postalCode" required minLength={2} maxLength={20} autoComplete="postal-code" />
        </Field>
        <Field label="Country" htmlFor="ship-country">
          <Select id="ship-country" name="country" defaultValue="US" autoComplete="country">
            {COUNTRIES.map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Phone (optional)" htmlFor="ship-phone">
        <Input id="ship-phone" name="phone" type="tel" maxLength={32} autoComplete="tel" />
      </Field>
      <label className="tap flex items-center gap-2 text-sm text-ink-200">
        <input type="checkbox" name="insured" defaultChecked className="h-4 w-4 accent-cyan-400" /> Insure shipment at reference value
      </label>
      <ErrorBox error={error} />
      <Button type="submit" disabled={busy} aria-busy={busy} className="w-full">
        {busy ? "Requesting…" : "Request shipping"}
      </Button>
    </form>
  );
}

// ---- Sell-back --------------------------------------------------------------------------
interface Quote {
  id: string;
  offerMinor: string;
  referenceValueMinor: string;
  currency: string;
  expiresAt: string;
  status: string;
}

function SellFlow({ item, onDone }: { item: VaultItem; onDone: (msg: string) => void }) {
  const toast = useToast();
  const [quote, setQuote] = useState<{ quote: Quote; policy: { version: string; description: string } } | null>(null);
  const [error, setError] = useState<ReturnType<typeof errorText> | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    api<{ quote: Quote; policy: { version: string; description: string } }>("/sellback/quotes", { method: "POST", body: { holdingId: item.holdingId } })
      .then((q) => {
        if (!cancelled) setQuote(q);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorText(e));
      });
    return () => {
      cancelled = true;
    };
  }, [item.holdingId]);

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t = setInterval(tick, 1000);
    tick();
    return () => clearInterval(t);
  }, []);

  const remainingMs = quote && now ? new Date(quote.quote.expiresAt).getTime() - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;
  const mm = remainingMs !== null ? Math.floor(Math.max(0, remainingMs) / 60000) : 0;
  const ss = remainingMs !== null ? Math.floor((Math.max(0, remainingMs) % 60000) / 1000) : 0;

  const accept = async () => {
    if (!quote) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/sellback/quotes/${quote.quote.id}/accept`, { method: "POST", idempotencyKey: newIdempotencyKey() });
      toast.push({ title: "Sold back", body: `${moneyStr(quote.quote.offerMinor, quote.quote.currency)} added to your balance.`, tone: "success" });
      onDone("sold");
    } catch (e) {
      setError(errorText(e));
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className="text-sm text-ink-300">
        Sell <span className="font-semibold text-ink-100">{item.sku.name}</span> ({item.item.itemCode}) back to the platform for the disclosed offer.
      </p>
      {!quote && !error && <div className="shimmer h-20 rounded-xl" aria-label="Loading quote" />}
      {quote && (
        <div className="glass glass-strong flex flex-col gap-2 p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Offer</div>
              <div className="font-display text-2xl font-extrabold text-ink-100">{moneyStr(quote.quote.offerMinor, quote.quote.currency)}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Reference value</div>
              <div className="font-display text-2xl font-bold text-ink-300">{moneyStr(quote.quote.referenceValueMinor, quote.quote.currency)}</div>
            </div>
          </div>
          <div className={cx("text-sm", expired ? "text-danger" : "text-ink-300")}>
            {expired ? "This quote expired. Close and reopen to request a new one." : `Quote valid for ${mm}:${ss.toString().padStart(2, "0")}`}
          </div>
          <p className="text-xs text-ink-400">
            {quote.policy.description} Policy <Mono>{quote.policy.version}</Mono>.
          </p>
        </div>
      )}
      <ErrorBox error={error} />
      <Button onClick={accept} disabled={!quote || expired || busy} aria-busy={busy} className="w-full">
        {busy ? "Selling…" : quote ? `Accept ${moneyStr(quote.quote.offerMinor, quote.quote.currency)}` : "Preparing quote…"}
      </Button>
      <p className="text-xs text-ink-400">Accepting transfers the item back to the platform and credits your balance immediately. This cannot be undone.</p>
    </div>
  );
}

// ---- Listing --------------------------------------------------------------------------------
function ListForm({ item, feeBp, onDone }: { item: VaultItem; feeBp: number; onDone: (msg: string) => void }) {
  const toast = useToast();
  const [ask, setAsk] = useState((Number(item.referenceValueMinor) / 100).toFixed(2));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ReturnType<typeof errorText> | null>(null);
  const askNum = Number(ask);
  const valid = /^\d+(\.\d{1,2})?$/.test(ask) && askNum > 0;
  const fee = valid ? Math.round(askNum * 100 * (feeBp / 10000)) : 0;
  const net = valid ? Math.round(askNum * 100) - fee : 0;
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await api("/marketplace/listings", { method: "POST", body: { holdingId: item.holdingId, ask } });
      toast.push({ title: "Listed", body: `${item.sku.name} is live on the marketplace at ${moneyStr(String(Math.round(askNum * 100)), item.currency)}.`, tone: "success" });
      onDone("listed");
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <p className="text-sm text-ink-300">
        List <span className="font-semibold text-ink-100">{item.sku.name}</span> ({item.item.itemCode}) for other collectors. The item stays in vault custody until sold.
      </p>
      <Field label={`Ask price (${item.currency})`} htmlFor="ask" hint={`Reference value ${moneyStr(item.referenceValueMinor, item.currency)} · sell-back offer ${moneyStr(item.sellbackOfferMinor, item.currency)}`} error={ask && !valid ? "Enter a positive amount with up to 2 decimals" : null}>
        <Input id="ask" name="ask" inputMode="decimal" value={ask} onChange={(e) => setAsk(e.target.value)} required pattern="^\d+(\.\d{1,2})?$" />
      </Field>
      <div className="glass p-3 text-sm text-ink-300">
        Marketplace fee {(feeBp / 100).toFixed(2)}% is deducted from the sale: fee {moneyStr(String(fee), item.currency)} · you receive <span className="font-mono text-ink-100">{moneyStr(String(net), item.currency)}</span>.
      </div>
      <ErrorBox error={error} />
      <Button type="submit" disabled={!valid || busy} aria-busy={busy} className="w-full">
        {busy ? "Listing…" : "Create listing"}
      </Button>
    </form>
  );
}

export function CancelListingButton({ listingId, className }: { listingId: string; className?: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className={className}
      disabled={busy}
      aria-busy={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api(`/marketplace/listings/${listingId}`, { method: "DELETE" });
          toast.push({ title: "Listing cancelled", tone: "success" });
          router.refresh();
        } catch (e) {
          toast.push({ title: "Could not cancel", body: errorText(e).message, tone: "error" });
        } finally {
          setBusy(false);
        }
      }}
    >
      <Store size={14} aria-hidden /> Unlist
    </button>
  );
}

// ---- History --------------------------------------------------------------------------------
interface Transfer {
  id: string;
  fromUserId: string | null;
  toUserId: string | null;
  reason: string;
  referenceType: string | null;
  referenceId: string | null;
  ledgerTransactionId: string | null;
  createdAt: string;
}

const REASONS: Record<string, string> = {
  OPENING: "Won from a pack opening",
  BATTLE_SETTLEMENT: "Awarded in a battle",
  SELLBACK: "Sold back to the platform",
  MARKETPLACE: "Marketplace sale",
  RAFFLE_PRIZE: "Raffle prize",
  RACE_PRIZE: "Race prize",
  ADMIN: "Administrative transfer",
  VOID: "Voided",
};

function HistoryView({ item }: { item: VaultItem }) {
  const [data, setData] = useState<{ item: { id: string; itemCode: string; status: string; custody: string }; history: Transfer[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    api<{ item: { id: string; itemCode: string; status: string; custody: string }; history: Transfer[] }>(`/vault/items/${item.item.id}/history`)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorText(e).message);
      });
    return () => {
      cancelled = true;
    };
  }, [item.item.id]);
  return (
    <div className="flex flex-col gap-3" aria-live="polite">
      <p className="text-sm text-ink-300">
        <span className="font-semibold text-ink-100">{item.sku.name}</span> · <Mono>{item.item.itemCode}</Mono> · custody {item.item.custody.replace(/_/g, " ").toLowerCase()}
      </p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!data && !error && <div className="shimmer h-24 rounded-xl" aria-label="Loading history" />}
      {data && (
        <ol className="relative flex flex-col gap-4 border-l border-white/10 pl-4">
          {data.history.map((t) => (
            <li key={t.id} className="relative">
              <span aria-hidden className="absolute top-1.5 -left-[21px] h-2.5 w-2.5 rounded-full bg-cyan-400" />
              <div className="text-sm font-semibold text-ink-100">{REASONS[t.reason] ?? t.reason}</div>
              <div className="text-xs text-ink-400">{fmtDate(t.createdAt, { dateStyle: "medium", timeStyle: "short" })}</div>
              <div className="mt-1 text-xs text-ink-300">
                {t.fromUserId ? "From a collector" : "From the platform"} → {t.toUserId ? "to a collector" : "to the platform"}
              </div>
              {t.referenceType && (
                <div className="text-xs text-ink-400">
                  {t.referenceType.replace(/_/g, " ")} <Mono>{t.referenceId}</Mono>
                </div>
              )}
              {t.ledgerTransactionId && (
                <div className="text-xs text-ink-400">
                  Ledger tx <Mono>{t.ledgerTransactionId}</Mono>
                </div>
              )}
            </li>
          ))}
          {data.history.length === 0 && <li className="text-sm text-ink-400">No transfers recorded.</li>}
        </ol>
      )}
    </div>
  );
}
