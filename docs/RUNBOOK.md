# Operational runbook

## Services
- **web**: `npm run start` (Next.js). Health `GET /api/v1/health`, readiness `GET /api/v1/ready`.
- **worker**: `npm run worker`. Drains outbox every 2s, runs schedulers every ~30s (races, raffles, seed reveal, scheduled publishes, auto-pause).
- **postgres**, **redis** (optional).

## Daily checks
1. `npm run reconcile` → exit 0 and `ok: true`. Any problem lists the failing invariant with row ids. Do not run settlements until resolved.
2. Admin → Dashboard: realized RTP vs target, liability, auto-paused packs.
3. Outbox lag: `SELECT count(*) FROM outbox_event WHERE processed_at IS NULL;` should be near zero. Rows with `attempts >= 10` are dead-lettered (processed_at set, last_error populated) and need manual replay: `UPDATE outbox_event SET processed_at = NULL, attempts = 0 WHERE id = …` (the only allowed edit on this table).

## Incidents

**Pack auto-paused.** Reason is in `pack_version.pause_reason` and the audit log. Fix the cause (refresh valuation via Admin → Inventory → Record valuation, restore inventory, raise liability limit with approval) then Resume in Admin → Version. Resume re-runs the health check.

**Serialization conflicts spike (`409 CONFLICT` from API).** Expected under contention; the tx helper retries up to 30 times. If sustained, check long-running admin transactions holding locks.

**Ledger invariant failure.** Freeze payouts (disable `finance.write` role or stop the worker). Identify the transaction from `reconcile` output. Ledger rows cannot be edited; post a compensating `ADJUSTMENT` transaction with a reason after review.

**Battle needs voiding.** Admin → Battles → Void (requires `battles.void` and a written reason). Allowed only while every item is still in the recipients' vaults; otherwise refund manually via Finance → Refund and document in audit.

**Raffle redraw.** Admin → Raffles → Redraw with a ≥20-character reason and a new public randomness value. The original draw remains visible as SUPERSEDED.

**Seed rotation policy change.** `SEED_REVEAL_AFTER_HOURS`, `SEED_MAX_USES` env vars; worker applies them.

**Key rotation.**
- `RECEIPT_SIGNING_KEY_PEM_B64`: generate with `node -e "console.log(Buffer.from(require('crypto').generateKeyPairSync('ed25519').privateKey.export({type:'pkcs8',format:'pem'})).toString('base64'))"`. Old receipts keep their `signing_key_id`; publish old public keys alongside.
- `DATA_ENCRYPTION_KEY`: requires re-encrypting `fairness_seed.server_seed_encrypted`, `shipment.address_encrypted`, `user_verification.encrypted_payload` (write a migration job; not included).

## Backups / retention
Ledger, receipts, audit, manifests and draws are append-only and must be retained per regulation. Use PITR on Postgres.

## Deploy
1. `npm run verify` (typecheck, lint, tests, build).
2. `npm run db:migrate` against the target database (migrations are forward-only).
3. Roll web, then worker.
