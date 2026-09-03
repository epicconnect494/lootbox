import type { NextRequest } from "next/server";
import { sseResponse } from "@/lib/sse";

export const dynamic = "force-dynamic";
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return sseResponse(`raffle:${id}`, req);
}
