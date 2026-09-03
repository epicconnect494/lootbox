import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { raceView } from "@/domain/races";
import { err } from "@/lib/errors";
import { eq } from "drizzle-orm";
import { raceStanding, raceScoreEvent, user } from "@/db/schema";
import { desc } from "drizzle-orm";

export const GET = route({ auth: "admin", permission: "races.read", params: idParam }, async ({ params }) => {
  const db = getDb();
  const v = await raceView(db, params.id, null);
  if (!v) throw err.notFound("Race");
  const standings = await db.select({ s: raceStanding, email: user.email, displayName: user.displayName }).from(raceStanding).innerJoin(user, eq(user.id, raceStanding.userId)).where(eq(raceStanding.raceId, params.id)).orderBy(desc(raceStanding.points));
  const events = await db.select().from(raceScoreEvent).where(eq(raceScoreEvent.raceId, params.id)).orderBy(desc(raceScoreEvent.occurredAt)).limit(200);
  return ok({ ...v, standings, events });
});
