import { route, ok } from "@/lib/api";
import { idParam, raffleClaimBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { claimPrize } from "@/domain/raffles";

export const POST = route({ auth: "user", params: idParam, body: raffleClaimBody }, async ({ params, body, session }) => {
  return ok({ prize: await claimPrize(getDb(), session!.user.id, params.id, body.prizeId) });
});
