import { route, ok } from "@/lib/api";
import { openingCreateBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { getOpeningView, listUserOpenings, openPack } from "@/domain/openings";
import { drainOutbox } from "@/domain/worker";

export const POST = route({ auth: "user", body: openingCreateBody, idempotent: "openings.create", rateLimit: { max: 60, windowSec: 60, key: "user" } }, async ({ body, session, idempotencyKey, requestId }) => {
  const db = getDb();
  const result = await openPack(db, { userId: session!.user.id, packVersionId: body.packVersionId, idempotencyKey: idempotencyKey!, correlationId: requestId });
  // Low-latency path: drain a small outbox batch inline so realtime + race scoring feel immediate (the worker is the durable path).
  drainOutbox(db, 25).catch(() => undefined);
  const view = await getOpeningView(db, result.opening.id, session!.user.id);
  return ok({ ...view, replayed: result.replayed }, result.replayed ? 200 : 201);
});

export const GET = route({ auth: "user" }, async ({ session }) => {
  const rows = await listUserOpenings(getDb(), session!.user.id);
  return ok({ items: rows.map((r) => ({ id: r.o.id, createdAt: r.o.createdAt, status: r.o.status, source: r.o.source, priceMinor: r.o.priceMinor, referenceValueMinor: r.o.referenceValueMinor, sellbackOfferMinor: r.o.sellbackOfferMinor, packName: r.packName, packSlug: r.packSlug, outcomeLabel: r.outcomeLabel, tier: r.tier, accent: r.accent, revealedAt: r.o.revealedAt })) });
});
