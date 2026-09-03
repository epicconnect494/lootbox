import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { dashboard } from "@/domain/admin";

export const GET = route({ auth: "admin" }, async () => ok(await dashboard(getDb())));
