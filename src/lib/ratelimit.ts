import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { config } from "./config";

/**
 * Fixed-window rate limiter. Uses Redis INCR/EXPIRE when REDIS_URL is set; otherwise the
 * `rate_limit_bucket` table so limits hold across processes without Redis.
 */
type RedisMulti = { incr(k: string): RedisMulti; expire(k: string, s: number): RedisMulti; exec(): Promise<Array<[Error | null, unknown]> | null> };
type RedisLike = { multi(): RedisMulti };
let redis: RedisLike | null | undefined;
async function getRedis(): Promise<RedisLike | null> {
  if (redis !== undefined) return redis;
  if (!process.env.REDIS_URL) return (redis = null);
  try {
    const { default: Redis } = await import("ioredis");
    redis = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1 }) as unknown as RedisLike;
  } catch {
    redis = null;
  }
  return redis;
}

export async function rateLimit(key: string, opts: { max?: number; windowSec?: number } = {}): Promise<{ allowed: boolean; remaining: number; resetSec: number }> {
  const max = opts.max ?? config.rateLimit.max;
  const windowSec = opts.windowSec ?? config.rateLimit.windowSec;
  const r = await getRedis();
  if (r) {
    const bucket = `rl:${key}:${Math.floor(Date.now() / 1000 / windowSec)}`;
    const res = await r.multi().incr(bucket).expire(bucket, windowSec).exec();
    const first = res?.[0] as [Error | null, unknown] | undefined;
    const count = Number(first?.[1] ?? 0);
    return { allowed: count <= max, remaining: Math.max(0, max - count), resetSec: windowSec };
  }
  const db = getDb();
  const rows = await db.execute<{ count: number; window_start: Date }>(sql`
    INSERT INTO rate_limit_bucket (key, count, window_start) VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN rate_limit_bucket.window_start < now() - make_interval(secs => ${windowSec}) THEN 1 ELSE rate_limit_bucket.count + 1 END,
      window_start = CASE WHEN rate_limit_bucket.window_start < now() - make_interval(secs => ${windowSec}) THEN now() ELSE rate_limit_bucket.window_start END
    RETURNING count, window_start`);
  const count = Number(rows.rows[0]?.count ?? 0);
  return { allowed: count <= max, remaining: Math.max(0, max - count), resetSec: windowSec };
}
