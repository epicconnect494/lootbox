import Link from "next/link";
import { redirect } from "next/navigation";
import { LayoutDashboard, Boxes, Package, Layers, Swords, Trophy, Ticket, Truck, Store, Users, Landmark, ScrollText, ArrowLeft } from "lucide-react";
import { getSession } from "@/lib/auth";
import { NavLink } from "./NavLink";
import type { Permission } from "@/lib/permissions";

const NAV: Array<{ href: string; label: string; icon: typeof LayoutDashboard; permission?: Permission }> = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/inventory", label: "Inventory", icon: Boxes, permission: "inventory.read" },
  { href: "/admin/packs", label: "Pack Builder", icon: Package, permission: "packs.read" },
  { href: "/admin/versions", label: "Pack Versions", icon: Layers, permission: "packs.read" },
  { href: "/admin/battles", label: "Battles", icon: Swords, permission: "battles.read" },
  { href: "/admin/races", label: "Race Builder", icon: Trophy, permission: "races.read" },
  { href: "/admin/raffles", label: "Raffle Builder", icon: Ticket, permission: "raffles.read" },
  { href: "/admin/fulfillment", label: "Fulfillment", icon: Truck, permission: "fulfillment.read" },
  { href: "/admin/marketplace", label: "Sell-back & Market", icon: Store, permission: "marketplace.read" },
  { href: "/admin/users", label: "Users & Risk", icon: Users, permission: "users.read" },
  { href: "/admin/finance", label: "Finance", icon: Landmark, permission: "finance.read" },
  { href: "/admin/audit", label: "Audit", icon: ScrollText, permission: "audit.read" },
];

export async function requireAdmin(permission?: Permission) {
  const session = await getSession();
  if (!session) redirect("/login?next=/admin");
  if (!session.user.permissions.has("admin.access")) redirect("/");
  if (permission && !session.user.permissions.has(permission)) redirect("/admin?denied=" + permission);
  return session;
}

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();
  const items = NAV.filter((n) => !n.permission || session.user.permissions.has(n.permission));
  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-white/8 bg-ink-950/80 px-4 py-6 md:flex" aria-label="Admin">
        <div className="font-display mb-1 px-2 text-lg font-extrabold">
          Operations <span className="text-violet-300">Console</span>
        </div>
        <div className="mb-6 px-2 text-xs text-ink-400">
          {session.user.displayName} · {session.user.roles.filter((r) => r !== "CUSTOMER").join(", ")}
        </div>
        <nav className="flex flex-col gap-0.5">
          {items.map((n) => (
            <NavLink key={n.href} href={n.href} label={n.label} icon={<n.icon size={17} aria-hidden />} variant="side" />
          ))}
        </nav>
        <Link href="/" className="tap mt-auto flex items-center gap-2 px-3 text-sm text-ink-400 hover:text-ink-100">
          <ArrowLeft size={16} aria-hidden /> Customer app
        </Link>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-3 overflow-x-auto border-b border-white/8 bg-ink-950/80 px-4 backdrop-blur md:hidden">
          <span className="font-display shrink-0 text-base font-extrabold">Ops</span>
          <nav className="flex gap-1" aria-label="Admin sections">
            {items.map((n) => (
              <Link key={n.href} href={n.href} className="tap inline-flex shrink-0 items-center rounded-lg px-2 text-xs font-semibold text-ink-300 hover:bg-white/5">
                {n.label}
              </Link>
            ))}
          </nav>
        </header>
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
