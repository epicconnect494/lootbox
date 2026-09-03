import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OpeningReveal } from "@/components/customer/OpeningReveal";
import { serialize } from "@/components/customer/serialize";
import { getOpeningView } from "@/domain/openings";
import { fmtDate, moneyStr } from "@/lib/format";
import { viewer } from "@/lib/server/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "Opening" };

export default async function OpeningPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db, session, userId } = await viewer();
  if (!session) redirect(`/login?next=${encodeURIComponent(`/openings/${id}`)}`);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const raw = await getOpeningView(db, id, userId);
  if (!raw) notFound();
  const view = serialize(raw);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">Opening</div>
          <h1 className="font-display text-xl font-extrabold text-ink-100 md:text-2xl">
            <Link href={`/packs/${view.pack.slug}`} className="hover:text-cyan-300">
              {view.pack.name}
            </Link>{" "}
            <span className="text-ink-400">v{view.pack.version}</span>
          </h1>
        </div>
        <p className="text-xs text-ink-400">
          {fmtDate(view.opening.createdAt)} · paid {moneyStr(view.opening.priceMinor, view.opening.currency)}
          {view.opening.source !== "DIRECT" ? ` · ${view.opening.source.toLowerCase()}` : ""}
        </p>
      </header>
      {view.opening.status === "VOIDED" && (
        <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
          This opening was voided{view.opening.voidReason ? `: ${view.opening.voidReason}` : "."}
        </p>
      )}
      <OpeningReveal view={view} />
      <p className="text-center text-xs text-ink-500">The result was settled and signed before this page loaded. Refreshing never re-draws.</p>
    </div>
  );
}
