import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BattleCreateForm, type LivePack } from "@/components/events/BattleCreateForm";
import { MODE_RULES } from "@/domain/battles";
import { listCatalog } from "@/domain/packs";
import { viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Create battle" };

export default async function BattleCreatePage() {
  const { db, session } = await viewer();
  if (!session) redirect("/login?next=/battles/create");
  const catalog = await listCatalog(db);
  const packs: LivePack[] = catalog
    .filter((p) => p.version.status === "PUBLISHED" && p.version.remainingOpenings > 0)
    .map((p) => ({ packVersionId: p.version.id, slug: p.slug, name: p.name, accent: p.accent, heroImageKey: p.heroImageKey, priceMinor: p.version.priceMinor.toString(), currency: p.version.currency, remainingOpenings: p.version.remainingOpenings }));
  return (
    <div className="space-y-5">
      <div>
        <Link href="/battles" className="tap inline-flex items-center gap-1 text-sm text-ink-300 hover:text-ink-100">
          <ChevronLeft size={16} aria-hidden /> All battles
        </Link>
        <h1 className="font-display mt-1 text-2xl font-extrabold md:text-3xl">Create a battle</h1>
        <p className="mt-1 max-w-2xl text-sm text-ink-400">Pick an identical ordered pack sequence, choose the number of players and a disclosed mode. The server seed hash is committed before any player&apos;s client seed is known.</p>
      </div>
      <BattleCreateForm packs={packs} rules={MODE_RULES} />
    </div>
  );
}
