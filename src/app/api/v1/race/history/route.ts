import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { computeLeaderboard, pastRaces } from "@/domain/races";

export const GET = route({ auth: "none" }, async () => {
  const db = getDb();
  const races = await pastRaces(db);
  const items = [];
  for (const r of races) items.push({ race: r, top: await computeLeaderboard(db, r.id, 10) });
  return ok({ items });
});
