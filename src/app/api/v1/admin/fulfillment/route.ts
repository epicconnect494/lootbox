import { z } from "zod";
import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { listShipments } from "@/domain/admin";

export const GET = route({ auth: "admin", permission: "fulfillment.read", query: z.object({ status: z.string().optional() }) }, async ({ query }) => {
  const rows = await listShipments(getDb(), query.status);
  return ok({ items: rows.map(({ s, item, sku, userEmail }) => ({ ...s, addressEncrypted: undefined, item: { itemCode: item.itemCode, status: item.status }, sku: { name: sku.name }, userEmail })) });
});
