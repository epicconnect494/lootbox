/**
 * Structured logging + metrics + error tracking adapters.
 * PRODUCTION INTEGRATION POINT: swap `sink` for OpenTelemetry / Datadog / Sentry exporters.
 * Never log secrets or PII: callers must pass hashed identifiers only.
 */
type Level = "debug" | "info" | "warn" | "error";
const REDACT = /(password|secret|seed|token|authorization|cookie|address|email)/i;

function redact(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) out[k] = REDACT.test(k) ? "[redacted]" : v;
  return out;
}

const sink = {
  write(level: Level, msg: string, fields: Record<string, unknown>) {
    const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...redact(fields) });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else if (process.env.LOG_LEVEL === "debug" || level !== "debug") console.log(line);
  },
};

export const log = {
  debug: (msg: string, fields: Record<string, unknown> = {}) => sink.write("debug", msg, fields),
  info: (msg: string, fields: Record<string, unknown> = {}) => sink.write("info", msg, fields),
  warn: (msg: string, fields: Record<string, unknown> = {}) => sink.write("warn", msg, fields),
  error: (msg: string, fields: Record<string, unknown> = {}) => sink.write("error", msg, fields),
};

const counters = new Map<string, number>();
export const metrics = {
  increment(name: string, by = 1, tags: Record<string, string> = {}) {
    const key = `${name}${Object.keys(tags).length ? ":" + JSON.stringify(tags) : ""}`;
    counters.set(key, (counters.get(key) ?? 0) + by);
  },
  timing(name: string, ms: number, tags: Record<string, string> = {}) {
    log.debug("metric.timing", { name, ms, ...tags });
  },
  snapshot(): Record<string, number> {
    return Object.fromEntries(counters);
  },
};

export const errorTracker = {
  capture(e: unknown, context: Record<string, unknown> = {}) {
    const message = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    log.error("exception", { message, stack, ...context });
  },
};
