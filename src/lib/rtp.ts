import { BP_SCALE, divRound, type Minor } from "./money";

/**
 * Exact RTP math for immutable pack versions.
 *
 * For finite packs each outcome i has integer quantity q_i, sum(q_i) = N, probability q_i/N.
 * merchandiseRtp = sum(p_i * referenceValue_i) / price = sum(q_i * referenceValue_i) / (N * price)
 * sellbackRtp    = sum(p_i * sellbackOffer_i)   / price = sum(q_i * sellbackOffer_i)   / (N * price)
 *
 * Everything is computed with BigInt; results are basis points (10000 = 100%) rounded half-up.
 */
export interface OutcomeInput {
  id?: string;
  label?: string;
  tier?: string;
  quantity: number;
  referenceValueMinor: Minor;
  sellbackOfferMinor: Minor;
  /** true when the outcome is a single unique physical item (quantity must be 1). */
  isUniqueItem?: boolean;
}

export interface RtpResult {
  totalOpenings: number;
  merchandiseRtpBp: number;
  sellbackRtpBp: number;
  merchandiseEvMinor: Minor; // expected merchandise value per opening (rounded)
  sellbackEvMinor: Minor;
  totalMerchandiseLiabilityMinor: Minor; // sum(q_i * refValue_i)
  totalSellbackLiabilityMinor: Minor;
  grossSalesMinor: Minor; // N * price
  probabilities: Array<{ index: number; numerator: number; denominator: number; bp: number; exact: string }>;
}

export interface RtpValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
  result: RtpResult | null;
}

export function computeRtp(priceMinor: Minor, outcomes: OutcomeInput[]): RtpResult {
  if (priceMinor <= 0n) throw new Error("price must be positive");
  const N = outcomes.reduce((acc, o) => acc + o.quantity, 0);
  if (N <= 0) throw new Error("total openings must be positive");
  const bigN = BigInt(N);
  let merch = 0n;
  let sell = 0n;
  for (const o of outcomes) {
    if (!Number.isInteger(o.quantity) || o.quantity < 0) throw new Error("quantities must be non-negative integers");
    merch += BigInt(o.quantity) * o.referenceValueMinor;
    sell += BigInt(o.quantity) * o.sellbackOfferMinor;
  }
  const gross = bigN * priceMinor;
  return {
    totalOpenings: N,
    merchandiseRtpBp: Number(divRound(merch * BP_SCALE, gross)),
    sellbackRtpBp: Number(divRound(sell * BP_SCALE, gross)),
    merchandiseEvMinor: divRound(merch, bigN),
    sellbackEvMinor: divRound(sell, bigN),
    totalMerchandiseLiabilityMinor: merch,
    totalSellbackLiabilityMinor: sell,
    grossSalesMinor: gross,
    probabilities: outcomes.map((o, index) => ({
      index,
      numerator: o.quantity,
      denominator: N,
      bp: Number(divRound(BigInt(o.quantity) * BP_SCALE, bigN)),
      exact: `${o.quantity}/${N}`,
    })),
  };
}

export interface ValidateOptions {
  targetRtpBp: number; // e.g. 9000
  toleranceBp: number; // e.g. 50
  /** which RTP is validated against target. Platform default: SELLBACK. */
  basis: "SELLBACK" | "MERCHANDISE";
  expectedTotalOpenings?: number;
}

export function validatePackEconomics(priceMinor: Minor, outcomes: OutcomeInput[], opts: ValidateOptions): RtpValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (outcomes.length === 0) errors.push("A pack needs at least one outcome.");
  if (priceMinor <= 0n) errors.push("Price must be positive.");
  outcomes.forEach((o, i) => {
    if (!Number.isInteger(o.quantity) || o.quantity <= 0) errors.push(`Outcome ${i + 1}: quantity must be a positive integer.`);
    if (o.isUniqueItem && o.quantity !== 1) errors.push(`Outcome ${i + 1}: unique physical items must have quantity 1.`);
    if (o.referenceValueMinor < 0n) errors.push(`Outcome ${i + 1}: reference value cannot be negative.`);
    if (o.sellbackOfferMinor < 0n) errors.push(`Outcome ${i + 1}: sell-back offer cannot be negative.`);
    if (o.sellbackOfferMinor > o.referenceValueMinor) errors.push(`Outcome ${i + 1}: sell-back offer cannot exceed reference value.`);
  });
  if (errors.length) return { ok: false, errors, warnings, result: null };
  const result = computeRtp(priceMinor, outcomes);
  if (opts.expectedTotalOpenings !== undefined && opts.expectedTotalOpenings !== result.totalOpenings) {
    errors.push(`Sum of quantities (${result.totalOpenings}) must equal total openings (${opts.expectedTotalOpenings}).`);
  }
  const actual = opts.basis === "SELLBACK" ? result.sellbackRtpBp : result.merchandiseRtpBp;
  const diff = actual - opts.targetRtpBp;
  if (Math.abs(diff) > opts.toleranceBp) {
    errors.push(`${opts.basis === "SELLBACK" ? "Sell-back" : "Merchandise"} RTP ${(actual / 100).toFixed(2)}% is outside ${(opts.targetRtpBp / 100).toFixed(2)}% ± ${(opts.toleranceBp / 100).toFixed(2)}%.`);
  }
  if (result.merchandiseRtpBp < result.sellbackRtpBp) errors.push("Merchandise RTP cannot be lower than sell-back RTP.");
  if (result.merchandiseRtpBp > 20000) warnings.push("Merchandise RTP above 200%: check reference values.");
  return { ok: errors.length === 0, errors, warnings, result };
}

export interface SolverSuggestion {
  kind: "ADJUST_COMMON_QUANTITY" | "ADJUST_COMMON_VALUE" | "ALREADY_ON_TARGET" | "NO_SOLUTION";
  description: string;
  outcomeIndex?: number;
  newQuantity?: number;
  newTotalOpenings?: number;
  newSellbackOfferMinor?: Minor;
  newReferenceValueMinor?: Minor;
  projected?: RtpResult;
}

/**
 * Suggests adjustments to the most common outcome so the chosen RTP basis reaches target.
 * It never mutates and never publishes; the admin applies a suggestion explicitly.
 *
 * Strategy A (quantity): keep values, solve for q_common such that RTP is inside tolerance.
 * Strategy B (value): keep quantities, solve for the common outcome's sell-back offer (and scale ref value proportionally).
 */
export function suggestRtpAdjustments(priceMinor: Minor, outcomes: OutcomeInput[], opts: ValidateOptions): SolverSuggestion[] {
  if (outcomes.length === 0 || priceMinor <= 0n) return [{ kind: "NO_SOLUTION", description: "Add outcomes and a price first." }];
  const current = computeRtp(priceMinor, outcomes);
  const basisOf = (r: RtpResult) => (opts.basis === "SELLBACK" ? r.sellbackRtpBp : r.merchandiseRtpBp);
  if (Math.abs(basisOf(current) - opts.targetRtpBp) <= opts.toleranceBp) {
    return [{ kind: "ALREADY_ON_TARGET", description: `Current ${opts.basis.toLowerCase()} RTP ${(basisOf(current) / 100).toFixed(2)}% is within tolerance.`, projected: current }];
  }
  const commonIdx = outcomes.reduce((best, o, i) => (o.quantity > outcomes[best].quantity ? i : best), 0);
  const common = outcomes[commonIdx];
  const suggestions: SolverSuggestion[] = [];

  // Strategy A: binary search the common quantity in [1, 1e7].
  {
    const others = outcomes.filter((_, i) => i !== commonIdx);
    const otherQ = others.reduce((a, o) => a + o.quantity, 0);
    const value = (o: OutcomeInput) => (opts.basis === "SELLBACK" ? o.sellbackOfferMinor : o.referenceValueMinor);
    const otherVal = others.reduce((a, o) => a + BigInt(o.quantity) * value(o), 0n);
    const cv = value(common);
    // RTP(q) = (otherVal + q*cv) / ((otherQ + q) * price). Monotone in q: moves toward cv/price.
    const rtpAt = (q: number) => Number(divRound((otherVal + BigInt(q) * cv) * BP_SCALE, BigInt(otherQ + q) * priceMinor));
    let lo = 1;
    let hi = 10_000_000;
    const target = opts.targetRtpBp;
    const increasing = rtpAt(hi) > rtpAt(lo);
    for (let i = 0; i < 60 && lo < hi; i++) {
      const mid = Math.floor((lo + hi) / 2);
      const r = rtpAt(mid);
      if ((increasing && r < target) || (!increasing && r > target)) lo = mid + 1;
      else hi = mid;
    }
    const candidates = [lo - 1, lo, lo + 1].filter((q) => q >= 1);
    const best = candidates.map((q) => ({ q, d: Math.abs(rtpAt(q) - target) })).sort((a, b) => a.d - b.d)[0];
    if (best && best.d <= opts.toleranceBp) {
      const next = outcomes.map((o, i) => (i === commonIdx ? { ...o, quantity: best.q } : o));
      const projected = computeRtp(priceMinor, next);
      suggestions.push({
        kind: "ADJUST_COMMON_QUANTITY",
        description: `Set "${common.label ?? `outcome ${commonIdx + 1}`}" quantity to ${best.q} (total openings ${projected.totalOpenings}).`,
        outcomeIndex: commonIdx,
        newQuantity: best.q,
        newTotalOpenings: projected.totalOpenings,
        projected,
      });
    }
  }

  // Strategy B: solve the common outcome's value exactly.
  {
    const N = BigInt(current.totalOpenings);
    const gross = N * priceMinor;
    const others = outcomes.filter((_, i) => i !== commonIdx);
    const value = (o: OutcomeInput) => (opts.basis === "SELLBACK" ? o.sellbackOfferMinor : o.referenceValueMinor);
    const otherVal = others.reduce((a, o) => a + BigInt(o.quantity) * value(o), 0n);
    // target: (otherVal + q*v) / gross = target/10000  =>  v = (target*gross/10000 - otherVal) / q
    const needed = divRound(BigInt(opts.targetRtpBp) * gross, BP_SCALE) - otherVal;
    const v = divRound(needed, BigInt(common.quantity));
    if (v >= 0n) {
      const ratio = common.referenceValueMinor > 0n ? { num: common.sellbackOfferMinor, den: common.referenceValueMinor } : { num: 1n, den: 1n };
      const next = outcomes.map((o, i) => {
        if (i !== commonIdx) return o;
        if (opts.basis === "SELLBACK") {
          const ref = ratio.num > 0n ? divRound(v * ratio.den, ratio.num) : v;
          return { ...o, sellbackOfferMinor: v, referenceValueMinor: ref < v ? v : ref };
        }
        const sb = divRound(v * ratio.num, ratio.den);
        return { ...o, referenceValueMinor: v, sellbackOfferMinor: sb > v ? v : sb };
      });
      const projected = computeRtp(priceMinor, next);
      if (Math.abs(basisOf(projected) - opts.targetRtpBp) <= opts.toleranceBp) {
        suggestions.push({
          kind: "ADJUST_COMMON_VALUE",
          description: `Set "${common.label ?? `outcome ${commonIdx + 1}`}" ${opts.basis === "SELLBACK" ? "sell-back offer" : "reference value"} to ${v.toString()} minor units.`,
          outcomeIndex: commonIdx,
          newSellbackOfferMinor: next[commonIdx].sellbackOfferMinor,
          newReferenceValueMinor: next[commonIdx].referenceValueMinor,
          projected,
        });
      }
    }
  }
  if (suggestions.length === 0) suggestions.push({ kind: "NO_SOLUTION", description: "No single-outcome adjustment reaches target; change price or add outcomes." });
  return suggestions;
}

export interface EconomicsInputs {
  paymentFeeBp: number;
  paymentFeeFixedMinor: Minor;
  fraudReserveBp: number;
  rewardsAllocationBp: number;
  shippingSubsidyMinor: Minor;
  /** expected share of openings that ship instead of selling back; bp */
  shipRateBp: number;
  acquisitionCostMinor: Minor; // total acquisition cost of the full manifest
}

export interface EconomicsScenario {
  grossSalesMinor: Minor;
  acquisitionCostMinor: Minor;
  merchandiseLiabilityMinor: Minor;
  sellbackLiabilityMinor: Minor;
  paymentFeesMinor: Minor;
  rewardsAllocationMinor: Minor;
  shippingSubsidyMinor: Minor;
  fraudReserveMinor: Minor;
  /** gross - acquisition - fees - rewards - shipping - fraud (sell-backs are covered by acquisition cost of items returned) */
  contributionMarginMinor: Minor;
  contributionMarginBp: number;
  /** worst case where every customer sells back at the disclosed offer */
  allSellbackMarginMinor: Minor;
}

export function computeEconomics(rtp: RtpResult, inputs: EconomicsInputs): EconomicsScenario {
  const N = BigInt(rtp.totalOpenings);
  const fees = divRound(rtp.grossSalesMinor * BigInt(inputs.paymentFeeBp), BP_SCALE) + N * inputs.paymentFeeFixedMinor;
  const rewards = divRound(rtp.grossSalesMinor * BigInt(inputs.rewardsAllocationBp), BP_SCALE);
  const shipping = divRound(N * inputs.shippingSubsidyMinor * BigInt(inputs.shipRateBp), BP_SCALE);
  const fraud = divRound(rtp.grossSalesMinor * BigInt(inputs.fraudReserveBp), BP_SCALE);
  const cm = rtp.grossSalesMinor - inputs.acquisitionCostMinor - fees - rewards - shipping - fraud;
  const allSellback = rtp.grossSalesMinor - rtp.totalSellbackLiabilityMinor - fees - rewards - fraud; // items return to stock, cost retained
  return {
    grossSalesMinor: rtp.grossSalesMinor,
    acquisitionCostMinor: inputs.acquisitionCostMinor,
    merchandiseLiabilityMinor: rtp.totalMerchandiseLiabilityMinor,
    sellbackLiabilityMinor: rtp.totalSellbackLiabilityMinor,
    paymentFeesMinor: fees,
    rewardsAllocationMinor: rewards,
    shippingSubsidyMinor: shipping,
    fraudReserveMinor: fraud,
    contributionMarginMinor: cm,
    contributionMarginBp: rtp.grossSalesMinor > 0n ? Number(divRound(cm * BP_SCALE, rtp.grossSalesMinor)) : 0,
    allSellbackMarginMinor: allSellback,
  };
}
