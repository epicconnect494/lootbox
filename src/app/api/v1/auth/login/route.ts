import { NextResponse } from "next/server";
import { route, ok } from "@/lib/api";
import { loginBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { authenticate, recordRiskEvent } from "@/domain/users";
import { createSession, csrfCookieOptions, sessionCookieOptions } from "@/lib/auth";
import { config } from "@/lib/config";
import { err } from "@/lib/errors";
import { keyedHash } from "@/lib/crypto";

export const POST = route({ auth: "none", body: loginBody, rateLimit: { max: 60, windowSec: 300 } }, async ({ body, ip, req }) => {
  const db = getDb();
  const u = await authenticate(db, body.email, body.password);
  if (!u) {
    await recordRiskEvent(db, { userId: null, kind: "LOGIN_FAILED", severity: "LOW", details: { emailHash: keyedHash(body.email.toLowerCase()), ipHash: ip ? keyedHash(ip) : null } });
    throw err.unauthenticated("Invalid email or password");
  }
  const sess = await createSession(db, u.id, { ip, userAgent: req.headers.get("user-agent") });
  const r = NextResponse.json({});
  r.cookies.set(config.session.cookieName, sess.token, sessionCookieOptions(sess.expiresAt));
  r.cookies.set(config.session.csrfCookieName, sess.csrfSecret, csrfCookieOptions(sess.expiresAt));
  return { ...ok({ user: { id: u.id, email: u.email, displayName: u.displayName }, csrfToken: sess.csrfSecret }), headers: { "set-cookie": r.headers.get("set-cookie") ?? "" } };
});
