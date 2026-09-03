import { requireAdmin } from "@/components/shell/AdminShell";
import { Panel } from "@/components/ui/primitives";
import { listBattlesAdmin } from "@/domain/admin";
import { viewer } from "@/lib/server/data";
import { ser } from "@/components/admin/serialize";
import { PageHeader } from "@/components/admin/ui";
import { BattlesTable } from "@/components/admin/BattlesTable";

export const dynamic = "force-dynamic";

export default async function BattlesPage() {
  const session = await requireAdmin("battles.read");
  const { db } = await viewer();
  const rows = ser(await listBattlesAdmin(db));
  return (
    <div className="space-y-6">
      <PageHeader title="Battles" sub="Most recent 200 battles. Open a battle to inspect seats, pulls and receipts, or to void it under the controlled policy." />
      <Panel>
        <BattlesTable rows={rows} permissions={[...session.user.permissions]} />
      </Panel>
    </div>
  );
}
