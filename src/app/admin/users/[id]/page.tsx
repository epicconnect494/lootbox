import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/components/shell/AdminShell";
import { userDetail } from "@/domain/admin";
import { viewer } from "@/lib/server/data";
import { AppError } from "@/lib/errors";
import { ser } from "@/components/admin/serialize";
import { UserDetail } from "@/components/admin/UserDetail";

export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdmin("users.read");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { db } = await viewer();
  let data;
  try {
    data = await userDetail(db, id);
  } catch (e) {
    if (e instanceof AppError && e.code === "NOT_FOUND") notFound();
    throw e;
  }
  return (
    <div className="space-y-4">
      <nav className="text-sm text-ink-400" aria-label="Breadcrumb">
        <Link href="/admin/users" className="hover:text-ink-100 hover:underline">
          Users & Risk
        </Link>{" "}
        / <span className="text-ink-200">{data.user.displayName}</span>
      </nav>
      <UserDetail data={ser(data)} permissions={[...session.user.permissions]} roles={session.user.roles} selfId={session.user.id} />
    </div>
  );
}
