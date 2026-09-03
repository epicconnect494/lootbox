import "./env";
import { Pool } from "pg";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  if (process.env.NODE_ENV === "production") throw new Error("refusing to reset a production database");
  const pool = new Pool({ connectionString: url });
  await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public; DROP SCHEMA IF EXISTS drizzle CASCADE;");
  await pool.end();
  console.log("database reset");
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
