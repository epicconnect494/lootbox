import { and, desc, eq, isNull, sql } from "drizzle-orm";
import type { Db, DbOrTx } from "@/db/client";
import { fairnessSeed, jurisdiction, notification, payment, refund, responsiblePlayLimit, riskEvent, role, selfExclusion, user, userRole, userSession, userVerification } from "@/db/schema";
import { audit } from "@/lib/audit";
import { encryptString, hashPassword, verifyPassword } from "@/lib/crypto";
import { err } from "@/lib/errors";
import { enqueueOutbox } from "@/lib/outbox";
import { kycProvider, paymentProvider } from "@/adapters";
import { getOrCreateUserAccount, getSystemAccount, getUserBalance, postTransaction } from "./ledger";
import { assertEligible, checkEligibility } from "./gates";
import { getOrCreateUserSeed } from "./openings";
import { serializable } from "@/lib/tx";

export async function registerUser(db: Db, input: { email: string; password: string; displayName: string; jurisdictionCode?: string | null; dateOfBirth?: Date | null }) {
  const email = input.email.trim().toLowerCase();
  if (input.password.length < 10) throw err.validation("Password must be at least 10 characters");
  return db.transaction(async (tx) => {
    const existing = await tx.query.user.findFirst({ where: eq(user.email, email) });
    if (existing) throw err.conflict("An account with this email already exists");
    const [u] = await tx.insert(user).values({ email, passwordHash: hashPassword(input.password), displayName: input.displayName.trim().slice(0, 64), jurisdictionCode: input.jurisdictionCode ?? null, dateOfBirth: input.dateOfBirth ?? null }).returning();
    const customer = await tx.query.role.findFirst({ where: eq(role.key, "CUSTOMER") });
    if (customer) await tx.insert(userRole).values({ userId: u.id, roleId: customer.id });
    await getOrCreateUserAccount(tx, u.id);
    await getOrCreateUserSeed(tx, u.id);
    await audit(tx, { actorUserId: u.id, actorRole: "CUSTOMER", action: "user.register", entityType: "user", entityId: u.id });
    return u;
  });
}

export async function authenticate(db: DbOrTx, email: string, password: string) {
  const u = await db.query.user.findFirst({ where: and(eq(user.email, email.trim().toLowerCase()), isNull(user.deletedAt)) });
  if (!u || !verifyPassword(password, u.passwordHash)) return null;
  if (u.status === "CLOSED") return null;
  await db.update(user).set({ lastLoginAt: new Date() }).where(eq(user.id, u.id));
  return u;
}

export async function accountOverview(db: DbOrTx, userId: string) {
  const u = (await db.query.user.findFirst({ where: eq(user.id, userId) }))!;
  const balance = await getUserBalance(db, userId);
  const verifications = await db.select().from(userVerification).where(eq(userVerification.userId, userId)).orderBy(desc(userVerification.createdAt));
  const limits = await db.select().from(responsiblePlayLimit).where(and(eq(responsiblePlayLimit.userId, userId), isNull(responsiblePlayLimit.supersededAt)));
  const exclusions = await db.select().from(selfExclusion).where(eq(selfExclusion.userId, userId)).orderBy(desc(selfExclusion.createdAt));
  const payments = await db.select().from(payment).where(eq(payment.userId, userId)).orderBy(desc(payment.createdAt)).limit(20);
  const notifications = await db.select().from(notification).where(eq(notification.userId, userId)).orderBy(desc(notification.createdAt)).limit(20);
  const jurisdictions = await db.select().from(jurisdiction).orderBy(jurisdiction.name);
  const sessions = await db.select({ id: userSession.id, createdAt: userSession.createdAt, lastSeenAt: userSession.lastSeenAt, expiresAt: userSession.expiresAt }).from(userSession).where(and(eq(userSession.userId, userId), isNull(userSession.revokedAt)));
  const gates = { open: await checkEligibility(db, userId, "OPEN"), battle: await checkEligibility(db, userId, "BATTLE"), sellback: await checkEligibility(db, userId, "SELLBACK"), raffle: await checkEligibility(db, userId, "RAFFLE_FREE") };
  const seed = await db.query.fairnessSeed.findFirst({ where: and(eq(fairnessSeed.userId, userId), eq(fairnessSeed.scope, "USER"), eq(fairnessSeed.status, "ACTIVE")) });
  return {
    user: { id: u.id, email: u.email, displayName: u.displayName, status: u.status, jurisdictionCode: u.jurisdictionCode, dateOfBirth: u.dateOfBirth, timezone: u.timezone, createdAt: u.createdAt, notificationPrefs: u.notificationPrefs },
    balance,
    verifications: verifications.map((v) => ({ id: v.id, type: v.type, status: v.status, provider: v.provider, reason: v.reason, createdAt: v.createdAt })),
    limits,
    exclusions,
    payments,
    notifications,
    jurisdictions: jurisdictions.map((j) => ({ code: j.code, name: j.name, paidChanceEnabled: j.paidChanceEnabled, battlesEnabled: j.battlesEnabled, rafflesEnabled: j.rafflesEnabled, cashConversionEnabled: j.cashConversionEnabled, minAge: j.minAge })),
    sessions,
    gates,
    seed: seed ? { serverSeedHash: seed.serverSeedHash, clientSeed: seed.clientSeed, nonce: seed.nonce } : null,
  };
}

export async function updateProfile(db: Db, userId: string, patch: { displayName?: string; jurisdictionCode?: string | null; dateOfBirth?: Date | null; timezone?: string; notificationPrefs?: Record<string, boolean> }) {
  return db.transaction(async (tx) => {
    const before = (await tx.query.user.findFirst({ where: eq(user.id, userId) }))!;
    if (patch.jurisdictionCode) {
      const j = await tx.query.jurisdiction.findFirst({ where: eq(jurisdiction.code, patch.jurisdictionCode) });
      if (!j) throw err.validation("Unknown region");
    }
    const [after] = await tx.update(user).set({ displayName: patch.displayName?.trim().slice(0, 64), jurisdictionCode: patch.jurisdictionCode, dateOfBirth: patch.dateOfBirth, timezone: patch.timezone, notificationPrefs: patch.notificationPrefs }).where(eq(user.id, userId)).returning();
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "user.profile.update", entityType: "user", entityId: userId, before: { jurisdictionCode: before.jurisdictionCode, timezone: before.timezone }, after: { jurisdictionCode: after.jurisdictionCode, timezone: after.timezone } });
    return after;
  });
}

export async function submitVerification(db: Db, userId: string, type: "AGE" | "IDENTITY" | "ADDRESS", payload: Record<string, unknown>) {
  const provider = kycProvider();
  const result = await provider.startVerification({ userId, type, payload });
  return db.transaction(async (tx) => {
    const [v] = await tx
      .insert(userVerification)
      .values({ userId, type, status: result.status, provider: provider.name, providerRef: result.providerRef, encryptedPayload: encryptString(JSON.stringify(payload), `kyc:${userId}`), reason: result.reason ?? null, expiresAt: result.status === "APPROVED" ? new Date(Date.now() + 365 * 86_400_000) : null })
      .returning();
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "verification.submit", entityType: "user_verification", entityId: v.id, after: { type, status: v.status, provider: provider.name } });
    return v;
  });
}

export async function setLimit(db: Db, userId: string, type: typeof responsiblePlayLimit.$inferSelect.type, amountMinor: bigint) {
  return db.transaction(async (tx) => {
    const current = await tx.query.responsiblePlayLimit.findFirst({ where: and(eq(responsiblePlayLimit.userId, userId), eq(responsiblePlayLimit.type, type), isNull(responsiblePlayLimit.supersededAt)) });
    // Decreases apply immediately; increases take effect after 24h cooling period.
    const increase = current ? amountMinor > current.amountMinor : false;
    const effectiveAt = increase ? new Date(Date.now() + 24 * 3_600_000) : new Date();
    if (current && !increase) await tx.update(responsiblePlayLimit).set({ supersededAt: new Date() }).where(eq(responsiblePlayLimit.id, current.id));
    const [row] = await tx.insert(responsiblePlayLimit).values({ userId, type, amountMinor, effectiveAt }).returning();
    if (current && increase) {
      // keep the lower limit active until the new one becomes effective; the worker supersedes it then.
      await tx.update(responsiblePlayLimit).set({ supersededAt: effectiveAt }).where(eq(responsiblePlayLimit.id, current.id));
    }
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "limit.set", entityType: "responsible_play_limit", entityId: row.id, before: current ? { amountMinor: current.amountMinor } : undefined, after: { amountMinor, effectiveAt } });
    return row;
  });
}

export async function setExclusion(db: Db, userId: string, type: "COOLING_OFF" | "SELF_EXCLUSION", days: number | null, reason?: string) {
  if (type === "COOLING_OFF" && (!days || days < 1 || days > 30)) throw err.validation("Cooling-off is 1-30 days");
  if (type === "SELF_EXCLUSION" && days !== null && days < 180) throw err.validation("Self-exclusion is at least 180 days or indefinite");
  return db.transaction(async (tx) => {
    const [row] = await tx.insert(selfExclusion).values({ userId, type, endsAt: days ? new Date(Date.now() + days * 86_400_000) : null, reason: reason ?? null, createdBy: userId }).returning();
    await tx.update(userSession).set({ revokedAt: new Date() }).where(and(eq(userSession.userId, userId), sql`${userSession.revokedAt} IS NULL`));
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "exclusion.set", entityType: "self_exclusion", entityId: row.id, after: { type, endsAt: row.endsAt } });
    return row;
  });
}

// ---- Payments -----------------------------------------------------------------------------------------
export async function deposit(db: Db, userId: string, amountMinor: bigint, method: string, idempotencyKey: string, testOutcome?: "succeed" | "fail") {
  if (amountMinor < 500n || amountMinor > 500_000n) throw err.validation("Deposit between $5 and $5,000");
  await assertEligible(db, userId, "DEPOSIT", amountMinor);
  const provider = paymentProvider();
  const result = await provider.charge({ userId, amountMinor, currency: "USD", method, idempotencyKey, testOutcome });
  return serializable(db, async (tx) => {
    const [p] = await tx.insert(payment).values({ userId, provider: provider.name, providerRef: result.providerRef, amountMinor, feeMinor: result.feeMinor, status: result.status, method, idempotencyKey, failureReason: result.failureReason ?? null }).returning();
    if (result.status === "SUCCEEDED") {
      const acct = await getOrCreateUserAccount(tx, userId);
      const clearing = await getSystemAccount(tx, "SYSTEM_PAYMENT_CLEARING");
      const trx = await postTransaction(tx, { kind: "DEPOSIT", referenceType: "payment", referenceId: p.id, idempotencyKey: `deposit:${userId}:${idempotencyKey}`, description: `Deposit via ${method}`, entries: [{ accountId: clearing.id, amountMinor: -amountMinor }, { accountId: acct.id, amountMinor }], createdBy: userId });
      await tx.update(payment).set({ ledgerTransactionId: trx.id }).where(eq(payment.id, p.id));
      await enqueueOutbox(tx, "notification.create", { userId, kind: "ACCOUNT", title: "Deposit received", body: "Funds are available in your balance.", href: "/account" });
    }
    await audit(tx, { actorUserId: userId, actorRole: "CUSTOMER", action: "payment.deposit", entityType: "payment", entityId: p.id, after: { status: result.status, amountMinor } });
    return p;
  });
}

export async function issueRefund(db: Db, adminUserId: string, input: { userId: string; paymentId?: string | null; amountMinor: bigint; reason: string; referenceType?: string; referenceId?: string }) {
  return serializable(db, async (tx) => {
    const acct = await getOrCreateUserAccount(tx, input.userId);
    const refunds = await getSystemAccount(tx, "SYSTEM_REFUNDS");
    const trx = await postTransaction(tx, { kind: "REFUND", referenceType: input.referenceType ?? "manual", referenceId: input.referenceId, description: input.reason, entries: [{ accountId: refunds.id, amountMinor: -input.amountMinor }, { accountId: acct.id, amountMinor: input.amountMinor }], createdBy: adminUserId });
    const [r] = await tx.insert(refund).values({ paymentId: input.paymentId ?? null, userId: input.userId, amountMinor: input.amountMinor, status: "SUCCEEDED", reason: input.reason, referenceType: input.referenceType ?? null, referenceId: input.referenceId ?? null, ledgerTransactionId: trx.id, createdBy: adminUserId }).returning();
    await audit(tx, { actorUserId: adminUserId, action: "finance.refund", entityType: "refund", entityId: r.id, reason: input.reason, after: { amountMinor: input.amountMinor, userId: input.userId } });
    return r;
  });
}

export async function recordRiskEvent(db: DbOrTx, input: { userId: string | null; kind: string; severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"; details?: Record<string, unknown>; correlationId?: string | null }) {
  const [row] = await db.insert(riskEvent).values({ userId: input.userId, kind: input.kind, severity: input.severity, details: input.details ?? {}, correlationId: input.correlationId ?? null }).returning();
  return row;
}
