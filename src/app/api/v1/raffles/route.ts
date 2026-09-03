import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { listRaffles } from "@/domain/raffles";

export const GET = route({ auth: "none" }, async () => ok({ items: await listRaffles(getDb()) }));
