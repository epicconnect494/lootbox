import type { Db, Tx } from "@/db/client";

const RETRYABLE = new Set(["40001", "40P01"]); // serialization_failure, deadlock_detected

export function isRetryableTxError(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return typeof code === "string" && RETRYABLE.has(code);
}

/**
 * Run `fn` in a SERIALIZABLE transaction, retrying on serialization failures with jittered backoff.
 * Callers must make `fn` free of side effects outside the database (use the outbox for those).
 */
export async function serializable<T>(db: Db, fn: (tx: Tx) => Promise<T>, opts: { maxAttempts?: number } = {}): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 6;
  let attempt = 0;
  for (;;) {
    attempt += 1;
    try {
      return await db.transaction(fn, { isolationLevel: "serializable" });
    } catch (err) {
      if (!isRetryableTxError(err) || attempt >= maxAttempts) throw err;
      const delay = Math.min(200, 10 * 2 ** attempt) + Math.floor(Math.random() * 15);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
