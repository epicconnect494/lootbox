"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { battle } from "@/db/schema";
import type { getBattleView } from "@/domain/battles";
import { Badge, Button, CrazyBanner, Field, Input, Mono } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDate, moneyStr, shortHash } from "@/lib/format";
import { Drawer } from "./Drawer";
import { describeError, useAction } from "./hooks";
import { JsonBlock, KV, ModeBadge, Notice, StatusBadge } from "./ui";
import type { Json } from "./serialize";

export type BattleRow = Json<typeof battle.$inferSelect>;
type View = Json<NonNullable<Awaited<ReturnType<typeof getBattleView>>>>;
type Receipts = { battleId: string; serverSeedHash: string | null; revealed: boolean; allValid: boolean; pulls: Array<{ pullIndex: number; openingId: string; nonce: number; signatureValid: boolean; recomputationOk: boolean | null; digest: string }>; tieBreak: unknown };

export function BattlesTable({ rows, permissions }: { rows: BattleRow[]; permissions: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === openId) ?? null;
  const close = useCallback(() => setOpenId(null), []);
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Mode</th>
              <th>Status</th>
              <th>Seats</th>
              <th>Entry</th>
              <th>Packs</th>
              <th>Created</th>
              <th>Winners</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id}>
                <td>
                  <Mono>{b.code}</Mono>
                  {b.isPrivate && <Badge tone="neutral" className="ml-1">private</Badge>}
                </td>
                <td>
                  <ModeBadge mode={b.mode} />
                </td>
                <td>
                  <StatusBadge status={b.status} />
                </td>
                <td>{b.seats}</td>
                <td>{moneyStr(b.entryCostMinor)}</td>
                <td>{b.packVersionIds.length}</td>
                <td className="whitespace-nowrap text-xs text-ink-300">{fmtDate(b.createdAt)}</td>
                <td className="text-xs text-ink-300">{b.winnerUserIds.length ? b.winnerUserIds.map((w) => w.slice(0, 8)).join(", ") : "—"}</td>
                <td>
                  <Button tone="secondary" size="sm" className="tap" onClick={() => setOpenId(b.id)}>
                    Detail
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="text-ink-400">
                  No battles yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Drawer open={!!selected} onClose={close} title={selected ? `Battle ${selected.code}` : ""} wide>
        {selected && <BattleDetail row={selected} permissions={permissions} />}
      </Drawer>
    </>
  );
}

function BattleDetail({ row, permissions }: { row: BattleRow; permissions: string[] }) {
  const [view, setView] = useState<View | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [receipts, setReceipts] = useState<Receipts | null>(null);
  const [receiptsError, setReceiptsError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const voidAction = useAction();
  const [reason, setReason] = useState("");
  const [showVoid, setShowVoid] = useState(false);
  const canVoid = permissions.includes("battles.void") && (row.status === "OPEN" || row.status === "SETTLED");

  useEffect(() => {
    let alive = true;
    api<View>(`/battles/${row.id}`)
      .then((v) => alive && setView(v))
      .catch((e) => alive && setLoadError(describeError(e)));
    return () => {
      alive = false;
    };
  }, [row.id]);

  async function verify() {
    setChecking(true);
    setReceiptsError(null);
    try {
      setReceipts(await api<Receipts>(`/admin/battles/${row.id}/receipts`));
    } catch (e) {
      setReceiptsError(describeError(e));
    } finally {
      setChecking(false);
    }
  }

  async function doVoid(e: FormEvent) {
    e.preventDefault();
    await voidAction.run(() => api(`/admin/battles/${row.id}/void`, { method: "POST", body: { reason } }), { success: "Battle voided and entries refunded", onSuccess: () => setShowVoid(false) });
  }

  return (
    <div className="space-y-5">
      {row.mode === "CRAZY" && <CrazyBanner compact />}
      <KV
        items={[
          ["Status", <StatusBadge key="s" status={row.status} />],
          ["Mode", <ModeBadge key="m" mode={row.mode} />],
          ["Entry", moneyStr(row.entryCostMinor)],
          ["Seats", String(row.seats)],
          ["Started", fmtDate(row.startedAt)],
          ["Settled", fmtDate(row.settledAt)],
          ["Server seed hash", <Mono key="h">{row.serverSeedHash ?? "—"}</Mono>],
          ["Combined client seed", <Mono key="c">{shortHash(row.combinedClientSeed, 12)}</Mono>],
          ...(row.voidedAt ? ([["Voided", `${fmtDate(row.voidedAt)} — ${row.voidReason ?? ""}`]] as Array<[string, string]>) : []),
        ]}
      />
      {loadError && (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      )}
      {view && (
        <>
          <section>
            <h3 className="font-display mb-2 text-base font-bold">Sequence</h3>
            <ol className="flex flex-wrap gap-2 text-sm">
              {view.sequence.map((s, i) => (
                <li key={`${s.packVersionId}-${i}`} className="rounded-lg border border-white/10 px-2 py-1">
                  {i + 1}. {s.name} <span className="text-ink-400">{moneyStr(s.priceMinor)}</span>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h3 className="font-display mb-2 text-base font-bold">Seats</h3>
            <div className="table-wrap">
              <table className="!min-w-0">
                <thead>
                  <tr>
                    <th>Seat</th>
                    <th>Player</th>
                    <th>Total</th>
                    <th>Rank</th>
                    <th>Awarded</th>
                  </tr>
                </thead>
                <tbody>
                  {view.seats.map((s) => (
                    <tr key={s.id}>
                      <td>{s.seatIndex + 1}</td>
                      <td>
                        {s.displayName} <span className="text-xs text-ink-400">{s.userId.slice(0, 8)}</span>
                      </td>
                      <td>{moneyStr(s.totalValueMinor)}</td>
                      <td>{s.finalRank ?? "—"}</td>
                      <td>{s.awardedValueMinor ? moneyStr(s.awardedValueMinor) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h3 className="font-display mb-2 text-base font-bold">Pulls</h3>
            <div className="table-wrap">
              <table className="!min-w-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Seat</th>
                    <th>Outcome</th>
                    <th>Value</th>
                    <th>Running</th>
                  </tr>
                </thead>
                <tbody>
                  {view.pulls.map((p) => (
                    <tr key={p.id}>
                      <td>{p.pullIndex}</td>
                      <td>{(view.seats.find((s) => s.id === p.seatId)?.seatIndex ?? 0) + 1}</td>
                      <td>
                        {p.outcome.label} <Badge tone="neutral">{p.outcome.tier}</Badge>
                      </td>
                      <td>{moneyStr(p.valueMinor)}</td>
                      <td>{moneyStr(p.runningTotalMinor)}</td>
                    </tr>
                  ))}
                  {view.pulls.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-ink-400">
                        No pulls yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <section className="glass p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-display text-base font-bold">Receipts</h3>
          <Button tone="secondary" size="sm" className="tap" onClick={verify} disabled={checking}>
            {checking ? "Verifying…" : "Verify receipts"}
          </Button>
        </div>
        <p className="mt-1 text-xs text-ink-400">Checks every pull&apos;s signature and, once the battle seed is revealed, recomputes the draw from the commitment.</p>
        {receiptsError && (
          <p role="alert" className="mt-2 text-sm text-danger">
            {receiptsError}
          </p>
        )}
        {receipts && (
          <div className="mt-3 space-y-3" aria-live="polite">
            {receipts.allValid && receipts.revealed ? <Notice tone="ok">All {receipts.pulls.length} receipts verified: signatures valid and draws recompute.</Notice> : receipts.allValid ? <Notice tone="warn">Signatures valid; seed not yet revealed so draws cannot be recomputed.</Notice> : <Notice tone="danger">One or more receipts failed verification.</Notice>}
            <div className="table-wrap">
              <table className="!min-w-0">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Nonce</th>
                    <th>Signature</th>
                    <th>Recomputation</th>
                    <th>Digest</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.pulls.map((p) => (
                    <tr key={p.openingId}>
                      <td>{p.pullIndex}</td>
                      <td>{p.nonce}</td>
                      <td>{p.signatureValid ? <Badge tone="lime">valid</Badge> : <Badge tone="danger">invalid</Badge>}</td>
                      <td>{p.recomputationOk === null ? <Badge tone="neutral">seed sealed</Badge> : p.recomputationOk ? <Badge tone="lime">match</Badge> : <Badge tone="danger">mismatch</Badge>}</td>
                      <td>
                        <Mono>{shortHash(p.digest, 8)}</Mono>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {receipts.tieBreak != null && <JsonBlock value={receipts.tieBreak} label="Tie-break receipt" />}
          </div>
        )}
      </section>

      {canVoid && (
        <section className="glass border-danger/30 p-4">
          <h3 className="font-display text-base font-bold">Void battle</h3>
          <p className="mt-1 text-xs text-ink-400">Policy: only OPEN battles, or SETTLED battles whose items are all still in vaults, can be voided. Voiding refunds every entry, returns items to stock and reverses race points. This is audited.</p>
          {!showVoid ? (
            <Button tone="danger" className="mt-3" onClick={() => setShowVoid(true)}>
              Void…
            </Button>
          ) : (
            <form onSubmit={doVoid} className="mt-3 space-y-3">
              <Field label="Reason" hint="At least 10 characters" error={voidAction.error}>
                <Input required minLength={10} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
              <div className="flex gap-2">
                <Button type="submit" tone="danger" disabled={voidAction.busy}>
                  {voidAction.busy ? "Voiding…" : "Confirm void"}
                </Button>
                <Button type="button" tone="ghost" onClick={() => setShowVoid(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </section>
      )}
    </div>
  );
}
