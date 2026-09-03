import { route, ok } from "@/lib/api";
import { listingBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { createListing } from "@/domain/vault";
import { parseDecimalToMinor } from "@/lib/money";

export const POST = route({ auth: "user", body: listingBody }, async ({ body, session }) => {
  const l = await createListing(getDb(), session!.user.id, body.holdingId, parseDecimalToMinor(body.ask));
  return ok({ listing: l }, 201);
});
