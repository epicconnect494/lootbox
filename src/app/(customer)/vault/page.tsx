import { redirect } from "next/navigation";
import { serialize } from "@/components/customer/serialize";
import { VaultBrowser } from "@/components/customer/VaultBrowser";
import type { VaultAction } from "@/components/customer/VaultItemActions";
import { Panel, Stat } from "@/components/ui/primitives";
import { listVault } from "@/domain/vault";
import { config } from "@/lib/config";
import { moneyStr } from "@/lib/format";
import { viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Vault" };

const UUID = /^[0-9a-f-]{36}$/i;

export default async function VaultPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { db, session, userId } = await viewer();
  if (!session || !userId) redirect("/login?next=/vault");
  const sp = await searchParams;
  const vault = serialize(await listVault(db, userId));
  let autoAction: { kind: VaultAction; holdingId: string } | null = null;
  for (const kind of ["sell", "ship", "list"] as const) {
    const v = sp[kind];
    const id = Array.isArray(v) ? v[0] : v;
    if (id && UUID.test(id) && vault.items.some((i) => i.holdingId === id)) {
      autoAction = { kind, holdingId: id };
      break;
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="font-display text-2xl font-extrabold text-ink-100 md:text-3xl">Vault</h1>
        <p className="mt-1 text-sm text-ink-300">Every item you own is held in insured custody. Ship it, sell it back at the disclosed offer, or list it for other collectors.</p>
      </header>
      <Panel as="section" aria-label="Vault summary" className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Portfolio value" value={moneyStr(vault.portfolioValueMinor)} hint="Sum of reference values" />
        <Stat label="Sell-back value" value={moneyStr(vault.sellbackValueMinor)} hint="Instant cash if sold today" />
        <Stat label="Unique items" value={vault.uniqueCount} hint="Graded / serialized" />
        <Stat label="Items" value={vault.count} />
      </Panel>
      <VaultBrowser items={vault.items} feeBp={config.economics.marketplaceFeeBp} autoAction={autoAction} />
    </div>
  );
}
