import type { Db, Tx } from "@/db/client";

const RETRYABLE = new Set(["40001", "40P01"]); // serialization_failure, deadlock_detected

/** Drizzle wraps driver errors (DrizzleQueryError) with the PG error on `cause`; check both levels. */
export function pgErrorCode(err: unknown): string | undefined {
  let cur = err as { code?: unknown; cause?: unknown } | null | undefined;
  for (let depth = 0; cur && depth < 4; depth++) {
    if (typeof cur.code === "string") return cur.code;
    cur = cur.cause as typeof cur;
  }
  return undefined;
}

export function isRetryableTxError(err: unknown): boolean {
  const code = pgErrorCode(err);
  return typeof code === "string" && RETRYABLE.has(code);
}

/**
 * Run `fn` in a SERIALIZABLE transaction, retrying on serialization failures with jittered backoff.
 * Callers must make `fn` free of side effects outside the database (use the outbox for those).
 */
export async function serializable<T>(db: Db, fn: (tx: Tx) => Promise<T>, opts: { maxAttempts?: number } = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 30;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await db.transaction(fn, { isolationLevel: "serializable" });
    } catch (err) {
      if (!isRetryableTxError(err) || attempt >= maxAttempts) throw err;
      const delay = Math.min(250, 5 * 2 ** Math.min(attempt, 6)) + Math.floor(Math.random() * 40);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
