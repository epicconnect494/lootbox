import "./env";
import { getDb, getPool } from "../src/db/client";
import { reconcile } from "../src/domain/admin";

async function main() {
  const r = await reconcile(getDb());
  console.log(JSON.stringify(r, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  await getPool().end();
  process.exit(r.ok ? 0 : 2);
}
main();
