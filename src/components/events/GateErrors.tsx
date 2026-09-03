"use client";
import Link from "next/link";
import { ApiError } from "@/lib/client/api";
import { accountLinkForReason } from "./json-types";

export type GateReason = { code: string; message: string };

/** Pulls the structured gate reasons out of an ApiError (GATE_BLOCKED / LIMIT_EXCEEDED). */
export function gateReasons(e: unknown): GateReason[] {
  if (!(e instanceof ApiError)) return [];
  const d = e.details as { reasons?: GateReason[] } | null | undefined;
  if (d && Array.isArray(d.reasons)) return d.reasons;
  if (e.code === "INSUFFICIENT_FUNDS") return [{ code: "INSUFFICIENT_FUNDS", message: e.message }];
  return [];
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}

export function GateErrors({ reasons, title = "You cannot do this yet" }: { reasons: GateReason[]; title?: string }) {
  if (!reasons.length) return null;
  return (
    <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">
      <div className="font-semibold text-danger">{title}</div>
      <ul className="mt-2 space-y-1.5">
        {reasons.map((r) => (
          <li key={r.code} className="flex flex-wrap items-center justify-between gap-2 text-ink-200">
            <span>{r.message}</span>
            <Link href={r.code === "INSUFFICIENT_FUNDS" ? "/account#wallet" : accountLinkForReason(r.code)} className="tap inline-flex items-center rounded-lg px-2 text-xs font-semibold text-cyan-300 underline-offset-2 hover:underline">
              Fix in Account
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
