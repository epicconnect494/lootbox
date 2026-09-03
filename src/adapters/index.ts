/**
 * Provider adapters. Every adapter has a functioning local fake and a documented production integration point.
 * Selection is by environment variables (see .env.example).
 */
import fs from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";
import { log } from "@/lib/log";
import { randomHex } from "@/lib/crypto";

// ---- Payments -------------------------------------------------------------------------------
export interface PaymentProvider {
  name: string;
  /** Create and (for mock) immediately settle a payment. Real providers return PENDING and settle via webhook. */
  charge(input: { userId: string; amountMinor: bigint; currency: string; method: string; idempotencyKey: string; testOutcome?: "succeed" | "fail" }): Promise<{ providerRef: string; status: "SUCCEEDED" | "PENDING" | "FAILED"; feeMinor: bigint; failureReason?: string }>;
  refund(input: { providerRef: string; amountMinor: bigint }): Promise<{ providerRef: string; status: "SUCCEEDED" | "PENDING" | "FAILED" }>;
}

const mockPayments: PaymentProvider = {
  name: "mock",
  async charge(input) {
    if (input.testOutcome === "fail") return { providerRef: `mock_pi_${randomHex(8)}`, status: "FAILED", feeMinor: 0n, failureReason: "card_declined (test)" };
    const fee = (input.amountMinor * BigInt(config.economics.paymentFeeBp)) / 10000n + config.economics.paymentFeeFixedMinor;
    return { providerRef: `mock_pi_${randomHex(8)}`, status: "SUCCEEDED", feeMinor: fee };
  },
  async refund(input) {
    return { providerRef: `mock_re_${input.providerRef}`, status: "SUCCEEDED" };
  },
};

export function paymentProvider(): PaymentProvider {
  // PRODUCTION INTEGRATION POINT: return a Stripe/Adyen implementation when PAYMENT_PROVIDER=stripe.
  if (config.providers.payment !== "mock") log.warn("payment provider not implemented; using mock", { provider: config.providers.payment });
  return mockPayments;
}

// ---- KYC / age / identity ------------------------------------------------------------------
export interface KycProvider {
  name: string;
  startVerification(input: { userId: string; type: "AGE" | "IDENTITY" | "ADDRESS"; payload: Record<string, unknown> }): Promise<{ providerRef: string; status: "PENDING" | "APPROVED" | "REJECTED"; reason?: string }>;
}
const mockKyc: KycProvider = {
  name: "mock",
  async startVerification(input) {
    // The mock approves unless the payload carries `simulate: "reject"` or `simulate: "pending"`.
    const sim = input.payload.simulate;
    if (sim === "reject") return { providerRef: `mock_kyc_${randomHex(6)}`, status: "REJECTED", reason: "Document unreadable (test)" };
    if (sim === "pending") return { providerRef: `mock_kyc_${randomHex(6)}`, status: "PENDING" };
    return { providerRef: `mock_kyc_${randomHex(6)}`, status: "APPROVED" };
  },
};
export function kycProvider(): KycProvider {
  // PRODUCTION INTEGRATION POINT: Persona / Onfido / Veriff adapter with webhook completion.
  return mockKyc;
}

// ---- Geo / jurisdiction -----------------------------------------------------------------------
export interface GeoProvider {
  name: string;
  resolve(ip: string | null, declared: string | null): Promise<{ jurisdictionCode: string | null; confidence: "HIGH" | "LOW" }>;
}
const mockGeo: GeoProvider = {
  name: "mock",
  async resolve(_ip, declared) {
    return { jurisdictionCode: declared, confidence: "LOW" };
  },
};
export function geoProvider(): GeoProvider {
  // PRODUCTION INTEGRATION POINT: MaxMind GeoIP2 + declared address cross-check.
  return mockGeo;
}

// ---- Object storage ---------------------------------------------------------------------------
export interface StorageProvider {
  name: string;
  put(key: string, data: Buffer, contentType: string): Promise<{ key: string }>;
  get(key: string): Promise<Buffer | null>;
  publicUrl(key: string): string;
}
function storageDir(): string {
  return path.resolve(process.cwd(), process.env.LOCAL_STORAGE_DIR ?? ".storage");
}
const localStorage: StorageProvider = {
  name: "local",
  async put(key, data) {
    const p = path.join(storageDir(), key);
    if (!p.startsWith(storageDir())) throw new Error("invalid storage key");
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, data);
    return { key };
  },
  async get(key) {
    const p = path.join(storageDir(), key);
    if (!p.startsWith(storageDir())) return null;
    return fs.existsSync(/* turbopackIgnore: true */ p) ? fs.readFileSync(/* turbopackIgnore: true */ p) : null;
  },
  publicUrl(key) {
    return `/api/v1/media/${encodeURIComponent(key)}`;
  },
};
export function storageProvider(): StorageProvider {
  // PRODUCTION INTEGRATION POINT: S3/R2 with signed URLs.
  return localStorage;
}

// ---- Email ----------------------------------------------------------------------------------------
export interface EmailProvider {
  send(input: { to: string; subject: string; text: string }): Promise<void>;
}
export function emailProvider(): EmailProvider {
  // PRODUCTION INTEGRATION POINT: SES / Postmark.
  return {
    async send(input) {
      log.info("email.sent", { toHash: input.to.length, subject: input.subject });
    },
  };
}
