"use client";
import { useState } from "react";
import type { adminAuditEvent } from "@/db/schema";
import { Button, Mono } from "@/components/ui/primitives";
import { fmtDate, shortHash } from "@/lib/format";
import { JsonBlock } from "./ui";
import type { Json } from "./serialize";

export type AuditRow = Json<typeof adminAuditEvent.$inferSelect> & { actorName: string | null };

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Reason</th>
            <th>Before / after</th>
            <th>Correlation</th>
            <th>
              <span className="sr-only">Expand</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const expanded = open.has(r.id);
            return (
              <FragmentRow key={r.id} r={r} expanded={expanded} onToggle={() => toggle(r.id)} />
            );
          })}
          {rows.length === 0 && (
            <tr>
              <td colSpan={8} className="text-ink-400">
                No audit events match.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function FragmentRow({ r, expanded, onToggle }: { r: AuditRow; expanded: boolean; onToggle: () => void }) {
  return (
    <>
      <tr>
        <td className="whitespace-nowrap text-xs">{fmtDate(r.createdAt)}</td>
        <td className="text-xs">
          <div>{r.actorName ?? (r.actorUserId ? r.actorUserId.slice(0, 8) : "system")}</div>
          {r.actorRole && <div className="text-ink-400">{r.actorRole}</div>}
        </td>
        <td>
          <Mono>{r.action}</Mono>
        </td>
        <td className="text-xs">
          <div>{r.entityType}</div>
          <Mono>{r.entityId ? shortHash(r.entityId, 8) : "—"}</Mono>
        </td>
        <td className="max-w-xs text-ink-300">{r.reason ?? "—"}</td>
        <td className="text-xs">
          <Mono>{shortHash(r.beforeHash, 5)}</Mono> → <Mono>{shortHash(r.afterHash, 5)}</Mono>
        </td>
        <td>
          <Mono>{shortHash(r.correlationId, 6)}</Mono>
        </td>
        <td>
          <Button tone="ghost" size="sm" className="tap" aria-expanded={expanded} onClick={onToggle}>
            {expanded ? "Hide" : "JSON"}
          </Button>
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8}>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Before</div>
                <JsonBlock value={r.before ?? null} label="Before" />
              </div>
              <div>
                <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">After</div>
                <JsonBlock value={r.after ?? null} label="After" />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
