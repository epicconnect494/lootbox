import { route, ok } from "@/lib/api";
import { catalogQuery } from "@/api/schemas";
import { getDb } from "@/db/client";
import { listCatalog } from "@/domain/packs";
import { parseDecimalToMinor } from "@/lib/money";

export const GET = route({ auth: "none", query: catalogQuery }, async ({ query }) => {
  const items = await listCatalog(getDb(), { category: query.category, q: query.q, tag: query.tag, sort: query.sort, limit: query.limit, maxPriceMinor: query.maxPrice ? parseDecimalToMinor(query.maxPrice) : undefined, minPriceMinor: query.minPrice ? parseDecimalToMinor(query.minPrice) : undefined });
  return ok({ items, rtpBasis: "Public RTP figures show both merchandise RTP (reference value) and sell-back RTP (cash offer). Packs target 90.00% sell-back RTP." });
});
