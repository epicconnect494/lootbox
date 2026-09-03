import { check, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createdAt, currency, id, money, updatedAt } from "./_common";
import { accountKindEnum, accountOwnerEnum, chargebackStatusEnum, ledgerKindEnum, paymentStatusEnum, refundStatusEnum } from "./enums";
import { user } from "./identity";

export const walletAccount = pgTable(
  "wallet_account",
  {
    id: id(),
    ownerType: accountOwnerEnum("owner_type").notNull(),
    userId: uuid("user_id").references(() => user.id),
    kind: accountKindEnum("kind").notNull(),
    currency: currency(),
    /** Materialized balance; must always equal SUM(ledger_entry.amount_minor). Verified by reconciliation. */
    balanceMinor: money("balance_minor").notNull().default(sql`0`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("wallet_account_user_kind_uq").on(t.userId, t.kind, t.currency).where(sql`user_id IS NOT NULL`),
    uniqueIndex("wallet_account_system_kind_uq").on(t.kind, t.currency).where(sql`owner_type = 'SYSTEM'`),
    check("wallet_user_non_negative", sql`owner_type = 'SYSTEM' OR balance_minor >= 0`),
  ],
);

/** Append-only. UPDATE/DELETE are blocked by trigger (see migration). */
export const ledgerTransaction = pgTable(
  "ledger_transaction",
  {
    id: id(),
    kind: ledgerKindEnum("kind").notNull(),
    referenceType: varchar("reference_type", { length: 48 }),
    referenceId: uuid("reference_id"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    description: text("description"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ledger_tx_idem_uq").on(t.idempotencyKey).where(sql`idempotency_key IS NOT NULL`),
    index("ledger_tx_ref_idx").on(t.referenceType, t.referenceId),
    index("ledger_tx_created_idx").on(t.createdAt),
  ],
);

/** Append-only. Sum of amount_minor per transaction must be zero (deferred constraint trigger). */
export const ledgerEntry = pgTable(
  "ledger_entry",
  {
    id: id(),
    transactionId: uuid("transaction_id").notNull().references(() => ledgerTransaction.id),
    accountId: uuid("account_id").notNull().references(() => walletAccount.id),
    amountMinor: money("amount_minor").notNull(),
    currency: currency(),
    memo: text("memo"),
    createdAt: createdAt(),
  },
  (t) => [index("ledger_entry_account_idx").on(t.accountId, t.createdAt), index("ledger_entry_tx_idx").on(t.transactionId), check("ledger_entry_nonzero", sql`amount_minor <> 0`)],
);

export const payment = pgTable(
  "payment",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerRef: varchar("provider_ref", { length: 160 }),
    amountMinor: money("amount_minor").notNull(),
    feeMinor: money("fee_minor").notNull().default(sql`0`),
    currency: currency(),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    method: varchar("method", { length: 32 }).notNull().default("card"),
    idempotencyKey: varchar("idempotency_key", { length: 160 }),
    ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransaction.id),
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("payment_provider_ref_uq").on(t.provider, t.providerRef).where(sql`provider_ref IS NOT NULL`), index("payment_user_idx").on(t.userId, t.createdAt)],
);

export const refund = pgTable("refund", {
  id: id(),
  paymentId: uuid("payment_id").references(() => payment.id),
  userId: uuid("user_id").notNull().references(() => user.id),
  amountMinor: money("amount_minor").notNull(),
  currency: currency(),
  status: refundStatusEnum("status").notNull().default("PENDING"),
  reason: text("reason").notNull(),
  referenceType: varchar("reference_type", { length: 48 }),
  referenceId: uuid("reference_id"),
  ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransaction.id),
  createdBy: uuid("created_by").references(() => user.id),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const chargeback = pgTable("chargeback", {
  id: id(),
  paymentId: uuid("payment_id").notNull().references(() => payment.id),
  userId: uuid("user_id").notNull().references(() => user.id),
  amountMinor: money("amount_minor").notNull(),
  currency: currency(),
  status: chargebackStatusEnum("status").notNull().default("OPEN"),
  providerRef: varchar("provider_ref", { length: 160 }),
  reasonCode: varchar("reason_code", { length: 32 }),
  ledgerTransactionId: uuid("ledger_transaction_id").references(() => ledgerTransaction.id),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  retryCount: integer("retry_count").notNull().default(0),
});
