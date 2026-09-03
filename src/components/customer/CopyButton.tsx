"use client";
import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cx } from "@/components/ui/primitives";

export function CopyButton({ value, label, className }: { value: string; label: string; className?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable: nothing to do */
        }
      }}
      className={cx("tap inline-flex shrink-0 items-center justify-center rounded-lg text-ink-300 hover:bg-white/8 hover:text-ink-100", className)}
      aria-label={done ? `${label} copied` : `Copy ${label}`}
    >
      {done ? <Check size={16} aria-hidden className="text-lime-400" /> : <Copy size={16} aria-hidden />}
      <span className="sr-only" aria-live="polite">
        {done ? "Copied" : ""}
      </span>
    </button>
  );
}
