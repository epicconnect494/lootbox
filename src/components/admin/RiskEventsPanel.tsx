"use client";
import { useState, type FormEvent } from "react";
import type { riskEvent } from "@/db/schema";
import { Button, Field, Input, Select, Textarea, Mono } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDate } from "@/lib/format";
import { useAction } from "./hooks";
import { JsonBlock, StatusBadge } from "./ui";
import type { Json } from "./serialize";

export type RiskRow = Json<typeof riskEvent.$inferSelect> & { email?: string | null };

export function RiskEventsPanel({ rows, permissions, defaultUserId, compact }: { rows: RiskRow[]; permissions: string[]; defaultUserId?: string; compact?: boolean }) {
  const canWrite = permissions.includes("risk.write");
  const create = useAction();
  const resolve = useAction();
  const [f, setF] = useState({ userId: defaultUserId ?? "", kind: "", severity: "MEDIUM", details: "" });
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolution, setResolution] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    let details: Record<string, unknown> = {};
    if (f.details.trim()) {
      try {
        details = JSON.parse(f.details);
      } catch {
        details = { note: f.details };
      }
    }
    await create.run(() => api("/admin/risk-events", { method: "POST", body: { userId: f.userId || null, kind: f.kind, severity: f.severity, details } }), { success: "Risk event recorded", onSuccess: () => setF((s) => ({ ...s, kind: "", details: "" })) });
  }
  async function doResolve(e: FormEvent) {
    e.preventDefault();
    if (!resolving) return;
    await resolve.run(() => api(`/admin/risk-events/${resolving}`, { method: "PATCH", body: { resolution } }), { success: "Risk event resolved", onSuccess: () => setResolving(null) });
  }

  return (
    <div className="space-y-4">
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>When</th>
              {!compact && <th>User</th>}
              <th>Kind</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Correlation</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RiskRowView key={r.id} r={r} compact={compact} canWrite={canWrite} expanded={expanded === r.id} onExpand={() => setExpanded(expanded === r.id ? null : r.id)} onResolve={() => setResolving(r.id)} />
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={compact ? 6 : 7} className="text-ink-400">
                  No risk events.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {resolving && canWrite && (
        <form onSubmit={doResolve} className="glass flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-64 flex-1">
            <Field label={`Resolution for ${resolving.slice(0, 8)}`} error={resolve.error}>
              <Input required minLength={3} value={resolution} onChange={(e) => setResolution(e.target.value)} />
            </Field>
          </div>
          <Button type="submit" tone="secondary" disabled={resolve.busy}>
            {resolve.busy ? "Resolving…" : "Resolve"}
          </Button>
          <Button type="button" tone="ghost" onClick={() => setResolving(null)}>
            Cancel
          </Button>
        </form>
      )}
      {canWrite && (
        <form onSubmit={submit} className="glass grid gap-3 p-4 md:grid-cols-4">
          <div className="text-sm font-semibold text-ink-200 md:col-span-4">Create risk event</div>
          <Field label="User ID" hint="Optional; blank for platform-level">
            <Input value={f.userId} onChange={(e) => setF((s) => ({ ...s, userId: e.target.value }))} placeholder="uuid" />
          </Field>
          <Field label="Kind">
            <Input required minLength={2} maxLength={64} value={f.kind} onChange={(e) => setF((s) => ({ ...s, kind: e.target.value }))} placeholder="LINKED_ACCOUNT, VELOCITY…" />
          </Field>
          <Field label="Severity">
            <Select value={f.severity} onChange={(e) => setF((s) => ({ ...s, severity: e.target.value }))}>
              {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Details" hint="JSON or free text" error={create.error}>
            <Textarea value={f.details} onChange={(e) => setF((s) => ({ ...s, details: e.target.value }))} className="min-h-11" />
          </Field>
          <div className="md:col-span-4">
            <Button type="submit" tone="secondary" disabled={create.busy}>
              {create.busy ? "Saving…" : "Record risk event"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function RiskRowView({ r, compact, canWrite, expanded, onExpand, onResolve }: { r: RiskRow; compact?: boolean; canWrite: boolean; expanded: boolean; onExpand: () => void; onResolve: () => void }) {
  return (
    <>
      <tr>
        <td className="whitespace-nowrap text-xs">{fmtDate(r.createdAt)}</td>
        {!compact && <td className="text-xs">{r.email ?? (r.userId ? r.userId.slice(0, 8) : "platform")}</td>}
        <td>
          <Mono>{r.kind}</Mono>
        </td>
        <td>
          <StatusBadge status={r.severity} />
        </td>
        <td>{r.resolvedAt ? <span className="text-xs text-ink-300">Resolved {fmtDate(r.resolvedAt)}</span> : <StatusBadge status="OPEN" />}</td>
        <td>
          <Mono>{r.correlationId?.slice(0, 8) ?? "—"}</Mono>
        </td>
        <td>
          <div className="flex gap-1">
            <Button tone="ghost" size="sm" className="tap" aria-expanded={expanded} onClick={onExpand}>
              {expanded ? "Hide" : "Details"}
            </Button>
            {canWrite && !r.resolvedAt && (
              <Button tone="secondary" size="sm" className="tap" onClick={onResolve}>
                Resolve…
              </Button>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={compact ? 6 : 7}>
            <JsonBlock value={{ details: r.details, resolution: r.resolution, resolvedBy: r.resolvedBy }} label="Risk event details" />
          </td>
        </tr>
      )}
    </>
  );
}
