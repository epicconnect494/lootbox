"use client";
import { useState, type FormEvent } from "react";
import type { marketplaceListing } from "@/db/schema";
import { Button, Field, Input, Mono } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDate, moneyStr } from "@/lib/format";
import { useAction } from "./hooks";
import { StatusBadge } from "./ui";
import type { Json } from "./serialize";

export type ListingRow = Json<typeof marketplaceListing.$inferSelect> & { item: { itemCode: string; status: string }; sku: { name: string } };

export function ListingsTable({ rows, permissions }: { rows: ListingRow[]; permissions: string[] }) {
  const canWrite = permissions.includes("marketplace.write");
  const [target, setTarget] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const { run, busy, error } = useAction();
  async function cancel(e: FormEvent) {
    e.preventDefault();
    if (!target) return;
    await run(() => api(`/admin/marketplace/listings/${target}`, { method: "DELETE", body: { reason } }), { success: "Listing cancelled", onSuccess: () => setTarget(null) });
  }
  return (
    <div className="space-y-3">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Listed</th>
              <th>Item</th>
              <th>Seller</th>
              <th>Ask</th>
              <th>Status</th>
              <th>Expires</th>
              {canWrite && (
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap text-xs text-ink-300">{fmtDate(l.createdAt)}</td>
                <td>
                  <div className="font-medium text-ink-100">{l.sku.name}</div>
                  <div className="text-xs text-ink-400">
                    <Mono>{l.item.itemCode}</Mono> · {l.item.status}
                  </div>
                </td>
                <td className="text-xs">{l.sellerUserId.slice(0, 8)}</td>
                <td>{moneyStr(l.askMinor)}</td>
                <td>
                  <StatusBadge status={l.status} />
                </td>
                <td className="text-xs text-ink-300">{fmtDate(l.expiresAt)}</td>
                {canWrite && (
                  <td>
                    {l.status === "ACTIVE" && (
                      <Button tone="danger" size="sm" className="tap" onClick={() => setTarget(l.id)}>
                        Cancel…
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={canWrite ? 7 : 6} className="text-ink-400">
                  No listings.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {target && (
        <form onSubmit={cancel} className="glass flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-64 flex-1">
            <Field label={`Reason to cancel listing ${target.slice(0, 8)}`} error={error}>
              <Input required minLength={3} value={reason} onChange={(e) => setReason(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" tone="danger" disabled={busy}>
            {busy ? "Cancelling…" : "Confirm cancel"}
          </Button>
          <Button type="button" tone="ghost" onClick={() => setTarget(null)}>
            Keep
          </Button>
        </form>
      )}
    </div>
  );
}
