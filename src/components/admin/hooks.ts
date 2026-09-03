"use client";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError } from "@/lib/client/api";
import { useToast } from "@/components/ui/toast";

export function describeError(e: unknown): string {
  if (e instanceof ApiError) {
    const details = e.details as { errors?: string[]; reasons?: string[] } | undefined;
    const extra = details?.errors ?? details?.reasons;
    return extra?.length ? `${e.message}: ${extra.join("; ")}` : e.message;
  }
  return e instanceof Error ? e.message : "Something went wrong";
}

/**
 * Wraps a mutation: tracks busy state, surfaces ApiError messages via toast and inline, and refreshes server data on success.
 */
export function useAction() {
  const router = useRouter();
  const { push } = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async <T,>(fn: () => Promise<T>, opts: { success?: string; refresh?: boolean; onSuccess?: (r: T) => void } = {}): Promise<T | null> => {
      setBusy(true);
      setError(null);
      try {
        const r = await fn();
        if (opts.success) push({ title: opts.success, tone: "success" });
        if (opts.refresh !== false) router.refresh();
        opts.onSuccess?.(r);
        return r;
      } catch (e) {
        const msg = describeError(e);
        setError(msg);
        push({ title: "Action failed", body: msg, tone: "error" });
        return null;
      } finally {
        setBusy(false);
      }
    },
    [push, router],
  );
  return { run, busy, error, setError };
}
