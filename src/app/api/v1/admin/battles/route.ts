import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { listBattlesAdmin } from "@/domain/admin";

export const GET = route({ auth: "admin", permission: "battles.read" }, async () => ok({ items: await listBattlesAdmin(getDb()) }));
