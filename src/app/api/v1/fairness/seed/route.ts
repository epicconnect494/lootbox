import { route, ok } from "@/lib/api";
import { clientSeedBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { getOrCreateUserSeed, setClientSeed } from "@/domain/openings";
import { desc, eq, and } from "drizzle-orm";
import { fairnessSeed } from "@/db/schema";

export const GET = route({ auth: "user" }, async ({ session }) => {
  const db = getDb();
  const active = await getOrCreateUserSeed(db, session!.user.id);
  const history = await db.select({ id: fairnessSeed.id, serverSeedHash: fairnessSeed.serverSeedHash, revealedServerSeed: fairnessSeed.revealedServerSeed, status: fairnessSeed.status, useCount: fairnessSeed.useCount, createdAt: fairnessSeed.createdAt, revealedAt: fairnessSeed.revealedAt, clientSeed: fairnessSeed.clientSeed }).from(fairnessSeed).where(and(eq(fairnessSeed.userId, session!.user.id), eq(fairnessSeed.scope, "USER"))).orderBy(desc(fairnessSeed.createdAt)).limit(20);
  return ok({ active: { id: active.id, serverSeedHash: active.serverSeedHash, clientSeed: active.clientSeed, nonce: active.nonce, useCount: active.useCount, createdAt: active.createdAt }, history });
});

export const PUT = route({ auth: "user", body: clientSeedBody }, async ({ body, session }) => {
  const s = await setClientSeed(getDb(), session!.user.id, body.clientSeed);
  return ok({ clientSeed: s.clientSeed, serverSeedHash: s.serverSeedHash, nonce: s.nonce });
});
