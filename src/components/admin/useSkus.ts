"use client";
import { useEffect, useState } from "react";
import type { category, productSku } from "@/db/schema";
import { api } from "@/lib/client/api";
import type { Json } from "./serialize";
import { describeError } from "./hooks";

export type SkuRow = Json<typeof productSku.$inferSelect> & { category: string };
export type CategoryRow = Json<typeof category.$inferSelect>;

/** Loads SKUs + categories from GET /admin/skus (inventory.read). */
export function useSkus(enabled = true) {
  const [skus, setSkus] = useState<SkuRow[]>([]);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    api<{ items: SkuRow[]; categories: CategoryRow[] }>("/admin/skus")
      .then((r) => {
        if (!alive) return;
        setSkus(r.items);
        setCategories(r.categories);
      })
      .catch((e) => alive && setError(describeError(e)));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return { skus, categories, error };
}

export const CONDITIONS = ["MINT", "NEAR_MINT", "EXCELLENT", "GOOD", "PLAYED", "NEW_IN_BOX", "NEW", "USED"] as const;
export const ACCENTS = ["violet", "cyan", "amber", "rose", "emerald", "slate"] as const;
