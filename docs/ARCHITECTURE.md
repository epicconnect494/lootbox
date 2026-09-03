# Architecture

## Overview

A single Next.js 16 (App Router) application serves the customer app, the operations console and the versioned REST API. PostgreSQL is the system of record; a worker process drains the transactional outbox and runs schedulers. Redis is optional (rate limiting and realtime fan-out across instances); a database-backed fallback is used when `REDIS_URL` is unset.

```
┌──────────────┐   HTTPS    ┌─────────────────────────────────────────────┐
│ Browser      │──────────▶│ Next.js (app/, api/v1/*)                    │
│ mobile/desk  │◀── SSE ───│  ├─ src/lib/api.ts   route() wrapper        │
└──────────────┘           │  ├─ src/domain/*     services (tx boundary) │
                           │  └─ src/db/*         Drizzle schema/client  │
                           └───────────────┬─────────────────────────────┘
                                           │ SERIALIZABLE transactions
                                           ▼
                           ┌──────────────────────────────┐   ┌───────────┐
                           │ PostgreSQL 16                │   │ Redis     │
                           │ ledger, inventory, manifests,│   │ (optional)│
                           │ receipts, outbox, jobs       │   └───────────┘
                           └──────────────┬───────────────┘
                                          │ poll
                           ┌──────────────▼───────────────┐
                           │ Worker (scripts/worker.ts)   │
                           │ outbox → realtime/email/race │
                           │ schedulers → races/raffles/  │
                           │ seed reveal/pack health      │
                           └──────────────────────────────┘
```

### Layers

| Layer | Location | Responsibility |
|---|---|---|
| Schema | `src/db/schema/*` | 56 normalized tables, enums, constraints, indexes. Money is `bigint` minor units + `currency`. |
| Migrations | `drizzle/*.sql` | Generated DDL plus hand-written guards (append-only triggers, deferred ledger-balance trigger, inventory guard). |
| Domain | `src/domain/*` | Business rules; each mutating function owns its transaction and writes audit + outbox rows inside it. |
| API | `src/app/api/v1/**/route.ts`, `src/api/schemas.ts`, `src/api/openapi.ts` | Thin handlers: validation (zod), auth/permission, CSRF, rate limit, idempotency, structured errors. |
| UI | `src/app/(customer)`, `src/app/admin`, `src/components/*` | Server components read the domain directly; client components call the API. |
| Adapters | `src/adapters/index.ts` | Payments, KYC, geo, storage, email. Mock/local implementations with marked production integration points. |
| Worker | `src/domain/worker.ts`, `scripts/worker.ts` | Outbox drain, DB job queue, schedulers. |

## Key design decisions

**Money.** Every amount is an integer number of minor units stored in `bigint` with a currency code. Node `BigInt` end to end; the `pg` type parser maps `int8` to `BigInt`. Percentages are integer basis points (10000 = 100%). No floats touch money or odds.

**Ledger.** Append-only double-entry. `ledger_transaction` + `ledger_entry` rows can never be updated or deleted (trigger). A deferred constraint trigger rejects any transaction whose entries do not sum to zero at commit. `wallet_account.balance_minor` is maintained by trigger and verified by reconciliation (`npm run reconcile`). User accounts have a `CHECK (balance >= 0)`; system accounts may go negative (they represent counterparties such as the payment processor).

**Immutable pack versions.** A `pack_version` is editable only while `DRAFT`/`REJECTED`. Submitting validates quantities and RTP; approval requires a different user (separation of duties); publishing reserves every unique item / pooled unit, computes the canonical manifest, stores its SHA-256 in `pack_manifest_commitment` and freezes the row. Any change is a new version (clone). Live odds are `quantity_remaining / remaining_openings`, updated in the same transaction as the opening.

**Opening = one serializable transaction.** `openPackInTx` locks the version and outcomes, checks eligibility and funds, increments the user's nonce, draws, decrements inventory, posts the ledger transaction, transfers the physical item into the vault, writes the signed receipt and outbox events. Serialization failures are retried with jitter (`src/lib/tx.ts`). Two layers of idempotency: the `Idempotency-Key` header (stored response replay) and the `opening.idempotency_key` unique index.

**Provably fair.** See `docs/FAIRNESS.md`. Server seeds are 32 random bytes, AES-256-GCM encrypted at rest with AAD binding them to their scope, revealed on rotation or by policy. Receipts are Ed25519-signed canonical JSON.

**Battles.** All pulls of a battle run inside one transaction with a battle-scoped seed whose hash was committed before any player's client seed was known; nonce = `round * seats + seat`. Ties use a fresh nonce beyond all pulls. Settlement transfers ownership in the same transaction. Playback is derived from stored pulls.

**Races.** Scoring is event-sourced: `race_score_event` rows are immutable; reversals append negative rows. Standings are recomputed with a deterministic window function (`points DESC, last_qualifying_at ASC, user_id ASC`). Lock snapshots are hashed; settlement is idempotent via ledger idempotency keys.

**Raffles.** Server-seed hash committed at creation; tickets are append-only with contiguous numbers; closing serializes the canonical ticket list and publishes its hash; the draw combines the revealed seed with declared public randomness; redraws append a new `raffle_draw` and supersede the old one (a trigger prevents any other edit).

**Outbox.** Side effects (realtime, email, fulfillment, race scoring, notifications) are rows written in the domain transaction and processed at-least-once by the worker. Handlers are idempotent.

**Realtime.** Server-Sent Events per channel (`battle:<id>`, `race:<id>`, `raffle:<id>`, `user:<id>`), fanned out in-process with an optional Redis pub/sub bridge.

**Authorization.** Roles → permissions (`src/lib/permissions.ts`). Every admin route declares its permission; the matrix is enforced and tested for every role (`tests/integration/authz.test.ts`).

## Data model

See `src/db/schema/*.ts`. Highlights:

- Unique physical items: `inventory_item` has exactly one `status`, one optional `owner_user_id` and one reservation (`reserved_for_type/id`). `vault_holding` has a partial unique index on `(inventory_item_id) WHERE status='ACTIVE'`. A trigger blocks re-reserving a reserved item and enforces owner/status consistency.
- `ownership_transfer` is the append-only chain of custody.
- Sensitive fields (`fairness_seed.server_seed_encrypted`, `shipment.address_encrypted`, `user_verification.encrypted_payload`) are AES-256-GCM ciphertexts.
- Soft deletion (`deleted_at`) exists for `user`, `pack`, `product_sku`, `inventory_item`; financial, fairness and audit tables are never deleted.

## Request lifecycle (mutating API call)

1. `route()` assigns/propagates `x-request-id`.
2. Session cookie → `user_session` (hashed token) → user + permissions.
3. Permission and account-status checks.
4. CSRF: `X-CSRF-Token` header must equal the session's CSRF secret (also exposed as the `lb_csrf` cookie).
5. Rate limit (Redis or `rate_limit_bucket`).
6. zod validation of params/query/body.
7. Optional idempotency wrapper (`idempotency_key` table, row lock while executing, stored response replay, mismatch → 422).
8. Domain call → serializable transaction → audit + outbox rows.
9. bigint-safe JSON response; errors as `{ error: { code, message, details, requestId } }`.

## Local development

`docker compose up -d` (Postgres + Redis) → `npm run db:migrate` → `npm run db:seed` → `npm run dev` and `npm run worker`. See README.
