import { requireAdmin } from "@/components/shell/AdminShell";
import { Button, Field, Input, Panel } from "@/components/ui/primitives";
import { searchAudit } from "@/domain/admin";
import { viewer } from "@/lib/server/data";
import { ser } from "@/components/admin/serialize";
import { PageHeader } from "@/components/admin/ui";
import { AuditTable, type AuditRow } from "@/components/admin/AuditTable";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin("audit.read");
  const sp = await searchParams;
  const str = (k: string, max = 80) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string).slice(0, max) : undefined);
  const q = str("q");
  const entityType = str("entityType", 64);
  const actorRaw = str("actorUserId", 36);
  const actorUserId = actorRaw && /^[0-9a-f-]{36}$/i.test(actorRaw) ? actorRaw : undefined;
  const { db } = await viewer();
  const rows: AuditRow[] = ser((await searchAudit(db, { q, entityType, actorUserId })).map(({ e, actorName }) => ({ ...e, actorName })));
  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" sub="Append-only record of admin and fairness-relevant actions with before/after hashes. Search matches action, entity ID or reason." />
      <Panel>
        <form method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Field label="Search">
            <Input name="q" defaultValue={q ?? ""} placeholder="pack.version.publish, entity id, reason…" />
          </Field>
          <Field label="Entity type">
            <Input name="entityType" defaultValue={entityType ?? ""} placeholder="pack_version, user, shipment…" />
          </Field>
          <Field label="Actor user ID" error={actorRaw && !actorUserId ? "Must be a UUID" : null}>
            <Input name="actorUserId" defaultValue={actorRaw ?? ""} placeholder="uuid" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" tone="secondary">
              Search
            </Button>
          </div>
        </form>
      </Panel>
      <Panel>
        <div className="mb-3 text-sm text-ink-400">{rows.length} event{rows.length === 1 ? "" : "s"} (max 200)</div>
        <AuditTable rows={rows} />
      </Panel>
    </div>
  );
}
