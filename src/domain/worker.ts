import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";
import type { Db } from "@/db/client";
import { job, notification, outboxEvent, packVersion, responsiblePlayLimit, shipment, user } from "@/db/schema";
import { emailProvider } from "@/adapters";
import { log } from "@/lib/log";
import { publish } from "@/lib/realtime";
import { evaluateVersionHealth, pauseVersion, publishVersion } from "./packs";
import { revealEligibleSeeds } from "./openings";
import { raceScheduler, scoreEvent } from "./races";
import { raffleScheduler } from "./raffles";

/** Drains up to `batch` outbox events. At-least-once: handlers must be idempotent. */
export async function drainOutbox(db: Db, batch = 100): Promise<number> {
  const rows = await db.select().from(outboxEvent).where(isNull(outboxEvent.processedAt)).orderBy(asc(outboxEvent.createdAt)).limit(batch);
  let n = 0;
  for (const ev of rows) {
    try {
      await handle(db, ev);
      await db.update(outboxEvent).set({ processedAt: new Date(), attempts: ev.attempts + 1 }).where(eq(outboxEvent.id, ev.id));
      n++;
    } catch (e) {
      log.error("outbox.failed", { id: ev.id, topic: ev.topic, message: (e as Error).message });
      await db.update(outboxEvent).set({ attempts: ev.attempts + 1, lastError: (e as Error).message, processedAt: ev.attempts + 1 >= 10 ? new Date() : null }).where(eq(outboxEvent.id, ev.id));
    }
  }
  return n;
}

async function handle(db: Db, ev: typeof outboxEvent.$inferSelect) {
  const p = ev.payload as Record<string, string>;
  switch (ev.topic) {
    case "realtime.battle":
      await publish(`battle:${p.battleId}`, p.type ?? "update", p);
      return;
    case "realtime.race":
      await publish(`race:${p.raceId}`, p.type ?? "update", p);
      return;
    case "realtime.raffle":
      await publish(`raffle:${p.raffleId}`, p.type ?? "update", p);
      return;
    case "realtime.opening":
      await publish(`user:${p.userId}`, "opening", p);
      return;
    case "race.score":
      await scoreEvent(db, { sourceType: p.sourceType as "OPENING", sourceId: p.sourceId, originalSourceType: p.originalSourceType, userId: p.userId, amountMinor: p.amountMinor ? BigInt(p.amountMinor) : 0n, reason: p.reason, occurredAt: new Date(p.occurredAt) });
      return;
    case "notification.create": {
      await db.insert(notification).values({ userId: p.userId, kind: (p.kind as "SYSTEM") ?? "SYSTEM", title: p.title, body: p.body, href: p.href ?? null });
      await publish(`user:${p.userId}`, "notification", { title: p.title, body: p.body, href: p.href ?? null });
      const u = await db.query.user.findFirst({ where: eq(user.id, p.userId) });
      if (u && u.notificationPrefs.email !== false) await emailProvider().send({ to: u.email, subject: p.title, text: p.body });
      return;
    }
    case "email.send":
      await emailProvider().send({ to: p.to, subject: p.subject, text: p.text });
      return;
    case "fulfillment.ship": {
      // PRODUCTION INTEGRATION POINT: push to WMS / 3PL. Locally we mark the address as verified by the mock verifier.
      await db.update(shipment).set({ addressVerified: true, status: "ADDRESS_VERIFIED" }).where(and(eq(shipment.id, p.shipmentId), eq(shipment.status, "REQUESTED")));
      return;
    }
    default:
      log.warn("outbox.unknown_topic", { topic: ev.topic });
  }
}

/** Periodic scheduler work. Safe to run concurrently (all operations are idempotent or guarded). */
export async function runSchedulers(db: Db) {
  const results: Record<string, unknown> = {};
  results.races = await raceScheduler(db);
  results.raffles = await raffleScheduler(db);
  results.seedsRevealed = await revealEligibleSeeds(db);
  // Scheduled publishes.
  const due = await db.select().from(packVersion).where(and(eq(packVersion.status, "SCHEDULED"), lte(packVersion.scheduledAt, new Date())));
  for (const v of due) {
    try {
      await db.update(packVersion).set({ status: "APPROVED" }).where(eq(packVersion.id, v.id));
      await publishVersion(db, { userId: v.approvedBy ?? v.createdBy!, role: "SYSTEM" }, v.id);
    } catch (e) {
      log.error("scheduler.publish_failed", { versionId: v.id, message: (e as Error).message });
    }
  }
  // Auto-pause unhealthy live packs.
  const live = await db.select().from(packVersion).where(eq(packVersion.status, "PUBLISHED"));
  let paused = 0;
  for (const v of live) {
    const h = await evaluateVersionHealth(db, v.id);
    if (!h.ok) {
      await pauseVersion(db, null, v.id, `Auto-pause: ${h.reasons.join("; ")}`);
      paused++;
    }
  }
  results.autoPaused = paused;
  // Activate pending limit increases (the old, lower limit was already superseded at effective time).
  await db.execute(sql`UPDATE responsible_play_limit SET superseded_at = now() WHERE superseded_at IS NULL AND id IN (
    SELECT old.id FROM responsible_play_limit old JOIN responsible_play_limit new ON new.user_id = old.user_id AND new.type = old.type AND new.id <> old.id AND new.effective_at <= now() AND new.created_at > old.created_at WHERE old.superseded_at IS NULL)`);
  void responsiblePlayLimit;
  return results;
}

/** Durable DB-backed job queue (Redis/BullMQ adapter is the production integration point). */
export async function enqueueJob(db: Db, kind: string, payload: Record<string, unknown>, opts: { runAt?: Date; dedupeKey?: string } = {}) {
  await db.insert(job).values({ kind, payload, runAt: opts.runAt ?? new Date(), dedupeKey: opts.dedupeKey ?? null }).onConflictDoNothing();
}

export async function runJobs(db: Db, handlers: Record<string, (payload: Record<string, unknown>) => Promise<void>>, batch = 20): Promise<number> {
  const claimed = await db.execute<{ id: string; kind: string; payload: Record<string, unknown>; attempts: number; max_attempts: number }>(sql`
    UPDATE job SET status='RUNNING', locked_at = now(), attempts = attempts + 1
    WHERE id IN (SELECT id FROM job WHERE status='PENDING' AND run_at <= now() ORDER BY run_at LIMIT ${batch} FOR UPDATE SKIP LOCKED)
    RETURNING id, kind, payload, attempts, max_attempts`);
  let n = 0;
  for (const j of claimed.rows) {
    const h = handlers[j.kind];
    try {
      if (!h) throw new Error(`no handler for ${j.kind}`);
      await h(j.payload);
      await db.update(job).set({ status: "DONE", completedAt: new Date() }).where(eq(job.id, j.id));
      n++;
    } catch (e) {
      const dead = j.attempts >= j.max_attempts;
      await db.update(job).set({ status: dead ? "DEAD" : "PENDING", lastError: (e as Error).message, runAt: new Date(Date.now() + Math.min(300_000, 1000 * 2 ** j.attempts)) }).where(eq(job.id, j.id));
    }
  }
  return n;
}
