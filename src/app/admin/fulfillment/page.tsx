import { requireAdmin } from "@/components/shell/AdminShell";
import { Button, Field, Panel, Select } from "@/components/ui/primitives";
import { listShipments } from "@/domain/admin";
import { viewer } from "@/lib/server/data";
import { ser } from "@/components/admin/serialize";
import { PageHeader } from "@/components/admin/ui";
import { ShipmentsTable, type ShipmentRow } from "@/components/admin/ShipmentsTable";

export const dynamic = "force-dynamic";

const STATUSES = ["REQUESTED", "ADDRESS_VERIFIED", "PACKED", "SHIPPED", "DELIVERED", "RETURNED", "DISPUTED", "CANCELLED"];

export default async function FulfillmentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await requireAdmin("fulfillment.read");
  const sp = await searchParams;
  const status = typeof sp.status === "string" && STATUSES.includes(sp.status) ? sp.status : undefined;
  const { db } = await viewer();
  const rows = await listShipments(db, status);
  const items: ShipmentRow[] = ser(rows.map(({ s, item, sku, userEmail }) => ({ ...s, addressEncrypted: undefined, item: { itemCode: item.itemCode, status: item.status }, sku: { name: sku.name }, userEmail })));
  return (
    <div className="space-y-6">
      <PageHeader title="Fulfillment" sub="Ship queue. Addresses are encrypted at rest and decrypted only inside the detail view, which is audited." />
      <Panel>
        <form method="get" className="flex flex-wrap items-end gap-3">
          <Field label="Status">
            <Select name="status" defaultValue={status ?? ""}>
              <option value="">All</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          <Button type="submit" tone="secondary">
            Filter
          </Button>
        </form>
      </Panel>
      <Panel>
        <ShipmentsTable rows={items} permissions={[...session.user.permissions]} />
      </Panel>
    </div>
  );
}
