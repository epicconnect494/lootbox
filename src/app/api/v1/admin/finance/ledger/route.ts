import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { ledgerOverview } from "@/domain/admin";

export const GET = route({ auth: "admin", permission: "finance.read" }, async () => ok(await ledgerOverview(getDb())));
