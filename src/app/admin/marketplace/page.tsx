import { requireAdmin } from "@/components/shell/AdminShell";
import { Panel, SectionTitle, Stat } from "@/components/ui/primitives";
import { sellbackOverview } from "@/domain/admin";
import { SELLBACK_POLICY_VERSION } from "@/domain/vault";
import { config } from "@/lib/config";
import { viewer } from "@/lib/server/data";
import { fmtDate, moneyStr, pct } from "@/lib/format";
import { ser } from "@/components/admin/serialize";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { ListingsTable, type ListingRow } from "@/components/admin/ListingsTable";

export const dynamic = "force-dynamic";

export default async function MarketplacePage() {
  const session = await requireAdmin("marketplace.read");
  const { db } = await viewer();
  const o = await sellbackOverview(db);
  const listings: ListingRow[] = ser(o.listings.map(({ l, item, sku }) => ({ ...l, item: { itemCode: item.itemCode, status: item.status }, sku: { name: sku.name } })));
  return (
    <div className="space-y-6">
      <PageHeader title="Sell-back & Marketplace" sub="Disclosed sell-back offers are the customer's guaranteed floor; marketplace listings are peer-to-peer with a platform fee." />
      <Panel>
        <SectionTitle title="Policy" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          <Stat label="Quote TTL" value={`${config.economics.sellbackQuoteTtlMinutes} min`} hint="A quote locks the offer for this long" />
          <Stat label="Marketplace fee" value={pct(config.economics.marketplaceFeeBp)} hint="Charged to the seller on settlement" />
          <Stat label="Sell-back policy" value={<span className="font-mono text-sm">{SELLBACK_POLICY_VERSION}</span>} />
        </div>
      </Panel>
      <Panel>
        <SectionTitle title="Sell-back quotes" sub="Most recent 100" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Created</th>
                <th>User</th>
                <th>Status</th>
                <th>Offer</th>
                <th>Reference</th>
                <th>Offer / ref</th>
                <th>Policy</th>
                <th>Expires</th>
                <th>Accepted</th>
              </tr>
            </thead>
            <tbody>
              {o.quotes.map((q) => (
                <tr key={q.id}>
                  <td className="whitespace-nowrap text-xs text-ink-300">{fmtDate(q.createdAt)}</td>
                  <td className="text-xs">{q.userId.slice(0, 8)}</td>
                  <td>
                    <StatusBadge status={q.status} />
                  </td>
                  <td>{moneyStr(q.offerMinor)}</td>
                  <td>{moneyStr(q.referenceValueMinor)}</td>
                  <td>{q.referenceValueMinor > 0n ? pct(Number((q.offerMinor * 10000n) / q.referenceValueMinor)) : "—"}</td>
                  <td className="font-mono text-xs">{q.policyVersion}</td>
                  <td className="text-xs text-ink-300">{fmtDate(q.expiresAt)}</td>
                  <td className="text-xs text-ink-300">{fmtDate(q.acceptedAt)}</td>
                </tr>
              ))}
              {o.quotes.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-ink-400">
                    No quotes yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel>
        <SectionTitle title="Listings" sub="Admin cancellation requires a reason and is audited" />
        <ListingsTable rows={listings} permissions={[...session.user.permissions]} />
      </Panel>
    </div>
  );
}
