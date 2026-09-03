import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { listVault } from "@/domain/vault";

export const GET = route({ auth: "user" }, async ({ session }) => ok(await listVault(getDb(), session!.user.id)));
