import { cookies, headers } from "next/headers";
import { and, eq, gt, isNull } from "drizzle-orm";
import { getDb, type DbOrTx } from "@/db/client";
import { permission, role, rolePermission, user, userRole, userSession } from "@/db/schema";
import { keyedHash, randomToken, sha256Hex } from "./crypto";
import { config } from "./config";
import { err } from "./errors";
import type { Permission } from "./permissions";

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  jurisdictionCode: string | null;
  roles: string[];
  permissions: Set<Permission>;
  timezone: string;
}

export interface Session {
  id: string;
  user: AuthUser;
  csrfSecret: string;
}

export async function loadUserWithPermissions(db: DbOrTx, userId: string): Promise<AuthUser | null> {
  const u = await db.query.user.findFirst({ where: and(eq(user.id, userId), isNull(user.deletedAt)) });
  if (!u) return null;
  const rows = await db
    .select({ roleKey: role.key, perm: permission.key })
    .from(userRole)
    .innerJoin(role, eq(role.id, userRole.roleId))
    .leftJoin(rolePermission, eq(rolePermission.roleId, role.id))
    .leftJoin(permission, eq(permission.id, rolePermission.permissionId))
    .where(eq(userRole.userId, userId));
  const roles = [...new Set(rows.map((r) => r.roleKey))];
  const permissions = new Set(rows.map((r) => r.perm).filter((p): p is string => !!p) as Permission[]);
  return { id: u.id, email: u.email, displayName: u.displayName, status: u.status, jurisdictionCode: u.jurisdictionCode, roles, permissions, timezone: u.timezone };
}

export async function createSession(db: DbOrTx, userId: string, meta: { ip?: string | null; userAgent?: string | null; device?: string | null }): Promise<{ token: string; csrfSecret: string; expiresAt: Date }> {
  const token = randomToken(32);
  const csrfSecret = randomToken(24);
  const expiresAt = new Date(Date.now() + config.session.ttlDays * 86_400_000);
  await db.insert(userSession).values({
    userId,
    tokenHash: sha256Hex(token),
    csrfSecret,
    ipHash: meta.ip ? keyedHash(meta.ip) : null,
    userAgentHash: meta.userAgent ? keyedHash(meta.userAgent) : null,
    deviceFingerprint: meta.device ?? null,
    expiresAt,
  });
  return { token, csrfSecret, expiresAt };
}

export async function resolveSessionByToken(db: DbOrTx, token: string): Promise<Session | null> {
  const row = await db.query.userSession.findFirst({ where: and(eq(userSession.tokenHash, sha256Hex(token)), isNull(userSession.revokedAt), gt(userSession.expiresAt, new Date())) });
  if (!row) return null;
  const u = await loadUserWithPermissions(db, row.userId);
  if (!u || u.status === "CLOSED") return null;
  return { id: row.id, user: u, csrfSecret: row.csrfSecret };
}

export async function revokeSession(db: DbOrTx, sessionId: string): Promise<void> {
  await db.update(userSession).set({ revokedAt: new Date() }).where(eq(userSession.id, sessionId));
}

/** Reads the session from request cookies (server components + route handlers). */
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const token = jar.get(config.session.cookieName)?.value;
  if (!token) return null;
  return resolveSessionByToken(getDb(), token);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw err.unauthenticated();
  return s;
}

export function hasPermission(u: AuthUser, p: Permission): boolean {
  return u.permissions.has(p);
}

export function assertPermission(u: AuthUser, p: Permission): void {
  if (!hasPermission(u, p)) throw err.forbidden(`Missing permission ${p}`);
}

export async function requestMeta(): Promise<{ ip: string | null; userAgent: string | null; requestId: string }> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  return { ip, userAgent: h.get("user-agent"), requestId: h.get("x-request-id") ?? randomToken(8) };
}

/** Secure cookies whenever the app is served over HTTPS (production deployments must set an https APP_URL). */
const secureCookies = config.appUrl.startsWith("https://");

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: secureCookies,
    path: "/",
    expires: expiresAt,
  };
}
export function csrfCookieOptions(expiresAt: Date) {
  return { httpOnly: false, sameSite: "lax" as const, secure: secureCookies, path: "/", expires: expiresAt };
}
