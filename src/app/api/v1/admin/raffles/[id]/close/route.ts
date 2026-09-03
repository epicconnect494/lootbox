import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { closeRaffle } from "@/domain/raffles";

export const POST = route({ auth: "admin", permission: "raffles.write", params: idParam }, async ({ params, session }) => ok({ result: await closeRaffle(getDb(), session!.user.id, params.id) }));
