"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Field, Input, Select } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { api } from "@/lib/client/api";
import { fmtDate, moneyStr } from "@/lib/format";
import { errorMessage } from "@/components/events/GateErrors";
import type { AccountOverview } from "./types";

const TYPES = [
  ["DEPOSIT_DAILY", "Deposit · daily"],
  ["DEPOSIT_WEEKLY", "Deposit · weekly"],
  ["DEPOSIT_MONTHLY", "Deposit · monthly"],
  ["SPEND_DAILY", "Spend · daily"],
  ["SPEND_WEEKLY", "Spend · weekly"],
  ["SPEND_MONTHLY", "Spend · monthly"],
  ["SESSION_MINUTES", "Session length (minutes)"],
] as const;
type LimitType = (typeof TYPES)[number][0];

export function LimitsForm({ limits }: { limits: AccountOverview["limits"] }) {
  const router = useRouter();
  const toast = useToast();
  const [type, setType] = useState<LimitType>("SPEND_WEEKLY");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = /^\d+(\.\d{1,2})?$/.test(amount) && Number(amount) > 0;
  const [now] = useState(() => Date.now());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api<{ limit: { effectiveAt: string } }>("/account/limits", { method: "POST", body: { type, amount } });
      const later = new Date(r.limit.effectiveAt).getTime() > now + 60_000;
      toast.push({ title: later ? "Limit increase scheduled" : "Limit applied", body: later ? `Takes effect ${fmtDate(r.limit.effectiveAt)}.` : "Effective immediately.", tone: "success" });
      setAmount("");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Limit type" htmlFor="limit-type">
          <Select id="limit-type" value={type} onChange={(e) => setType(e.target.value as LimitType)}>
            {TYPES.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={type === "SESSION_MINUTES" ? "Minutes" : "Amount (USD)"} htmlFor="limit-amount" error={amount && !valid ? "Enter a positive number" : null}>
          <Input id="limit-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} className="font-mono" placeholder={type === "SESSION_MINUTES" ? "60" : "100.00"} />
        </Field>
        <Button type="submit" disabled={busy || !valid}>
          {busy ? "Saving…" : "Set limit"}
        </Button>
      </form>
      <p className="text-xs text-ink-400">Decreases apply immediately. Increases only take effect after a 24-hour cooling period; the lower limit stays active until then.</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-200">Current limits</h3>
        {limits.length === 0 ? (
          <p className="text-sm text-ink-400">No limits set.</p>
        ) : (
          <div className="table-wrap rounded-xl border border-white/8">
            <table>
              <thead>
                <tr>
                  <th scope="col">Type</th>
                  <th scope="col">Limit</th>
                  <th scope="col">Effective</th>
                  <th scope="col">Set</th>
                </tr>
              </thead>
              <tbody>
                {limits.map((l) => {
                  const pending = new Date(l.effectiveAt).getTime() > now;
                  return (
                    <tr key={l.id}>
                      <td>{TYPES.find((t) => t[0] === l.type)?.[1] ?? l.type}</td>
                      <td className="font-mono">{l.type === "SESSION_MINUTES" ? `${l.amountMinor} min` : moneyStr(l.amountMinor, l.currency)}</td>
                      <td className={pending ? "text-amber-400" : "text-lime-300"}>{pending ? `from ${fmtDate(l.effectiveAt)}` : "active"}</td>
                      <td className="text-ink-400">{fmtDate(l.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
