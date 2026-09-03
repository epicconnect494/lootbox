"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet } from "lucide-react";
import { Badge, Button, Field, Input, Select, Stat, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api, newIdempotencyKey } from "@/lib/client/api";
import { fmtDate, moneyStr } from "@/lib/format";
import { GateErrors, errorMessage, gateReasons, type GateReason } from "@/components/events/GateErrors";
import type { AccountOverview } from "./types";

const PRESETS = ["10", "25", "50", "100"];

export function WalletPanel({ balance, payments }: { balance: AccountOverview["balance"]; payments: AccountOverview["payments"] }) {
  const router = useRouter();
  const toast = useToast();
  const [amount, setAmount] = useState("25");
  const [outcome, setOutcome] = useState<"succeed" | "fail">("succeed");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reasons, setReasons] = useState<GateReason[]>([]);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) >= 5 && Number(amount) <= 5000;

  async function deposit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    setReasons([]);
    try {
      const r = await api<{ payment: { status: string; failureReason: string | null }; balance: { cashMinor: string } }>("/account/deposits", { method: "POST", idempotencyKey: newIdempotencyKey(), body: { amount, method: "test-card", testOutcome: outcome } });
      toast.push({ title: "Deposit received", body: `Balance ${moneyStr(r.balance.cashMinor)}`, tone: "success" });
      router.refresh();
    } catch (err) {
      const rs = gateReasons(err);
      setReasons(rs);
      setError(rs.length ? null : errorMessage(err));
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Stat label="Cash balance" value={moneyStr(balance.cashMinor)} />
        <Stat label="Promo balance" value={moneyStr(balance.promoMinor)} hint="Not withdrawable" />
      </div>
      <form onSubmit={deposit} className="space-y-3 rounded-xl border border-white/10 p-3">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Wallet size={16} aria-hidden /> Add funds
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Amount presets">
          {PRESETS.map((p) => (
            <button key={p} type="button" onClick={() => setAmount(p)} aria-pressed={amount === p} className={cx("tap rounded-xl border px-4 text-sm font-semibold", amount === p ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-300" : "border-white/10 text-ink-300 hover:bg-white/5")}>
              ${p}
            </button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Amount (USD)" htmlFor="dep-amount" hint="Between $5 and $5,000." error={amount && !valid ? "Enter an amount between 5 and 5000 with up to 2 decimals" : null}>
            <Input id="dep-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Test payment outcome" htmlFor="dep-outcome" hint="The bundled payment provider is a test double; no real card is charged.">
            <Select id="dep-outcome" value={outcome} onChange={(e) => setOutcome(e.target.value as "succeed" | "fail")}>
              <option value="succeed">succeed (test)</option>
              <option value="fail">fail (test)</option>
            </Select>
          </Field>
        </div>
        <GateErrors reasons={reasons} title="Deposit blocked" />
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy || !valid}>
          {busy ? "Processing…" : `Deposit ${valid ? moneyStr(Math.round(Number(amount) * 100)) : ""}`}
        </Button>
      </form>
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-200">Payment history</h3>
        {payments.length === 0 ? (
          <p className="text-sm text-ink-400">No payments yet.</p>
        ) : (
          <div className="table-wrap rounded-xl border border-white/8">
            <table>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Amount</th>
                  <th scope="col">Fee</th>
                  <th scope="col">Method</th>
                  <th scope="col">Status</th>
                  <th scope="col">Reference</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="text-ink-400">{fmtDate(p.createdAt)}</td>
                    <td className="font-mono">{moneyStr(p.amountMinor, p.currency)}</td>
                    <td className="font-mono text-ink-400">{moneyStr(p.feeMinor, p.currency)}</td>
                    <td>{p.method}</td>
                    <td>
                      <Badge tone={p.status === "SUCCEEDED" ? "lime" : p.status === "FAILED" ? "danger" : "amber"}>{p.status.toLowerCase()}</Badge>
                      {p.failureReason && <span className="ml-1 text-xs text-ink-400">{p.failureReason}</span>}
                    </td>
                    <td className="font-mono text-xs text-ink-400">{p.providerRef ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
