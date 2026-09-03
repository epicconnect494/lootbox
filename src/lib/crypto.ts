import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function sha256Hex(input: string | Buffer): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256Hex(key: Buffer | string, message: string): string {
  return createHmac("sha256", key).update(message).digest("hex");
}

export function randomHex(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Stable JSON serialization: sorted object keys, no whitespace, bigint as string. */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: unknown): unknown {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object" && !(v instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(v as Record<string, unknown>).sort()) {
      const val = (v as Record<string, unknown>)[k];
      if (val !== undefined) out[k] = sortKeys(val);
    }
    return out;
  }
  if (v instanceof Date) return v.toISOString();
  return v;
}

export function hashObject(value: unknown): string {
  return sha256Hex(canonicalJson(value));
}

// ---- Symmetric encryption at rest (AES-256-GCM) ----------------------------------
function dataKey(): Buffer {
  const hex = process.env.DATA_ENCRYPTION_KEY;
  if (!hex || !/^[0-9a-fA-F]{64}$/.test(hex)) throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes hex");
  return Buffer.from(hex, "hex");
}

/** Returns "v1.<iv>.<tag>.<ciphertext>" base64url. */
export function encryptString(plaintext: string, aad = ""): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", dataKey(), iv);
  if (aad) cipher.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), ct.toString("base64url")].join(".");
}

export function decryptString(payload: string, aad = ""): string {
  const [v, ivB, tagB, ctB] = payload.split(".");
  if (v !== "v1" || !ivB || !tagB || !ctB) throw new Error("malformed ciphertext");
  const decipher = createDecipheriv("aes-256-gcm", dataKey(), Buffer.from(ivB, "base64url"));
  if (aad) decipher.setAAD(Buffer.from(aad));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB, "base64url")), decipher.final()]).toString("utf8");
}

// ---- Passwords (scrypt, no native deps) ---------------------------------------------
export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `scrypt$${salt.toString("base64url")}$${hash.toString("base64url")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algo, saltB, hashB] = stored.split("$");
  if (algo !== "scrypt" || !saltB || !hashB) return false;
  const expected = Buffer.from(hashB, "base64url");
  const actual = scryptSync(password, Buffer.from(saltB, "base64url"), expected.length, { N: 16384, r: 8, p: 1 });
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Non-reversible hash for IPs / user agents used in audit and risk (keyed to prevent rainbow lookups). */
export function keyedHash(value: string): string {
  const key = process.env.SESSION_SECRET ?? "dev";
  return hmacSha256Hex(key, value);
}
