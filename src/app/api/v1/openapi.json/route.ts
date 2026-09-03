import { NextResponse } from "next/server";
import { buildOpenApi } from "@/api/openapi";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(buildOpenApi());
}
