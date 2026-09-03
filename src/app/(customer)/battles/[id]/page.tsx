import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { BattleRoom, type BattleView } from "@/components/events/BattleRoom";
import { getBattleView } from "@/domain/battles";
import { json, viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return { title: `Battle ${id.slice(0, 8)}` };
}

export default async function BattlePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db, userId } = await viewer();
  const view = await getBattleView(db, id, userId);
  if (!view) notFound();
  const initial = json(view) as unknown as BattleView;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <Link href="/battles" className="tap inline-flex items-center gap-1 text-sm text-ink-300 hover:text-ink-100">
          <ChevronLeft size={16} aria-hidden /> All battles
        </Link>
        <h1 className="font-display text-xl font-extrabold md:text-2xl">
          {view.rules.title} battle <span className="font-mono text-base text-ink-400">#{view.battle.code}</span>
        </h1>
      </div>
      <BattleRoom initial={initial} viewerUserId={userId} />
    </div>
  );
}
