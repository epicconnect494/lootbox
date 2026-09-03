import { ItemArt } from "@/components/art/ItemArt";
import { BuyListingButton } from "@/components/customer/BuyListingButton";
import { Badge, Empty, Panel, ButtonLink } from "@/components/ui/primitives";
import { listMarketplace } from "@/domain/vault";
import { config } from "@/lib/config";
import { fmtDate, moneyStr, pct } from "@/lib/format";
import { viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Marketplace" };

function conditionLabel(c: string): string {
  return c.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
}

export default async function MarketplacePage() {
  const { db, session, userId } = await viewer();
  const rows = await listMarketplace(db);
  const feeBp = config.economics.marketplaceFeeBp;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold text-ink-100 md:text-3xl">Marketplace</h1>
          <p className="mt-1 text-sm text-ink-300">Collector-to-collector listings. Items never leave vault custody; ownership transfers instantly on purchase.</p>
        </div>
        {session && (
          <ButtonLink href="/vault" tone="secondary">
            List an item from your vault
          </ButtonLink>
        )}
      </header>
      <Panel className="text-sm text-ink-300">
        Buyers pay the ask price. A marketplace fee of <span className="font-mono text-ink-100">{pct(feeBp)}</span> is deducted from the seller&apos;s proceeds. Purchases require identity verification and are subject to your spend limits.
      </Panel>

      {rows.length === 0 ? (
        <Empty title="No active listings" body="When collectors list items from their vault they appear here." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Listings">
          {rows.map(({ l, item, sku }) => (
            <li key={l.id} className="glass flex flex-col gap-3 p-3">
              <div className="flex gap-3">
                <ItemArt name={sku.name} accent={sku.accent} imageKey={sku.imageKey} size="md" label="" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone="cyan">Listed</Badge>
                    {l.sellerUserId === userId && <Badge tone="violet">Yours</Badge>}
                  </div>
                  <div className="font-display mt-1 truncate font-bold text-ink-100">{sku.name}</div>
                  <div className="truncate text-xs text-ink-400">
                    {sku.brand ? `${sku.brand} · ` : ""}
                    <span className="font-mono">{item.itemCode}</span> · {conditionLabel(item.condition)}
                  </div>
                  <div className="text-xs text-ink-400">
                    {item.grader && item.grade ? `${item.grader} ${item.grade}` : ""}
                    {item.certificationId ? ` · cert ${item.certificationId}` : ""}
                    {item.serialNumber ? ` · s/n ${item.serialNumber}` : ""}
                  </div>
                  <div className="font-display mt-1 text-xl font-extrabold text-ink-100">{moneyStr(l.askMinor, l.currency)}</div>
                  <div className="text-[11px] text-ink-500">Listed {fmtDate(l.createdAt, { dateStyle: "medium" })}</div>
                </div>
              </div>
              <BuyListingButton listingId={l.id} askMinor={l.askMinor.toString()} currency={l.currency} name={sku.name} signedIn={!!session} own={l.sellerUserId === userId} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
