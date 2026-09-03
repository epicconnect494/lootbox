import { route, ok } from "@/lib/api";
import { idParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { getOpeningView } from "@/domain/openings";
import { err } from "@/lib/errors";

export const GET = route({ auth: "user", params: idParam }, async ({ params, session }) => {
  const view = await getOpeningView(getDb(), params.id, session!.user.id, { admin: session!.user.permissions.has("battles.read") });
  if (!view) throw err.notFound("Opening");
  return ok(view);
});
