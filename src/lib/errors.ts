export type ErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "IDEMPOTENCY_MISMATCH"
  | "INSUFFICIENT_FUNDS"
  | "SOLD_OUT"
  | "PACK_UNAVAILABLE"
  | "GATE_BLOCKED"
  | "LIMIT_EXCEEDED"
  | "RATE_LIMITED"
  | "CSRF_FAILED"
  | "FEATURE_DISABLED"
  | "INVALID_STATE"
  | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  IDEMPOTENCY_MISMATCH: 422,
  INSUFFICIENT_FUNDS: 402,
  SOLD_OUT: 409,
  PACK_UNAVAILABLE: 409,
  GATE_BLOCKED: 403,
  LIMIT_EXCEEDED: 403,
  RATE_LIMITED: 429,
  CSRF_FAILED: 403,
  FEATURE_DISABLED: 403,
  INVALID_STATE: 409,
  INTERNAL: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: unknown;
  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.status = STATUS[code];
    this.details = details;
  }
}

export const err = {
  validation: (msg: string, details?: unknown) => new AppError("VALIDATION_ERROR", msg, details),
  unauthenticated: (msg = "Sign in required") => new AppError("UNAUTHENTICATED", msg),
  forbidden: (msg = "Not allowed") => new AppError("FORBIDDEN", msg),
  notFound: (what = "Resource") => new AppError("NOT_FOUND", `${what} not found`),
  conflict: (msg: string) => new AppError("CONFLICT", msg),
  state: (msg: string) => new AppError("INVALID_STATE", msg),
  funds: (msg = "Insufficient balance") => new AppError("INSUFFICIENT_FUNDS", msg),
  soldOut: (msg = "This pack is sold out") => new AppError("SOLD_OUT", msg),
  gate: (msg: string, details?: unknown) => new AppError("GATE_BLOCKED", msg, details),
  limit: (msg: string, details?: unknown) => new AppError("LIMIT_EXCEEDED", msg, details),
  feature: (msg: string) => new AppError("FEATURE_DISABLED", msg),
};

export function isAppError(e: unknown): e is AppError {
  return e instanceof AppError;
}
