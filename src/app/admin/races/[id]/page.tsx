import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { requireAdmin } from "@/components/shell/AdminShell";
import { raceScoreEvent, raceStanding, user } from "@/db/schema";
import { raceView } from "@/domain/races";
import { viewer } from "@/lib/server/data";
import { ser } from "@/components/admin/serialize";
import { RaceDetail } from "@/components/admin/RaceDetail";

export const dynamic = "force-dynamic";

export default async function RaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin("races.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await viewer();
  const view = await raceView(db, id, null);
  if (!view) notFound();
  const [standings, events] = await Promise.all([
    db.select({ s: raceStanding, email: user.email, displayName: user.displayName }).from(raceStanding).innerJoin(user, eq(user.id, raceStanding.userId)).where(eq(raceStanding.raceId, id)).orderBy(desc(raceStanding.points)),
    db.select().from(raceScoreEvent).where(eq(raceScoreEvent.raceId, id)).orderBy(desc(raceScoreEvent.occurredAt)).limit(200),
  ]);
  return (
    <div className="space-y-4">
      <nav className="text-sm text-ink-400" aria-label="Breadcrumb">
        <Link href="/admin/races" className="hover:text-ink-100 hover:underline">
          Race Builder
        </Link>{" "}
        / <span className="text-ink-200">{view.race.name}</span>
      </nav>
      <RaceDetail view={ser(view)} standings={ser(standings)} events={ser(events)} permissions={[...session.user.permissions]} />
    </div>
  );
}
