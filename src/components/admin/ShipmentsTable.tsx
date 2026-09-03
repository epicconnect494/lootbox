"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { shipment } from "@/db/schema";
import { Badge, Button, Field, Input, Mono, Select, Textarea } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";
import { fmtDate, moneyStr } from "@/lib/format";
import { Drawer } from "./Drawer";
import { describeError, useAction } from "./hooks";
import { KV, Notice, StatusBadge } from "./ui";
import type { Json } from "./serialize";

export type ShipmentRow = Json<Omit<typeof shipment.$inferSelect, "addressEncrypted">> & { item: { itemCode: string; status: string }; sku: { name: string }; userEmail: string };
type Address = { name: string; line1: string; line2?: string; city: string; region?: string; postalCode: string; country: string; phone?: string };
type Detail = { shipment: Json<Omit<typeof shipment.$inferSelect, "addressEncrypted">> & { address: Address } };

const TRANSITIONS: Record<string, string[]> = {
  REQUESTED: ["ADDRESS_VERIFIED", "CANCELLED"],
  ADDRESS_VERIFIED: ["PACKED", "CANCELLED"],
  PACKED: ["SHIPPED", "CANCELLED"],
  SHIPPED: ["DELIVERED", "RETURNED", "DISPUTED"],
  DELIVERED: ["DISPUTED", "RETURNED"],
  DISPUTED: ["DELIVERED", "RETURNED"],
};

export function ShipmentsTable({ rows, permissions }: { rows: ShipmentRow[]; permissions: string[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const selected = rows.find((r) => r.id === openId) ?? null;
  const close = useCallback(() => setOpenId(null), []);
  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Requested</th>
              <th>Item</th>
              <th>Customer</th>
              <th>Country</th>
              <th>Status</th>
              <th>Insured</th>
              <th>Carrier / tracking</th>
              <th>
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td className="whitespace-nowrap text-xs text-ink-300">{fmtDate(s.createdAt)}</td>
                <td>
                  <div className="font-medium text-ink-100">{s.sku.name}</div>
                  <div className="text-xs text-ink-400">
                    <Mono>{s.item.itemCode}</Mono> · {s.item.status}
                  </div>
                </td>
                <td className="text-xs">{s.userEmail}</td>
                <td>{s.addressCountry}</td>
                <td>
                  <StatusBadge status={s.status} />
                </td>
                <td>{s.insured ? moneyStr(s.insuredValueMinor) : "No"}</td>
                <td className="text-xs text-ink-300">{s.trackingNumber ? `${s.carrier ?? ""} ${s.trackingNumber}` : "—"}</td>
                <td>
                  <Button tone="secondary" size="sm" className="tap" onClick={() => setOpenId(s.id)}>
                    Detail
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="text-ink-400">
                  Queue is empty.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <Drawer open={!!selected} onClose={close} title={selected ? `Shipment · ${selected.item.itemCode}` : ""}>
        {selected && <ShipmentDetail row={selected} permissions={permissions} />}
      </Drawer>
    </>
  );
}

function ShipmentDetail({ row, permissions }: { row: ShipmentRow; permissions: string[] }) {
  const canWrite = permissions.includes("fulfillment.write");
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    api<Detail>(`/admin/fulfillment/${row.id}`)
      .then((d) => alive && setDetail(d))
      .catch((e) => alive && setLoadError(describeError(e)));
    return () => {
      alive = false;
    };
  }, [row.id]);
  const s = detail?.shipment ?? row;
  const next = TRANSITIONS[s.status] ?? [];
  const { run, busy, error } = useAction();
  const [f, setF] = useState({ status: "", carrier: row.carrier ?? "", trackingNumber: row.trackingNumber ?? "", notes: "", disputeReason: "" });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  const needsReason = f.status === "RETURNED" || f.status === "DISPUTED";

  async function submit(e: FormEvent) {
    e.preventDefault();
    const body: Record<string, unknown> = { status: f.status };
    if (f.carrier) body.carrier = f.carrier;
    if (f.trackingNumber) body.trackingNumber = f.trackingNumber;
    if (f.notes) body.notes = f.notes;
    if (f.disputeReason) body.disputeReason = f.disputeReason;
    await run(() => api(`/admin/fulfillment/${row.id}`, { method: "PATCH", body }), { success: `Shipment ${f.status.toLowerCase().replace(/_/g, " ")}` });
  }

  const a = detail?.shipment.address;
  return (
    <div className="space-y-5">
      <Notice tone="warn">Viewing the decrypted address is recorded in the audit log.</Notice>
      <KV
        items={[
          ["Status", <StatusBadge key="s" status={s.status} />],
          ["Item", `${row.sku.name} (${row.item.itemCode})`],
          ["Customer", row.userEmail],
          ["Insurance", s.insured ? `Insured for ${moneyStr(s.insuredValueMinor)}` : "Not insured"],
          ["Shipping fee", moneyStr(s.shippingFeeMinor)],
          ["Address verified", s.addressVerified ? "Yes" : "No"],
          ["Carrier", s.carrier ?? "—"],
          ["Tracking", s.trackingNumber ?? "—"],
          ["Shipped", fmtDate(s.shippedAt)],
          ["Delivered", fmtDate(s.deliveredAt)],
          ["Dispute", s.disputeReason ?? "—"],
          ["Notes", s.notes ?? "—"],
        ]}
      />
      {loadError && (
        <p role="alert" className="text-sm text-danger">
          {loadError}
        </p>
      )}
      {a && (
        <address className="glass not-italic p-4 text-sm leading-relaxed">
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Ship to</div>
          <div className="font-semibold text-ink-100">{a.name}</div>
          <div>{a.line1}</div>
          {a.line2 && <div>{a.line2}</div>}
          <div>
            {a.city}
            {a.region ? `, ${a.region}` : ""} {a.postalCode}
          </div>
          <div>{a.country}</div>
          {a.phone && <div className="text-ink-300">{a.phone}</div>}
        </address>
      )}
      {canWrite && next.length > 0 && (
        <form onSubmit={submit} className="glass space-y-3 p-4">
          <h3 className="font-display text-base font-bold">Update status</h3>
          <p className="text-xs text-ink-400">Flow: address verified → packed → shipped (carrier + tracking) → delivered. Returned / disputed require a reason; cancelled returns the item to the vault.</p>
          <Field label="New status">
            <Select required value={f.status} onChange={set("status")}>
              <option value="">Select…</option>
              {next.map((n) => (
                <option key={n} value={n}>
                  {n.replace(/_/g, " ")}
                </option>
              ))}
            </Select>
          </Field>
          {f.status === "SHIPPED" && (
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Carrier">
                <Input required maxLength={32} value={f.carrier} onChange={set("carrier")} placeholder="UPS" />
              </Field>
              <Field label="Tracking number">
                <Input required maxLength={96} value={f.trackingNumber} onChange={set("trackingNumber")} />
              </Field>
            </div>
          )}
          {needsReason && (
            <Field label="Reason">
              <Textarea required value={f.disputeReason} onChange={set("disputeReason")} className="min-h-16" />
            </Field>
          )}
          <Field label="Notes" error={error}>
            <Textarea value={f.notes} onChange={set("notes")} className="min-h-16" />
          </Field>
          <Button type="submit" tone={f.status === "CANCELLED" || needsReason ? "danger" : "primary"} disabled={busy || !f.status}>
            {busy ? "Saving…" : "Apply transition"}
          </Button>
        </form>
      )}
      {canWrite && next.length === 0 && (
        <p className="text-sm text-ink-400">
          <Badge tone="neutral">{s.status}</Badge> is terminal.
        </p>
      )}
    </div>
  );
}
