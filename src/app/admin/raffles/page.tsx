import Link from "next/link";
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/components/shell/AdminShell";
import { Panel, SectionTitle, Mono, Badge } from "@/components/ui/primitives";
import { raffle } from "@/db/schema";
import { viewer } from "@/lib/server/data";
import { fmtDate, moneyStr, shortHash } from "@/lib/format";
import { PageHeader, StatusBadge } from "@/components/admin/ui";
import { RaffleCreateForm } from "@/components/admin/RaffleCreateForm";

export const dynamic = "force-dynamic";

export default async function RafflesPage() {
  const session = await requireAdmin("raffles.read");
  const { db } = await viewer();
  const rows = await db.select().from(raffle).orderBy(desc(raffle.createdAt)).limit(100);
  const canWrite = session.user.permissions.has("raffles.write");
  return (
    <div className="space-y-6">
      <PageHeader title="Raffle Builder" sub="Commit-reveal raffles: the server-seed hash is committed at creation, the ticket manifest is hashed at close, and the draw binds both to declared public randomness." />
      <Panel>
        <SectionTitle title="Raffles" />
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Raffle</th>
                <th>Status</th>
                <th>Mode</th>
                <th>Tickets</th>
                <th>Price</th>
                <th>Closes</th>
                <th>Draws</th>
                <th>Seed hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/raffles/${r.id}`} className="font-semibold text-ink-100 hover:underline">
                      {r.name}
                    </Link>
                    <div className="text-xs text-ink-400">{r.slug}</div>
                  </td>
                  <td>
                    <StatusBadge status={r.status} />
                  </td>
                  <td>
                    <Badge tone="neutral">{r.entryMode.replace(/_/g, " ")}</Badge>
                  </td>
                  <td>
                    {r.maxTickets} · {r.winnersCount} winner{r.winnersCount === 1 ? "" : "s"}
                  </td>
                  <td>{moneyStr(r.ticketPriceMinor)}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(r.closesAt)}</td>
                  <td className="whitespace-nowrap text-xs">{fmtDate(r.drawsAt)}</td>
                  <td>
                    <Mono>{shortHash(r.serverSeedHash, 6)}</Mono>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-ink-400">
                    No raffles yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Panel>
      {canWrite && <RaffleCreateForm />}
    </div>
  );
}
