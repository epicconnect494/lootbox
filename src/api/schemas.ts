import { z } from "zod";

export const moneyString = z.string().regex(/^\d+(\.\d{1,2})?$/, "amount must be a decimal with up to 2 places");
export const uuid = z.string().uuid();
export const idParam = z.object({ id: uuid });

export const registerBody = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
  displayName: z.string().min(2).max(64),
  jurisdictionCode: z.string().min(2).max(8).optional(),
  dateOfBirth: z.string().date().optional(),
});
export const loginBody = z.object({ email: z.string().email(), password: z.string().min(1).max(200) });

export const catalogQuery = z.object({
  category: z.string().optional(),
  q: z.string().max(80).optional(),
  tag: z.string().max(32).optional(),
  maxPrice: moneyString.optional(),
  minPrice: moneyString.optional(),
  sort: z.enum(["new", "price_asc", "price_desc", "value", "ending"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});
export const slugParam = z.object({ slug: z.string().min(1).max(96) });

export const openingQuoteBody = z.object({ packVersionId: uuid });
export const openingCreateBody = z.object({ packVersionId: uuid });
export const clientSeedBody = z.object({ clientSeed: z.string().min(1).max(64) });
export const rotateSeedBody = z.object({ clientSeed: z.string().min(1).max(64).optional() });

export const collectionBody = z.object({ holdingIds: z.array(uuid).min(1).max(200), collectionName: z.string().max(64).nullable() });
export const sellbackQuoteBody = z.object({ holdingId: uuid });
export const addressSchema = z.object({
  name: z.string().min(2).max(96),
  line1: z.string().min(3).max(120),
  line2: z.string().max(120).optional(),
  city: z.string().min(1).max(80),
  region: z.string().max(80).optional(),
  postalCode: z.string().min(2).max(20),
  country: z.string().length(2),
  phone: z.string().max(32).optional(),
});
export const shipmentBody = z.object({ holdingId: uuid, address: addressSchema, insured: z.boolean().optional() });
export const listingBody = z.object({ holdingId: uuid, ask: moneyString });

export const battleCreateBody = z.object({
  mode: z.enum(["CLASSIC", "CRAZY", "SHARED", "KEEP"]),
  speed: z.enum(["NORMAL", "FAST"]).default("NORMAL"),
  isPrivate: z.boolean().default(false),
  seats: z.number().int().min(2).max(4),
  packVersionIds: z.array(uuid).min(1).max(10),
  sharedRule: z.union([z.object({ type: z.literal("EQUAL_SPLIT_VALUE") }), z.object({ type: z.literal("RANK_SPLIT_BP"), shares: z.array(z.number().int().min(0).max(10000)) })]).optional(),
});
export const battleJoinBody = z.object({ joinCode: z.string().max(16).optional() });
export const battleListQuery = z.object({ status: z.enum(["live", "history", "mine"]).default("live") });

export const raffleEnterBody = z.object({ count: z.number().int().min(1).max(100), source: z.enum(["FREE", "PURCHASE"]).default("FREE") });
export const raffleClaimBody = z.object({ prizeId: uuid });

export const accountPatchBody = z.object({
  displayName: z.string().min(2).max(64).optional(),
  jurisdictionCode: z.string().min(2).max(8).nullable().optional(),
  dateOfBirth: z.string().date().nullable().optional(),
  timezone: z.string().max(64).optional(),
  notificationPrefs: z.record(z.string(), z.boolean()).optional(),
});
export const verificationBody = z.object({ type: z.enum(["AGE", "IDENTITY", "ADDRESS"]), payload: z.record(z.string(), z.unknown()).default({}) });
export const limitBody = z.object({ type: z.enum(["DEPOSIT_DAILY", "DEPOSIT_WEEKLY", "DEPOSIT_MONTHLY", "SPEND_DAILY", "SPEND_WEEKLY", "SPEND_MONTHLY", "SESSION_MINUTES"]), amount: moneyString });
export const exclusionBody = z.object({ type: z.enum(["COOLING_OFF", "SELF_EXCLUSION"]), days: z.number().int().min(1).max(3650).nullable(), reason: z.string().max(500).optional() });
export const depositBody = z.object({ amount: moneyString, method: z.string().max(32).default("test-card"), testOutcome: z.enum(["succeed", "fail"]).optional() });
export const notificationsReadBody = z.object({ ids: z.array(uuid).max(200).optional() });

// ---- Admin ----
export const skuBody = z.object({
  sku: z.string().min(2).max(64),
  categoryId: uuid,
  name: z.string().min(2).max(200),
  brand: z.string().max(120).optional(),
  isUnique: z.boolean().default(true),
  pooledQuantity: z.number().int().min(0).default(0),
  referenceValue: moneyString,
  sellbackOffer: moneyString,
  accent: z.string().max(16).default("violet"),
  shippingRestricted: z.boolean().default(false),
  shippingRestrictionNote: z.string().max(300).optional(),
});
export const inventoryIntakeBody = z.object({
  skuId: uuid,
  warehouseId: uuid.optional(),
  serialNumber: z.string().max(128).optional(),
  certificationId: z.string().max(128).optional(),
  grader: z.string().max(64).optional(),
  grade: z.string().max(32).optional(),
  size: z.string().max(32).optional(),
  condition: z.enum(["MINT", "NEAR_MINT", "EXCELLENT", "GOOD", "PLAYED", "NEW_IN_BOX", "NEW", "USED"]).default("NEAR_MINT"),
  acquisitionCost: moneyString,
  referenceValue: moneyString,
  sellbackOffer: moneyString,
  valuationSource: z.string().max(64).default("manual"),
  valuationSourceRef: z.string().max(300).optional(),
  notes: z.string().max(1000).optional(),
});
export const inventoryPatchBody = z.object({
  status: z.enum(["INTAKE", "IN_STOCK", "RETIRED", "LOST"]).optional(),
  custody: z.enum(["WAREHOUSE", "IN_TRANSIT", "DELIVERED", "THIRD_PARTY"]).optional(),
  notes: z.string().max(1000).optional(),
  reason: z.string().min(3).max(500),
});
export const valuationBody = z.object({ skuId: uuid.optional(), inventoryItemId: uuid.optional(), referenceValue: moneyString, sellbackOffer: moneyString, source: z.string().max(64), sourceRef: z.string().max(300).optional() });
export const inventoryQuery = z.object({ status: z.string().optional(), q: z.string().max(80).optional() });

export const packCreateBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,96}$/),
  name: z.string().min(2).max(120),
  tagline: z.string().max(200).optional(),
  description: z.string().max(4000).optional(),
  categoryId: uuid,
  price: moneyString,
  kind: z.enum(["FINITE", "POOLED"]).default("FINITE"),
  accent: z.string().max(16).default("violet"),
  tags: z.array(z.string().max(32)).max(12).default([]),
});
export const packVersionPatchBody = z.object({
  price: moneyString.optional(),
  notes: z.string().max(2000).nullable().optional(),
  liabilityLimit: moneyString.nullable().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  name: z.string().min(2).max(120).optional(),
  tagline: z.string().max(200).nullable().optional(),
  description: z.string().max(4000).nullable().optional(),
  accent: z.string().max(16).optional(),
  tags: z.array(z.string().max(32)).max(12).optional(),
});
export const outcomeBody = z.object({
  id: uuid.optional(),
  label: z.string().min(1).max(160),
  tier: z.enum(["GRAIL", "RARE", "UNCOMMON", "COMMON"]).default("COMMON"),
  skuId: uuid,
  inventoryItemId: uuid.nullable().optional(),
  quantity: z.number().int().min(1),
  referenceValue: moneyString,
  sellbackOffer: moneyString,
  condition: z.string().max(32).optional(),
  shippingEligible: z.boolean().optional(),
  valuationSnapshotId: uuid.nullable().optional(),
});
export const reviewBody = z.object({ decision: z.enum(["APPROVED", "REJECTED"]), reason: z.string().min(3).max(1000) });
export const reasonBody = z.object({ reason: z.string().min(3).max(1000) });
export const publishBody = z.object({ scheduledAt: z.string().datetime().optional() });

export const scoringPolicyBody = z.object({
  name: z.string().min(2).max(120),
  rules: z.object({
    pointsPerUnitSpent: z.number().int().min(0).max(1000),
    pointsPerOpening: z.number().int().min(0).max(1000),
    pointsPerBattleEntry: z.number().int().min(0).max(1000),
    pointsPerPromoUnit: z.number().int().min(0).max(1000),
    maxPointsPerEvent: z.number().int().min(1).max(1_000_000),
    tiePolicy: z.literal("EARLIEST_QUALIFYING_EVENT_WINS"),
    excludedKinds: z.array(z.string()),
  }),
});
export const raceCreateBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,64}$/),
  name: z.string().min(2).max(120),
  timezone: z.string().max(64).default("UTC"),
  startsAt: z.string().datetime(),
  scoringPolicyId: uuid,
  prizes: z.array(z.object({ rank: z.number().int().min(1).max(100), amount: moneyString, label: z.string().max(80).optional() })).max(100),
});
export const promoEntryBody = z.object({ userId: uuid, units: moneyString, ref: z.string().min(1).max(160) });

export const raffleCreateBody = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,64}$/),
  name: z.string().min(2).max(120),
  description: z.string().max(4000).optional(),
  entryMode: z.enum(["FREE", "PROMOTIONAL", "PURCHASE_LINKED"]).default("FREE"),
  maxTickets: z.number().int().min(1).max(1_000_000),
  maxTicketsPerUser: z.number().int().min(1).max(1000).default(10),
  ticketPrice: moneyString.default("0"),
  winnersCount: z.number().int().min(1).max(100).default(1),
  amoeEnabled: z.boolean().default(true),
  amoeInstructions: z.string().max(2000).optional(),
  allowedJurisdictions: z.array(z.string().max(8)).default([]),
  opensAt: z.string().datetime(),
  closesAt: z.string().datetime(),
  drawsAt: z.string().datetime(),
  claimDeadlineAt: z.string().datetime(),
  publicRandomnessSource: z.string().min(3).max(300),
  prizes: z.array(z.object({ rank: z.number().int().min(1), title: z.string().min(1).max(200), description: z.string().max(2000).optional(), condition: z.string().max(32).optional(), referenceValue: moneyString, valueSource: z.string().max(120).optional(), inventoryItemId: uuid.nullable().optional() })).min(1),
});
export const drawBody = z.object({ publicRandomness: z.string().min(8).max(300), publicRandomnessSource: z.string().min(3).max(300) });
export const redrawBody = drawBody.extend({ reason: z.string().min(20).max(2000) });
export const amoeBody = z.object({ userId: uuid, count: z.number().int().min(1).max(100), sourceRef: z.string().min(1).max(160) });

export const shipmentPatchBody = z.object({
  status: z.enum(["ADDRESS_VERIFIED", "PACKED", "SHIPPED", "DELIVERED", "RETURNED", "DISPUTED", "CANCELLED"]),
  carrier: z.string().max(32).optional(),
  trackingNumber: z.string().max(96).optional(),
  notes: z.string().max(1000).optional(),
  disputeReason: z.string().max(1000).optional(),
});
export const userPatchBody = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED", "CLOSED"]).optional(),
  jurisdictionCode: z.string().max(8).nullable().optional(),
  roles: z.array(z.string().max(48)).optional(),
  linkedAccountGroup: uuid.nullable().optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  reason: z.string().min(3).max(1000),
});
export const adminExclusionBody = z.object({ days: z.number().int().min(1).max(3650).nullable(), reason: z.string().min(3).max(1000) });
export const verificationReviewBody = z.object({ status: z.enum(["APPROVED", "REJECTED"]), reason: z.string().min(3).max(1000) });
export const riskEventBody = z.object({ userId: uuid.nullable(), kind: z.string().min(2).max(64), severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]), details: z.record(z.string(), z.unknown()).default({}) });
export const riskResolveBody = z.object({ resolution: z.string().min(3).max(1000) });
export const refundBody = z.object({ userId: uuid, paymentId: uuid.nullable().optional(), amount: moneyString, reason: z.string().min(3).max(1000), referenceType: z.string().max(48).optional(), referenceId: uuid.optional() });
export const chargebackBody = z.object({ paymentId: uuid, amount: moneyString, providerRef: z.string().max(160).optional(), reasonCode: z.string().max(32).optional() });
export const auditQuery = z.object({ q: z.string().max(80).optional(), entityType: z.string().max(64).optional(), actorUserId: uuid.optional() });
export const usersQuery = z.object({ q: z.string().max(80).optional() });
