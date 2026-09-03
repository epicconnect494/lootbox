CREATE TYPE "public"."account_kind" AS ENUM('USER_CASH', 'USER_PROMO', 'SYSTEM_PAYMENT_CLEARING', 'SYSTEM_PACK_SALES', 'SYSTEM_SELLBACK_PAYOUTS', 'SYSTEM_PRIZES', 'SYSTEM_FEES', 'SYSTEM_REFUNDS', 'SYSTEM_CHARGEBACKS', 'SYSTEM_MARKETPLACE_ESCROW', 'SYSTEM_PROMO_FUNDING', 'SYSTEM_BATTLE_POOL');--> statement-breakpoint
CREATE TYPE "public"."account_owner" AS ENUM('USER', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."battle_mode" AS ENUM('CLASSIC', 'CRAZY', 'SHARED', 'KEEP');--> statement-breakpoint
CREATE TYPE "public"."battle_speed" AS ENUM('NORMAL', 'FAST');--> statement-breakpoint
CREATE TYPE "public"."battle_status" AS ENUM('OPEN', 'IN_PROGRESS', 'SETTLED', 'VOIDED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."chargeback_status" AS ENUM('OPEN', 'WON', 'LOST');--> statement-breakpoint
CREATE TYPE "public"."custody_status" AS ENUM('WAREHOUSE', 'IN_TRANSIT', 'DELIVERED', 'THIRD_PARTY');--> statement-breakpoint
CREATE TYPE "public"."exclusion_type" AS ENUM('COOLING_OFF', 'SELF_EXCLUSION', 'OPERATOR_EXCLUSION');--> statement-breakpoint
CREATE TYPE "public"."holding_status" AS ENUM('ACTIVE', 'TRANSFERRED', 'SOLD_BACK', 'SHIPPED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."inventory_status" AS ENUM('INTAKE', 'IN_STOCK', 'RESERVED', 'IN_VAULT', 'LISTED', 'SHIP_REQUESTED', 'SHIPPED', 'DELIVERED', 'SOLD_BACK', 'RETURNED', 'LOST', 'RETIRED');--> statement-breakpoint
CREATE TYPE "public"."item_condition" AS ENUM('MINT', 'NEAR_MINT', 'EXCELLENT', 'GOOD', 'PLAYED', 'NEW_IN_BOX', 'NEW', 'USED');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('PENDING', 'RUNNING', 'DONE', 'FAILED', 'DEAD');--> statement-breakpoint
CREATE TYPE "public"."ledger_kind" AS ENUM('DEPOSIT', 'PACK_PURCHASE', 'BATTLE_ENTRY', 'SELLBACK', 'RACE_PRIZE', 'RAFFLE_PRIZE', 'REFUND', 'CHARGEBACK', 'CHARGEBACK_REVERSAL', 'MARKETPLACE_SALE', 'MARKETPLACE_PURCHASE', 'PROMO_CREDIT', 'WITHDRAWAL', 'ADJUSTMENT', 'SHIPPING_FEE');--> statement-breakpoint
CREATE TYPE "public"."limit_type" AS ENUM('DEPOSIT_DAILY', 'DEPOSIT_WEEKLY', 'DEPOSIT_MONTHLY', 'SPEND_DAILY', 'SPEND_WEEKLY', 'SPEND_MONTHLY', 'SESSION_MINUTES');--> statement-breakpoint
CREATE TYPE "public"."listing_status" AS ENUM('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."notification_kind" AS ENUM('OPENING', 'BATTLE', 'RACE', 'RAFFLE', 'SHIPMENT', 'SELLBACK', 'ACCOUNT', 'SYSTEM');--> statement-breakpoint
CREATE TYPE "public"."opening_source" AS ENUM('DIRECT', 'BATTLE', 'PROMO');--> statement-breakpoint
CREATE TYPE "public"."opening_status" AS ENUM('SETTLED', 'VOIDED');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('SETTLED', 'REFUNDED');--> statement-breakpoint
CREATE TYPE "public"."pack_kind" AS ENUM('FINITE', 'POOLED');--> statement-breakpoint
CREATE TYPE "public"."pack_status" AS ENUM('DRAFT', 'ACTIVE', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."pack_version_status" AS ENUM('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'CLOSED', 'REJECTED');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('OPEN', 'ACCEPTED', 'EXPIRED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."race_status" AS ENUM('SCHEDULED', 'ACTIVE', 'LOCKED', 'REVIEW', 'SETTLED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."raffle_draw_status" AS ENUM('VALID', 'SUPERSEDED');--> statement-breakpoint
CREATE TYPE "public"."raffle_entry_mode" AS ENUM('FREE', 'PROMOTIONAL', 'PURCHASE_LINKED');--> statement-breakpoint
CREATE TYPE "public"."raffle_entry_source" AS ENUM('FREE', 'PROMO', 'PURCHASE', 'AMOE', 'ADMIN');--> statement-breakpoint
CREATE TYPE "public"."raffle_status" AS ENUM('DRAFT', 'UPCOMING', 'OPEN', 'CLOSED', 'DRAWN', 'CLAIMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('PENDING', 'SUCCEEDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."risk_severity" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');--> statement-breakpoint
CREATE TYPE "public"."seed_scope" AS ENUM('USER', 'BATTLE', 'RAFFLE');--> statement-breakpoint
CREATE TYPE "public"."seed_status" AS ENUM('ACTIVE', 'RETIRED', 'REVEALED');--> statement-breakpoint
CREATE TYPE "public"."shipment_status" AS ENUM('REQUESTED', 'ADDRESS_VERIFIED', 'PACKED', 'SHIPPED', 'DELIVERED', 'RETURNED', 'DISPUTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."transfer_reason" AS ENUM('OPENING', 'BATTLE_SETTLEMENT', 'SELLBACK', 'MARKETPLACE', 'RAFFLE_PRIZE', 'RACE_PRIZE', 'ADMIN', 'VOID');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('ACTIVE', 'SUSPENDED', 'CLOSED');--> statement-breakpoint
CREATE TYPE "public"."verification_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."verification_type" AS ENUM('AGE', 'IDENTITY', 'ADDRESS', 'SOURCE_OF_FUNDS');--> statement-breakpoint
CREATE TABLE "jurisdiction" (
	"code" varchar(8) PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"min_age" integer DEFAULT 18 NOT NULL,
	"paid_chance_enabled" boolean DEFAULT false NOT NULL,
	"battles_enabled" boolean DEFAULT false NOT NULL,
	"raffles_enabled" boolean DEFAULT false NOT NULL,
	"raffle_free_entry_required" boolean DEFAULT true NOT NULL,
	"cash_conversion_enabled" boolean DEFAULT false NOT NULL,
	"crypto_conversion_enabled" boolean DEFAULT false NOT NULL,
	"free_entry_route_enabled" boolean DEFAULT true NOT NULL,
	"bots_enabled" boolean DEFAULT false NOT NULL,
	"legal_approval_reference" text,
	"legal_approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(64) NOT NULL,
	"description" text,
	CONSTRAINT "permission_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "responsible_play_limit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "limit_type" NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"effective_at" timestamp with time zone DEFAULT now() NOT NULL,
	"superseded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(48) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "role_permission" (
	"role_id" uuid NOT NULL,
	"permission_id" uuid NOT NULL,
	CONSTRAINT "role_permission_role_id_permission_id_pk" PRIMARY KEY("role_id","permission_id")
);
--> statement-breakpoint
CREATE TABLE "self_exclusion" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "exclusion_type" NOT NULL,
	"starts_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ends_at" timestamp with time zone,
	"reason" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(320) NOT NULL,
	"email_verified_at" timestamp with time zone,
	"password_hash" text NOT NULL,
	"display_name" varchar(64) NOT NULL,
	"status" "user_status" DEFAULT 'ACTIVE' NOT NULL,
	"jurisdiction_code" varchar(8),
	"date_of_birth" timestamp,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"risk_score" integer DEFAULT 0 NOT NULL,
	"linked_account_group" uuid,
	"notification_prefs" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "user_role" (
	"user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"granted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_role_user_id_role_id_pk" PRIMARY KEY("user_id","role_id")
);
--> statement-breakpoint
CREATE TABLE "user_session" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(128) NOT NULL,
	"csrf_secret" varchar(128) NOT NULL,
	"ip_hash" varchar(128),
	"user_agent_hash" varchar(128),
	"device_fingerprint" varchar(128),
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_verification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "verification_type" NOT NULL,
	"status" "verification_status" DEFAULT 'PENDING' NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_ref" varchar(128),
	"encrypted_payload" text,
	"reviewed_by" uuid,
	"reason" text,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chargeback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" chargeback_status DEFAULT 'OPEN' NOT NULL,
	"provider_ref" varchar(160),
	"reason_code" varchar(32),
	"ledger_transaction_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ledger_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"memo" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ledger_entry_nonzero" CHECK (amount_minor <> 0)
);
--> statement-breakpoint
CREATE TABLE "ledger_transaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" "ledger_kind" NOT NULL,
	"reference_type" varchar(48),
	"reference_id" uuid,
	"idempotency_key" varchar(160),
	"description" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" varchar(32) NOT NULL,
	"provider_ref" varchar(160),
	"amount_minor" bigint NOT NULL,
	"fee_minor" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "payment_status" DEFAULT 'PENDING' NOT NULL,
	"method" varchar(32) DEFAULT 'card' NOT NULL,
	"idempotency_key" varchar(160),
	"ledger_transaction_id" uuid,
	"failure_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refund" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid,
	"user_id" uuid NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "refund_status" DEFAULT 'PENDING' NOT NULL,
	"reason" text NOT NULL,
	"reference_type" varchar(48),
	"reference_id" uuid,
	"ledger_transaction_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_account" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_type" "account_owner" NOT NULL,
	"user_id" uuid,
	"kind" "account_kind" NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"balance_minor" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallet_user_non_negative" CHECK (owner_type = 'SYSTEM' OR balance_minor >= 0)
);
--> statement-breakpoint
CREATE TABLE "category" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "category_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "inventory_item" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_code" varchar(32) NOT NULL,
	"sku_id" uuid NOT NULL,
	"warehouse_id" uuid,
	"serial_number" varchar(128),
	"certification_id" varchar(128),
	"grader" varchar(64),
	"grade" varchar(32),
	"size" varchar(32),
	"condition" "item_condition" DEFAULT 'NEAR_MINT' NOT NULL,
	"acquisition_cost_minor" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "inventory_status" DEFAULT 'INTAKE' NOT NULL,
	"custody" "custody_status" DEFAULT 'WAREHOUSE' NOT NULL,
	"reserved_for_type" varchar(32),
	"reserved_for_id" uuid,
	"reserved_at" timestamp with time zone,
	"owner_user_id" uuid,
	"media_keys" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "inventory_item_item_code_unique" UNIQUE("item_code"),
	CONSTRAINT "inventory_reservation_consistent" CHECK ((status <> 'RESERVED') OR (reserved_for_type IS NOT NULL AND reserved_for_id IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "product_sku" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(64) NOT NULL,
	"category_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"brand" text,
	"image_key" text,
	"accent" varchar(16) DEFAULT 'violet' NOT NULL,
	"is_unique" boolean DEFAULT false NOT NULL,
	"pooled_quantity" integer DEFAULT 0 NOT NULL,
	"pooled_reserved" integer DEFAULT 0 NOT NULL,
	"default_reference_value_minor" bigint DEFAULT 0 NOT NULL,
	"default_sellback_offer_minor" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"shipping_restricted" boolean DEFAULT false NOT NULL,
	"shipping_restriction_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "product_sku_sku_unique" UNIQUE("sku"),
	CONSTRAINT "product_sku_pool_nonneg" CHECK (pooled_quantity >= 0 AND pooled_reserved >= 0 AND pooled_reserved <= pooled_quantity)
);
--> statement-breakpoint
CREATE TABLE "valuation_snapshot" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku_id" uuid,
	"inventory_item_id" uuid,
	"reference_value_minor" bigint NOT NULL,
	"sellback_offer_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"source" varchar(64) NOT NULL,
	"source_ref" text,
	"observed_at" timestamp with time zone NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "valuation_sellback_le_ref" CHECK (sellback_offer_minor <= reference_value_minor AND sellback_offer_minor >= 0)
);
--> statement-breakpoint
CREATE TABLE "warehouse_location" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"name" text NOT NULL,
	"country_code" varchar(2) NOT NULL,
	"address" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_location_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "pack" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(96) NOT NULL,
	"name" text NOT NULL,
	"tagline" text,
	"description" text,
	"category_id" uuid NOT NULL,
	"kind" "pack_kind" DEFAULT 'FINITE' NOT NULL,
	"status" "pack_status" DEFAULT 'DRAFT' NOT NULL,
	"hero_image_key" text,
	"accent" varchar(16) DEFAULT 'violet' NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"current_version_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "pack_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pack_manifest_commitment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_version_id" uuid NOT NULL,
	"manifest_hash" varchar(64) NOT NULL,
	"manifest_json" jsonb NOT NULL,
	"canonical_manifest" text NOT NULL,
	"published_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_manifest_commitment_pack_version_id_unique" UNIQUE("pack_version_id")
);
--> statement-breakpoint
CREATE TABLE "pack_outcome" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_version_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"label" text NOT NULL,
	"tier" varchar(16) DEFAULT 'COMMON' NOT NULL,
	"sku_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"valuation_snapshot_id" uuid,
	"quantity_total" integer NOT NULL,
	"quantity_remaining" integer NOT NULL,
	"reference_value_minor" bigint NOT NULL,
	"sellback_offer_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"condition" varchar(32) DEFAULT 'NEAR_MINT' NOT NULL,
	"shipping_eligible" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_outcome_qty_range" CHECK (quantity_remaining >= 0 AND quantity_remaining <= quantity_total AND quantity_total > 0),
	CONSTRAINT "pack_outcome_unique_item_qty" CHECK (inventory_item_id IS NULL OR quantity_total = 1)
);
--> statement-breakpoint
CREATE TABLE "pack_version" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pack_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "pack_version_status" DEFAULT 'DRAFT' NOT NULL,
	"price_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"total_openings" integer NOT NULL,
	"remaining_openings" integer NOT NULL,
	"merchandise_rtp_bp" integer,
	"sellback_rtp_bp" integer,
	"target_rtp_bp" integer DEFAULT 9000 NOT NULL,
	"rtp_tolerance_bp" integer DEFAULT 50 NOT NULL,
	"manifest_hash" varchar(64),
	"manifest_json" jsonb,
	"scheduled_at" timestamp with time zone,
	"published_at" timestamp with time zone,
	"paused_at" timestamp with time zone,
	"pause_reason" text,
	"closed_at" timestamp with time zone,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"submitted_by" uuid,
	"liability_limit_minor" bigint,
	"notes" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pack_version_remaining_range" CHECK (remaining_openings >= 0 AND remaining_openings <= total_openings),
	CONSTRAINT "pack_version_price_positive" CHECK (price_minor > 0)
);
--> statement-breakpoint
CREATE TABLE "fairness_receipt" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"opening_id" uuid NOT NULL,
	"seed_id" uuid NOT NULL,
	"pack_version_id" uuid NOT NULL,
	"manifest_hash" varchar(64) NOT NULL,
	"remaining_inventory_commitment" varchar(64) NOT NULL,
	"server_seed_hash" varchar(64) NOT NULL,
	"client_seed" varchar(64) NOT NULL,
	"nonce" integer NOT NULL,
	"message" text NOT NULL,
	"digest" varchar(64) NOT NULL,
	"range_size" integer NOT NULL,
	"sampling_steps" jsonb NOT NULL,
	"selected_index" integer NOT NULL,
	"outcome_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"value_snapshot" jsonb NOT NULL,
	"ledger_transaction_id" uuid,
	"ownership_transfer_id" uuid,
	"payload_canonical" text NOT NULL,
	"signature" text NOT NULL,
	"signing_key_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fairness_receipt_opening_id_unique" UNIQUE("opening_id"),
	CONSTRAINT "fairness_receipt_index_range" CHECK (selected_index >= 0 AND selected_index < range_size)
);
--> statement-breakpoint
CREATE TABLE "fairness_seed" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" "seed_scope" NOT NULL,
	"user_id" uuid,
	"scope_ref_id" uuid,
	"server_seed_hash" varchar(64) NOT NULL,
	"server_seed_encrypted" text NOT NULL,
	"revealed_server_seed" varchar(64),
	"client_seed" varchar(64) NOT NULL,
	"nonce" integer DEFAULT 0 NOT NULL,
	"use_count" integer DEFAULT 0 NOT NULL,
	"status" "seed_status" DEFAULT 'ACTIVE' NOT NULL,
	"retired_at" timestamp with time zone,
	"revealed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opening" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"pack_version_id" uuid NOT NULL,
	"outcome_id" uuid NOT NULL,
	"inventory_item_id" uuid,
	"source" "opening_source" DEFAULT 'DIRECT' NOT NULL,
	"status" "opening_status" DEFAULT 'SETTLED' NOT NULL,
	"price_minor" bigint NOT NULL,
	"reference_value_minor" bigint NOT NULL,
	"sellback_offer_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"ledger_transaction_id" uuid,
	"ownership_transfer_id" uuid,
	"battle_id" uuid,
	"idempotency_key" varchar(160),
	"revealed_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplace_listing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"ask_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "listing_status" DEFAULT 'ACTIVE' NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_listing_ask_positive" CHECK (ask_minor > 0)
);
--> statement-breakpoint
CREATE TABLE "marketplace_order" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_user_id" uuid NOT NULL,
	"seller_user_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"price_minor" bigint NOT NULL,
	"fee_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"status" "order_status" DEFAULT 'SETTLED' NOT NULL,
	"ledger_transaction_id" uuid,
	"ownership_transfer_id" uuid,
	"idempotency_key" varchar(160),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplace_order_listing_id_unique" UNIQUE("listing_id")
);
--> statement-breakpoint
CREATE TABLE "ownership_transfer" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"from_user_id" uuid,
	"to_user_id" uuid,
	"reason" "transfer_reason" NOT NULL,
	"reference_type" varchar(48),
	"reference_id" uuid,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sellback_quote" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"offer_minor" bigint NOT NULL,
	"reference_value_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"policy_version" varchar(32) NOT NULL,
	"status" "quote_status" DEFAULT 'OPEN' NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"ledger_transaction_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"holding_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"status" "shipment_status" DEFAULT 'REQUESTED' NOT NULL,
	"address_encrypted" text NOT NULL,
	"address_country" varchar(2) NOT NULL,
	"address_verified" boolean DEFAULT false NOT NULL,
	"insured" boolean DEFAULT true NOT NULL,
	"insured_value_minor" bigint NOT NULL,
	"shipping_fee_minor" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"carrier" varchar(32),
	"tracking_number" varchar(96),
	"shipped_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"dispute_reason" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vault_holding" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"inventory_item_id" uuid NOT NULL,
	"status" "holding_status" DEFAULT 'ACTIVE' NOT NULL,
	"acquired_via" "transfer_reason" NOT NULL,
	"acquired_ref_id" uuid,
	"reference_value_minor" bigint NOT NULL,
	"sellback_offer_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"collection_name" varchar(64),
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(12) NOT NULL,
	"mode" "battle_mode" NOT NULL,
	"speed" "battle_speed" DEFAULT 'NORMAL' NOT NULL,
	"status" "battle_status" DEFAULT 'OPEN' NOT NULL,
	"is_private" boolean DEFAULT false NOT NULL,
	"join_code" varchar(16),
	"seats" smallint NOT NULL,
	"pack_version_ids" jsonb NOT NULL,
	"entry_cost_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"shared_rule" jsonb,
	"seed_id" uuid,
	"server_seed_hash" varchar(64),
	"combined_client_seed" varchar(512),
	"created_by" uuid NOT NULL,
	"started_at" timestamp with time zone,
	"settled_at" timestamp with time zone,
	"voided_at" timestamp with time zone,
	"void_reason" text,
	"voided_by" uuid,
	"winner_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tie_break_receipt" jsonb,
	"settlement_summary" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "battle_code_unique" UNIQUE("code"),
	CONSTRAINT "battle_seats_range" CHECK (seats BETWEEN 2 AND 4)
);
--> statement-breakpoint
CREATE TABLE "battle_pull" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"battle_id" uuid NOT NULL,
	"round_id" uuid NOT NULL,
	"seat_id" uuid NOT NULL,
	"opening_id" uuid NOT NULL,
	"pull_index" integer NOT NULL,
	"value_minor" bigint NOT NULL,
	"running_total_minor" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "battle_pull_opening_id_unique" UNIQUE("opening_id")
);
--> statement-breakpoint
CREATE TABLE "battle_round" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"battle_id" uuid NOT NULL,
	"round_index" smallint NOT NULL,
	"pack_version_id" uuid NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "battle_seat" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"battle_id" uuid NOT NULL,
	"seat_index" smallint NOT NULL,
	"user_id" uuid NOT NULL,
	"is_bot" boolean DEFAULT false NOT NULL,
	"client_seed" varchar(64) NOT NULL,
	"entry_ledger_transaction_id" uuid,
	"total_value_minor" bigint DEFAULT 0 NOT NULL,
	"final_rank" smallint,
	"awarded_value_minor" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"status" "race_status" DEFAULT 'SCHEDULED' NOT NULL,
	"timezone" varchar(64) DEFAULT 'UTC' NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"scoring_policy_id" uuid NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"locked_at" timestamp with time zone,
	"lock_snapshot_hash" varchar(64),
	"lock_snapshot" jsonb,
	"settled_at" timestamp with time zone,
	"settlement_summary" jsonb,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "race_slug_unique" UNIQUE("slug"),
	CONSTRAINT "race_window" CHECK (ends_at > starts_at)
);
--> statement-breakpoint
CREATE TABLE "race_prize" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"race_id" uuid NOT NULL,
	"rank" integer NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"label" text,
	CONSTRAINT "race_prize_rank_range" CHECK (rank >= 1 AND rank <= 100)
);
--> statement-breakpoint
CREATE TABLE "race_score_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"race_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" varchar(48) NOT NULL,
	"source_id" uuid NOT NULL,
	"points" integer NOT NULL,
	"explanation" text NOT NULL,
	"excluded" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race_scoring_policy" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb NOT NULL,
	"policy_hash" varchar(64) NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "race_scoring_policy_version_unique" UNIQUE("version")
);
--> statement-breakpoint
CREATE TABLE "race_standing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"race_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"rank" integer,
	"last_qualifying_at" timestamp with time zone,
	"prize_amount_minor" bigint,
	"prize_ledger_transaction_id" uuid,
	"excluded_reason" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(64) NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"status" "raffle_status" DEFAULT 'DRAFT' NOT NULL,
	"entry_mode" "raffle_entry_mode" DEFAULT 'FREE' NOT NULL,
	"max_tickets" integer NOT NULL,
	"max_tickets_per_user" integer DEFAULT 10 NOT NULL,
	"ticket_price_minor" bigint DEFAULT 0 NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"winners_count" integer DEFAULT 1 NOT NULL,
	"amoe_enabled" boolean DEFAULT true NOT NULL,
	"amoe_instructions" text,
	"allowed_jurisdictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opens_at" timestamp with time zone NOT NULL,
	"closes_at" timestamp with time zone NOT NULL,
	"draws_at" timestamp with time zone NOT NULL,
	"claim_deadline_at" timestamp with time zone NOT NULL,
	"seed_id" uuid,
	"server_seed_hash" varchar(64),
	"server_seed_committed_at" timestamp with time zone,
	"public_randomness_source" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raffle_slug_unique" UNIQUE("slug"),
	CONSTRAINT "raffle_schedule" CHECK (closes_at > opens_at AND draws_at >= closes_at AND claim_deadline_at > draws_at)
);
--> statement-breakpoint
CREATE TABLE "raffle_draw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raffle_id" uuid NOT NULL,
	"draw_number" integer NOT NULL,
	"status" "raffle_draw_status" DEFAULT 'VALID' NOT NULL,
	"manifest_hash" varchar(64) NOT NULL,
	"server_seed_hash" varchar(64) NOT NULL,
	"server_seed" varchar(64) NOT NULL,
	"public_randomness" text NOT NULL,
	"public_randomness_source" text NOT NULL,
	"ticket_count" integer NOT NULL,
	"winners" jsonb NOT NULL,
	"reason" text,
	"drawn_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_entry" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raffle_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"ticket_number" integer NOT NULL,
	"ticket_id" varchar(32) NOT NULL,
	"source" "raffle_entry_source" NOT NULL,
	"source_ref" varchar(160),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "raffle_manifest" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raffle_id" uuid NOT NULL,
	"ticket_count" integer NOT NULL,
	"manifest_hash" varchar(64) NOT NULL,
	"canonical_manifest" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "raffle_manifest_raffle_id_unique" UNIQUE("raffle_id")
);
--> statement-breakpoint
CREATE TABLE "raffle_prize" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"raffle_id" uuid NOT NULL,
	"rank" integer DEFAULT 1 NOT NULL,
	"inventory_item_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"condition" varchar(32),
	"reference_value_minor" bigint NOT NULL,
	"currency" char(3) DEFAULT 'USD' NOT NULL,
	"value_source" text,
	"value_observed_at" timestamp with time zone,
	"winner_user_id" uuid,
	"claimed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "admin_audit_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"actor_role" varchar(48),
	"action" varchar(96) NOT NULL,
	"entity_type" varchar(64) NOT NULL,
	"entity_id" varchar(96),
	"reason" text,
	"before_hash" varchar(64),
	"after_hash" varchar(64),
	"before" jsonb,
	"after" jsonb,
	"correlation_id" varchar(64),
	"ip_hash" varchar(128),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "idempotency_key" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scope" varchar(64) NOT NULL,
	"user_id" uuid,
	"key" varchar(160) NOT NULL,
	"request_hash" varchar(64) NOT NULL,
	"response_status" integer,
	"response_body" jsonb,
	"locked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "job_status" DEFAULT 'PENDING' NOT NULL,
	"run_at" timestamp with time zone DEFAULT now() NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"max_attempts" integer DEFAULT 5 NOT NULL,
	"last_error" text,
	"dedupe_key" varchar(160),
	"locked_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" "notification_kind" NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"href" text,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbox_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"topic" varchar(64) NOT NULL,
	"aggregate_type" varchar(48),
	"aggregate_id" uuid,
	"payload" jsonb NOT NULL,
	"processed_at" timestamp with time zone,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_bucket" (
	"key" varchar(160) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_event" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" varchar(64) NOT NULL,
	"severity" "risk_severity" DEFAULT 'LOW' NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"correlation_id" varchar(64),
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	"resolution" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "responsible_play_limit" ADD CONSTRAINT "responsible_play_limit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permission" ADD CONSTRAINT "role_permission_permission_id_permission_id_fk" FOREIGN KEY ("permission_id") REFERENCES "public"."permission"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_exclusion" ADD CONSTRAINT "self_exclusion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "self_exclusion" ADD CONSTRAINT "self_exclusion_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_jurisdiction_code_jurisdiction_code_fk" FOREIGN KEY ("jurisdiction_code") REFERENCES "public"."jurisdiction"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_role_id_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_role" ADD CONSTRAINT "user_role_granted_by_user_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_session" ADD CONSTRAINT "user_session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_verification" ADD CONSTRAINT "user_verification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_verification" ADD CONSTRAINT "user_verification_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chargeback" ADD CONSTRAINT "chargeback_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chargeback" ADD CONSTRAINT "chargeback_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chargeback" ADD CONSTRAINT "chargeback_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_entry" ADD CONSTRAINT "ledger_entry_account_id_wallet_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."wallet_account"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ledger_transaction" ADD CONSTRAINT "ledger_transaction_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_payment_id_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refund" ADD CONSTRAINT "refund_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_account" ADD CONSTRAINT "wallet_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_sku_id_product_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."product_sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_warehouse_id_warehouse_location_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse_location"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_item" ADD CONSTRAINT "inventory_item_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_sku" ADD CONSTRAINT "product_sku_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_snapshot" ADD CONSTRAINT "valuation_snapshot_sku_id_product_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."product_sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_snapshot" ADD CONSTRAINT "valuation_snapshot_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "valuation_snapshot" ADD CONSTRAINT "valuation_snapshot_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack" ADD CONSTRAINT "pack_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack" ADD CONSTRAINT "pack_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_manifest_commitment" ADD CONSTRAINT "pack_manifest_commitment_pack_version_id_pack_version_id_fk" FOREIGN KEY ("pack_version_id") REFERENCES "public"."pack_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_manifest_commitment" ADD CONSTRAINT "pack_manifest_commitment_published_by_user_id_fk" FOREIGN KEY ("published_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_outcome" ADD CONSTRAINT "pack_outcome_pack_version_id_pack_version_id_fk" FOREIGN KEY ("pack_version_id") REFERENCES "public"."pack_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_outcome" ADD CONSTRAINT "pack_outcome_sku_id_product_sku_id_fk" FOREIGN KEY ("sku_id") REFERENCES "public"."product_sku"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_outcome" ADD CONSTRAINT "pack_outcome_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_outcome" ADD CONSTRAINT "pack_outcome_valuation_snapshot_id_valuation_snapshot_id_fk" FOREIGN KEY ("valuation_snapshot_id") REFERENCES "public"."valuation_snapshot"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_version" ADD CONSTRAINT "pack_version_pack_id_pack_id_fk" FOREIGN KEY ("pack_id") REFERENCES "public"."pack"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_version" ADD CONSTRAINT "pack_version_approved_by_user_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_version" ADD CONSTRAINT "pack_version_submitted_by_user_id_fk" FOREIGN KEY ("submitted_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pack_version" ADD CONSTRAINT "pack_version_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fairness_receipt" ADD CONSTRAINT "fairness_receipt_opening_id_opening_id_fk" FOREIGN KEY ("opening_id") REFERENCES "public"."opening"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fairness_receipt" ADD CONSTRAINT "fairness_receipt_seed_id_fairness_seed_id_fk" FOREIGN KEY ("seed_id") REFERENCES "public"."fairness_seed"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fairness_receipt" ADD CONSTRAINT "fairness_receipt_pack_version_id_pack_version_id_fk" FOREIGN KEY ("pack_version_id") REFERENCES "public"."pack_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fairness_seed" ADD CONSTRAINT "fairness_seed_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening" ADD CONSTRAINT "opening_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening" ADD CONSTRAINT "opening_pack_version_id_pack_version_id_fk" FOREIGN KEY ("pack_version_id") REFERENCES "public"."pack_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening" ADD CONSTRAINT "opening_outcome_id_pack_outcome_id_fk" FOREIGN KEY ("outcome_id") REFERENCES "public"."pack_outcome"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening" ADD CONSTRAINT "opening_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening" ADD CONSTRAINT "opening_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listing" ADD CONSTRAINT "marketplace_listing_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listing" ADD CONSTRAINT "marketplace_listing_holding_id_vault_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."vault_holding"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listing" ADD CONSTRAINT "marketplace_listing_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_listing_id_marketplace_listing_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listing"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_buyer_user_id_user_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_seller_user_id_user_id_fk" FOREIGN KEY ("seller_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_order" ADD CONSTRAINT "marketplace_order_ownership_transfer_id_ownership_transfer_id_fk" FOREIGN KEY ("ownership_transfer_id") REFERENCES "public"."ownership_transfer"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ownership_transfer" ADD CONSTRAINT "ownership_transfer_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellback_quote" ADD CONSTRAINT "sellback_quote_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellback_quote" ADD CONSTRAINT "sellback_quote_holding_id_vault_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."vault_holding"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellback_quote" ADD CONSTRAINT "sellback_quote_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sellback_quote" ADD CONSTRAINT "sellback_quote_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_holding_id_vault_holding_id_fk" FOREIGN KEY ("holding_id") REFERENCES "public"."vault_holding"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment" ADD CONSTRAINT "shipment_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_holding" ADD CONSTRAINT "vault_holding_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vault_holding" ADD CONSTRAINT "vault_holding_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle" ADD CONSTRAINT "battle_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle" ADD CONSTRAINT "battle_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_pull" ADD CONSTRAINT "battle_pull_battle_id_battle_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_pull" ADD CONSTRAINT "battle_pull_round_id_battle_round_id_fk" FOREIGN KEY ("round_id") REFERENCES "public"."battle_round"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_pull" ADD CONSTRAINT "battle_pull_seat_id_battle_seat_id_fk" FOREIGN KEY ("seat_id") REFERENCES "public"."battle_seat"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_pull" ADD CONSTRAINT "battle_pull_opening_id_opening_id_fk" FOREIGN KEY ("opening_id") REFERENCES "public"."opening"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_round" ADD CONSTRAINT "battle_round_battle_id_battle_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_round" ADD CONSTRAINT "battle_round_pack_version_id_pack_version_id_fk" FOREIGN KEY ("pack_version_id") REFERENCES "public"."pack_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_seat" ADD CONSTRAINT "battle_seat_battle_id_battle_id_fk" FOREIGN KEY ("battle_id") REFERENCES "public"."battle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_seat" ADD CONSTRAINT "battle_seat_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battle_seat" ADD CONSTRAINT "battle_seat_entry_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("entry_ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race" ADD CONSTRAINT "race_scoring_policy_id_race_scoring_policy_id_fk" FOREIGN KEY ("scoring_policy_id") REFERENCES "public"."race_scoring_policy"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race" ADD CONSTRAINT "race_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_prize" ADD CONSTRAINT "race_prize_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_score_event" ADD CONSTRAINT "race_score_event_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_score_event" ADD CONSTRAINT "race_score_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_scoring_policy" ADD CONSTRAINT "race_scoring_policy_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_standing" ADD CONSTRAINT "race_standing_race_id_race_id_fk" FOREIGN KEY ("race_id") REFERENCES "public"."race"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_standing" ADD CONSTRAINT "race_standing_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_standing" ADD CONSTRAINT "race_standing_prize_ledger_transaction_id_ledger_transaction_id_fk" FOREIGN KEY ("prize_ledger_transaction_id") REFERENCES "public"."ledger_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle" ADD CONSTRAINT "raffle_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draw" ADD CONSTRAINT "raffle_draw_raffle_id_raffle_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_draw" ADD CONSTRAINT "raffle_draw_drawn_by_user_id_fk" FOREIGN KEY ("drawn_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_entry" ADD CONSTRAINT "raffle_entry_raffle_id_raffle_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_entry" ADD CONSTRAINT "raffle_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_manifest" ADD CONSTRAINT "raffle_manifest_raffle_id_raffle_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_prize" ADD CONSTRAINT "raffle_prize_raffle_id_raffle_id_fk" FOREIGN KEY ("raffle_id") REFERENCES "public"."raffle"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_prize" ADD CONSTRAINT "raffle_prize_inventory_item_id_inventory_item_id_fk" FOREIGN KEY ("inventory_item_id") REFERENCES "public"."inventory_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "raffle_prize" ADD CONSTRAINT "raffle_prize_winner_user_id_user_id_fk" FOREIGN KEY ("winner_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "admin_audit_event" ADD CONSTRAINT "admin_audit_event_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_event" ADD CONSTRAINT "risk_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "risk_event" ADD CONSTRAINT "risk_event_resolved_by_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rpl_user_type_idx" ON "responsible_play_limit" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "self_exclusion_user_idx" ON "self_exclusion" USING btree ("user_id","ends_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_uq" ON "user" USING btree ("email");--> statement-breakpoint
CREATE INDEX "user_linked_group_idx" ON "user" USING btree ("linked_account_group");--> statement-breakpoint
CREATE UNIQUE INDEX "user_session_token_uq" ON "user_session" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "user_session_user_idx" ON "user_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_verification_user_idx" ON "user_verification" USING btree ("user_id","type");--> statement-breakpoint
CREATE INDEX "ledger_entry_account_idx" ON "ledger_entry" USING btree ("account_id","created_at");--> statement-breakpoint
CREATE INDEX "ledger_entry_tx_idx" ON "ledger_entry" USING btree ("transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ledger_tx_idem_uq" ON "ledger_transaction" USING btree ("idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "ledger_tx_ref_idx" ON "ledger_transaction" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "ledger_tx_created_idx" ON "ledger_transaction" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payment_provider_ref_uq" ON "payment" USING btree ("provider","provider_ref") WHERE provider_ref IS NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_user_idx" ON "payment" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_account_user_kind_uq" ON "wallet_account" USING btree ("user_id","kind","currency") WHERE user_id IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "wallet_account_system_kind_uq" ON "wallet_account" USING btree ("kind","currency") WHERE owner_type = 'SYSTEM';--> statement-breakpoint
CREATE INDEX "inventory_item_sku_idx" ON "inventory_item" USING btree ("sku_id","status");--> statement-breakpoint
CREATE INDEX "inventory_item_owner_idx" ON "inventory_item" USING btree ("owner_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_item_cert_uq" ON "inventory_item" USING btree ("grader","certification_id") WHERE certification_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "product_sku_category_idx" ON "product_sku" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "valuation_sku_idx" ON "valuation_snapshot" USING btree ("sku_id","observed_at");--> statement-breakpoint
CREATE INDEX "valuation_item_idx" ON "valuation_snapshot" USING btree ("inventory_item_id","observed_at");--> statement-breakpoint
CREATE INDEX "pack_category_idx" ON "pack" USING btree ("category_id","status");--> statement-breakpoint
CREATE INDEX "pack_manifest_hash_idx" ON "pack_manifest_commitment" USING btree ("manifest_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "pack_outcome_version_position_uq" ON "pack_outcome" USING btree ("pack_version_id","position");--> statement-breakpoint
CREATE INDEX "pack_outcome_item_idx" ON "pack_outcome" USING btree ("inventory_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pack_version_pack_version_uq" ON "pack_version" USING btree ("pack_id","version");--> statement-breakpoint
CREATE INDEX "pack_version_status_idx" ON "pack_version" USING btree ("status");--> statement-breakpoint
CREATE INDEX "fairness_receipt_seed_idx" ON "fairness_receipt" USING btree ("seed_id","nonce");--> statement-breakpoint
CREATE UNIQUE INDEX "fairness_seed_user_active_uq" ON "fairness_seed" USING btree ("user_id") WHERE scope = 'USER' AND status = 'ACTIVE';--> statement-breakpoint
CREATE UNIQUE INDEX "fairness_seed_scope_ref_uq" ON "fairness_seed" USING btree ("scope","scope_ref_id") WHERE scope_ref_id IS NOT NULL;--> statement-breakpoint
CREATE INDEX "fairness_seed_hash_idx" ON "fairness_seed" USING btree ("server_seed_hash");--> statement-breakpoint
CREATE INDEX "opening_user_idx" ON "opening" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "opening_version_idx" ON "opening" USING btree ("pack_version_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "opening_idem_uq" ON "opening" USING btree ("user_id","idempotency_key") WHERE idempotency_key IS NOT NULL;--> statement-breakpoint
CREATE INDEX "opening_battle_idx" ON "opening" USING btree ("battle_id");--> statement-breakpoint
CREATE UNIQUE INDEX "marketplace_listing_item_active_uq" ON "marketplace_listing" USING btree ("inventory_item_id") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "marketplace_listing_status_idx" ON "marketplace_listing" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ownership_transfer_item_idx" ON "ownership_transfer" USING btree ("inventory_item_id","created_at");--> statement-breakpoint
CREATE INDEX "ownership_transfer_ref_idx" ON "ownership_transfer" USING btree ("reference_type","reference_id");--> statement-breakpoint
CREATE INDEX "sellback_quote_holding_idx" ON "sellback_quote" USING btree ("holding_id","status");--> statement-breakpoint
CREATE INDEX "shipment_status_idx" ON "shipment" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "shipment_user_idx" ON "shipment" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "vault_holding_item_active_uq" ON "vault_holding" USING btree ("inventory_item_id") WHERE status = 'ACTIVE';--> statement-breakpoint
CREATE INDEX "vault_holding_user_idx" ON "vault_holding" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "battle_status_idx" ON "battle" USING btree ("status","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "battle_pull_round_seat_uq" ON "battle_pull" USING btree ("round_id","seat_id");--> statement-breakpoint
CREATE INDEX "battle_pull_battle_idx" ON "battle_pull" USING btree ("battle_id","pull_index");--> statement-breakpoint
CREATE UNIQUE INDEX "battle_round_uq" ON "battle_round" USING btree ("battle_id","round_index");--> statement-breakpoint
CREATE UNIQUE INDEX "battle_seat_index_uq" ON "battle_seat" USING btree ("battle_id","seat_index");--> statement-breakpoint
CREATE UNIQUE INDEX "battle_seat_user_uq" ON "battle_seat" USING btree ("battle_id","user_id");--> statement-breakpoint
CREATE INDEX "race_status_idx" ON "race" USING btree ("status","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "race_prize_rank_uq" ON "race_prize" USING btree ("race_id","rank");--> statement-breakpoint
CREATE UNIQUE INDEX "race_score_event_source_uq" ON "race_score_event" USING btree ("race_id","source_type","source_id");--> statement-breakpoint
CREATE INDEX "race_score_event_user_idx" ON "race_score_event" USING btree ("race_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "race_standing_user_uq" ON "race_standing" USING btree ("race_id","user_id");--> statement-breakpoint
CREATE INDEX "race_standing_rank_idx" ON "race_standing" USING btree ("race_id","points","last_qualifying_at");--> statement-breakpoint
CREATE INDEX "raffle_status_idx" ON "raffle" USING btree ("status","draws_at");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_draw_number_uq" ON "raffle_draw" USING btree ("raffle_id","draw_number");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_entry_number_uq" ON "raffle_entry" USING btree ("raffle_id","ticket_number");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_entry_ticket_uq" ON "raffle_entry" USING btree ("ticket_id");--> statement-breakpoint
CREATE INDEX "raffle_entry_user_idx" ON "raffle_entry" USING btree ("raffle_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "raffle_prize_rank_uq" ON "raffle_prize" USING btree ("raffle_id","rank");--> statement-breakpoint
CREATE INDEX "admin_audit_entity_idx" ON "admin_audit_event" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "admin_audit_actor_idx" ON "admin_audit_event" USING btree ("actor_user_id","created_at");--> statement-breakpoint
CREATE INDEX "admin_audit_created_idx" ON "admin_audit_event" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "idempotency_key_uq" ON "idempotency_key" USING btree ("scope","user_id","key");--> statement-breakpoint
CREATE INDEX "job_pending_idx" ON "job" USING btree ("status","run_at");--> statement-breakpoint
CREATE UNIQUE INDEX "job_dedupe_uq" ON "job" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "notification_user_idx" ON "notification" USING btree ("user_id","read_at","created_at");--> statement-breakpoint
CREATE INDEX "outbox_unprocessed_idx" ON "outbox_event" USING btree ("processed_at","created_at");--> statement-breakpoint
CREATE INDEX "outbox_aggregate_idx" ON "outbox_event" USING btree ("aggregate_type","aggregate_id","created_at");--> statement-breakpoint
CREATE INDEX "risk_event_user_idx" ON "risk_event" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "risk_event_kind_idx" ON "risk_event" USING btree ("kind","severity");