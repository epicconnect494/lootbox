import { desc } from "drizzle-orm";
import { route, ok } from "@/lib/api";
import { raffleCreateBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { raffle } from "@/db/schema";
import { createRaffle } from "@/domain/raffles";
import { parseDecimalToMinor } from "@/lib/money";

export const GET = route({ auth: "admin", permission: "raffles.read" }, async () => ok({ items: await getDb().select().from(raffle).orderBy(desc(raffle.createdAt)).limit(100) }));

export const POST = route({ auth: "admin", permission: "raffles.write", body: raffleCreateBody }, async ({ body, session }) => {
  const r = await createRaffle(getDb(), session!.user.id, {
    slug: body.slug, name: body.name, description: body.description, entryMode: body.entryMode, maxTickets: body.maxTickets, maxTicketsPerUser: body.maxTicketsPerUser,
    ticketPriceMinor: parseDecimalToMinor(body.ticketPrice), winnersCount: body.winnersCount, amoeEnabled: body.amoeEnabled, amoeInstructions: body.amoeInstructions, allowedJurisdictions: body.allowedJurisdictions,
    opensAt: new Date(body.opensAt), closesAt: new Date(body.closesAt), drawsAt: new Date(body.drawsAt), claimDeadlineAt: new Date(body.claimDeadlineAt), publicRandomnessSource: body.publicRandomnessSource,
    prizes: body.prizes.map((p) => ({ rank: p.rank, title: p.title, description: p.description, condition: p.condition, referenceValueMinor: parseDecimalToMinor(p.referenceValue), valueSource: p.valueSource, valueObservedAt: new Date(), inventoryItemId: p.inventoryItemId ?? null })),
  });
  return ok({ raffle: r }, 201);
});
