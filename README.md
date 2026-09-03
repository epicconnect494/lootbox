# Lootbox Vault

A production-oriented, mobile-first platform for opening **authenticated physical collectible packs**: finite, inventory-backed manifests with every outcome and exact probability disclosed, provably fair server-side settlement, a custody vault with ship / sell-back / list, battles (Classic, **Crazy Mode**, Shared, Keep), a weekly race and provably fair raffles, plus a role-based operations console.

> **Not legal advice, not legally approved.** Every paid mechanic (paid chance, battles, raffles, cash/crypto conversion, free-entry routes, bots) is switched off by default per jurisdiction and must be enabled in the `jurisdiction` table only after legal approval for that market. The seeded `DEMO` region enables everything for local development only.

## Stack

| Concern | Choice |
|---|---|
| Frontend + API | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, lucide icons |
| Database | PostgreSQL 16 + Drizzle ORM, SQL migrations (`drizzle/`) |
| Jobs / cache | Transactional outbox + DB-backed job queue (`job` table); optional Redis for rate limits and multi-instance realtime |
| Realtime | Server-Sent Events (`/api/v1/{battles,race,raffles}/{id}/events`, `/api/v1/account/events`) |
| Storage | Adapter with local filesystem implementation (`STORAGE_PROVIDER=local`) |
| Tests | Vitest (unit + property + integration against Postgres), Playwright (e2e, mobile + desktop) |

**Deviation from the original repository.** The previous contents were a float-based CLI/webpack prototype with no persistence. It is replaced wholesale; the reel concept survives as `src/components/reel/Reel.tsx`, but money, odds and settlement now run on exact integer arithmetic against the database.

## Quick start

```bash
cp .env.example .env            # dev defaults, no secrets
docker compose up -d            # Postgres 16 + Redis 7
npm install
npm run db:migrate              # applies drizzle/*.sql (schema + triggers)
npm run db:seed                 # demo data through the real domain code (~3s)
npm run dev                     # http://localhost:3000
npm run worker                  # second terminal: outbox drain + schedulers
```

Without Docker, point `DATABASE_URL` at any Postgres 16 and leave `REDIS_URL` empty (DB fallbacks are used).

### Demo accounts (password `demo-password-123`)

| Email | Role |
|---|---|
| customer@demo.lootbox | Customer (verified, funded) |
| nova@ / kai@ / sol@demo.lootbox | Customers (battle participants) |
| fresh@demo.lootbox | Customer (unverified, unfunded) |
| support@demo.lootbox | Support |
| risk@demo.lootbox | Risk & Compliance |
| catalog@demo.lootbox | Catalog Manager |
| finance@demo.lootbox | Finance (approvals, settlements, draws) |
| admin@demo.lootbox | Super Admin |

Admin console: `/admin` (visible to any role with `admin.access`).

## Commands

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run worker` | Outbox drain, job queue, schedulers (races, raffles, seed reveal, scheduled publish, auto-pause) |
| `npm run db:migrate` | Apply migrations |
| `npm run db:generate` | Generate a migration from schema changes |
| `npm run db:seed` | Seed demo data (idempotent) |
| `npm run db:reset` | Drop, migrate, seed (refuses in production) |
| `npm run reconcile` | Invariant checks: ledger balance, materialized balances, vault ownership, manifest quantities, receipts, battle pulls, race settlement totals. Exit code 2 on problems. |
| `npm run openapi` | Regenerate `docs/openapi.json` (also served at `/api/v1/openapi.json`) |
| `npm run typecheck`, `npm run lint` | TypeScript, ESLint |
| `npm run test` | Unit + property tests |
| `npm run test:integration` | Integration tests against `TEST_DATABASE_URL` (schema is recreated) |
| `npm run test:e2e` | Playwright (starts `next dev` on port 3100; needs a seeded `DATABASE_URL`) |
| `npm run verify` | typecheck + lint + all vitest projects + production build |

## What is real

Everything the customer sees is backed by database transactions:

- **Openings** settle in one `SERIALIZABLE` transaction (`src/domain/openings.ts`): eligibility + balance → atomic nonce → HMAC-SHA-256 draw with rejection sampling → inventory decrement → double-entry ledger debit → physical item into the vault → Ed25519-signed receipt → outbox. The animation only visualises the stored result; refreshing `/openings/{id}` shows the same result.
- **Ledger** is append-only double-entry with a deferred database trigger that rejects unbalanced transactions and a check that user balances never go negative.
- **Inventory** is reserved on publish and consumed on opening; unique items have exactly one owner/reservation (partial unique index + trigger). Concurrent last-item opens are tested.
- **RTP** is exact integer basis points computed from the immutable manifest; the builder targets **90.00% sell-back RTP** (±0.50%) and displays merchandise RTP alongside. Public pages label which figure is shown.
- **Battles** run every pull and the settlement in one transaction with a pre-committed battle seed; Crazy Mode shows the pink “LOWEST TOTAL WINS” banner during creation, confirmation and play.
- **Races** score immutable qualified events, exclude reversals, lock a hashed snapshot, run fraud review and settle idempotently.
- **Raffles** commit the server-seed hash at creation, publish a manifest hash at close, draw with public randomness and only ever *append* redraws.

## Fairness

See `docs/FAIRNESS.md`, the `/fairness` page (plain-language explanation + in-browser verifier), `src/lib/fairness/verify.ts` (pure verifier) and `docs/fairness-test-vectors.json`.

## Repository map

```
src/db/schema/        Drizzle schema (56 tables)            drizzle/            SQL migrations + guards
src/domain/           services (ledger, gates, inventory,   src/app/api/v1/     REST routes
                      packs, openings, vault, battles,      src/api/            zod schemas + OpenAPI
                      races, raffles, users, admin, worker) src/app/(customer)  customer app
src/lib/              money, rtp, fairness, crypto, auth,   src/app/admin       operations console
                      api wrapper, idempotency, ratelimit   src/components/     UI
src/adapters/         payments/KYC/geo/storage/email        tests/, e2e/        vitest + playwright
scripts/              migrate, seed, worker, reconcile      docs/               architecture, threat model, runbook
```

## Assumptions

- One live version per pack; a new version supersedes (closes) the previous one and releases its unreserved inventory.
- Pooled SKUs materialise a physical `inventory_item` row when won so every vault holding is a concrete unit.
- Sell-back offer is exactly the amount disclosed on the pack page at the time of winning (`sellback-v1:disclosed-offer`); marketplace fee 5%.
- Race scoring: 10 pts per whole currency unit spent + 5 per opening/battle entry, capped at 2000 per event; no-purchase promo entries earn the same rate.
- SHARED battles deal the pooled items in snake order by rank (disclosed before entry).
- Battle voids reverse ownership only while every item is still in a vault; refunds all entries.

## Production integration points

Marked `PRODUCTION INTEGRATION POINT` in code:

- `src/adapters/index.ts`: Stripe/Adyen payments (webhook settlement), Persona/Onfido KYC, MaxMind geo, S3 storage, SES/Postmark email.
- `src/lib/fairness/node.ts`: `RECEIPT_SIGNING_KEY_PEM_B64` from a secret manager / HSM (dev derives a deterministic key).
- `src/lib/log.ts`: OpenTelemetry / Sentry exporters.
- `src/domain/worker.ts`: WMS/3PL fulfillment push; BullMQ adapter for the job queue.
- `src/lib/realtime.ts`, `src/lib/ratelimit.ts`: set `REDIS_URL` for multi-instance deployments.

## Security notes

Secrets only via environment (`.env.example` contains placeholders). Sensitive fields (server seeds, shipping addresses, KYC payloads) are AES-256-GCM encrypted. Sessions are hashed random tokens in `HttpOnly` cookies with a double-submit CSRF secret. All admin routes are permission-checked and tested for every role. See `docs/THREAT_MODEL.md`.
