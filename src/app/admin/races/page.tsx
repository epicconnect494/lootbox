import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/components/shell/AdminShell";
import { Panel, SectionTitle, Mono } from "@/components/ui/primitives";
import { race, raceScoringPolicy } from "@/db/schema";
import { viewer } from "@/lib/server/data";
import { fmtDate, shortHash } from "@/lib/format";
import { ser } from "@/components/admin/serialize";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { RaceCreateForm, ScoringPolicyForm } from "@/components/admin/RaceForms";

export const dynamic = "force-dynamic";

export default async function RacesPage() {
  const session = await requireAdmin("races.read");
  const { db } = await viewer();
  const [races, policies] = await Promise.all([db.select().from(race).orderBy(desc(race.startsAt)).limit(50), db.select().from(raceScoringPolicy).orderBy(desc(raceScoringPolicy.version))]);
  const canWrite = session.user.permissions.has("races.write");
  const policyRows = ser(policies);
  return (
    <div className="space-y-6">
      <PageHeader title="Race Builder" sub="Weekly races score qualified events with a versioned, hashed policy. Ranking: points, then earliest qualifying event." />
      <Panel>
        <SectionTitle title="Races" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Race</th>
                <th>Status</th>
                <th>Window</th>
                <th>Timezone</th>
                <th>Lock hash</th>
                <th>Settled</th>
              </tr>
            </thead>
            <tbody>
              {races.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/races/${r.id}`} className="font-semibold text-ink-100 hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-ink-400">{r.slug}</div>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {fmtDate(r.startsAt)} → {fmtDate(r.endsAt)}
                  </td>
                  <td>{r.timezone}</td>
                  <td>
                    <Mono>{shortHash(r.lockSnapshotHash, 6)}</Mono>
                  </td>
                  <td className="text-xs text-ink-300">{fmtDate(r.settledAt)}</td>
                </tr>
              ))}
              {races.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-ink-400">
                    No races yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <SectionTitle title="Scoring policies" sub="Immutable versions; the hash is published with each race" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Version</th>
                <th>Name</th>
                <th>Per unit</th>
                <th>Per opening</th>
                <th>Per battle</th>
                <th>Promo / unit</th>
                <th>Cap</th>
                <th>Excluded</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.id}>
                  <td>v{p.version}</td>
                  <td>{p.name}</td>
                  <td>{p.rules.pointsPerUnitSpent}</td>
                  <td>{p.rules.pointsPerOpening}</td>
                  <td>{p.rules.pointsPerBattleEntry}</td>
                  <td>{p.rules.pointsPerPromoUnit}</td>
                  <td>{p.rules.maxPointsPerEvent}</td>
                  <td className="text-xs text-ink-300">{p.rules.excludedKinds.join(", ")}</td>
                  <td>
                    <Mono>{shortHash(p.policyHash, 6)}</Mono>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      {canWrite && (
        <div className="grid gap-6 xl:grid-cols-2">
          <RaceCreateForm policies={policyRows} />
          <ScoringPolicyForm latest={policyRows[0] ?? null} />
        </div>
      )}
    </div>
  );
}
