"use client";
/** Vault grid with collection filter, multi-select grouping and per-item actions. */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { FolderPlus, LayoutGrid, List } from "lucide-react";
import { ItemArt } from "@/components/art/ItemArt";
import { Badge, Button, Empty, Field, Input, ButtonLink, cx } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toast";
import { ApiError, api } from "@/lib/client/api";
import { moneyStr } from "@/lib/format";
import { Modal } from "./Modal";
import { VaultItemActions, type VaultAction } from "./VaultItemActions";
import type { VaultItem } from "./types";

const UNGROUPED = "__none__";

function statusOf(i: VaultItem): { label: string; tone: "lime" | "cyan" | "amber" | "neutral" } {
  if (i.listing) return { label: "Listed", tone: "cyan" };
  if (i.shipment || i.item.status === "SHIP_REQUESTED") return { label: "Shipping requested", tone: "amber" };
  if (i.item.status === "SHIPPED") return { label: "Shipped", tone: "amber" };
  if (i.item.status === "IN_VAULT") return { label: "In vault", tone: "lime" };
  return { label: i.item.status.replace(/_/g, " ").toLowerCase(), tone: "neutral" };
}

function custodyLabel(c: string): string {
  return c === "WAREHOUSE" ? "Vault custody" : c === "IN_TRANSIT" ? "In transit" : c === "DELIVERED" ? "Delivered" : "Third-party custody";
}

export function VaultBrowser({ items, feeBp, autoAction }: { items: VaultItem[]; feeBp: number; autoAction: { kind: VaultAction; holdingId: string } | null }) {
  const router = useRouter();
  const toast = useToast();
  const [collection, setCollection] = useState<string>("");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [naming, setNaming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // The deep-link action has been handed to the item; drop the query so a refresh does not reopen it.
    if (autoAction && typeof window !== "undefined" && window.location.search) window.history.replaceState(null, "", "/vault");
  }, [autoAction]);

  const collections = useMemo(() => {
    const names = new Map<string, number>();
    for (const i of items) names.set(i.collectionName ?? UNGROUPED, (names.get(i.collectionName ?? UNGROUPED) ?? 0) + 1);
    return [...names.entries()].sort((a, b) => (a[0] === UNGROUPED ? 1 : b[0] === UNGROUPED ? -1 : a[0].localeCompare(b[0])));
  }, [items]);
  const visible = collection ? items.filter((i) => (i.collectionName ?? UNGROUPED) === collection) : items;

  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const group = async (name: string | null) => {
    setBusy(true);
    try {
      await api("/vault/collections", { method: "POST", body: { holdingIds: [...selected], collectionName: name } });
      toast.push({ title: name ? `Grouped into “${name}”` : "Removed from collection", tone: "success" });
      setNaming(false);
      setSelecting(false);
      setSelected(new Set());
      router.refresh();
    } catch (e) {
      toast.push({ title: "Could not update collection", body: e instanceof ApiError ? e.message : "Something went wrong.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  if (items.length === 0) {
    return (
      <Empty
        title="Your vault is empty"
        body="Items you open or buy are held here in insured custody until you ship, sell or list them."
        action={
          <ButtonLink href="/packs" tone="secondary">
            Browse packs
          </ButtonLink>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by collection">
          <FilterChip active={collection === ""} onClick={() => setCollection("")}>
            All ({items.length})
          </FilterChip>
          {collections.map(([name, n]) => (
            <FilterChip key={name} active={collection === name} onClick={() => setCollection(name)}>
              {name === UNGROUPED ? "Ungrouped" : name} ({n})
            </FilterChip>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button tone={selecting ? "secondary" : "ghost"} size="sm" onClick={() => { setSelecting((s) => !s); setSelected(new Set()); }} aria-pressed={selecting}>
            <FolderPlus size={16} aria-hidden /> {selecting ? "Cancel" : "Group"}
          </Button>
          <div className="flex rounded-xl bg-white/5 p-0.5" role="group" aria-label="Layout">
            <button type="button" onClick={() => setLayout("grid")} aria-pressed={layout === "grid"} aria-label="Grid layout" className={cx("tap inline-flex items-center justify-center rounded-lg", layout === "grid" ? "bg-white/10 text-ink-100" : "text-ink-400")}>
              <LayoutGrid size={16} aria-hidden />
            </button>
            <button type="button" onClick={() => setLayout("list")} aria-pressed={layout === "list"} aria-label="List layout" className={cx("tap inline-flex items-center justify-center rounded-lg", layout === "list" ? "bg-white/10 text-ink-100" : "text-ink-400")}>
              <List size={16} aria-hidden />
            </button>
          </div>
        </div>
      </div>

      {selecting && (
        <div className="glass glass-strong flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm" aria-live="polite">
          <span className="text-ink-200">{selected.size} selected</span>
          <div className="flex gap-2">
            <Button size="sm" tone="ghost" disabled={selected.size === 0 || busy} onClick={() => group(null)}>
              Remove from collection
            </Button>
            <Button size="sm" disabled={selected.size === 0 || busy} onClick={() => setNaming(true)}>
              Group into collection
            </Button>
          </div>
        </div>
      )}

      <ul className={cx(layout === "grid" ? "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-col gap-3")} aria-label="Vault items">
        {visible.map((i) => {
          const st = statusOf(i);
          const checked = selected.has(i.holdingId);
          return (
            <li key={i.holdingId} className={cx("glass relative flex flex-col gap-3 p-3", checked && "ring-2 ring-cyan-400/70")}>
              <div className={cx("flex gap-3", layout === "list" && "items-center")}>
                {selecting && (
                  <label className="tap flex items-start">
                    <input type="checkbox" checked={checked} onChange={() => toggle(i.holdingId)} className="mt-1 h-5 w-5 accent-cyan-400" aria-label={`Select ${i.sku.name}`} />
                  </label>
                )}
                <ItemArt name={i.sku.name} accent={i.sku.accent} imageKey={i.sku.imageKey} size={layout === "grid" ? "md" : "sm"} label="" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={st.tone}>{st.label}</Badge>
                    <Badge>{custodyLabel(i.item.custody)}</Badge>
                    {i.collectionName && <Badge tone="violet">{i.collectionName}</Badge>}
                  </div>
                  <div className="font-display mt-1 truncate font-bold text-ink-100">{i.sku.name}</div>
                  <div className="truncate text-xs text-ink-400">
                    {i.sku.brand ? `${i.sku.brand} · ` : ""}
                    <span className="font-mono">{i.item.itemCode}</span>
                    {i.item.grader && i.item.grade ? ` · ${i.item.grader} ${i.item.grade}` : ""}
                    {i.item.certificationId ? ` · cert ${i.item.certificationId}` : ""}
                    {i.item.serialNumber ? ` · s/n ${i.item.serialNumber}` : ""}
                    {i.item.size ? ` · size ${i.item.size}` : ""}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs">
                    <span className="text-ink-400">
                      Reference <span className="font-mono text-ink-100">{moneyStr(i.referenceValueMinor, i.currency)}</span>
                    </span>
                    <span className="text-ink-400">
                      Sell-back <span className="font-mono text-ink-100">{moneyStr(i.sellbackOfferMinor, i.currency)}</span>
                    </span>
                    {i.listing && (
                      <span className="text-ink-400">
                        Ask <span className="font-mono text-cyan-300">{moneyStr(i.listing.askMinor, i.listing.currency)}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {!selecting && <VaultItemActions item={i} feeBp={feeBp} initialAction={autoAction?.holdingId === i.holdingId ? autoAction.kind : null} />}
            </li>
          );
        })}
      </ul>
      {visible.length === 0 && <p className="text-sm text-ink-400">No items in this collection.</p>}

      <Modal open={naming} onClose={() => setNaming(false)} title="Name the collection">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const name = String(new FormData(e.currentTarget).get("name") ?? "").trim();
            if (name) group(name);
          }}
          className="flex flex-col gap-3"
        >
          <Field label="Collection name" htmlFor="collection-name" hint={`${selected.size} item${selected.size === 1 ? "" : "s"} will be grouped`}>
            <Input id="collection-name" name="name" required maxLength={64} list="existing-collections" autoFocus />
          </Field>
          <datalist id="existing-collections">
            {collections.filter(([n]) => n !== UNGROUPED).map(([n]) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <Button type="submit" disabled={busy} aria-busy={busy} className="w-full">
            Save collection
          </Button>
        </form>
      </Modal>
    </div>
  );
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={active} className={cx("tap rounded-xl px-3 text-sm font-semibold transition", active ? "bg-white/12 text-ink-100" : "text-ink-300 hover:bg-white/5")}>
      {children}
    </button>
  );
}
