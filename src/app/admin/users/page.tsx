import Link from "next/link";
import { requireAdmin } from "@/components/shell/AdminShell";
import { Badge, Button, Field, Input, Panel, SectionTitle } from "@/components/ui/primitives";
import { listRiskEvents, listUsers } from "@/domain/admin";
import { viewer } from "@/lib/server/data";
import { fmtDate, moneyStr } from "@/lib/format";
import { ser } from "@/components/admin/serialize";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { RiskEventsPanel } from "@/components/admin/RiskEventsPanel";

export const dynamic = "force-dynamic";

export default async function UsersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireAdmin("users.read");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const { db } = await viewer();
  const [users, risks] = await Promise.all([listUsers(db, q), listRiskEvents(db)]);
  const riskRows = ser(risks.map(({ r, email }) => ({ ...r, email })));
  return (
    <div className="space-y-6">
      <PageHeader title="Users & Risk" sub="Search by email or display name. Open a user for roles, verifications, exclusions, balances and activity." />
      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-64 flex-1">
            <Field label="Search">
              <Input name="q" defaultValue={q ?? ""} placeholder="email or name" />
            </Field>
          </div>
          <Button type="submit" tone="secondary">
            Search
          </Button>
        </form>
      </Panel>
      <Panel>
        <SectionTitle title="Users" sub={`${users.length} shown (max 100)`} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User</th>
                <th>Status</th>
                <th>Region</th>
                <th>Roles</th>
                <th>Balance</th>
                <th>Verified</th>
                <th>Open risk</th>
                <th>Risk score</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/admin/users/${u.id}`} className="font-semibold text-ink-100 hover:underline">
                      {u.displayName}
                    </Link>
                    <div className="text-xs text-ink-400">{u.email}</div>
                  </td>
                  <td>
                    <StatusBadge status={u.status} />
                  </td>
                  <td>{u.jurisdictionCode ?? "—"}</td>
                  <td className="text-xs">{u.roles.filter((r) => r !== "CUSTOMER").join(", ") || "customer"}</td>
                  <td>{moneyStr(u.balanceMinor)}</td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {u.verified.map((v) => (
                        <Badge key={v} tone="lime">
                          {v}
                        </Badge>
                      ))}
                      {u.verified.length === 0 && <span className="text-xs text-ink-400">none</span>}
                    </div>
                  </td>
                  <td>{u.openRisk > 0 ? <Badge tone="danger">{u.openRisk}</Badge> : "0"}</td>
                  <td>{u.riskScore}</td>
                  <td className="whitespace-nowrap text-xs text-ink-300">{fmtDate(u.createdAt)}</td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-ink-400">
                    No users match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <SectionTitle title="Risk events" sub="Most recent 200 across all users" />
        <RiskEventsPanel rows={riskRows} permissions={[...session.user.permissions]} />
      </Panel>
    </div>
  );
}
