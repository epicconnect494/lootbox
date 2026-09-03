import type { NextRequest } from "next/server";
import { storageProvider } from "@/adapters";

export const dynamic = "force-dynamic";
export async function GET(_req: NextRequest, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  if (key.includes("..")) return new Response("bad key", { status: 400 });
  const data = await storageProvider().get(decodeURIComponent(key));
  if (!data) return new Response("not found", { status: 404 });
  const type = key.endsWith(".png") ? "image/png" : key.endsWith(".webp") ? "image/webp" : key.endsWith(".svg") ? "image/svg+xml" : "image/jpeg";
  return new Response(new Uint8Array(data), { headers: { "Content-Type": type, "Cache-Control": "public, max-age=86400" } });
}
