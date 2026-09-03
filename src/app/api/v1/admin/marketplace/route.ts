import { route, ok } from "@/lib/api";
import { getDb } from "@/db/client";
import { sellbackOverview } from "@/domain/admin";
import { SELLBACK_POLICY_VERSION } from "@/domain/vault";
import { config } from "@/lib/config";

export const GET = route({ auth: "admin", permission: "marketplace.read" }, async () => {
  const o = await sellbackOverview(getDb());
  return ok({ ...o, listings: o.listings.map(({ l, item, sku }) => ({ ...l, item: { itemCode: item.itemCode, status: item.status }, sku: { name: sku.name } })), policy: { sellback: SELLBACK_POLICY_VERSION, quoteTtlMinutes: config.economics.sellbackQuoteTtlMinutes, marketplaceFeeBp: config.economics.marketplaceFeeBp } });
});
