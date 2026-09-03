import type { DbOrTx } from "@/db/client";
import { outboxEvent } from "@/db/schema";

export type OutboxTopic =
  | "realtime.battle"
  | "realtime.race"
  | "realtime.raffle"
  | "realtime.opening"
  | "email.send"
  | "fulfillment.ship"
  | "race.score"
  | "notification.create";

/** Write an event in the same transaction as the domain change. The worker drains it (at-least-once). */
export async function enqueueOutbox(db: DbOrTx, topic: OutboxTopic, payload: Record<string, unknown>, aggregate?: { type: string; id: string }): Promise<void> {
  await db.insert(outboxEvent).values({
    topic,
    aggregateType: aggregate?.type ?? null,
    aggregateId: aggregate?.id ?? null,
    payload: JSON.parse(JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v))),
  });
}
