"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, LogOut, ShieldHalf } from "lucide-react";
import { api } from "@/lib/client/api";
import { useEffect, useState } from "react";

export function HeaderActions({ user, balance }: { user: { displayName: string; isAdmin: boolean } | null; balance: string | null }) {
  const router = useRouter();
  const [unread, setUnread] = useState(0);
  useEffect(() => {
    if (!user) return;
    api<{ unread: number }>("/account/notifications").then((r) => setUnread(r.unread)).catch(() => undefined);
  }, [user]);
  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/login" className="tap inline-flex items-center rounded-xl px-3 text-sm font-semibold text-ink-200 hover:bg-white/5">
          Sign in
        </Link>
        <Link href="/register" className="tap inline-flex items-center rounded-xl bg-gradient-to-r from-violet-500 to-cyan-500 px-4 text-sm font-semibold text-ink-950">
          Create account
        </Link>
      </div>
    );
  }
  return (
    <div className="flex min-w-0 shrink-0 items-center gap-0.5 md:gap-2">
      <Link href="/account#wallet" className="glass glass-strong tap flex items-center gap-2 rounded-xl px-2.5 text-sm font-semibold md:px-3" aria-label={`Balance ${balance}`}>
        <span className="hidden text-ink-400 md:inline">Balance</span>
        <span className="font-mono text-ink-100">{balance}</span>
      </Link>
      <Link href="/account#notifications" className="tap relative inline-flex items-center justify-center rounded-xl text-ink-300 hover:bg-white/5" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell size={18} aria-hidden />
        {unread > 0 && <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-lime-400" aria-hidden />}
      </Link>
      {user.isAdmin && (
        <Link href="/admin" className="tap hidden items-center gap-1 rounded-xl px-3 text-sm font-semibold text-violet-300 hover:bg-white/5 md:inline-flex">
          <ShieldHalf size={16} aria-hidden /> Admin
        </Link>
      )}
      <button
        type="button"
        onClick={async () => {
          await api("/auth/logout", { method: "POST" });
          router.push("/");
          router.refresh();
        }}
        className="tap inline-flex items-center justify-center rounded-xl text-ink-300 hover:bg-white/5"
        aria-label="Sign out"
      >
        <LogOut size={18} aria-hidden />
      </button>
    </div>
  );
}
