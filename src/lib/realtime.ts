/**
 * Realtime fan-out. In-process EventEmitter with an optional Redis pub/sub bridge so multiple
 * Next.js instances receive each other's events. Events originate from the outbox drain
 * (worker) and are also published directly after commit for low latency.
 */
import { EventEmitter } from "node:events";

export interface RealtimeEvent {
  channel: string; // battle:<id> | race:<id> | raffle:<id> | user:<id>
  type: string;
  payload: unknown;
  at: string;
}

const g = globalThis as unknown as { __lbRealtime?: EventEmitter; __lbRedisSub?: unknown };
function emitter(): EventEmitter {
  if (!g.__lbRealtime) {
    g.__lbRealtime = new EventEmitter();
    g.__lbRealtime.setMaxListeners(10_000);
  }
  return g.__lbRealtime;
}

export function subscribe(channel: string, handler: (e: RealtimeEvent) => void): () => void {
  emitter().on(channel, handler);
  ensureRedisBridge();
  return () => emitter().off(channel, handler);
}

export async function publish(channel: string, type: string, payload: unknown): Promise<void> {
  const e: RealtimeEvent = { channel, type, payload: JSON.parse(JSON.stringify(payload, (_k, v) => (typeof v === "bigint" ? v.toString() : v))), at: new Date().toISOString() };
  emitter().emit(channel, e);
  const redis = await getRedisPublisher();
  if (redis) await redis.publish("lb:realtime", JSON.stringify(e)).catch(() => undefined);
}

type RedisLike = { publish(ch: string, msg: string): Promise<unknown>; subscribe(ch: string): Promise<unknown>; on(ev: string, cb: (...a: string[]) => void): unknown };
let publisher: RedisLike | null | undefined;
async function getRedisPublisher(): Promise<RedisLike | null> {
  if (publisher !== undefined) return publisher;
  if (!process.env.REDIS_URL) return (publisher = null);
  try {
    const { default: Redis } = await import("ioredis");
    publisher = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }) as unknown as RedisLike;
    return publisher;
  } catch {
    return (publisher = null);
  }
}

async function ensureRedisBridge() {
  if (g.__lbRedisSub || !process.env.REDIS_URL) return;
  g.__lbRedisSub = true;
  try {
    const { default: Redis } = await import("ioredis");
    const sub = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 });
    await sub.subscribe("lb:realtime");
    sub.on("message", (_ch: string, msg: string) => {
      try {
        const e = JSON.parse(msg) as RealtimeEvent;
        emitter().emit(e.channel, e);
      } catch {
        /* ignore */
      }
    });
  } catch {
    g.__lbRedisSub = undefined;
  }
}
