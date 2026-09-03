# Provably fair openings, battles and raffles

## Openings

1. **Commit.** For each user a server seed `S` (32 random bytes, hex) is generated. Only `H = SHA-256(S)` is shown before use. `S` is stored encrypted (AES-256-GCM, AAD `seed:<userId>`).
2. **Client seed.** The user may set any 1–64 character client seed `C` at any time (`PUT /fairness/seed`). Changing it does not reset the nonce.
3. **Nonce.** An integer `n` per seed, incremented atomically inside the opening transaction.
4. **Message.** `M = C + ":" + n + ":" + packVersionId + ":" + manifestHash`. The pack version id and the published manifest hash are locked into the message so the result is bound to one immutable manifest.
5. **Digest.** `D = HMAC-SHA-256(key = S as the hex string's bytes, message = M)` (hex).
6. **Rejection sampling.** Let `R` = remaining openings (sum of remaining quantities). Read `D` in 32-bit big-endian windows `v0, v1, … v7`. `limit = 2^32 − (2^32 mod R)`. The first window with `v < limit` is accepted and `index = v mod R`. If all eight are rejected, extension digests `HMAC(S, M + ":" + k)` for `k = 1, 2, …` are consumed in the same way. This removes modulo bias.
7. **Mapping.** Outcomes are ordered by manifest position with their *remaining* quantities `[q0, q1, …]`; `index` falls into the first outcome whose cumulative range contains it. The receipt records the remaining quantities and a `remainingInventoryCommitment = SHA-256("<outcomeId>=<remaining>|…")`.
8. **Receipt.** The canonical JSON (sorted keys) of all inputs and outputs is signed with Ed25519 (`GET /fairness/public-key`). Fields: opening id/time, pack + version, manifest hash, remaining-inventory commitment, server seed hash, client seed, nonce, message, digest, range, rejection steps, selected index, outcome id/position, item id, value snapshot, ledger transaction id, ownership transfer id.
9. **Reveal.** `S` is revealed when the user rotates their seed (`POST /fairness/seed/rotate`) or automatically after `SEED_REVEAL_AFTER_HOURS` / `SEED_MAX_USES` (worker). After reveal `POST /openings/{id}/verify` and the `/fairness` verifier recompute everything client-side (`src/lib/fairness/verify.ts` uses WebCrypto and has no server dependency).

Test vectors: `docs/fairness-test-vectors.json` (regenerate with `npx tsx scripts/gen-vectors.ts`).

## Battles

- A battle seed is created (hash committed) when the battle is created, before any opponent joins.
- Combined client seed = players' client seeds joined with `|` (first 64 chars), fixed at start.
- Pull nonce = `roundIndex * seats + seatIndex`; each pull is a normal opening receipt against the battle seed with scope = pack version id.
- Tie-break: nonce = `rounds * seats`, scope = battle id, manifestHash = committed seed hash, range = number of tied seats.
- The seed is revealed at settlement. `GET /admin/battles/{id}/receipts` verifies every pull.

## Raffles

- Server seed hash committed at creation.
- On close: tickets sorted by ticket number, `canonicalManifest = JSON.stringify([ticketId, …])`, `manifestHash = SHA-256(canonicalManifest)`.
- Draw: `clientSeed := publicRandomness` (declared independent source), scope := raffle id, nonce 0, 1, 2…; `range = ticketCount`; winners sampled without replacement by skipping already-drawn tickets while incrementing the nonce.
- Redraw appends a new `raffle_draw` with a reason; the previous draw becomes `SUPERSEDED` and is otherwise immutable (database trigger).

## What the animation does

Nothing that affects the result. The client receives the signed settled outcome first, builds a presentation strip deterministically from the opening id (neighbors sampled by disclosed quantities, winner at a fixed landing slot), and animates to it. Refreshing shows the same stored result; there is no path to re-roll.
