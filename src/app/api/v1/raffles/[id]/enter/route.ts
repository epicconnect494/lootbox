import { route, ok } from "@/lib/api";
import { idParam, raffleEnterBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { enterRaffle } from "@/domain/raffles";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "user", params: idParam, body: raffleEnterBody, idempotent: "raffles.enter" }, async ({ params, body, session, idempotencyKey }) => {
  const db = getDb();
  const tickets = await enterRaffle(db, session!.user.id, params.id, body.count, body.source === "PURCHASE" ? "PURCHASE" : "FREE", { idempotencyKey: idempotencyKey! });
  drainOutbox(db, 10).catch(() => undefined);
  return ok({ tickets: tickets.map((t) => ({ ticketNumber: t.ticketNumber, ticketId: t.ticketId, source: t.source })) }, 201);
});
