import Link from "next/link";
import { requireAdmin } from "@/components/shell/AdminShell";
import { Panel, SectionTitle, Stat, Badge } from "@/components/ui/primitives";
import { dashboard } from "@/domain/admin";
import { viewer } from "@/lib/server/data";
import { moneyStr, pct, fmtDate } from "@/lib/format";
import { MiniBars, Notice, PageHeader, StatusBadge } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin();
  const sp = await searchParams;
  const denied = typeof sp.denied === "string" ? sp.denied : null;
  const { db } = await viewer();
  const d = await dashboard(db);
  const liabilityMerch = d.liability.remainingMerchMinor + d.liability.vaultMerchMinor;
  const liabilitySellback = d.liability.remainingSellbackMinor + d.liability.vaultSellbackMinor;
  const inventoryCost = d.inventory.reduce((a, r) => a + r.costMinor, 0n);
  const days = d.daily.map((r) => ({ label: r.day.slice(5), value: Number(r.grossMinor), title: `${r.day}: ${moneyStr(r.grossMinor)} · ${r.opens} openings` }));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" sub="Realized economics, liabilities and operational counts. RTP figures are labelled by basis: merchandise (reference value) vs sell-back (disclosed offer)." />
      {denied && (
        <Notice tone="warn">
          You were redirected: your role lacks the <code className="font-mono">{denied}</code> permission required for that page.
        </Notice>
      )}

      <Panel>
        <SectionTitle title="Sales" sub="Settled direct openings (battles excluded)" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Gross sales" value={moneyStr(d.sales.grossMinor)} />
          <Stat label="Openings" value={d.sales.opens.toLocaleString("en-US")} />
          <Stat label="Realized merchandise RTP" value={pct(d.sales.realizedMerchRtpBp)} hint="Reference value ÷ price" />
          <Stat label="Realized sell-back RTP" value={pct(d.sales.realizedSellbackRtpBp)} hint="Disclosed sell-back offer ÷ price" />
          <Stat label="Sold back" value={d.sales.soldBackCount.toLocaleString("en-US")} hint={`${moneyStr(d.sales.soldBackValueMinor)} paid out`} />
          <Stat label="Contribution margin" value={moneyStr(d.sales.contributionMarginMinor)} hint="Gross − acquisition cost of opened items" />
          <Stat label="Users" value={d.users.total.toLocaleString("en-US")} hint={`${d.users.verified} identity-verified`} />
          <Stat label="Vault items" value={d.liability.vaultItems.toLocaleString("en-US")} />
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel>
          <SectionTitle title="Expected liability" sub="Remaining live manifests + active vault holdings" />
          <div className="grid grid-cols-2 gap-4">
            <Stat label="Merchandise (total)" value={moneyStr(liabilityMerch)} />
            <Stat label="Sell-back (total)" value={moneyStr(liabilitySellback)} />
            <Stat label="Live manifests · merch" value={moneyStr(d.liability.remainingMerchMinor)} hint={`sell-back ${moneyStr(d.liability.remainingSellbackMinor)}`} />
            <Stat label="Vault · merch" value={moneyStr(d.liability.vaultMerchMinor)} hint={`sell-back ${moneyStr(d.liability.vaultSellbackMinor)}`} />
          </div>
        </Panel>
        <Panel>
          <SectionTitle title="Daily sales (7 days)" sub="Gross settled openings per day" />
          <MiniBars data={days} label="Daily gross sales bar chart" />
          {days.length > 0 && (
            <div className="table-wrap mt-3">
              <table>
                <thead>
                  <tr>
                    <th>Day</th>
                    <th>Gross</th>
                    <th>Opens</th>
                  </tr>
                </thead>
                <tbody>
                  {d.daily.map((r) => (
                    <tr key={r.day}>
                      <td>{r.day}</td>
                      <td>{moneyStr(r.grossMinor)}</td>
                      <td>{r.opens}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel>
          <SectionTitle title="Inventory" sub={`Acquisition cost ${moneyStr(inventoryCost)}`} action={<Link href="/admin/inventory" className="text-sm text-cyan-300 hover:underline">Open</Link>} />
          <div className="table-wrap">
            <table className="!min-w-0">
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Count</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {d.inventory.map((r) => (
                  <tr key={r.status}>
                    <td>
                      <StatusBadge status={r.status} />
                    </td>
                    <td>{r.count}</td>
                    <td>{moneyStr(r.costMinor)}</td>
                  </tr>
                ))}
                {d.inventory.length === 0 && (
                  <tr>
                    <td colSpan={3} className="text-ink-400">
                      No inventory yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel>
          <SectionTitle title="Pack versions" action={<Link href="/admin/versions" className="text-sm text-cyan-300 hover:underline">Open</Link>} />
          <CountList rows={d.packs} />
          <SectionTitle title="Battles" action={<Link href="/admin/battles" className="text-sm text-cyan-300 hover:underline">Open</Link>} />
          <CountList rows={d.battles} />
        </Panel>
        <Panel>
          <SectionTitle title="Race" action={<Link href="/admin/races" className="text-sm text-cyan-300 hover:underline">Open</Link>} />
          {d.race ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge status={d.race.status} />
              <Link href={`/admin/races/${d.race.id}`} className="font-semibold text-ink-100 hover:underline">
                {d.race.name}
              </Link>
              <span className="text-ink-400">ends {fmtDate(d.race.endsAt)}</span>
            </div>
          ) : (
            <p className="text-sm text-ink-400">No active race.</p>
          )}
          <SectionTitle title="Raffles" action={<Link href="/admin/raffles" className="text-sm text-cyan-300 hover:underline">Open</Link>} />
          {d.raffles.length ? (
            <ul className="space-y-2 text-sm">
              {d.raffles.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={r.status} />
                  <Link href={`/admin/raffles/${r.id}`} className="font-semibold text-ink-100 hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-ink-400">draws {fmtDate(r.drawsAt)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-400">No upcoming or open raffles.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CountList({ rows }: { rows: Array<{ status: string; count: number }> }) {
  if (!rows.length) return <p className="mb-4 text-sm text-ink-400">None yet.</p>;
  return (
    <ul className="mb-4 flex flex-wrap gap-2">
      {rows.map((r) => (
        <li key={r.status} className="flex items-center gap-1.5">
          <StatusBadge status={r.status} />
          <Badge tone="neutral">{r.count}</Badge>
        </li>
      ))}
    </ul>
  );
}
