import type { DbOrTx } from "@/db/client";
import { adminAuditEvent } from "@/db/schema";
import { hashObject } from "./crypto";

export interface AuditInput {
  actorUserId?: string | null;
  actorRole?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  reason?: string | null;
  before?: unknown;
  after?: unknown;
  correlationId?: string | null;
  ipHash?: string | null;
}

/** Append-only audit row with before/after hashes. Must be called inside the same transaction as the change. */
export async function audit(db: DbOrTx, input: AuditInput): Promise<void> {
  await db.insert(adminAuditEvent).values({
    actorUserId: input.actorUserId ?? null,
    actorRole: input.actorRole ?? null,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    reason: input.reason ?? null,
    beforeHash: input.before === undefined ? null : hashObject(input.before),
    afterHash: input.after === undefined ? null : hashObject(input.after),
    before: input.before === undefined ? null : JSON.parse(JSON.stringify(input.before, (_k, v) => (typeof v === "bigint" ? v.toString() : v))),
    after: input.after === undefined ? null : JSON.parse(JSON.stringify(input.after, (_k, v) => (typeof v === "bigint" ? v.toString() : v))),
    correlationId: input.correlationId ?? null,
    ipHash: input.ipHash ?? null,
  });
}
