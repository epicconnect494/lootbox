import { NextResponse } from "next/server";
import { route, ok } from "@/lib/api";
import { registerBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { registerUser } from "@/domain/users";
import { createSession, csrfCookieOptions, sessionCookieOptions } from "@/lib/auth";
import { config } from "@/lib/config";

export const POST = route({ auth: "none", body: registerBody, rateLimit: { max: 10, windowSec: 600 } }, async ({ body, ip, req }) => {
  const db = getDb();
  const u = await registerUser(db, { email: body.email, password: body.password, displayName: body.displayName, jurisdictionCode: body.jurisdictionCode ?? null, dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null });
  const sess = await createSession(db, u.id, { ip, userAgent: req.headers.get("user-agent") });
  const res = ok({ user: { id: u.id, email: u.email, displayName: u.displayName }, csrfToken: sess.csrfSecret }, 201);
  return { ...res, headers: { "set-cookie": cookieHeader(sess) } };
});

function cookieHeader(sess: { token: string; csrfSecret: string; expiresAt: Date }): string {
  const r = NextResponse.json({});
  r.cookies.set(config.session.cookieName, sess.token, sessionCookieOptions(sess.expiresAt));
  r.cookies.set(config.session.csrfCookieName, sess.csrfSecret, csrfCookieOptions(sess.expiresAt));
  return r.headers.get("set-cookie") ?? "";
}
