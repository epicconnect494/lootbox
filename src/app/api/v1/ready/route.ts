import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/db/client";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await getDb().execute(sql`SELECT 1`);
    return NextResponse.json({ status: "ready", database: "ok" });
  } catch (e) {
    return NextResponse.json({ status: "not-ready", database: (e as Error).message }, { status: 503 });
  }
}
