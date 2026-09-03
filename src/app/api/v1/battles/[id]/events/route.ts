import type { NextRequest } from "next/server";
import { sseResponse } from "@/lib/sse";
import { getDb } from "@/db/client";
import { getBattleView } from "@/domain/battles";
import { config } from "@/lib/config";
import { resolveSessionByToken } from "@/lib/auth";
import { bigintToJson } from "@/lib/money";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const token = req.cookies.get(config.session.cookieName)?.value;
  const session = token ? await resolveSessionByToken(getDb(), token) : null;
  const snapshot = await getBattleView(getDb(), id, session?.user.id ?? null);
  return sseResponse(`battle:${id}`, req, snapshot ? bigintToJson(snapshot) : null);
}
