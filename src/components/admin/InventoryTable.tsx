"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { inventoryItem, ownershipTransfer, valuationSnapshot } from "@/db/schema";
import { Button, Field, Input, Select, Textarea, Mono } from "@/components/ui/primitives";
import { ItemArt } from "@/components/art/ItemArt";
import { api } from "@/lib/client/api";
import { fmtDate, moneyStr } from "@/lib/format";
import { Drawer } from "./Drawer";
import { KV, StatusBadge } from "./ui";
import { describeError, useAction } from "./hooks";
import type { Json } from "./serialize";

export type InventoryRow = Json<typeof inventoryItem.$inferSelect> & { sku: { id: string; sku: string; name: string; brand: string | null; isUnique: boolean; accent: string; imageKey: string | null; shippingRestricted: boolean; shippingRestrictionNote: string | null }; category: string };
type Detail = { item: Json<typeof inventoryItem.$inferSelect>; valuations: Json<typeof valuationSnapshot.$inferSelect>[]; history: Json<typeof ownershipTransfer.$inferSelect>[] };

export function InventoryTable({ rows, permissions }: { rows: InventoryRow[]; permissions: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === openId) ?? null;
  const close = useCallback(() => setOpenId(null), []);
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>SKU</th>
              <th>Category</th>
              <th>Grade / serial</th>
              <th>Condition</th>
              <th>Acq. cost</th>
              <th>Status</th>
              <th>Custody</th>
              <th>Reservation</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>
                  <Mono>{r.itemCode}</Mono>
                </td>
                <td>
                  <div className="flex items-center gap-2">
                    <ItemArt name={r.sku.name} accent={r.sku.accent} imageKey={r.sku.imageKey} size="sm" />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-ink-100">{r.sku.name}</div>
                      <div className="text-xs text-ink-400">
                        {r.sku.sku}
                        {r.sku.shippingRestricted && <span className="ml-1 text-amber-400">· ship restricted</span>}
                      </div>
                    </div>
                  </div>
                </td>
                <td>{r.category}</td>
                <td className="text-ink-200">{r.grader || r.grade ? `${r.grader ?? ""} ${r.grade ?? ""}${r.certificationId ? ` · ${r.certificationId}` : ""}` : (r.serialNumber ?? r.size ?? "—")}</td>
                <td>{r.condition.replace(/_/g, " ")}</td>
                <td>{moneyStr(r.acquisitionCostMinor)}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{r.custody.replace(/_/g, " ")}</td>
                <td className="text-xs text-ink-300">{r.reservedForType ? `${r.reservedForType} ${r.reservedForId?.slice(0, 8)}` : r.ownerUserId ? `owner ${r.ownerUserId.slice(0, 8)}` : "—"}</td>
                <td>
                  <Button tone="secondary" size="sm" className="tap" onClick={() => setOpenId(r.id)}>
                    Detail
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="text-ink-400">
                  No items match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Drawer open={!!selected} onClose={close} title={selected ? `${selected.itemCode} · ${selected.sku.name}` : ""} wide>
        {selected && <ItemDetail row={selected} permissions={permissions} />}
      </Drawer>
    </>
  );
}

function ItemDetail({ row, permissions }: { row: InventoryRow; permissions: string[] }) {
  const canWrite = permissions.includes("inventory.write");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  useEffect(() => {
    let alive = true;
    api<Detail>(`/admin/inventory/${row.id}`)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setLoadError(describeError(e)));
    return () => {
      alive = false;
    };
  }, [row.id, reloadKey]);
  const item = detail?.item ?? row;

  const edit = useAction();
  const [ef, setEf] = useState({ status: "", custody: "", notes: item.notes ?? "", reason: "" });
  async function saveEdit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { reason: ef.reason };
    if (ef.status) body.status = ef.status;
    if (ef.custody) body.custody = ef.custody;
    if (ef.notes !== (item.notes ?? "")) body.notes = ef.notes;
    await edit.run(() => api(`/admin/inventory/${row.id}`, { method: "PATCH", body }), { success: "Item updated", onSuccess: () => setReloadKey((k) => k + 1) });
  }

  const val = useAction();
  const [vf, setVf] = useState({ referenceValue: "", sellbackOffer: "", source: "manual", sourceRef: "" });
  async function saveValuation(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { inventoryItemId: row.id, skuId: row.skuId, referenceValue: vf.referenceValue, sellbackOffer: vf.sellbackOffer, source: vf.source };
    if (vf.sourceRef) body.sourceRef = vf.sourceRef;
    await val.run(() => api("/admin/valuations", { method: "POST", body }), { success: "Valuation recorded", refresh: false, onSuccess: () => setReloadKey((k) => k + 1) });
  }

  const latest = detail?.valuations[0];
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <ItemArt name={row.sku.name} accent={row.sku.accent} imageKey={row.sku.imageKey} size="md" />
        <div className="min-w-0 flex-1">
          <KV
            items={[
              ["Status", <StatusBadge key="s" status={item.status} />],
              ["Custody", item.custody.replace(/_/g, " ")],
              ["Condition", item.condition.replace(/_/g, " ")],
              ["Acquisition cost", moneyStr(item.acquisitionCostMinor)],
              ["Latest reference", latest ? moneyStr(latest.referenceValueMinor) : "—"],
              ["Latest sell-back", latest ? moneyStr(latest.sellbackOfferMinor) : "—"],
              ["Grader / grade", item.grader || item.grade ? `${item.grader ?? ""} ${item.grade ?? ""}` : "—"],
              ["Cert / serial", item.certificationId ?? item.serialNumber ?? "—"],
              ["Reserved for", item.reservedForType ? `${item.reservedForType} ${item.reservedForId}` : "—"],
              ["Owner", item.ownerUserId ?? "Platform"],
              ["Shipping", row.sku.shippingRestricted ? `Restricted — ${row.sku.shippingRestrictionNote ?? "see SKU"}` : "Eligible"],
            ]}
          />
        </div>
      </div>
      {loadError && (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      )}

      <section aria-labelledby="val-hist">
        <h3 id="val-hist" className="font-display mb-2 text-base font-bold">
          Valuation history
        </h3>
        <div className="table-wrap">
          <table className="!min-w-0">
            <thead>
              <tr>
                <th>Observed</th>
                <th>Reference</th>
                <th>Sell-back</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {(detail?.valuations ?? []).map((v) => (
                <tr key={v.id}>
                  <td>{fmtDate(v.observedAt)}</td>
                  <td>{moneyStr(v.referenceValueMinor)}</td>
                  <td>{moneyStr(v.sellbackOfferMinor)}</td>
                  <td className="text-xs text-ink-300">
                    {v.source}
                    {v.sourceRef ? ` · ${v.sourceRef}` : ""}
                  </td>
                </tr>
              ))}
              {detail && detail.valuations.length === 0 && (
                <tr>
                  <td colSpan={4} className="text-ink-400">
                    No valuations recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="own-hist">
        <h3 id="own-hist" className="font-display mb-2 text-base font-bold">
          Ownership history
        </h3>
        <div className="table-wrap">
          <table className="!min-w-0">
            <thead>
              <tr>
                <th>When</th>
                <th>From</th>
                <th>To</th>
                <th>Reason</th>
                <th>Ref</th>
              </tr>
            </thead>
            <tbody>
              {(detail?.history ?? []).map((h) => (
                <tr key={h.id}>
                  <td>{fmtDate(h.createdAt)}</td>
                  <td className="text-xs">{h.fromUserId ?? "Platform"}</td>
                  <td className="text-xs">{h.toUserId ?? "Platform"}</td>
                  <td>{h.reason.replace(/_/g, " ")}</td>
                  <td className="text-xs text-ink-300">{h.referenceType ? `${h.referenceType} ${h.referenceId?.slice(0, 8)}` : "—"}</td>
                </tr>
              ))}
              {detail && detail.history.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-ink-400">
                    Never transferred.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {canWrite && (
        <form onSubmit={saveEdit} className="glass space-y-3 p-4" aria-labelledby="edit-title">
          <h3 id="edit-title" className="font-display text-base font-bold">
            Update status / custody / notes
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Status" hint="Only INTAKE, IN_STOCK or RETURNED items can change status">
              <Select value={ef.status} onChange={(e) => setEf((s) => ({ ...s, status: e.target.value }))}>
                <option value="">Unchanged</option>
                {["INTAKE", "IN_STOCK", "RETIRED", "LOST"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Custody">
              <Select value={ef.custody} onChange={(e) => setEf((s) => ({ ...s, custody: e.target.value }))}>
                <option value="">Unchanged</option>
                {["WAREHOUSE", "IN_TRANSIT", "DELIVERED", "THIRD_PARTY"].map((s) => (
                  <option key={s} value={s}>
                    {s.replace(/_/g, " ")}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea value={ef.notes} onChange={(e) => setEf((s) => ({ ...s, notes: e.target.value }))} className="min-h-16" />
          </Field>
          <Field label="Reason" hint="Recorded in the audit log" error={edit.error}>
            <Input required minLength={3} value={ef.reason} onChange={(e) => setEf((s) => ({ ...s, reason: e.target.value }))} />
          </Field>
          <Button type="submit" tone="secondary" disabled={edit.busy}>
            {edit.busy ? "Saving…" : "Save changes"}
          </Button>
        </form>
      )}

      {canWrite && (
        <form onSubmit={saveValuation} className="glass space-y-3 p-4" aria-labelledby="val-title">
          <h3 id="val-title" className="font-display text-base font-bold">
            Record valuation
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Reference value">
              <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={vf.referenceValue} onChange={(e) => setVf((s) => ({ ...s, referenceValue: e.target.value }))} placeholder="0.00" />
            </Field>
            <Field label="Sell-back offer">
              <Input required inputMode="decimal" pattern="^\d+(\.\d{1,2})?$" value={vf.sellbackOffer} onChange={(e) => setVf((s) => ({ ...s, sellbackOffer: e.target.value }))} placeholder="0.00" />
            </Field>
            <Field label="Source">
              <Input required value={vf.source} onChange={(e) => setVf((s) => ({ ...s, source: e.target.value }))} />
            </Field>
            <Field label="Source ref" error={val.error}>
              <Input value={vf.sourceRef} onChange={(e) => setVf((s) => ({ ...s, sourceRef: e.target.value }))} />
            </Field>
          </div>
          <Button type="submit" tone="secondary" disabled={val.busy}>
            {val.busy ? "Saving…" : "Record valuation"}
          </Button>
        </form>
      )}
    </div>
  );
}
