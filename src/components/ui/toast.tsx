"use client";
import { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = { id: number; title: string; body?: string; tone?: "default" | "success" | "error" | "crazy" };
const Ctx = createContext<{ push: (t: Omit<Toast, "id">) => void }>({ push: () => undefined });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s, { ...t, id }]);
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), 5000);
  }, []);
  const value = useMemo(() => ({ push }), [push]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div aria-live="polite" aria-atomic="false" className="pointer-events-none fixed inset-x-3 bottom-24 z-[90] flex flex-col items-center gap-2 md:inset-x-auto md:right-6 md:bottom-6 md:items-end">
        {items.map((t) => (
          <div key={t.id} role="status" className={`glass glass-strong rise pointer-events-auto w-full max-w-sm px-4 py-3 text-sm ${t.tone === "success" ? "border-lime-400/40" : t.tone === "error" ? "border-danger/50" : t.tone === "crazy" ? "border-crazy-500/50" : ""}`}>
            <div className="font-semibold">{t.title}</div>
            {t.body && <div className="mt-0.5 text-ink-300">{t.body}</div>}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
