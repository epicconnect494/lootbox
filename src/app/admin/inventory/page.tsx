import { requireAdmin } from "@/components/shell/AdminShell";
import { Button, Field, Input, Panel, Select } from "@/components/ui/primitives";
import { listInventory } from "@/domain/admin";
import { warehouseLocation } from "@/db/schema";
import { viewer } from "@/lib/server/data";
import { ser } from "@/components/admin/serialize";
import { PageHeader } from "@/components/admin/ui";
import { InventoryTable, type InventoryRow } from "@/components/admin/InventoryTable";
import { InventoryIntakeForm } from "@/components/admin/InventoryIntakeForm";
import { SkuForm } from "@/components/admin/SkuForm";

export const dynamic = "force-dynamic";

const STATUSES = ["INTAKE", "IN_STOCK", "RESERVED", "IN_VAULT", "LISTED", "SHIP_REQUESTED", "SHIPPED", "DELIVERED", "SOLD_BACK", "RETURNED", "LOST", "RETIRED"];

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireAdmin("inventory.read");
  const sp = await searchParams;
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : undefined;
  const { db } = await viewer();
  const [rows, warehouses] = await Promise.all([listInventory(db, { status, q }), db.select({ id: warehouseLocation.id, code: warehouseLocation.code, name: warehouseLocation.name }).from(warehouseLocation)]);
  const items: InventoryRow[] = ser(rows.map(({ item, sku, category }) => ({ ...item, sku: { id: sku.id, sku: sku.sku, name: sku.name, brand: sku.brand, isUnique: sku.isUnique, accent: sku.accent, imageKey: sku.imageKey, shippingRestricted: sku.shippingRestricted, shippingRestrictionNote: sku.shippingRestrictionNote }, category: category.name })));
  const permissions = [...session.user.permissions];
  const canWrite = session.user.permissions.has("inventory.write");

  return (
    <div className="space-y-6">
      <PageHeader title="Inventory" sub="Every physical item, its custody and reservation. Values shown are acquisition cost; open an item for its valuation and ownership history." />
      <Panel>
        <form method="get" className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Field label="Status">
            <Select name="status" defaultValue={status ?? ""}>
              <option value="">All statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Search" hint="Item code, SKU name or certification ID">
            <Input name="q" defaultValue={q ?? ""} placeholder="ITM-0001, PSA cert…" />
          </Field>
          <div className="flex items-end">
            <Button type="submit" tone="secondary">
              Filter
            </Button>
          </div>
        </form>
      </Panel>
      <Panel>
        <div className="mb-3 text-sm text-ink-400">
          {items.length} item{items.length === 1 ? "" : "s"}
          {status ? ` · ${status.replace(/_/g, " ")}` : ""}
        </div>
        <InventoryTable rows={items} permissions={permissions} />
      </Panel>
      {canWrite && (
        <div className="grid gap-6 xl:grid-cols-2">
          <InventoryIntakeForm warehouses={warehouses} />
          <SkuForm />
        </div>
      )}
    </div>
  );
}
