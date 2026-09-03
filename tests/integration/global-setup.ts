import { loadEnv } from "../../scripts/env";
import { Pool } from "pg";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../../src/db/client";

export default async function setup() {
  loadEnv();
  const url = process.env.TEST_DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/lootbox_test";
  const pool = new Pool({ connectionString: url });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await pool.end();
  const { db, pool: p2 } = createDb(url);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await p2.end();
}
