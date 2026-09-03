import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { currentRace, raceView } from "@/domain/races";

export const GET = route({ auth: "optional" }, async ({ session }) => {
  const db = getDb();
  const r = await currentRace(db);
  if (!r) return ok({ race: null });
  return ok(await raceView(db, r.id, session?.user.id ?? null));
});
