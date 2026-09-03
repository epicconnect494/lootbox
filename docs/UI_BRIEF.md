# UI brief (shared by all page work)

Stack: Next.js 16 App Router, React 19, Tailwind v4 (tokens in `src/app/globals.css`), lucide-react icons.

## Data access
- Server components: import domain functions directly (`@/domain/packs`, `@/domain/openings`, `@/domain/vault`, `@/domain/battles`, `@/domain/races`, `@/domain/raffles`, `@/domain/users`, `@/domain/admin`) and use `const { db, session, userId } = await viewer()` from `@/lib/server/data`. Convert results with `json(...)` before passing to client components (bigint → string).
- Client components: `api<T>(path, { method, body, idempotencyKey })` from `@/lib/client/api` (paths relative to `/api/v1`), `newIdempotencyKey()` for POSTs marked idempotent, `subscribeSse(path, { eventType: handler })` for realtime. Errors are `ApiError` with `.code`, `.message`, `.details` (gate failures: `details.reasons[]`).
- Auth: pages that need a user should `redirect("/login?next=<path>")` when `session` is null.
- API contract: see `src/api/openapi.ts` (OPERATIONS) and `src/api/schemas.ts`. Money is always minor-unit strings; format with `moneyStr()` from `@/lib/format`. Probabilities: `probability(num, den)`.

## Visual rules
- Premium black-glass collector vault; deep ink background; `glass` panels; iridescent violet/cyan highlights (`text-iris`, `ring-iris`).
- **Pink (`crazy-*`, `Badge tone="crazy"`, `CrazyBanner`) only for Crazy Mode. Lime (`lime-*`) only for verified / winning states.**
- Product imagery is the hero: use `<ItemArt name accent imageKey size />` from `@/components/art/ItemArt`.
- Typography: `font-display` (Syne) for headings/numbers, body is Inter. 
- Components: `Button`, `ButtonLink`, `Panel`, `Badge`, `tierTone`, `Stat`, `Field`, `Input`, `Select`, `Textarea`, `ProbabilityBar`, `SectionTitle`, `Empty`, `Mono`, `CrazyBanner`, `cx` from `@/components/ui/primitives`; `useToast()` from `@/components/ui/toast`.
- Mobile-first. Bottom nav (Discover, Drops, Battle, Vault, Account) and desktop sidebar are already in `CustomerShell`; main content max-width is handled by the shell.
- Accessibility: WCAG AA contrast (use `text-ink-300`+ on dark), keyboard operable, visible focus (global), 44px targets (`tap` class), `aria-live` for dynamic results, reduced-motion respected (global CSS + `Reel` handles it).
- Tables must be wrapped in `<div className="table-wrap">`.
- Never imply legal approval; show RTP basis explicitly ("Sell-back RTP" vs "Merchandise RTP").
- No casino tropes: no slot-machine chrome, no flashing "WIN", no fake urgency.

## Reel
`<Reel openingId outcomes winner speed autoplay onComplete skipAnimation compact />` from `@/components/reel/Reel` (client). The opening is settled before the reel renders; `skipAnimation` for resume (`opening.revealedAt` set) and reduced motion.

## Files you may create
Pages under your assigned routes and components under `src/components/<area>/`. Do not edit shared foundation files (`globals.css`, primitives, shells, domain, api) — if something is missing, add a new component or note it in your final report.

## Verification
Run `npx tsc --noEmit` and `npx eslint <your files>` until clean. Do NOT run `next build` or `next dev` (another process owns `.next`).
