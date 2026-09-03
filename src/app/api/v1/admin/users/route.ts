import { route, ok } from "@/lib/api";
import { usersQuery } from "@/api/schemas";
import { getDb } from "@/db/client";
import { listUsers } from "@/domain/admin";

export const GET = route({ auth: "admin", permission: "users.read", query: usersQuery }, async ({ query }) => ok({ items: await listUsers(getDb(), query.q) }));
