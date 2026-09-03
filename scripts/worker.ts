import "./env";
import { getDb } from "../src/db/client";
import { drainOutbox, runJobs, runSchedulers } from "../src/domain/worker";
import { log } from "../src/lib/log";

const INTERVAL_MS = Number(process.env.WORKER_INTERVAL_MS ?? 2000);
const SCHEDULER_EVERY = Number(process.env.WORKER_SCHEDULER_EVERY_TICKS ?? 15);

async function main() {
  const db = getDb();
  let tick = 0;
  log.info("worker.start", { intervalMs: INTERVAL_MS });
  for (;;) {
    try {
      const drained = await drainOutbox(db);
      const jobs = await runJobs(db, {});
      if (drained || jobs) log.info("worker.tick", { drained, jobs });
      if (tick % SCHEDULER_EVERY === 0) {
        const r = await runSchedulers(db);
        log.debug("worker.schedulers", r);
      }
    } catch (e) {
      log.error("worker.error", { message: (e as Error).message });
    }
    tick++;
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}
main();
