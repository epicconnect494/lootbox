import "./env";
import { getDb, getPool } from "../src/db/client";
import { seedAll, DEMO_ACCOUNTS, DEMO_PASSWORD } from "../src/db/seed";
import { reconcile } from "../src/domain/admin";

async function main() {
  const db = getDb();
  const started = Date.now();
  await seedAll(db);
  const r = await reconcile(db);
  console.log(`seeded in ${Date.now() - started}ms; reconciliation ${r.ok ? "OK" : "PROBLEMS: " + JSON.stringify(r.problems)}`);
  console.log("Demo accounts (password: %s):", DEMO_PASSWORD);
  for (const a of DEMO_ACCOUNTS) console.log(`  ${a.email.padEnd(26)} ${a.role}`);
  await getPool().end();
  process.exit(r.ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
