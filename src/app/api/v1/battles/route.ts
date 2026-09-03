import { route, ok } from "@/lib/api";
import { battleCreateBody, battleListQuery } from "@/api/schemas";
import { getDb } from "@/db/client";
import { createBattle, listBattles, MODE_RULES } from "@/domain/battles";
import { drainOutbox } from "@/domain/worker";

export const GET = route({ auth: "optional", query: battleListQuery }, async ({ query, session }) => {
  return ok({ items: await listBattles(getDb(), query.status, session?.user.id ?? null), modes: MODE_RULES });
});

export const POST = route({ auth: "user", body: battleCreateBody, idempotent: "battles.create" }, async ({ body, session, idempotencyKey }) => {
  const db = getDb();
  const b = await createBattle(db, session!.user.id, { mode: body.mode, speed: body.speed, isPrivate: body.isPrivate, seats: body.seats, packVersionIds: body.packVersionIds, sharedRule: body.sharedRule ?? null, idempotencyKey: idempotencyKey! });
  drainOutbox(db, 10).catch(() => undefined);
  return ok({ battle: b }, 201);
});
