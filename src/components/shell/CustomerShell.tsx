import Link from "next/link";
import { Compass, Zap, Swords, Vault, UserRound, Trophy, Ticket, ShieldCheck, Store } from "lucide-react";
import { getSession } from "@/lib/auth";
import { getDb } from "@/db/client";
import { getUserBalance } from "@/domain/ledger";
import { moneyStr } from "@/lib/format";
import { NavLink } from "./NavLink";
import { HeaderActions } from "./HeaderActions";

const PRIMARY = [
  { href: "/", label: "Discover", icon: Compass },
  { href: "/drops", label: "Drops", icon: Zap },
  { href: "/battles", label: "Battle", icon: Swords },
  { href: "/vault", label: "Vault", icon: Vault },
  { href: "/account", label: "Account", icon: UserRound },
];
const SECONDARY = [
  { href: "/race", label: "Weekly Race", icon: Trophy },
  { href: "/raffles", label: "Raffles", icon: Ticket },
  { href: "/marketplace", label: "Marketplace", icon: Store },
  { href: "/fairness", label: "Fairness", icon: ShieldCheck },
];

export async function CustomerShell({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  const balance = session ? await getUserBalance(getDb(), session.user.id) : null;
  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/8 bg-ink-950/70 px-4 py-6 backdrop-blur md:flex" aria-label="Primary">
        <Link href="/" className="font-display mb-8 flex items-center gap-2 px-2 text-xl font-extrabold tracking-tight">
          <span className="inline-block h-6 w-6 rounded-md bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[var(--shadow-glow-violet)]" aria-hidden />
          <span>
            Lootbox <span className="text-iris">Vault</span>
          </span>
        </Link>
        <nav className="flex flex-col gap-1">
          {PRIMARY.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} icon={<n.icon size={18} aria-hidden />} variant="side" />
          ))}
          <div className="mt-4 mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-ink-500">More</div>
          {SECONDARY.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} icon={<n.icon size={18} aria-hidden />} variant="side" />
          ))}
        </nav>
        <div className="mt-auto px-2 text-[11px] leading-relaxed text-ink-500">
          Demo environment. No jurisdiction is legally approved by default; paid features are gated per region. 18+ where enabled.
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-white/8 bg-ink-950/75 px-4 backdrop-blur md:h-16 md:px-8">
          <Link href="/" className="font-display flex items-center gap-2 text-lg font-extrabold md:hidden">
            <span className="inline-block h-5 w-5 rounded-md bg-gradient-to-br from-violet-500 to-cyan-400" aria-hidden />
            Lootbox <span className="text-iris">Vault</span>
          </Link>
          <div className="hidden text-sm text-ink-400 md:block">Authenticated collectibles · disclosed odds · provably fair</div>
          <HeaderActions user={session ? { displayName: session.user.displayName, isAdmin: session.user.permissions.has("admin.access") } : null} balance={balance ? moneyStr(balance.cashMinor) : null} />
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 pt-4 pb-28 md:px-8 md:pt-6 md:pb-12">
          {children}
        </main>
        {/* Mobile bottom navigation */}
        <nav aria-label="Primary" className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink-950/90 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
          <ul className="grid grid-cols-5">
            {PRIMARY.map((n) => (
              <li key={n.href}>
                <NavLink href={n.href} label={n.label} icon={<n.icon size={20} aria-hidden />} variant="bottom" />
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}
