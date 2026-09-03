/** Server-only helper: bigint/Date-safe JSON conversion with a matching static type for client props. */
import { json } from "@/lib/server/data";
import type { Serialized } from "./types";

export function serialize<T>(v: T): Serialized<T> {
  return json(v) as unknown as Serialized<T>;
}
