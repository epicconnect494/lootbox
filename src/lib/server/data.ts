/** Server-component helpers: fetch domain data directly (no HTTP hop) with bigint-safe JSON conversion for client components. */
import { getDb } from "@/db/client";
import { getSession } from "@/lib/auth";

export function json<T>(v: T): T {
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val))) as T;
}

export async function viewer() {
  const session = await getSession();
  return { db: getDb(), session, userId: session?.user.id ?? null };
}
