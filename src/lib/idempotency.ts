import { and, eq, isNull, sql } from "drizzle-orm";
import { getDb } from "@/db/client";
import { idempotencyKey } from "@/db/schema";
import { AppError } from "./errors";
import { sha256Hex } from "./crypto";

export interface IdempotentResult<T> {
  replayed: boolean;
  status: number;
  body: T;
}

/**
 * Executes `fn` at most once per (scope, userId, key). Concurrent duplicates wait on the row lock
 * and then replay the stored response. A different request body with the same key is rejected.
 */
export async function withIdempotency<T>(scope: string, userId: string | null, key: string, requestBody: unknown, fn: () => Promise<{ status: number; body: T }>, ttlHours = 24): Promise<IdempotentResult<T>> {
  const db = getDb();
  const requestHash = sha256Hex(JSON.stringify(requestBody ?? null));
  const expiresAt = new Date(Date.now() + ttlHours * 3_600_000);
  const userCond = userId ? eq(idempotencyKey.userId, userId) : isNull(idempotencyKey.userId);

  // Fast path: claim the key.
  const inserted = await db
    .insert(idempotencyKey)
    .values({ scope, userId, key, requestHash, expiresAt })
    .onConflictDoNothing({ target: [idempotencyKey.scope, idempotencyKey.userId, idempotencyKey.key] })
    .returning({ id: idempotencyKey.id });

  if (inserted.length === 0) {
    // Someone else holds it: wait for completion by locking the row, then replay.
    const existing = await db.transaction(async (tx) => {
      const rows = await tx.execute<{ request_hash: string; response_status: number | null; response_body: unknown }>(
        sql`SELECT request_hash, response_status, response_body FROM idempotency_key WHERE scope = ${scope} AND key = ${key} AND ${userId ? sql`user_id = ${userId}` : sql`user_id IS NULL`} FOR UPDATE`,
      );
      return rows.rows[0];
    });
    if (!existing) throw new AppError("CONFLICT", "Idempotency key vanished; retry");
    if (existing.request_hash !== requestHash) throw new AppError("IDEMPOTENCY_MISMATCH", "Idempotency key reused with a different request body");
    if (existing.response_status === null) throw new AppError("CONFLICT", "Request with this idempotency key is still in progress");
    return { replayed: true, status: existing.response_status, body: existing.response_body as T };
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Hold the row lock for the duration so concurrent retries block instead of double-executing.
      await tx.execute(sql`SELECT id FROM idempotency_key WHERE id = ${inserted[0].id} FOR UPDATE`);
      const r = await fn();
      await tx
        .update(idempotencyKey)
        .set({ responseStatus: r.status, responseBody: JSON.parse(JSON.stringify(r.body, (_k, v) => (typeof v === "bigint" ? v.toString() : v))), completedAt: new Date() })
        .where(eq(idempotencyKey.id, inserted[0].id));
      return r;
    });
    return { replayed: false, status: result.status, body: result.body };
  } catch (e) {
    // Release the key so the client can retry a failed attempt (errors are not cached).
    await db.delete(idempotencyKey).where(and(eq(idempotencyKey.id, inserted[0].id), isNull(idempotencyKey.completedAt), userCond));
    throw e;
  }
}
