"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function NavLink({ href, label, icon, variant }: { href: string; label: string; icon: ReactNode; variant: "side" | "bottom" }) {
  const path = usePathname();
  const active = href === "/" ? path === "/" : path.startsWith(href);
  if (variant === "bottom") {
    return (
      <Link href={href} aria-current={active ? "page" : undefined} className={`tap flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold ${active ? "text-cyan-300" : "text-ink-400"}`}>
        <span className={active ? "rounded-full bg-cyan-400/15 px-3 py-0.5" : "px-3 py-0.5"}>{icon}</span>
        {label}
      </Link>
    );
  }
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={`tap flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active ? "bg-white/8 text-ink-100 shadow-[inset_2px_0_0_0_#22d3ee]" : "text-ink-300 hover:bg-white/5 hover:text-ink-100"}`}>
      {icon}
      {label}
    </Link>
  );
}
