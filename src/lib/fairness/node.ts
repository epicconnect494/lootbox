import { createHmac, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, sign as edSign, verify as edVerify, type KeyObject } from "node:crypto";
import { canonicalJson, sha256Hex } from "../crypto";
import { buildMessage, mapIndexToOutcome, remainingInventoryCommitmentInput, selectIndexFromDigest, type SelectionResult } from "./core";

export function generateServerSeed(): string {
  return randomBytes(32).toString("hex");
}

export function serverSeedHash(serverSeedHex: string): string {
  return sha256Hex(serverSeedHex);
}

export function hmacDigest(serverSeedHex: string, message: string): string {
  return createHmac("sha256", serverSeedHex).update(message).digest("hex");
}

export interface DrawInput {
  serverSeed: string;
  clientSeed: string;
  nonce: number;
  scopeId: string; // packVersionId (openings) or raffleId (raffles)
  manifestHash: string;
  range: number;
}

export interface DrawOutput extends SelectionResult {
  message: string;
  range: number;
}

/** Deterministic draw: HMAC + rejection sampling. Used by openings, battles, tie-breaks and raffles. */
export function draw(input: DrawInput): DrawOutput {
  const message = buildMessage(input.clientSeed, input.nonce, input.scopeId, input.manifestHash);
  const digest = hmacDigest(input.serverSeed, message);
  const sel = selectIndexFromDigest(digest, input.range, (ext) => hmacDigest(input.serverSeed, `${message}:${ext}`));
  return { ...sel, message, range: input.range };
}

export function remainingInventoryCommitment(remaining: Array<{ outcomeId: string; remaining: number }>): string {
  return sha256Hex(remainingInventoryCommitmentInput(remaining));
}

export { mapIndexToOutcome };

// ---- Receipt signing (Ed25519) ------------------------------------------------------
let cached: { priv: KeyObject; pub: KeyObject; keyId: string } | null = null;

function loadSigningKey() {
  if (cached) return cached;
  const b64 = process.env.RECEIPT_SIGNING_KEY_PEM_B64;
  let priv: KeyObject;
  if (b64) {
    priv = createPrivateKey(Buffer.from(b64, "base64").toString("utf8"));
  } else {
    // Development fallback: deterministic key derived from DATA_ENCRYPTION_KEY so receipts verify across restarts.
    // PRODUCTION INTEGRATION POINT: supply RECEIPT_SIGNING_KEY_PEM_B64 from a secret manager / HSM.
    const seedHex = process.env.DATA_ENCRYPTION_KEY ?? "00".repeat(32);
    const seed = Buffer.from(sha256Hex(`receipt-signing:${seedHex}`), "hex");
    priv = createPrivateKey({
      key: Buffer.concat([Buffer.from("302e020100300506032b657004220420", "hex"), seed]),
      format: "der",
      type: "pkcs8",
    });
    if (process.env.NODE_ENV === "production") console.warn("[fairness] RECEIPT_SIGNING_KEY_PEM_B64 unset; using derived dev key");
  }
  const pub = createPublicKey(priv);
  const keyId = sha256Hex(pub.export({ type: "spki", format: "der" }) as Buffer).slice(0, 16);
  cached = { priv, pub, keyId };
  return cached;
}

export function signingKeyId(): string {
  return loadSigningKey().keyId;
}

export function signingPublicKeyPem(): string {
  return loadSigningKey().pub.export({ type: "spki", format: "pem" }).toString();
}

export function signReceipt(payload: unknown): { canonical: string; signature: string; keyId: string } {
  const { priv, keyId } = loadSigningKey();
  const canonical = canonicalJson(payload);
  const signature = edSign(null, Buffer.from(canonical), priv).toString("base64");
  return { canonical, signature, keyId };
}

export function verifyReceiptSignature(canonical: string, signatureB64: string, publicKeyPem?: string): boolean {
  const pub = publicKeyPem ? createPublicKey(publicKeyPem) : loadSigningKey().pub;
  try {
    return edVerify(null, Buffer.from(canonical), pub, Buffer.from(signatureB64, "base64"));
  } catch {
    return false;
  }
}

export function generateEd25519Pem(): string {
  const { privateKey } = generateKeyPairSync("ed25519");
  return privateKey.export({ type: "pkcs8", format: "pem" }).toString();
}
