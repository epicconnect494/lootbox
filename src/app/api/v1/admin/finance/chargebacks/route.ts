import { eq } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { chargebackBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { chargeback, payment } from "@/db/schema";
import { getOrCreateUserAccount, getSystemAccount, postTransaction } from "@/domain/ledger";
import { audit } from "@/lib/audit";
import { err } from "@/lib/errors";
import { parseDecimalToMinor } from "@/lib/money";
import { enqueueOutbox } from "@/lib/outbox";
import { recordRiskEvent } from "@/domain/users";
import { serializable } from "@/lib/tx";

/** Records a chargeback: debits the customer (may drive balance to zero, remainder tracked as system loss), raises a HIGH risk event, excludes race points. */
export const POST = route({ auth: "admin", permission: "finance.write", body: chargebackBody }, async ({ body, session, requestId }) => {
  const db = getDb();
  const row = await serializable(db, async (tx) => {
    const p = await tx.query.payment.findFirst({ where: eq(payment.id, body.paymentId) });
    if (!p) throw err.notFound("Payment");
    const amount = parseDecimalToMinor(body.amount);
    const acct = await getOrCreateUserAccount(tx, p.userId);
    const cb = await getSystemAccount(tx, "SYSTEM_CHARGEBACKS");
    const clearing = await getSystemAccount(tx, "SYSTEM_PAYMENT_CLEARING");
    const recoverable = acct.balanceMinor < amount ? acct.balanceMinor : amount;
    const entries = [{ accountId: clearing.id, amountMinor: amount, memo: "chargeback withdrawn by processor" }];
    if (recoverable > 0n) entries.push({ accountId: acct.id, amountMinor: -recoverable, memo: "chargeback recovery" });
    if (amount - recoverable > 0n) entries.push({ accountId: cb.id, amountMinor: -(amount - recoverable), memo: "unrecovered chargeback loss" });
    const trx = await postTransaction(tx, { kind: "CHARGEBACK", referenceType: "payment", referenceId: p.id, description: `Chargeback ${body.reasonCode ?? ""}`, entries, createdBy: session!.user.id });
    const [c] = await tx.insert(chargeback).values({ paymentId: p.id, userId: p.userId, amountMinor: amount, providerRef: body.providerRef ?? null, reasonCode: body.reasonCode ?? null, ledgerTransactionId: trx.id }).returning();
    await recordRiskEvent(tx, { userId: p.userId, kind: "CHARGEBACK", severity: "HIGH", details: { chargebackId: c.id, amountMinor: amount.toString() }, correlationId: requestId });
    await enqueueOutbox(tx, "race.score", { sourceType: "REVERSAL", sourceId: p.id, originalSourceType: "OPENING", userId: p.userId, reason: "CHARGEBACK", occurredAt: new Date().toISOString() });
    await audit(tx, { actorUserId: session!.user.id, action: "finance.chargeback", entityType: "chargeback", entityId: c.id, after: { amountMinor: amount, recoverable }, correlationId: requestId });
    return c;
  });
  return ok({ chargeback: row }, 201);
});
