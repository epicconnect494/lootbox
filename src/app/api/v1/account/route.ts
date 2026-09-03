import { route, ok } from "@/lib/api";
import { accountPatchBody } from "@/api/schemas";
import { getDb } from "@/db/client";
import { accountOverview, updateProfile } from "@/domain/users";

export const GET = route({ auth: "user" }, async ({ session }) => ok(await accountOverview(getDb(), session!.user.id)));

export const PATCH = route({ auth: "user", body: accountPatchBody }, async ({ body, session }) => {
  const u = await updateProfile(getDb(), session!.user.id, { displayName: body.displayName, jurisdictionCode: body.jurisdictionCode, dateOfBirth: body.dateOfBirth === undefined ? undefined : body.dateOfBirth ? new Date(body.dateOfBirth) : null, timezone: body.timezone, notificationPrefs: body.notificationPrefs });
  return ok({ user: { id: u.id, displayName: u.displayName, jurisdictionCode: u.jurisdictionCode, timezone: u.timezone, dateOfBirth: u.dateOfBirth } });
});
