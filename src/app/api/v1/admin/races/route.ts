import { desc } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { raceCreateBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { race, raceScoringPolicy } from "@/db/schema";
import { createRace } from "@/domain/races";
import { parseDecimalToMinor } from "@/lib/money";

export const GET = route({ auth: "admin", permission: "races.read" }, async () => {
  const db = getDb();
  return ok({ items: await db.select().from(race).orderBy(desc(race.startsAt)).limit(50), policies: await db.select().from(raceScoringPolicy).orderBy(desc(raceScoringPolicy.version)) });
});

export const POST = route({ auth: "admin", permission: "races.write", body: raceCreateBody }, async ({ body, session }) => {
  const startsAt = new Date(body.startsAt);
  const r = await createRace(getDb(), session!.user.id, { slug: body.slug, name: body.name, timezone: body.timezone, startsAt, endsAt: new Date(startsAt.getTime() + 7 * 86_400_000), scoringPolicyId: body.scoringPolicyId, prizes: body.prizes.map((p) => ({ rank: p.rank, amountMinor: parseDecimalToMinor(p.amount), label: p.label })) });
  return ok({ race: r }, 201);
});
