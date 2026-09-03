import { NextResponse } from "next/server";
import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { revokeSession } from "@/lib/auth";
import { config } from "@/lib/config";

export const POST = route({ auth: "optional", csrf: false }, async ({ session }) => {
  if (session) await revokeSession(getDb(), session.id);
  const r = NextResponse.json({});
  r.cookies.set(config.session.cookieName, "", { maxAge: 0, path: "/" });
  r.cookies.set(config.session.csrfCookieName, "", { maxAge: 0, path: "/" });
  return { ...ok({ ok: true }), headers: { "set-cookie": r.headers.get("set-cookie") ?? "" } };
});
