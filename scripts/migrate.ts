import "./env";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { createDb } from "../src/db/client";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const { db, pool } = createDb(url);
  await migrate(db, { migrationsFolder: "./drizzle" });
  await pool.end();
  console.log("migrations applied to", url.replace(/\/\/.*@/, "//***@"));
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
