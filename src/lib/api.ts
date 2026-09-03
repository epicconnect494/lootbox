import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { getDb } from "@/db/client";
import { AppError, isAppError } from "./errors";
import { errorTracker, log, metrics } from "./log";
import { resolveSessionByToken, type Session } from "./auth";
import { config } from "./config";
import type { Permission } from "./permissions";
import { rateLimit } from "./ratelimit";
import { randomToken } from "./crypto";
import { withIdempotency } from "./idempotency";
import { isRetryableTxError } from "./tx";

export interface HandlerContext<B, Q, P> {
  req: NextRequest;
  body: B;
  query: Q;
  params: P;
  session: Session | null;
  requestId: string;
  ip: string | null;
  idempotencyKey: string | null;
}

export interface RouteOptions<B, Q, P> {
  auth?: "none" | "optional" | "user" | "admin";
  permission?: Permission;
  body?: ZodType<B>;
  query?: ZodType<Q>;
  params?: ZodType<P>;
  /** Mutating handlers require a CSRF header when a cookie session is present. Defaults true for non-GET. */
  csrf?: boolean;
  rateLimit?: { max: number; windowSec: number; key?: "ip" | "user" };
  /** When set, the handler is wrapped in idempotency keyed by the Idempotency-Key header (required). */
  idempotent?: string;
}

export type ApiResponse = { status?: number; body: unknown; headers?: Record<string, string> };

export function ok(body: unknown, status = 200): ApiResponse {
  return { status, body };
}

function jsonify(v: unknown): unknown {
  return JSON.parse(JSON.stringify(v, (_k, val) => (typeof val === "bigint" ? val.toString() : val)));
}

export function errorResponse(e: unknown, requestId: string): NextResponse {
  if (isAppError(e)) {
    return NextResponse.json({ error: { code: e.code, message: e.message, details: e.details ?? null, requestId } }, { status: e.status, headers: { "x-request-id": requestId } });
  }
  if (e instanceof z.ZodError) {
    return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: "Invalid request", details: e.issues, requestId } }, { status: 400, headers: { "x-request-id": requestId } });
  }
  if (isRetryableTxError(e)) {
    return NextResponse.json({ error: { code: "CONFLICT", message: "Please retry", details: null, requestId } }, { status: 409, headers: { "x-request-id": requestId } });
  }
  errorTracker.capture(e, { requestId });
  return NextResponse.json({ error: { code: "INTERNAL", message: "Internal error", details: null, requestId } }, { status: 500, headers: { "x-request-id": requestId } });
}

/**
 * Route factory. Handles: request id, auth/permissions, CSRF, rate limits, validation,
 * idempotency, structured errors, bigint-safe JSON.
 */
export function route<B = undefined, Q = undefined, P = Record<string, string>>(opts: RouteOptions<B, Q, P>, handler: (ctx: HandlerContext<B, Q, P>) => Promise<ApiResponse>) {
  return async (req: NextRequest, routeCtx?: { params?: Promise<Record<string, string>> | Record<string, string> }): Promise<NextResponse> => {
    const requestId = req.headers.get("x-request-id") ?? randomToken(8);
    const started = Date.now();
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    try {
      const db = getDb();
      const token = req.cookies.get(config.session.cookieName)?.value;
      const session = token ? await resolveSessionByToken(db, token) : null;
      const auth = opts.auth ?? "user";
      if ((auth === "user" || auth === "admin") && !session) throw new AppError("UNAUTHENTICATED", "Sign in required");
      if (session && session.user.status === "SUSPENDED" && auth !== "none") throw new AppError("FORBIDDEN", "Account suspended");
      if (auth === "admin" && !session!.user.permissions.has("admin.access")) throw new AppError("FORBIDDEN", "Admin access required");
      if (opts.permission && !session?.user.permissions.has(opts.permission)) throw new AppError("FORBIDDEN", `Missing permission ${opts.permission}`);

      const mutating = req.method !== "GET" && req.method !== "HEAD";
      const csrfRequired = opts.csrf ?? mutating;
      if (csrfRequired && session) {
        const header = req.headers.get("x-csrf-token");
        if (!header || header !== session.csrfSecret) throw new AppError("CSRF_FAILED", "CSRF token missing or invalid");
      }

      if (opts.rateLimit) {
        const keyBase = opts.rateLimit.key === "user" && session ? `u:${session.user.id}` : `ip:${ip ?? "unknown"}`;
        const rl = await rateLimit(`${req.nextUrl.pathname}:${keyBase}`, opts.rateLimit);
        if (!rl.allowed) throw new AppError("RATE_LIMITED", "Too many requests", { retryAfterSec: rl.resetSec });
      } else if (mutating) {
        const rl = await rateLimit(`mut:${session ? `u:${session.user.id}` : `ip:${ip ?? "unknown"}`}`);
        if (!rl.allowed) throw new AppError("RATE_LIMITED", "Too many requests", { retryAfterSec: rl.resetSec });
      }

      const rawParams = routeCtx?.params ? await routeCtx.params : {};
      const params = (opts.params ? opts.params.parse(rawParams) : rawParams) as P;
      const queryObj = Object.fromEntries(req.nextUrl.searchParams.entries());
      const query = (opts.query ? opts.query.parse(queryObj) : queryObj) as Q;
      let body: B = undefined as B;
      if (opts.body) {
        let raw: unknown = null;
        try {
          raw = await req.json();
        } catch {
          raw = null;
        }
        body = opts.body.parse(raw);
      }
      const idemKey = req.headers.get("idempotency-key");
      const ctx: HandlerContext<B, Q, P> = { req, body, query, params, session, requestId, ip, idempotencyKey: idemKey };

      let result: ApiResponse;
      if (opts.idempotent) {
        if (!idemKey || idemKey.length < 8 || idemKey.length > 160) throw new AppError("VALIDATION_ERROR", "Idempotency-Key header (8-160 chars) is required");
        const r = await withIdempotency(opts.idempotent, session?.user.id ?? null, idemKey, { body: jsonify(body), params }, async () => {
          const res = await handler(ctx);
          return { status: res.status ?? 200, body: jsonify(res.body) };
        });
        result = { status: r.status, body: r.body, headers: r.replayed ? { "idempotent-replayed": "true" } : undefined };
      } else {
        result = await handler(ctx);
      }
      metrics.increment("http.requests", 1, { path: req.nextUrl.pathname, status: String(result.status ?? 200) });
      log.debug("http", { method: req.method, path: req.nextUrl.pathname, status: result.status ?? 200, ms: Date.now() - started, requestId });
      return NextResponse.json(jsonify(result.body), { status: result.status ?? 200, headers: { "x-request-id": requestId, ...(result.headers ?? {}) } });
    } catch (e) {
      metrics.increment("http.errors", 1, { path: req.nextUrl.pathname });
      if (!isAppError(e) && !(e instanceof z.ZodError)) log.error("http.unhandled", { path: req.nextUrl.pathname, requestId, message: (e as Error)?.message });
      return errorResponse(e, requestId);
    }
  };
}

export const paginationQuery = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(24),
});
export type PaginationQuery = z.infer<typeof paginationQuery>;

export function page<T extends { id: string }>(rows: T[], limit: number): { items: T[]; nextCursor: string | null } {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? items[items.length - 1].id : null };
}
