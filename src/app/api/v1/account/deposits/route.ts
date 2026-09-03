import { route, ok } from "@/lib/api";
import { depositBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { deposit } from "@/domain/users";
import { getUserBalance } from "@/domain/ledger";
import { parseDecimalToMinor } from "@/lib/money";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "user", body: depositBody, idempotent: "account.deposit", rateLimit: { max: 20, windowSec: 3600, key: "user" } }, async ({ body, session, idempotencyKey }) => {
  const db = getDb();
  const p = await deposit(db, session!.user.id, parseDecimalToMinor(body.amount), body.method, idempotencyKey!, body.testOutcome);
  drainOutbox(db, 10).catch(() => undefined);
  const balance = await getUserBalance(db, session!.user.id);
  return ok({ payment: { id: p.id, status: p.status, amountMinor: p.amountMinor, feeMinor: p.feeMinor, failureReason: p.failureReason }, balance }, p.status === "SUCCEEDED" ? 201 : 402);
});
