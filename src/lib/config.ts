function int(name: string, def: number): number {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  const n = Number(v);
  if (!Number.isInteger(n)) throw new Error(`${name} must be an integer`);
  return n;
}
function big(name: string, def: bigint): bigint {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  return BigInt(v);
}
function bool(name: string, def: boolean): boolean {
  const v = process.env[name];
  if (v === undefined || v === "") return def;
  return v === "true" || v === "1";
}

export const config = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  isProd: process.env.NODE_ENV === "production",
  providers: {
    payment: process.env.PAYMENT_PROVIDER ?? "mock",
    kyc: process.env.KYC_PROVIDER ?? "mock",
    geo: process.env.GEO_PROVIDER ?? "mock",
    storage: process.env.STORAGE_PROVIDER ?? "local",
    email: process.env.EMAIL_PROVIDER ?? "log",
  },
  fairness: {
    seedRevealAfterHours: int("SEED_REVEAL_AFTER_HOURS", 24),
    seedMaxUses: int("SEED_MAX_USES", 10000),
  },
  features: {
    paidChance: bool("FEATURE_PAID_CHANCE_ENABLED", true),
    battles: bool("FEATURE_BATTLES_ENABLED", true),
    raffles: bool("FEATURE_RAFFLES_ENABLED", true),
    cashConversion: bool("FEATURE_CASH_CONVERSION_ENABLED", true),
    cryptoConversion: bool("FEATURE_CRYPTO_CONVERSION_ENABLED", false),
    freeEntryRoute: bool("FEATURE_FREE_ENTRY_ROUTE_ENABLED", true),
    bots: bool("FEATURE_BOTS_ENABLED", false),
  },
  economics: {
    targetSellbackRtpBp: int("TARGET_SELLBACK_RTP_BP", 9000),
    rtpToleranceBp: int("RTP_TOLERANCE_BP", 50),
    paymentFeeBp: int("PAYMENT_FEE_BP", 290),
    paymentFeeFixedMinor: big("PAYMENT_FEE_FIXED_MINOR", 30n),
    fraudReserveBp: int("FRAUD_RESERVE_BP", 100),
    shippingSubsidyMinor: big("SHIPPING_SUBSIDY_MINOR", 600n),
    rewardsAllocationBp: int("REWARDS_ALLOCATION_BP", 200),
    valuationMaxAgeHours: int("VALUATION_MAX_AGE_HOURS", 72),
    maxMerchLiabilityMinor: big("MAX_MERCH_LIABILITY_MINOR", 50_000_000n),
    marketplaceFeeBp: int("MARKETPLACE_FEE_BP", 500),
    sellbackQuoteTtlMinutes: int("SELLBACK_QUOTE_TTL_MINUTES", 15),
    shippingFeeMinor: big("SHIPPING_FEE_MINOR", 0n),
  },
  rateLimit: {
    windowSec: int("RATE_LIMIT_WINDOW_SEC", 60),
    max: int("RATE_LIMIT_MAX", 120),
  },
  session: {
    ttlDays: int("SESSION_TTL_DAYS", 14),
    cookieName: "lb_session",
    csrfCookieName: "lb_csrf",
  },
} as const;
