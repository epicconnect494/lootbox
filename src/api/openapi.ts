import { z } from "zod";
import * as S from "./schemas";

type Op = { method: "get" | "post" | "patch" | "put" | "delete"; path: string; summary: string; tag: string; auth: "none" | "user" | "admin"; permission?: string; body?: z.ZodType; query?: z.ZodType; idempotent?: boolean; sse?: boolean };

export const OPERATIONS: Op[] = [
  { method: "get", path: "/health", summary: "Liveness", tag: "System", auth: "none" },
  { method: "get", path: "/ready", summary: "Readiness (checks database)", tag: "System", auth: "none" },
  { method: "get", path: "/openapi.json", summary: "This specification", tag: "System", auth: "none" },
  { method: "post", path: "/auth/register", summary: "Register", tag: "Auth", auth: "none", body: S.registerBody },
  { method: "post", path: "/auth/login", summary: "Login (sets session + CSRF cookies)", tag: "Auth", auth: "none", body: S.loginBody },
  { method: "post", path: "/auth/logout", summary: "Logout", tag: "Auth", auth: "user" },
  { method: "get", path: "/auth/me", summary: "Current session", tag: "Auth", auth: "none" },
  { method: "get", path: "/packs", summary: "Catalog (search/filter/sort)", tag: "Packs", auth: "none", query: S.catalogQuery },
  { method: "get", path: "/packs/{slug}", summary: "Pack detail: outcomes, exact odds, values, RTPs, manifest hash", tag: "Packs", auth: "none" },
  { method: "post", path: "/openings/quote", summary: "Quote an opening (price, balance, eligibility)", tag: "Openings", auth: "user", body: S.openingQuoteBody },
  { method: "post", path: "/openings", summary: "Open a pack (settled server-side, atomic)", tag: "Openings", auth: "user", body: S.openingCreateBody, idempotent: true },
  { method: "get", path: "/openings", summary: "My openings", tag: "Openings", auth: "user" },
  { method: "get", path: "/openings/{id}", summary: "Opening with signed fairness receipt", tag: "Openings", auth: "user" },
  { method: "post", path: "/openings/{id}/revealed", summary: "Mark reveal animation complete (presentation only)", tag: "Openings", auth: "user" },
  { method: "post", path: "/openings/{id}/verify", summary: "Server-side receipt verification", tag: "Openings", auth: "user" },
  { method: "get", path: "/fairness/seed", summary: "Active seed pair and history", tag: "Fairness", auth: "user" },
  { method: "put", path: "/fairness/seed", summary: "Set client seed", tag: "Fairness", auth: "user", body: S.clientSeedBody },
  { method: "post", path: "/fairness/seed/rotate", summary: "Rotate (reveal) server seed", tag: "Fairness", auth: "user", body: S.rotateSeedBody },
  { method: "get", path: "/fairness/public-key", summary: "Receipt signing public key + test vectors", tag: "Fairness", auth: "none" },
  { method: "get", path: "/vault", summary: "My vault", tag: "Vault", auth: "user" },
  { method: "get", path: "/vault/items/{id}/history", summary: "Item chain of custody", tag: "Vault", auth: "user" },
  { method: "post", path: "/vault/collections", summary: "Group holdings into a collection", tag: "Vault", auth: "user", body: S.collectionBody },
  { method: "post", path: "/sellback/quotes", summary: "Create sell-back quote (disclosed offer)", tag: "Vault", auth: "user", body: S.sellbackQuoteBody },
  { method: "post", path: "/sellback/quotes/{id}/accept", summary: "Accept sell-back quote", tag: "Vault", auth: "user", idempotent: true },
  { method: "post", path: "/shipments", summary: "Request shipping", tag: "Vault", auth: "user", body: S.shipmentBody },
  { method: "get", path: "/marketplace", summary: "Active listings", tag: "Marketplace", auth: "none" },
  { method: "post", path: "/marketplace/listings", summary: "List an item", tag: "Marketplace", auth: "user", body: S.listingBody },
  { method: "delete", path: "/marketplace/listings/{id}", summary: "Cancel listing", tag: "Marketplace", auth: "user" },
  { method: "post", path: "/marketplace/listings/{id}/buy", summary: "Buy listing", tag: "Marketplace", auth: "user", idempotent: true },
  { method: "get", path: "/battles", summary: "List battles", tag: "Battles", auth: "none", query: S.battleListQuery },
  { method: "post", path: "/battles", summary: "Create battle", tag: "Battles", auth: "user", body: S.battleCreateBody, idempotent: true },
  { method: "get", path: "/battles/{id}", summary: "Battle view", tag: "Battles", auth: "none" },
  { method: "post", path: "/battles/{id}/join", summary: "Join battle (starts + settles when full)", tag: "Battles", auth: "user", body: S.battleJoinBody, idempotent: true },
  { method: "post", path: "/battles/{id}/cancel", summary: "Cancel open battle", tag: "Battles", auth: "user" },
  { method: "post", path: "/battles/{id}/bot", summary: "Add labeled house bot (feature-flagged)", tag: "Battles", auth: "user" },
  { method: "get", path: "/battles/{id}/events", summary: "SSE stream", tag: "Battles", auth: "none", sse: true },
  { method: "get", path: "/race/current", summary: "Current race + my standing", tag: "Race", auth: "none" },
  { method: "get", path: "/race/history", summary: "Past races", tag: "Race", auth: "none" },
  { method: "get", path: "/race/{id}", summary: "Race view", tag: "Race", auth: "none" },
  { method: "get", path: "/race/{id}/events", summary: "SSE stream", tag: "Race", auth: "none", sse: true },
  { method: "get", path: "/raffles", summary: "List raffles", tag: "Raffles", auth: "none" },
  { method: "get", path: "/raffles/{id}", summary: "Raffle view with manifest and draws", tag: "Raffles", auth: "none" },
  { method: "post", path: "/raffles/{id}/enter", summary: "Enter raffle", tag: "Raffles", auth: "user", body: S.raffleEnterBody, idempotent: true },
  { method: "post", path: "/raffles/{id}/claim", summary: "Claim prize", tag: "Raffles", auth: "user", body: S.raffleClaimBody },
  { method: "get", path: "/raffles/{id}/events", summary: "SSE stream", tag: "Raffles", auth: "none", sse: true },
  { method: "get", path: "/account", summary: "Account overview", tag: "Account", auth: "user" },
  { method: "patch", path: "/account", summary: "Update profile", tag: "Account", auth: "user", body: S.accountPatchBody },
  { method: "post", path: "/account/verifications", summary: "Submit verification", tag: "Account", auth: "user", body: S.verificationBody },
  { method: "post", path: "/account/limits", summary: "Set responsible-play limit", tag: "Account", auth: "user", body: S.limitBody },
  { method: "post", path: "/account/exclusions", summary: "Cooling-off / self-exclusion", tag: "Account", auth: "user", body: S.exclusionBody },
  { method: "post", path: "/account/deposits", summary: "Deposit (test payment provider)", tag: "Account", auth: "user", body: S.depositBody, idempotent: true },
  { method: "get", path: "/account/notifications", summary: "Notifications", tag: "Account", auth: "user" },
  { method: "post", path: "/account/notifications", summary: "Mark read", tag: "Account", auth: "user", body: S.notificationsReadBody },
  { method: "get", path: "/account/events", summary: "SSE user stream", tag: "Account", auth: "user", sse: true },
  { method: "get", path: "/admin/dashboard", summary: "Dashboard", tag: "Admin", auth: "admin" },
  { method: "get", path: "/admin/inventory", summary: "Inventory", tag: "Admin", auth: "admin", permission: "inventory.read", query: S.inventoryQuery },
  { method: "post", path: "/admin/inventory", summary: "Intake item", tag: "Admin", auth: "admin", permission: "inventory.write", body: S.inventoryIntakeBody },
  { method: "get", path: "/admin/inventory/{id}", summary: "Item detail", tag: "Admin", auth: "admin", permission: "inventory.read" },
  { method: "patch", path: "/admin/inventory/{id}", summary: "Update item", tag: "Admin", auth: "admin", permission: "inventory.write", body: S.inventoryPatchBody },
  { method: "post", path: "/admin/valuations", summary: "Record valuation", tag: "Admin", auth: "admin", permission: "inventory.write", body: S.valuationBody },
  { method: "get", path: "/admin/skus", summary: "SKUs", tag: "Admin", auth: "admin", permission: "inventory.read" },
  { method: "post", path: "/admin/skus", summary: "Create SKU", tag: "Admin", auth: "admin", permission: "inventory.write", body: S.skuBody },
  { method: "get", path: "/admin/packs", summary: "All pack versions", tag: "Admin", auth: "admin", permission: "packs.read" },
  { method: "post", path: "/admin/packs", summary: "Create draft pack", tag: "Admin", auth: "admin", permission: "packs.write", body: S.packCreateBody },
  { method: "get", path: "/admin/packs/versions/{id}", summary: "Version economics, validation, solver", tag: "Admin", auth: "admin", permission: "packs.read" },
  { method: "patch", path: "/admin/packs/versions/{id}", summary: "Update draft version", tag: "Admin", auth: "admin", permission: "packs.write", body: S.packVersionPatchBody },
  { method: "post", path: "/admin/packs/versions/{id}/outcomes", summary: "Add/update outcome", tag: "Admin", auth: "admin", permission: "packs.write", body: S.outcomeBody },
  { method: "delete", path: "/admin/packs/versions/{id}/outcomes/{outcomeId}", summary: "Remove outcome", tag: "Admin", auth: "admin", permission: "packs.write" },
  { method: "post", path: "/admin/packs/versions/{id}/submit", summary: "Submit for approval", tag: "Admin", auth: "admin", permission: "packs.write" },
  { method: "post", path: "/admin/packs/versions/{id}/review", summary: "Approve/reject", tag: "Admin", auth: "admin", permission: "packs.approve", body: S.reviewBody },
  { method: "post", path: "/admin/packs/versions/{id}/publish", summary: "Publish or schedule (locks manifest)", tag: "Admin", auth: "admin", permission: "packs.publish", body: S.publishBody },
  { method: "post", path: "/admin/packs/versions/{id}/pause", summary: "Pause", tag: "Admin", auth: "admin", permission: "packs.publish", body: S.reasonBody },
  { method: "post", path: "/admin/packs/versions/{id}/resume", summary: "Resume", tag: "Admin", auth: "admin", permission: "packs.publish" },
  { method: "post", path: "/admin/packs/versions/{id}/close", summary: "Close", tag: "Admin", auth: "admin", permission: "packs.publish", body: S.reasonBody },
  { method: "post", path: "/admin/packs/versions/{id}/clone", summary: "Clone to new draft version", tag: "Admin", auth: "admin", permission: "packs.write" },
  { method: "get", path: "/admin/battles", summary: "Battles", tag: "Admin", auth: "admin", permission: "battles.read" },
  { method: "post", path: "/admin/battles/{id}/void", summary: "Void (controlled policy)", tag: "Admin", auth: "admin", permission: "battles.void", body: S.reasonBody },
  { method: "get", path: "/admin/battles/{id}/receipts", summary: "Verify all receipts", tag: "Admin", auth: "admin", permission: "battles.read" },
  { method: "get", path: "/admin/races", summary: "Races + policies", tag: "Admin", auth: "admin", permission: "races.read" },
  { method: "post", path: "/admin/races", summary: "Create race", tag: "Admin", auth: "admin", permission: "races.write", body: S.raceCreateBody },
  { method: "post", path: "/admin/races/policies", summary: "Create scoring policy version", tag: "Admin", auth: "admin", permission: "races.write", body: S.scoringPolicyBody },
  { method: "get", path: "/admin/races/{id}", summary: "Race detail", tag: "Admin", auth: "admin", permission: "races.read" },
  { method: "post", path: "/admin/races/{id}/lock", summary: "Lock standings", tag: "Admin", auth: "admin", permission: "races.write" },
  { method: "post", path: "/admin/races/{id}/review", summary: "Fraud review", tag: "Admin", auth: "admin", permission: "races.write" },
  { method: "post", path: "/admin/races/{id}/settle", summary: "Settle prizes (idempotent)", tag: "Admin", auth: "admin", permission: "races.settle" },
  { method: "post", path: "/admin/races/{id}/promo-entry", summary: "No-purchase entry", tag: "Admin", auth: "admin", permission: "races.write", body: S.promoEntryBody },
  { method: "get", path: "/admin/raffles", summary: "Raffles", tag: "Admin", auth: "admin", permission: "raffles.read" },
  { method: "post", path: "/admin/raffles", summary: "Create raffle (commits seed hash)", tag: "Admin", auth: "admin", permission: "raffles.write", body: S.raffleCreateBody },
  { method: "post", path: "/admin/raffles/{id}/close", summary: "Close + publish manifest", tag: "Admin", auth: "admin", permission: "raffles.write" },
  { method: "post", path: "/admin/raffles/{id}/draw", summary: "Draw", tag: "Admin", auth: "admin", permission: "raffles.draw", body: S.drawBody },
  { method: "post", path: "/admin/raffles/{id}/redraw", summary: "Audited redraw", tag: "Admin", auth: "admin", permission: "raffles.draw", body: S.redrawBody },
  { method: "post", path: "/admin/raffles/{id}/amoe", summary: "Record AMOE entry", tag: "Admin", auth: "admin", permission: "raffles.write", body: S.amoeBody },
  { method: "get", path: "/admin/fulfillment", summary: "Ship queue", tag: "Admin", auth: "admin", permission: "fulfillment.read" },
  { method: "get", path: "/admin/fulfillment/{id}", summary: "Shipment with address (audited)", tag: "Admin", auth: "admin", permission: "fulfillment.read" },
  { method: "patch", path: "/admin/fulfillment/{id}", summary: "Update shipment", tag: "Admin", auth: "admin", permission: "fulfillment.write", body: S.shipmentPatchBody },
  { method: "get", path: "/admin/marketplace", summary: "Sell-back quotes + listings", tag: "Admin", auth: "admin", permission: "marketplace.read" },
  { method: "delete", path: "/admin/marketplace/listings/{id}", summary: "Cancel listing", tag: "Admin", auth: "admin", permission: "marketplace.write", body: S.reasonBody },
  { method: "get", path: "/admin/users", summary: "Users", tag: "Admin", auth: "admin", permission: "users.read", query: S.usersQuery },
  { method: "get", path: "/admin/users/{id}", summary: "User detail", tag: "Admin", auth: "admin", permission: "users.read" },
  { method: "patch", path: "/admin/users/{id}", summary: "Update user (status, region, roles, links)", tag: "Admin", auth: "admin", permission: "users.write", body: S.userPatchBody },
  { method: "post", path: "/admin/users/{id}/exclusions", summary: "Operator exclusion", tag: "Admin", auth: "admin", permission: "risk.write", body: S.adminExclusionBody },
  { method: "post", path: "/admin/users/{id}/verifications/{vid}", summary: "Review verification", tag: "Admin", auth: "admin", permission: "users.write", body: S.verificationReviewBody },
  { method: "get", path: "/admin/risk-events", summary: "Risk events", tag: "Admin", auth: "admin", permission: "users.read" },
  { method: "post", path: "/admin/risk-events", summary: "Create risk event", tag: "Admin", auth: "admin", permission: "risk.write", body: S.riskEventBody },
  { method: "patch", path: "/admin/risk-events/{id}", summary: "Resolve risk event", tag: "Admin", auth: "admin", permission: "risk.write", body: S.riskResolveBody },
  { method: "get", path: "/admin/finance/ledger", summary: "Ledger overview", tag: "Admin", auth: "admin", permission: "finance.read" },
  { method: "post", path: "/admin/finance/refunds", summary: "Refund", tag: "Admin", auth: "admin", permission: "finance.write", body: S.refundBody },
  { method: "post", path: "/admin/finance/chargebacks", summary: "Record chargeback", tag: "Admin", auth: "admin", permission: "finance.write", body: S.chargebackBody },
  { method: "post", path: "/admin/finance/reconcile", summary: "Run invariant checks", tag: "Admin", auth: "admin", permission: "finance.read" },
  { method: "get", path: "/admin/audit", summary: "Search audit log", tag: "Admin", auth: "admin", permission: "audit.read", query: S.auditQuery },
];

const errorSchema = { type: "object", properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: {}, requestId: { type: "string" } }, required: ["code", "message", "requestId"] } } };

export function buildOpenApi() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    const params: unknown[] = [];
    for (const m of op.path.matchAll(/\{(\w+)\}/g)) params.push({ name: m[1], in: "path", required: true, schema: { type: "string", format: "uuid" } });
    if (op.query) {
      const js = z.toJSONSchema(op.query) as { properties?: Record<string, unknown>; required?: string[] };
      for (const [name, schema] of Object.entries(js.properties ?? {})) params.push({ name, in: "query", required: js.required?.includes(name) ?? false, schema });
    }
    if (op.idempotent) params.push({ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string", minLength: 8, maxLength: 160 }, description: "Retries with the same key replay the original response; a different body with the same key returns 422." });
    if (op.auth !== "none" && op.method !== "get") params.push({ name: "X-CSRF-Token", in: "header", required: true, schema: { type: "string" }, description: "Value of the lb_csrf cookie set at login." });
    const entry: Record<string, unknown> = {
      summary: op.summary,
      tags: [op.tag],
      parameters: params,
      security: op.auth === "none" ? [] : [{ cookieAuth: [] }],
      "x-permission": op.permission,
      responses: {
        "200": op.sse ? { description: "text/event-stream", content: { "text/event-stream": { schema: { type: "string" } } } } : { description: "OK", content: { "application/json": { schema: { type: "object" } } } },
        "400": { description: "Validation error", content: { "application/json": { schema: errorSchema } } },
        "401": { description: "Unauthenticated", content: { "application/json": { schema: errorSchema } } },
        "403": { description: "Forbidden / gate blocked / CSRF", content: { "application/json": { schema: errorSchema } } },
        "409": { description: "Conflict / invalid state / sold out", content: { "application/json": { schema: errorSchema } } },
        "429": { description: "Rate limited", content: { "application/json": { schema: errorSchema } } },
      },
    };
    if (op.body) entry.requestBody = { required: true, content: { "application/json": { schema: z.toJSONSchema(op.body) } } };
    paths[op.path] ??= {};
    paths[op.path][op.method] = entry;
  }
  return {
    openapi: "3.1.0",
    info: { title: "Lootbox Collectibles API", version: "1.0.0", description: "Versioned REST API. All money values are integer minor units serialized as strings. Errors use { error: { code, message, details, requestId } }." },
    servers: [{ url: "/api/v1" }],
    components: { securitySchemes: { cookieAuth: { type: "apiKey", in: "cookie", name: "lb_session" } } },
    paths,
  };
}
