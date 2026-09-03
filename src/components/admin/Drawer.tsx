"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/primitives";

/** Right-hand detail drawer: modal dialog, Escape closes, focus moves inside on open. */
export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      prev?.focus?.();
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex justify-end">
      <button type="button" aria-label="Close drawer" className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm" onClick={onClose} />
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Details"} className={`glass glass-strong rise relative flex h-full w-full flex-col overflow-hidden border-l border-white/10 ${wide ? "md:max-w-3xl" : "md:max-w-xl"}`} style={{ borderRadius: 0 }}>
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
          <div className="font-display min-w-0 truncate text-lg font-bold">{title}</div>
          <Button tone="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X size={18} aria-hidden />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}
