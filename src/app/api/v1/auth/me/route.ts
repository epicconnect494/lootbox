import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { getUserBalance } from "@/domain/ledger";

export const GET = route({ auth: "optional" }, async ({ session }) => {
  if (!session) return ok({ user: null });
  const balance = await getUserBalance(getDb(), session.user.id);
  return ok({ user: { id: session.user.id, email: session.user.email, displayName: session.user.displayName, roles: session.user.roles, permissions: [...session.user.permissions], jurisdictionCode: session.user.jurisdictionCode }, balance, csrfToken: session.csrfSecret });
});
