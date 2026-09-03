import { pgEnum } from "drizzle-orm/pg-core";

export const userStatusEnum = pgEnum("user_status", ["ACTIVE", "SUSPENDED", "CLOSED"]);
export const verificationTypeEnum = pgEnum("verification_type", ["AGE", "IDENTITY", "ADDRESS", "SOURCE_OF_FUNDS"]);
export const verificationStatusEnum = pgEnum("verification_status", ["PENDING", "APPROVED", "REJECTED", "EXPIRED"]);
export const limitTypeEnum = pgEnum("limit_type", ["DEPOSIT_DAILY", "DEPOSIT_WEEKLY", "DEPOSIT_MONTHLY", "SPEND_DAILY", "SPEND_WEEKLY", "SPEND_MONTHLY", "SESSION_MINUTES"]);
export const exclusionTypeEnum = pgEnum("exclusion_type", ["COOLING_OFF", "SELF_EXCLUSION", "OPERATOR_EXCLUSION"]);

export const accountOwnerEnum = pgEnum("account_owner", ["USER", "SYSTEM"]);
export const accountKindEnum = pgEnum("account_kind", [
  "USER_CASH",
  "USER_PROMO",
  "SYSTEM_PAYMENT_CLEARING",
  "SYSTEM_PACK_SALES",
  "SYSTEM_SELLBACK_PAYOUTS",
  "SYSTEM_PRIZES",
  "SYSTEM_FEES",
  "SYSTEM_REFUNDS",
  "SYSTEM_CHARGEBACKS",
  "SYSTEM_MARKETPLACE_ESCROW",
  "SYSTEM_PROMO_FUNDING",
  "SYSTEM_BATTLE_POOL",
]);
export const ledgerKindEnum = pgEnum("ledger_kind", [
  "DEPOSIT",
  "PACK_PURCHASE",
  "BATTLE_ENTRY",
  "SELLBACK",
  "RACE_PRIZE",
  "RAFFLE_PRIZE",
  "REFUND",
  "CHARGEBACK",
  "CHARGEBACK_REVERSAL",
  "MARKETPLACE_SALE",
  "MARKETPLACE_PURCHASE",
  "PROMO_CREDIT",
  "WITHDRAWAL",
  "ADJUSTMENT",
  "SHIPPING_FEE",
]);
export const paymentStatusEnum = pgEnum("payment_status", ["PENDING", "SUCCEEDED", "FAILED", "CANCELLED"]);
export const refundStatusEnum = pgEnum("refund_status", ["PENDING", "SUCCEEDED", "FAILED"]);
export const chargebackStatusEnum = pgEnum("chargeback_status", ["OPEN", "WON", "LOST"]);

export const itemConditionEnum = pgEnum("item_condition", ["MINT", "NEAR_MINT", "EXCELLENT", "GOOD", "PLAYED", "NEW_IN_BOX", "NEW", "USED"]);
export const inventoryStatusEnum = pgEnum("inventory_status", [
  "INTAKE",
  "IN_STOCK",
  "RESERVED",
  "IN_VAULT",
  "LISTED",
  "SHIP_REQUESTED",
  "SHIPPED",
  "DELIVERED",
  "SOLD_BACK",
  "RETURNED",
  "LOST",
  "RETIRED",
]);
export const custodyEnum = pgEnum("custody_status", ["WAREHOUSE", "IN_TRANSIT", "DELIVERED", "THIRD_PARTY"]);

export const packStatusEnum = pgEnum("pack_status", ["DRAFT", "ACTIVE", "ARCHIVED"]);
export const packVersionStatusEnum = pgEnum("pack_version_status", ["DRAFT", "PENDING_APPROVAL", "APPROVED", "SCHEDULED", "PUBLISHED", "PAUSED", "CLOSED", "REJECTED"]);
export const packKindEnum = pgEnum("pack_kind", ["FINITE", "POOLED"]);
export const openingStatusEnum = pgEnum("opening_status", ["SETTLED", "VOIDED"]);
export const openingSourceEnum = pgEnum("opening_source", ["DIRECT", "BATTLE", "PROMO"]);
export const seedStatusEnum = pgEnum("seed_status", ["ACTIVE", "RETIRED", "REVEALED"]);
export const seedScopeEnum = pgEnum("seed_scope", ["USER", "BATTLE", "RAFFLE"]);

export const holdingStatusEnum = pgEnum("holding_status", ["ACTIVE", "TRANSFERRED", "SOLD_BACK", "SHIPPED", "VOIDED"]);
export const transferReasonEnum = pgEnum("transfer_reason", ["OPENING", "BATTLE_SETTLEMENT", "SELLBACK", "MARKETPLACE", "RAFFLE_PRIZE", "RACE_PRIZE", "ADMIN", "VOID"]);
export const quoteStatusEnum = pgEnum("quote_status", ["OPEN", "ACCEPTED", "EXPIRED", "CANCELLED"]);
export const shipmentStatusEnum = pgEnum("shipment_status", ["REQUESTED", "ADDRESS_VERIFIED", "PACKED", "SHIPPED", "DELIVERED", "RETURNED", "DISPUTED", "CANCELLED"]);
export const listingStatusEnum = pgEnum("listing_status", ["ACTIVE", "SOLD", "CANCELLED", "EXPIRED"]);
export const orderStatusEnum = pgEnum("order_status", ["SETTLED", "REFUNDED"]);

export const battleModeEnum = pgEnum("battle_mode", ["CLASSIC", "CRAZY", "SHARED", "KEEP"]);
export const battleStatusEnum = pgEnum("battle_status", ["OPEN", "IN_PROGRESS", "SETTLED", "VOIDED", "CANCELLED"]);
export const battleSpeedEnum = pgEnum("battle_speed", ["NORMAL", "FAST"]);

export const raceStatusEnum = pgEnum("race_status", ["SCHEDULED", "ACTIVE", "LOCKED", "REVIEW", "SETTLED", "CANCELLED"]);
export const raffleStatusEnum = pgEnum("raffle_status", ["DRAFT", "UPCOMING", "OPEN", "CLOSED", "DRAWN", "CLAIMED", "CANCELLED"]);
export const raffleEntryModeEnum = pgEnum("raffle_entry_mode", ["FREE", "PROMOTIONAL", "PURCHASE_LINKED"]);
export const raffleEntrySourceEnum = pgEnum("raffle_entry_source", ["FREE", "PROMO", "PURCHASE", "AMOE", "ADMIN"]);
export const raffleDrawStatusEnum = pgEnum("raffle_draw_status", ["VALID", "SUPERSEDED"]);

export const notificationKindEnum = pgEnum("notification_kind", ["OPENING", "BATTLE", "RACE", "RAFFLE", "SHIPMENT", "SELLBACK", "ACCOUNT", "SYSTEM"]);
export const riskSeverityEnum = pgEnum("risk_severity", ["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
export const jobStatusEnum = pgEnum("job_status", ["PENDING", "RUNNING", "DONE", "FAILED", "DEAD"]);
