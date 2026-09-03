"use client";
/** Accessible dialog built on the native <dialog>: focus containment, Escape to close, bottom sheet on mobile. */
import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cx } from "@/components/ui/primitives";

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-labelledby={`${title.replace(/\s+/g, "-")}-title`}
      className={cx(
        "glass glass-strong m-0 mt-auto w-full max-w-none rounded-t-2xl rounded-b-none p-0 text-ink-100 backdrop:bg-ink-950/70 backdrop:backdrop-blur-sm",
        "md:m-auto md:rounded-2xl",
        wide ? "md:max-w-3xl" : "md:max-w-lg",
      )}
    >
      <div className="flex max-h-[85dvh] flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-white/8 px-4 py-3 md:px-5">
          <h2 id={`${title.replace(/\s+/g, "-")}-title`} className="font-display text-lg font-bold">
            {title}
          </h2>
          <button type="button" onClick={onClose} className="tap inline-flex items-center justify-center rounded-xl text-ink-300 hover:bg-white/8" aria-label="Close dialog">
            <X size={18} aria-hidden />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-4 md:px-5">{children}</div>
      </div>
    </dialog>
  );
}
