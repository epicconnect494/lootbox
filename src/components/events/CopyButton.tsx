"use client";
import { useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function CopyButton({ text, label = "Copy", size = "sm" }: { text: string; label?: string; size?: "sm" | "md" }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      type="button"
      tone="secondary"
      size={size}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setOk(true);
          setTimeout(() => setOk(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
      aria-live="polite"
    >
      {ok ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {ok ? "Copied" : label}
    </Button>
  );
}

export function DownloadButton({ text, filename, label = "Download" }: { text: string; filename: string; label?: string }) {
  return (
    <Button
      type="button"
      tone="secondary"
      size="sm"
      onClick={() => {
        const blob = new Blob([text], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}
    >
      <Download size={14} aria-hidden /> {label}
    </Button>
  );
}
