import { route, ok } from "@/lib/api";
import { slugParam } from "@/api/schemas";
import { getDb } from "@/db/client";
import { getPackDetail } from "@/domain/packs";
import { err } from "@/lib/errors";

export const GET = route({ auth: "none", params: slugParam }, async ({ params }) => {
  const detail = await getPackDetail(getDb(), params.slug);
  if (!detail) throw err.notFound("Pack");
  return ok(detail);
});
