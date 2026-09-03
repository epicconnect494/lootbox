import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/components/shell/AdminShell";
import { raffleView } from "@/domain/raffles";
import { viewer } from "@/lib/server/data";
import { ser } from "@/components/admin/serialize";
import { RaffleDetail } from "@/components/admin/RaffleDetail";

export const dynamic = "force-dynamic";

export default async function RaffleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin("raffles.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await viewer();
  const view = await raffleView(db, id, null);
  if (!view) notFound();
  return (
    <div className="space-y-4">
      <nav className="text-sm text-ink-400" aria-label="Breadcrumb">
        <Link href="/admin/raffles" className="hover:text-ink-100 hover:underline">
          Raffle Builder
        </Link>{" "}
        / <span className="text-ink-200">{view.raffle.name}</span>
      </nav>
      <RaffleDetail view={ser(view)} permissions={[...session.user.permissions]} />
    </div>
  );
}
