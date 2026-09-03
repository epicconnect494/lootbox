import Link from "next/link";
import { requireAdmin } from "@/components/shell/AdminShell";
import { Panel, Mono } from "@/components/ui/primitives";
import { listPackVersions } from "@/domain/admin";
import { viewer } from "@/lib/server/data";
import { fmtDate, moneyStr, pct, shortHash } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function VersionsPage() {
  await requireAdmin("packs.read");
  const { db } = await viewer();
  const rows = await listPackVersions(db);
  return (
    <div className="space-y-6">
      <PageHeader title="Pack Versions" sub="Every version across every pack. Published manifests are immutable: the editor shows them read-only; clone to make changes." />
      <Panel>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pack</th>
                <th>Ver</th>
                <th>Status</th>
                <th>Price</th>
                <th>N</th>
                <th>Remaining</th>
                <th>Merch RTP</th>
                <th>Sell-back RTP</th>
                <th>Manifest</th>
                <th>Published</th>
                <th>Paused</th>
                <th>Closed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ v, p }) => (
                <tr key={v.id}>
                  <td>
                    <Link href={`/admin/packs/versions/${v.id}`} className="font-semibold text-ink-100 hover:underline">
                      {p.name}
                    </Link>
                    <div className="text-xs text-ink-400">{p.slug}</div>
                  </td>
                  <td>v{v.version}</td>
                  <td>
                    <StatusBadge status={v.status} />
                  </td>
                  <td>{moneyStr(v.priceMinor)}</td>
                  <td>{v.totalOpenings}</td>
                  <td>{v.remainingOpenings}</td>
                  <td>{pct(v.merchandiseRtpBp)}</td>
                  <td>{pct(v.sellbackRtpBp)}</td>
                  <td>
                    <Mono>{shortHash(v.manifestHash, 6)}</Mono>
                  </td>
                  <td className="text-xs text-ink-300">{fmtDate(v.publishedAt)}</td>
                  <td className="text-xs text-ink-300">{fmtDate(v.pausedAt)}</td>
                  <td className="text-xs text-ink-300">{fmtDate(v.closedAt)}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={12} className="text-ink-400">
                    No versions yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
