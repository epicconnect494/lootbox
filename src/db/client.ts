import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export type DbOrTx = Db | Tx;

// pg returns int8 as string by default; we parse to BigInt so money never touches floats.
import pg from "pg";
pg.types.setTypeParser(20, (v: string) => BigInt(v));

const globalForDb = globalThis as unknown as { __lootboxPool?: Pool; __lootboxDb?: Db };

export function getPool(): Pool {
  if (!globalForDb.__lootboxPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL is not set");
    globalForDb.__lootboxPool = new Pool({ connectionString, max: Number(process.env.PG_POOL_MAX ?? 10) });
  }
  return globalForDb.__lootboxPool;
}

export function getDb(): Db {
  if (!globalForDb.__lootboxDb) {
    globalForDb.__lootboxDb = drizzle(getPool(), { schema });
  }
  return globalForDb.__lootboxDb;
}

export function createDb(connectionString: string): { db: Db; pool: Pool } {
  const pool = new Pool({ connectionString, max: 10 });
  return { db: drizzle(pool, { schema }), pool };
}

export { schema };
