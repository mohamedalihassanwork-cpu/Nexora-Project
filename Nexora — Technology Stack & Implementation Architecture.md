# Nexora — Technology Stack & Implementation Architecture

*CTO-level recommendation based on the Requirements v2, User Flow & Edge Cases Spec, System & Data Architecture v1.0 and the Design System. Free-tier terms change often; every cost/limit statement below must be re-verified in the week before launch.*

---

## 1. What Nexora actually demands (read before the stack)

I analysed the workflows first. Seven facts drive every choice below.

1. **Correctness beats throughput.** Two owners and a few hundred orders a day is a tiny load, but every order touches stock, money and a customer promise. The hard problems are *the last unit*, *double accept/deliver/refund*, and *ledger integrity*. These are solved by PostgreSQL constraints and row locks, not by frameworks. The stack must therefore expose SQL (partial unique indexes, `FOR UPDATE SKIP LOCKED`, CAS updates, triggers) instead of hiding it.
2. **Single-instance scale, but unreliable hosts.** Free hosts sleep, restart and get redeployed. Anything that lives only in process memory (timers, queues, locks) is a bug. The architecture's lazy-expiry rule already handles this; the stack must not undermine it.
3. **The people are the bottleneck.** Manual payment verification has a 30-minute review hold (MD-PAY-01) and a 15-minute delivery flag. A missed payment notification costs real orders. *Notifying owners reliably* matters more than sophisticated realtime.
4. **A public, guest-facing attack surface holds sensitive goods.** Credentials, codes and customer account data sit behind unauthenticated checkout/tracking endpoints. Rate limiting, tokens, encryption and log hygiene are first-class.
5. **Arabic-first, RTL, mobile-first, with LTR islands** (phones, IBANs, keys, emails, URLs). This affects component library choice, CSS discipline, fonts and i18n plural rules.
6. **"Zero cost" is a constraint with traps.** Every free tier has one (sleep, pause, non-commercial terms, no backups). I pick *portable primitives* (Postgres, S3 API, Docker) so any trap is a connection-string or deploy-target change.
7. **One transaction spans stock + order + history + ledger.** That argues for a **modular monolith with one database**. Nothing here justifies microservices, queues, Kubernetes or event buses.

---

## 2. Technology decisions

Each block: **Pick → Why/what it solves → Pros → Cons/limits → Alternatives and why not.**

### D1. Language & runtime — TypeScript (strict) on current Node LTS

- **Why:** one language across UI, domain services, validation and tests; shared Zod schemas and enums between storefront, admin and server. Solves typed state machines (order/unit/delivery states as union types) and the "language-neutral enum codes" principle.
- **Pros:** compile-time exhaustive checks on status transitions; huge ecosystem; easiest hiring/AI-assist.
- **Cons:** types vanish at runtime — every boundary (HTTP, DB rows, JSON columns) still needs runtime validation. `numeric` money must never become a JS `number`.
- **Alternatives:** Python/Django (excellent admin, ORM and migrations, but splits language from UI and weaker end-to-end typing); Laravel (fast CRUD, same split); Go (great concurrency, slower UI/product velocity). None beat "one typed language" for a small team.
- **Config:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.

### D2. Application framework — Next.js (App Router), self-hosted as a Docker `standalone` build

- **Why for Nexora:** (a) the storefront needs **server-rendered Open Graph tags** — products get shared on WhatsApp and the link-preview crawler does not run JavaScript; (b) storefront and owner app share one codebase, design tokens and i18n; (c) React Server Components give cheap, typed server reads for admin screens; (d) Route Handlers cover the public API, cron endpoints and beacons.
- **Pros:** largest React ecosystem (shadcn, TanStack, next-intl); one deployable (matches the modular-monolith decision); ISR for catalog pages.
- **Cons:** caching semantics are subtle (mitigation below); RSC/Server Actions have a learning curve; framework churn; some features assume Vercel.
- **Limits:** Server Actions are POST-only and queued per client — fine for owner commands, **wrong for public endpoints and `sendBeacon`**, which must be Route Handlers. ISR with the default in-memory cache is single-instance only (acceptable for MVP).
- **Mitigations:** domain logic lives in `server/modules/*` as plain TypeScript with **zero Next imports**, so the framework is replaceable. Catalog HTML is cached (`revalidate` + tag revalidation on product edit) but **store-open/availability is fetched live (`no-store`)** so cached HTML never claims the store is open when it is not.
- **Alternatives:** *React Router v7 / Remix* (simpler mental model, loaders/actions, no hosting coupling — the strongest alternative; I rank ecosystem and docs depth higher for this team); *SvelteKit/Nuxt* (excellent DX, smaller component/RTL ecosystem); *Hono + Vite SPA* (clear boundary, no SSR → no link previews); *NestJS* (ceremony Nexora doesn't need). **Not Vercel Hobby:** its terms are non-commercial (verify) — self-host the container instead.

### D3. Database — PostgreSQL 17, hosted as plain Postgres on Supabase Free (private schema, no BaaS features)

- **Why:** the architecture depends on partial unique indexes, row locks, `SKIP LOCKED`, `CHECK`, triggers, `numeric`, `jsonb`, `timestamptz`. Only Postgres gives all of these with real transactions. Free tier (per published limits, checked mid-2026): \~500 MB DB, 1 GB file storage, free projects **pause after 7 days of inactivity** (irrelevant for a store with daily traffic and a cron that touches the DB), and **no automatic backups on Free** — so we run our own (D15).
- **Sizing:** an order with history, units, movements and ledger rows is roughly 5–10 KB → comfortably tens of thousands of orders inside 500 MB, because images and proofs live in object storage.
- **Pros:** zero cost; real Postgres, portable by `pg_dump`; direct + pooled connection strings.
- **Cons/limits:** small connection/compute budget; no PITR; pooled port is *transaction-mode* (no prepared statements, no session advisory locks, no `LISTEN/NOTIFY`).
- **Critical security note:** Supabase auto-exposes tables in `public` through its REST API. **Put Nexora tables in a custom schema, disable the Data API, revoke privileges from `anon`/`authenticated`, and never ship the anon key.** Connect with two least-privilege roles: `nexora_app` (no `UPDATE/DELETE` on immutable tables, no DDL) and `nexora_migrator`.
- **Alternatives:** *Neon Free* (no exposure issue, branching is great for staging; scale-to-zero adds cold start in checkout and an always-on keep-warm would burn the compute allowance); *Oracle Always-Free VM + self-hosted Postgres* (full control and big disk, but you own patching, backups and security); *SQLite/Turso* and *Firestore/Mongo* (rejected in the architecture doc for good reason — no multi-row locking guarantees for stock and money). **Do not** use Supabase Auth/RLS/Realtime/Edge Functions: they would move invariants out of reviewable SQL and break portability.

### D4. Data access — Drizzle ORM + `postgres.js`, with hand-written SQL migrations for invariants

- **Why:** Nexora's correctness lives in raw SQL semantics. Drizzle is a thin typed layer over SQL: it supports partial unique indexes, `.for('update', { skipLocked: true })`, `UPDATE … WHERE status = $expected RETURNING` (the CAS pattern), `sql` fragments and returns `numeric` as string (safe for money).
- **Pros:** types inferred from schema; no query-engine abstraction; migrations are plain SQL files you can review.
- **Cons:** relations/query DX is younger than Prisma's; `drizzle-kit` cannot generate triggers, roles/grants or some partial-index predicates — those go in hand-written migration files (we need them anyway: immutability triggers, `REVOKE`, `CHECK`s).
- **Rules:** every repo function takes a `tx`; the allocation primitive and `Finance.post` are written as explicit SQL; set `prepare: false` when using the transaction pooler.
- **Alternatives:** *Prisma* (best DX for CRUD, but no first-class partial unique indexes, no `FOR UPDATE SKIP LOCKED` without raw queries — the two things Nexora needs most); *Kysely* (equally good for SQL fidelity; choose it if you prefer a pure query builder + a separate migration tool like dbmate); *raw SQL + pgTyped/sqlc* (maximum control, slower start).
- **Identifiers:** UUIDv7 (time-ordered; better index locality than v4). Money: store `numeric(12,2)`, hold as integer piastres or `big.js` in code — never `number` arithmetic.

### D5. Authentication & sessions — Better Auth (owners) + a custom checkout token (guests)

- **Why:** only two principals ever log in; no OAuth, no customers. We need email+password, **server-side DB sessions** (instant revocation on owner deactivation, MD-ACC-03), 7-day sliding expiry (MD-ACC-02), password reset, and strong brute-force protection. Better Auth provides these in TypeScript with a Drizzle adapter, built-in rate limiting and a TOTP 2FA plugin.
- **Configuration:** public sign-up **disabled** (owners are created by seed/invite in Settings); Argon2id/scrypt hashing; `HttpOnly; Secure; SameSite=Lax` cookies; **mandatory TOTP for both owners** (they can see credentials and move money; costs nothing); re-check `owners.status='active'` on every request.
- **Password reset at zero cost:** the *other owner* generates a one-time reset link from Settings (shared out-of-band); a CLI break-glass script covers the case where both are locked out. Email (Resend/Brevo free tier) is optional.
- **Guest access:** a 256-bit random **checkout token**, stored only as a hash on the order (`access_token_hash`), delivered in an `HttpOnly` cookie scoped to the checkout path. Tracking uses the two-factor lookup with identical responses for "not found" and "mismatch" (no enumeration) and constant-time comparisons.
- **Cons:** newer library, API still evolving — pin versions, wrap behind `platform/auth`.
- **Alternatives:** *Auth.js* (more mature but credentials flow is deliberately second-class); *hand-rolled sessions* (≈150 lines and perfectly viable — pick it if you distrust a young dependency; never hand-roll the hashing); *Supabase Auth / Clerk / Auth0* (vendor coupling or cost for two users; Clerk's free tier is non-portable).

### D6. Validation — Zod (v4) shared schemas + `libphonenumber-js` + a normalisation layer

- **Why:** one schema validates the browser form, the server command and the JSON columns (`product_fields.validation`, snapshots). Dynamic per-product fields are *built* from `product_fields` into a Zod schema at runtime.
- **Nexora-specific, easy to miss:** a **normalise-then-validate** step that converts Arabic-Indic digits (٠١٢٣…) and Persian digits to ASCII, strips spaces/dashes, trims zero-width/BiDi control characters, and converts Egyptian numbers to E.164 (`+20…`). Without it, tracking lookups, duplicate-item fingerprints, transfer-number matching and the accepted-reference uniqueness rule will silently miss matches because customers type numbers in Arabic digits.
- **Alternatives:** *Valibot* (smaller bundle; fewer integrations), *ArkType* (fastest, newer), *Yup* (older, weaker inference). Zod wins on ecosystem (react-hook-form resolver, Drizzle/Zod helpers, action wrappers).

### D7. State management & data fetching — server-first: RSC reads + TanStack Query for live panels + React Hook Form

- **Why:** almost all state is server state. No global client store is needed. Admin lists/detail pages render on the server; live panels (dashboard counters, order queue, checkout status) use **TanStack Query** with `refetchInterval` and `refetchOnWindowFocus`; forms use **React Hook Form + Zod**; URL-addressable filters use `nuqs`; tiny ephemeral UI state uses `useState` (add Zustand only if a real need appears).
- **Countdown (important):** the API returns `hold_expires_at` **and** `server_now`; the client computes `offset = server_now − Date.now()` and ticks locally. Re-sync on `visibilitychange` (customer returns from the banking app) and every 15 s. Never trust the device clock for decisions — only for display.
- **Money actions are never optimistic.** Show pending state; render only server-confirmed results.
- **Alternatives:** *SWR* (lighter, weaker mutations/invalidation), *Redux Toolkit/RTK Query* (heavier than the problem), *tRPC* (excellent typing, but Server Actions + shared Zod already cover it and tRPC adds a layer).

### D8. UI & design-system implementation — Tailwind CSS v4 + shadcn/ui (Radix) + next-intl + self-hosted fonts

- **Why:** the Design System is a **custom token set** (brand gradient, status colours, 12/16 px radii, elevation levels, strict BiDi rules). Tailwind v4 maps tokens straight from `DESIGN.md` into `@theme`; shadcn/ui gives accessible, copy-in primitives you own (dialogs, bottom sheets, tabs, toasts) rather than fighting a theme engine.
- **RTL discipline:** `<html lang="ar" dir="rtl">`; **logical utilities only** (`ms-/me-/ps-/pe-/start-/end-`; ban `ml-/mr-/pl-/pr-/left-/right-` with a CI grep); Radix `DirectionProvider`; directional icons flip with `rtl:-scale-x-100`, static icons don't (per Design System); a tiny `<Ltr>` component (`dir="ltr"`, `unicode-bidi: isolate`, monospace) wraps every phone/IBAN/key/email/URL. Verify RTL behaviour of each shadcn component you adopt (popover/sheet side props, carousel, slider).
- **i18n:** `next-intl`, Arabic default, ICU messages — **Arabic has six plural categories**, so never hand-roll plurals. Format numbers/dates with `Intl` using `numberingSystem: 'latn'` for money and codes (the Design System specifies tabular monospace numerals) and `ar-EG` for dates in `Africa/Cairo` (Egypt observes DST — never hard-code UTC+2).
- **Fonts:** IBM Plex Sans Arabic + JetBrains Mono via `next/font` (self-hosted, subsetted, `font-display: swap`) — no runtime Google request, better in Egypt's variable networks.
- **Admin tables:** TanStack Table; **toasts:** Sonner; **icons:** lucide-react; **charts:** none in MVP (the requirements prioritise operational clarity over analytics) — add Recharts later.
- **Alternatives:** *MUI* (RTL works through Emotion/stylis but heavy and hard to bend to this design), *Ant Design* (strong admin components and RTL, wrong visual identity and weight on mobile), *Mantine* (good RTL and hooks; the best alternative if you want less assembly), *Chakra*. shadcn wins because the brand is custom and the code is yours.

### D9. Realtime & owner notification — polling "pulse" now; Web Push next; SSE/LISTEN-NOTIFY later

- **Why not SSE/WebSocket on day one:** free PaaS proxies buffer or cut long-lived connections, the transaction pooler cannot carry `LISTEN/NOTIFY`, and the requirement is only "live enough" (MD-DSH-03).
- **MVP:** a cheap `/api/admin/pulse` endpoint returns monotonically increasing counters/IDs (new submissions, cases, low-stock) from indexed queries; the dashboard polls it every 5–10 s (only while the tab is visible) and refetches the affected panels. Customers poll their own order every 10–15 s and on tab focus.
- **Owner notification (cheap, high value):** make the owner app an installable **PWA with Web Push** (VAPID, free) for "new payment to review", "review about to expire", "customer-service case". Owners are mostly on phones, and polling does nothing when the browser is closed. iOS requires the PWA to be installed to the home screen; add a Telegram-bot alert as a fallback channel for the same events.
- **Alternatives:** *SSE* (right once the host is a persistent paid container), *Supabase Realtime* (couples to the BaaS), *Pusher/Ably* (extra vendor; free quotas small), *WhatsApp automation* (explicitly out of scope).

### D10. Background jobs — HTTP-triggered job endpoints driven by a free cron; no queue

- **Why:** the architecture makes jobs *housekeeping, not correctness* (hold sweeper, claim sweeper, nightly reconciliation, backup). Each is idempotent and finishes in seconds.
- **How:** `/api/internal/jobs/<name>` protected by an HMAC/shared-secret header and IP allow-list; triggered every minute by a **Cloudflare Workers Cron Trigger** (free), which also keeps a sleeping free host warm. A GitHub Actions schedule is the redundant second trigger for the nightly jobs. Jobs are advisory-locked by `pg_try_advisory_xact_lock` (works inside a transaction on the pooler) so overlapping runs are harmless.
- **Alternatives:** *pg\_cron* (job runs even if the app host is down — good for the sweeper once logic is expressed in SQL; adds duplicated logic now), *pg-boss* (Postgres-backed queue — **adopt it first** when you need retries/webhooks), *BullMQ/Redis, SQS, Temporal* (extra infrastructure, not justified).

### D11. File & object storage — Cloudflare R2 (S3 API), two buckets

- **Why:** product images (public, cacheable) and optional payment proofs (private). R2's free allowance (\~10 GB, zero egress fees) dwarfs Supabase's 1 GB; the S3 API keeps it portable (Backblaze B2, S3, MinIO locally).
- **Rules:** upload via **presigned PUT** with size/type limits; after upload, the server verifies magic bytes and strips EXIF before marking the file usable; proofs are **private** and shown only through short-lived signed GET URLs to owners; product images are resized once on upload (WebP 400/800/1200 px, `sharp`) and served through the CDN — do not rely on a CPU-limited free host's runtime image optimiser. An orphan-file cleanup job removes uploads never attached to a record.
- **Alternatives:** Supabase Storage (fewer accounts, 1 GB cap), Backblaze B2 (cheap, more setup), storing blobs in Postgres (kills the 500 MB budget), Cloudinary/Uploadthing (vendor limits, non-portable).

### D12. Sensitive-data protection & secrets

- **Pick:** application-layer **AES-256-GCM** (Node `crypto`) for `inventory_items.content`, sensitive `customer_fields`, and — **a gap in the current data model** — `delivery_messages.body_generated/body_final`, which contain the rendered credentials. Each ciphertext carries a **key id** (rotation) and uses the row id as AAD. `content_fingerprint` must be an **HMAC-SHA-256 with a separate secret**, not a plain hash — short codes are brute-forceable from an unkeyed hash.
- **Key custody:** encryption keys live only in the host's secret store plus an **offline copy owned by the owners, separate from DB backups**. Losing the key means losing every credential; leaking it alongside a backup means leaking all of them.
- **Config:** env vars validated at boot with Zod (`@t3-oss/env-nextjs` or a 20-line equivalent); `.env.example` committed, real secrets never; `gitleaks` in CI.
- **Alternatives:** *pgcrypto* (key travels through SQL and logs), *Supabase Vault* (couples to vendor), *cloud KMS* (costs money; adopt envelope encryption with KMS at the growth stage).

### D13. Testing — Vitest + real PostgreSQL integration tests + Playwright

- **Why:** the risks are concurrency and invariants, so tests must hit a real Postgres (Docker locally, a service container in CI). In-memory/WASM Postgres cannot reproduce lock behaviour.
- **Layers:** unit (pure state machines, template rendering, normalisation, money); **concurrency integration tests written before the UI** (parallel last-unit reservation, double accept, double delivery confirm, double refund, A↔B transfers, submit-vs-expiry, buy-vs-shift-close) using separate connections and `Promise.all`; **invariant checks** after every test run (wallet balance = Σ ledger; stock counters = recomputed states; no active unit shares an item); schema tests proving `UPDATE/DELETE` on immutable tables fails for `nexora_app`; Playwright E2E on Chromium **and WebKit with an iPhone profile and `rtl`** for the golden path plus expiry/late-payment; `axe` accessibility checks; a small **k6** script firing 200 simultaneous reserves at one unit before launch.
- **Alternatives:** Jest (slower, more config), Cypress (weaker multi-browser/WebKit), Testcontainers (good, optional wrapper over Docker Compose).

### D14. Deployment & CI/CD — Docker image, GitHub Actions, free container host behind Cloudflare

- **Pick:** one Docker image (Next `standalone`). **Default host:** a free always-on-capable container PaaS (Render or Koyeb class) kept warm by the Cloudflare cron; **fallback:** an Oracle Always-Free ARM VM running the same image behind Caddy. Cloudflare (free) fronts the domain for DNS, CDN, WAF/rate rules and **Turnstile** (free CAPTCHA) on tracking and reservation abuse paths.
- **Host checklist (verify before locking):** commercial use allowed; no forced sleep or a legitimate keep-warm path; Docker or Node supported; secrets manager; WebSocket/SSE not required; deploy from GitHub.
- **Honest cost:** the only mandatory spend is a domain (~~$10–15/year). The first *worthwhile* upgrades, in order: always-on host (~~$7/month), then DB with automated backups/PITR (Supabase Pro \~$25/month). Plan the switch trigger: first month with meaningful real sales.
- **CI:** lint → typecheck → unit → integration (Postgres service) → build → Playwright (on main and release PRs) → apply migrations → deploy. Migrations follow **expand/contract** so a rollback never needs a destructive down-migration.
- **Alternatives:** Vercel Hobby (non-commercial), Cloudflare Workers/OpenNext (attractive and free, but Node-compat gaps, CPU limits and Argon2/sharp friction — not for a first build), Fly.io/Railway (no real free tier now), Kubernetes (never for this).

### D15. Backup & recovery

- **Pick:** GitHub Actions scheduled `pg_dump` (custom format) **every 6 hours** + nightly bucket sync, encrypted with `age`, copied to **two places** (R2 + an owner-controlled drive via rclone). Monthly **restore drill** into a scratch database, run the invariant checks, record the result.
- **Why 6 h:** Free Supabase has no PITR, so RPO equals your dump interval. Because history/ledger tables are append-only, a restore is internally consistent; recent orders can be reconciled from WhatsApp chats and wallet statements.
- **Alternatives:** Supabase Pro daily backups/PITR (do this when you start paying), Neon history window, WAL archiving on a self-hosted VM (best RPO, highest ops load).

### D16. Monitoring, logging & dev tooling

- **Logs:** Pino structured JSON with `request_id`, `order_id`, `actor_owner_id`; **never log credentials, tokens, full phone numbers or request bodies of sensitive routes**; ship to the host's log stream plus a free log tier (Better Stack/Axiom).
- **Errors:** Sentry free tier (scrub PII, disable session replay on owner screens).
- **Uptime:** Better Stack/UptimeRobot on `/api/health` (DB round-trip) and on one public product page.
- **Business health alerts (the valuable ones):** reconciliation drift, orders in `under_review` > 20 min, `expired` orders with a payment submission, delivery stuck in `sent_waiting_confirmation` > 15 min, sweeper silent > 5 min → Telegram/Web Push.
- **Tooling:** pnpm, Biome (format + lint) plus the React-hooks lint rule, `dependency-cruiser` to enforce module boundaries, Lefthook pre-commit, Renovate/Dependabot, `knip`, Docker Compose for Postgres + MinIO + Mailpit.
