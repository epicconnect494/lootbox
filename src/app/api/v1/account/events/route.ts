import type { NextRequest } from "next/server";
import { sseResponse } from "@/lib/sse";
import { getDb } from "@/db/client";
import { config } from "@/lib/config";
import { resolveSessionByToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const token = req.cookies.get(config.session.cookieName)?.value;
  const session = token ? await resolveSessionByToken(getDb(), token) : null;
  if (!session) return new Response("unauthenticated", { status: 401 });
  return sseResponse(`user:${session.user.id}`, req);
}
