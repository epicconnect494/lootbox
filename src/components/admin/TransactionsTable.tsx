"use client";
import { useState } from "react";
import type { ledgerEntry, ledgerTransaction, walletAccount } from "@/db/schema";
import { Button, Mono } from "@/components/ui/primitives";
import { fmtDate, moneyStr, shortHash } from "@/lib/format";
import type { Json } from "./serialize";

export type TxRow = Json<typeof ledgerTransaction.$inferSelect & { entries: Array<typeof ledgerEntry.$inferSelect> }>;
type Account = Json<typeof walletAccount.$inferSelect>;

export function TransactionsTable({ rows, accounts }: { rows: TxRow[]; accounts: Account[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const label = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return a ? a.kind.replace(/_/g, " ") : `user acct ${id.slice(0, 8)}`;
  };
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>When</th>
            <th>Kind</th>
            <th>Description</th>
            <th>Reference</th>
            <th>Entries</th>
            <th>
              <span className="sr-only">Expand</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const expanded = open === t.id;
            return (
              <TxRowView key={t.id} t={t} expanded={expanded} onToggle={() => setOpen(expanded ? null : t.id)} label={label} />
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="text-ink-400">
                No transactions.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function TxRowView({ t, expanded, onToggle, label }: { t: TxRow; expanded: boolean; onToggle: () => void; label: (id: string) => string }) {
  return (
    <>
      <tr>
        <td className="whitespace-nowrap text-xs">{fmtDate(t.createdAt)}</td>
        <td>
          <Mono>{t.kind}</Mono>
        </td>
        <td className="text-ink-300">{t.description ?? "—"}</td>
        <td className="text-xs text-ink-300">{t.referenceType ? `${t.referenceType} ${shortHash(t.referenceId, 6)}` : "—"}</td>
        <td>{t.entries.length}</td>
        <td>
          <Button tone="ghost" size="sm" className="tap" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? "Hide" : "Entries"}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={6}>
            <div className="table-wrap rounded-xl border border-white/8">
              <table className="!min-w-0">
                <thead>
                  <tr>
                    <th>Account</th>
                    <th>Amount</th>
                    <th>Memo</th>
                  </tr>
                </thead>
                <tbody>
                  {t.entries.map((e) => (
                    <tr key={e.id}>
                      <td>{label(e.accountId)}</td>
                      <td className={BigInt(e.amountMinor) < 0n ? "text-danger" : "text-ink-100"}>{moneyStr(e.amountMinor, e.currency)}</td>
                      <td className="text-xs text-ink-300">{e.memo ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-1 text-xs text-ink-400">
              tx <Mono>{t.id}</Mono>
              {t.idempotencyKey ? (
                <>
                  {" "}
                  · idempotency <Mono>{t.idempotencyKey}</Mono>
                </>
              ) : null}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
