import { index, integer, jsonb, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, id } from "./_common";
import { jobStatusEnum, notificationKindEnum, riskSeverityEnum } from "./enums";
import { user } from "./identity";

export const notification = pgTable(
  "notification",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    kind: notificationKindEnum("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    href: text("href"),
    readAt: timestamp("read_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("notification_user_idx").on(t.userId, t.readAt, t.createdAt)],
);

export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    id: id(),
    scope: varchar("scope", { length: 64 }).notNull(), // e.g. "openings.create"
    userId: uuid("user_id"),
    key: varchar("key", { length: 160 }).notNull(),
    requestHash: varchar("request_hash", { length: 64 }).notNull(),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body").$type<unknown>(),
    lockedAt: timestamp("locked_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("idempotency_key_uq").on(t.scope, t.userId, t.key)],
);

export const riskEvent = pgTable(
  "risk_event",
  {
    id: id(),
    userId: uuid("user_id").references(() => user.id),
    kind: varchar("kind", { length: 64 }).notNull(), // e.g. RATE_LIMIT, LINKED_ACCOUNT, CHARGEBACK, VELOCITY, DEVICE_MISMATCH
    severity: riskSeverityEnum("severity").notNull().default("LOW"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    correlationId: varchar("correlation_id", { length: 64 }),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: uuid("resolved_by").references(() => user.id),
    resolution: text("resolution"),
    createdAt: createdAt(),
  },
  (t) => [index("risk_event_user_idx").on(t.userId, t.createdAt), index("risk_event_kind_idx").on(t.kind, t.severity)],
);

/** Append-only (trigger). Records admin and fairness-relevant actions. */
export const adminAuditEvent = pgTable(
  "admin_audit_event",
  {
    id: id(),
    actorUserId: uuid("actor_user_id").references(() => user.id),
    actorRole: varchar("actor_role", { length: 48 }),
    action: varchar("action", { length: 96 }).notNull(),
    entityType: varchar("entity_type", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 96 }),
    reason: text("reason"),
    beforeHash: varchar("before_hash", { length: 64 }),
    afterHash: varchar("after_hash", { length: 64 }),
    before: jsonb("before").$type<unknown>(),
    after: jsonb("after").$type<unknown>(),
    correlationId: varchar("correlation_id", { length: 64 }),
    ipHash: varchar("ip_hash", { length: 128 }),
    createdAt: createdAt(),
  },
  (t) => [index("admin_audit_entity_idx").on(t.entityType, t.entityId), index("admin_audit_actor_idx").on(t.actorUserId, t.createdAt), index("admin_audit_created_idx").on(t.createdAt)],
);

/** Transactional outbox: written in the same transaction as the domain change; drained by the worker. */
export const outboxEvent = pgTable(
  "outbox_event",
  {
    id: id(),
    topic: varchar("topic", { length: 64 }).notNull(), // realtime.battle | email.send | fulfillment.ship | ...
    aggregateType: varchar("aggregate_type", { length: 48 }),
    aggregateId: uuid("aggregate_id"),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    createdAt: createdAt(),
  },
  (t) => [index("outbox_unprocessed_idx").on(t.processedAt, t.createdAt), index("outbox_aggregate_idx").on(t.aggregateType, t.aggregateId, t.createdAt)],
);

/** Durable DB-backed job queue (local fallback for Redis/BullMQ). */
export const job = pgTable(
  "job",
  {
    id: id(),
    kind: varchar("kind", { length: 64 }).notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    status: jobStatusEnum("status").notNull().default("PENDING"),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    lastError: text("last_error"),
    dedupeKey: varchar("dedupe_key", { length: 160 }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("job_pending_idx").on(t.status, t.runAt), uniqueIndex("job_dedupe_uq").on(t.dedupeKey)],
);

export const rateLimitBucket = pgTable(
  "rate_limit_bucket",
  {
    key: varchar("key", { length: 160 }).primaryKey(),
    count: integer("count").notNull().default(0),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  },
);
