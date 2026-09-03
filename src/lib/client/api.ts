"use client";

/** Browser API client: same-origin cookies, CSRF header from the lb_csrf cookie, idempotency keys, structured errors. */
export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;
  requestId?: string;
  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[$()*+.?[\\\]^{|}]/g, "\\$&")}=([^;]*)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export function newIdempotencyKey(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json" };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") {
    const csrf = readCookie("lb_csrf");
    if (csrf) headers["X-CSRF-Token"] = csrf;
  }
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;
  const res = await fetch(`/api/v1${path}`, { method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body), credentials: "same-origin", signal: opts.signal });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const e = (json as { error?: { code: string; message: string; details?: unknown; requestId?: string } } | null)?.error;
    throw new ApiError(res.status, e?.code ?? "HTTP_ERROR", e?.message ?? `Request failed (${res.status})`, e?.details, e?.requestId);
  }
  return json as T;
}

/** Subscribe to a server-sent event stream. Returns an unsubscribe function. */
export function subscribeSse(path: string, handlers: Record<string, (data: unknown) => void>, onError?: () => void): () => void {
  if (typeof window === "undefined" || typeof EventSource === "undefined") return () => undefined;
  const es = new EventSource(`/api/v1${path}`, { withCredentials: true });
  for (const [type, fn] of Object.entries(handlers)) {
    es.addEventListener(type, (ev) => {
      try {
        fn(JSON.parse((ev as MessageEvent).data));
      } catch {
        fn(null);
      }
    });
  }
  es.onerror = () => onError?.();
  return () => es.close();
}
