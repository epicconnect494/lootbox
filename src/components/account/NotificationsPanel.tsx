"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckCheck } from "lucide-react";
import { Badge, Button, cx } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { relative } from "@/lib/format";
import { errorMessage } from "@/components/events/GateErrors";
import type { AccountOverview } from "./types";

export function NotificationsPanel({ notifications }: { notifications: AccountOverview["notifications"] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unread = notifications.filter((n) => !n.readAt);

  async function markRead(ids?: string[]) {
    setBusy(ids?.[0] ?? "all");
    setError(null);
    try {
      await api("/account/notifications", { method: "POST", body: ids ? { ids } : {} });
      router.refresh();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-ink-400" aria-live="polite">
          {unread.length} unread
        </span>
        {unread.length > 0 && (
          <Button size="sm" tone="secondary" onClick={() => void markRead()} disabled={busy !== null}>
            <CheckCheck size={14} aria-hidden /> Mark all read
          </Button>
        )}
      </div>
      {notifications.length === 0 ? (
        <p className="text-sm text-ink-400">No notifications yet.</p>
      ) : (
        <ul className="divide-y divide-white/6">
          {notifications.map((n) => (
            <li key={n.id} className={cx("flex items-start gap-3 py-2.5", !n.readAt && "bg-white/[0.02]")}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{n.kind.toLowerCase()}</Badge>
                  <span className={cx("text-sm font-semibold", n.readAt ? "text-ink-300" : "text-ink-100")}>{n.title}</span>
                  {!n.readAt && <span className="h-2 w-2 rounded-full bg-cyan-400" aria-label="Unread" />}
                </div>
                <p className="text-sm text-ink-300">{n.body}</p>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-500">
                  <span>{relative(n.createdAt)}</span>
                  {n.href && (
                    <Link href={n.href} className="text-cyan-300 hover:underline">
                      Open
                    </Link>
                  )}
                </div>
              </div>
              {!n.readAt && (
                <button type="button" onClick={() => void markRead([n.id])} disabled={busy !== null} className="tap inline-flex items-center justify-center rounded-lg text-ink-300 hover:bg-white/8" aria-label={`Mark "${n.title}" read`}>
                  <Check size={16} aria-hidden />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
