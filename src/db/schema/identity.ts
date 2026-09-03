import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { createdAt, currency, deletedAt, id, money, updatedAt } from "./_common";
import { exclusionTypeEnum, limitTypeEnum, userStatusEnum, verificationStatusEnum, verificationTypeEnum } from "./enums";

/** Per-jurisdiction legal switches. Nothing is enabled without explicit legal approval recorded here. */
export const jurisdiction = pgTable("jurisdiction", {
  code: varchar("code", { length: 8 }).primaryKey(), // ISO 3166-1 alpha-2 or alpha-2 + region, e.g. "US-NY"
  name: text("name").notNull(),
  minAge: integer("min_age").notNull().default(18),
  paidChanceEnabled: boolean("paid_chance_enabled").notNull().default(false),
  battlesEnabled: boolean("battles_enabled").notNull().default(false),
  rafflesEnabled: boolean("raffles_enabled").notNull().default(false),
  raffleFreeEntryRequired: boolean("raffle_free_entry_required").notNull().default(true),
  cashConversionEnabled: boolean("cash_conversion_enabled").notNull().default(false),
  cryptoConversionEnabled: boolean("crypto_conversion_enabled").notNull().default(false),
  freeEntryRouteEnabled: boolean("free_entry_route_enabled").notNull().default(true),
  botsEnabled: boolean("bots_enabled").notNull().default(false),
  legalApprovalReference: text("legal_approval_reference"),
  legalApprovedAt: timestamp("legal_approved_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const user = pgTable(
  "user",
  {
    id: id(),
    email: varchar("email", { length: 320 }).notNull(),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 64 }).notNull(),
    status: userStatusEnum("status").notNull().default("ACTIVE"),
    jurisdictionCode: varchar("jurisdiction_code", { length: 8 }).references(() => jurisdiction.code),
    dateOfBirth: timestamp("date_of_birth", { withTimezone: false }),
    timezone: varchar("timezone", { length: 64 }).notNull().default("UTC"),
    isBot: boolean("is_bot").notNull().default(false),
    riskScore: integer("risk_score").notNull().default(0),
    linkedAccountGroup: uuid("linked_account_group"),
    notificationPrefs: jsonb("notification_prefs").$type<Record<string, boolean>>().notNull().default({}),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [uniqueIndex("user_email_uq").on(t.email), index("user_linked_group_idx").on(t.linkedAccountGroup)],
);

export const role = pgTable("role", {
  id: id(),
  key: varchar("key", { length: 48 }).notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: createdAt(),
});

export const permission = pgTable("permission", {
  id: id(),
  key: varchar("key", { length: 64 }).notNull().unique(),
  description: text("description"),
});

export const rolePermission = pgTable(
  "role_permission",
  {
    roleId: uuid("role_id").notNull().references(() => role.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permission.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.roleId, t.permissionId] })],
);

export const userRole = pgTable(
  "user_role",
  {
    userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    roleId: uuid("role_id").notNull().references(() => role.id, { onDelete: "cascade" }),
    grantedBy: uuid("granted_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.roleId] })],
);

export const userSession = pgTable(
  "user_session",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 128 }).notNull(),
    csrfSecret: varchar("csrf_secret", { length: 128 }).notNull(),
    ipHash: varchar("ip_hash", { length: 128 }),
    userAgentHash: varchar("user_agent_hash", { length: 128 }),
    deviceFingerprint: varchar("device_fingerprint", { length: 128 }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("user_session_token_uq").on(t.tokenHash), index("user_session_user_idx").on(t.userId)],
);

export const userVerification = pgTable(
  "user_verification",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    type: verificationTypeEnum("type").notNull(),
    status: verificationStatusEnum("status").notNull().default("PENDING"),
    provider: varchar("provider", { length: 32 }).notNull(),
    providerRef: varchar("provider_ref", { length: 128 }),
    /** Encrypted at rest (AES-256-GCM); see lib/crypto. */
    encryptedPayload: text("encrypted_payload"),
    reviewedBy: uuid("reviewed_by").references(() => user.id),
    reason: text("reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("user_verification_user_idx").on(t.userId, t.type)],
);

export const responsiblePlayLimit = pgTable(
  "responsible_play_limit",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    type: limitTypeEnum("type").notNull(),
    amountMinor: money("amount_minor").notNull(),
    currency: currency(),
    /** Decreases apply immediately; increases apply only after a cooling period. */
    effectiveAt: timestamp("effective_at", { withTimezone: true }).notNull().defaultNow(),
    supersededAt: timestamp("superseded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("rpl_user_type_idx").on(t.userId, t.type)],
);

export const selfExclusion = pgTable(
  "self_exclusion",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
    type: exclusionTypeEnum("type").notNull(),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull().defaultNow(),
    endsAt: timestamp("ends_at", { withTimezone: true }), // null = indefinite
    reason: text("reason"),
    createdBy: uuid("created_by").references(() => user.id),
    createdAt: createdAt(),
  },
  (t) => [index("self_exclusion_user_idx").on(t.userId, t.endsAt)],
);
