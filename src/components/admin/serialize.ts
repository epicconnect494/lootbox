import { json } from "@/lib/server/data";

/** Shape of a value after `json()` serialization: bigint and Date become strings. */
export type Json<T> = T extends bigint ? string : T extends Date ? string : T extends Array<infer U> ? Json<U>[] : T extends object ? { [K in keyof T]: Json<T[K]> } : T;

/** Serialize domain output for client components with an accurate static type. */
export function ser<T>(v: T): Json<T> {
  return json(v) as unknown as Json<T>;
}
