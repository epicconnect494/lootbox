import Link from "next/link";
import { requireAdmin } from "@/components/shell/AdminShell";
import { Panel, SectionTitle, Mono } from "@/components/ui/primitives";
import { listPackVersions } from "@/domain/admin";
import { viewer } from "@/lib/server/data";
import { fmtDate, moneyStr, pct } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { PackCreateForm } from "@/components/admin/PackCreateForm";

export const dynamic = "force-dynamic";

const LIVE = new Set(["PUBLISHED", "PAUSED", "CLOSED"]);

export default async function PackBuilderPage() {
  const session = await requireAdmin("packs.read");
  const { db } = await viewer();
  const rows = (await listPackVersions(db)).filter((r) => !LIVE.has(r.v.status));
  const canWrite = session.user.permissions.has("packs.write");
  return (
    <div className="space-y-6">
      <PageHeader title="Pack Builder" sub="Drafts, submissions and approved versions awaiting publish. Published manifests are immutable and live under Pack Versions." action={<Link href="/admin/versions" className="text-sm text-cyan-300 hover:underline">All versions →</Link>} />
      <Panel>
        <SectionTitle title="In progress" sub={`${rows.length} version${rows.length === 1 ? "" : "s"} not yet live`} />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pack</th>
                <th>Version</th>
                <th>Status</th>
                <th>Category</th>
                <th>Price</th>
                <th>Openings</th>
                <th>Merch RTP</th>
                <th>Sell-back RTP</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, p, category }) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/admin/packs/versions/${v.id}`} className="font-semibold text-ink-100 hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-ink-400">
                      <Mono>{p.slug}</Mono>
                    </div>
                  </td>
                  <td>v{v.version}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>{category.name}</td>
                  <td>{moneyStr(v.priceMinor)}</td>
                  <td>{v.totalOpenings}</td>
                  <td>{pct(v.merchandiseRtpBp)}</td>
                  <td>{pct(v.sellbackRtpBp)}</td>
                  <td className="text-xs text-ink-300">{fmtDate(v.updatedAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-ink-400">
                    Nothing in progress. Create a draft below.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {canWrite ? <PackCreateForm /> : <p className="text-sm text-ink-400">Your role can view packs but not create drafts (requires packs.write).</p>}
    </div>
  );
}
