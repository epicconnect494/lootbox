import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/components/shell/AdminShell";
import { viewer } from "@/lib/server/data";
import { AppError } from "@/lib/errors";
import { loadVersion, loadVersionAudit, type VersionAuditRow } from "@/components/admin/versionLoader";
import { VersionEditor } from "@/components/admin/VersionEditor";

export const dynamic = "force-dynamic";

export default async function VersionEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin("packs.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await viewer();
  let data;
  try {
    data = await loadVersion(db, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  const audit: VersionAuditRow[] = session.user.permissions.has("audit.read") ? await loadVersionAudit(db, id) : [];
  return (
    <div className="space-y-4">
      <nav className="text-sm text-ink-400" aria-label="Breadcrumb">
        <Link href="/admin/packs" className="hover:text-ink-100 hover:underline">
          Pack Builder
        </Link>{" "}
        / <span className="text-ink-200">{data.pack?.name ?? "Version"} v{data.version.version}</span>
      </nav>
      <VersionEditor data={data} audit={audit} permissions={[...session.user.permissions]} userId={session.user.id} />
    </div>
  );
}
