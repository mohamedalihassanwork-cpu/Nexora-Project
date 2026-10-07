# Nexora — Final Implementation Task Plan
## Phase 3 · October 2026

> **Status:** All architecture decisions finalized. All 118 User Flow decisions answered. Ready for direct execution.
> **Stack:** TypeScript · Next.js (App Router) · PostgreSQL 17 · Drizzle ORM · Better Auth · Tailwind CSS v4 · shadcn/ui · Cloudflare R2 · Vitest · Playwright
> **Locale:** Arabic-first, RTL, EGP, Africa/Cairo

---

## PHASE 0 — Foundation & Infrastructure

---

### NEX-001 — Project Scaffold & Developer Tooling

**STATUS: DONE**

**Target:** A fully configured monorepo with working local development environment, enforced code quality, and a runnable CI pipeline skeleton — before any domain code is written.

**Description:**
Initialize the Next.js App Router project with TypeScript strict mode, configure all tooling (Biome, Lefthook, Renovate, knip, dependency-cruiser), create the `docker-compose.yml` for local Postgres + MinIO + Mailpit, write the module boundary rules, scaffold the `server/modules/` directory structure, and configure the GitHub Actions CI skeleton (lint → typecheck → build). Self-hosted IBM Plex Sans Arabic and JetBrains Mono fonts via `next/font`. Tailwind CSS v4 installed with the design token file from DESIGN.md mapped into `@theme`.

**Affected Models:** None.

**Affected Modules:** Platform (project structure, tooling, CI/CD skeleton).

**Dependencies:** None.

**Parallelizable:** No — everything else depends on this.

**Acceptance Criteria:**
- `pnpm dev` starts the Next.js app locally with hot reload.
- `pnpm lint` runs Biome with zero errors on the empty scaffold.
- `pnpm typecheck` passes with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `docker-compose up` starts Postgres 17, MinIO, and Mailpit with no errors.
- GitHub Actions CI pipeline runs lint + typecheck + build on every push to `main`.
- `dependency-cruiser` rules reject any import from `server/modules/A` into `server/modules/B` that violates the declared dependency direction.
- `gitleaks` scan finds no secrets in the repository.
- Lefthook pre-commit hook runs Biome format + typecheck before every commit.
- IBM Plex Sans Arabic and JetBrains Mono load from `next/font` with no external Google Fonts requests in the browser.
- Tailwind `@theme` contains all color tokens, typography scale, spacing, and border radii from DESIGN.md.
- `dir="rtl"` and `lang="ar"` are set on the root `<html>` element.
- `.env.example` is committed; no real secrets are present in any committed file.

**Source References:** Tech Stack §D1, §D8, §D14, §D16; Requirements §4.1 (Arabic-first); Design System (typography, tokens).

---

### NEX-002 — Database Schema Bootstrap & Security Hardening

**STATUS: DONE**
**Target:** A live PostgreSQL database on Supabase with all tables, constraints, indexes, roles, and immutability triggers created in a single baseline migration — with the public schema locked down before any data enters.

**Description:**
Create the `nexora` custom schema. Revoke all privileges on `public` from `anon` and `authenticated`. Disable the Supabase Data API (REST/GraphQL) for the `nexora` schema. Create two DB roles: `nexora_app` (no `UPDATE/DELETE` on immutable tables, no DDL) and `nexora_migrator`. Write the baseline SQL migration covering all tables from Architecture §3: `owners`, `shifts`, `settings`, `categories`, `products`, `product_fields`, `product_images`, `message_templates`, `message_template_versions`, `payment_accounts`, `inventory_items`, `stock_pools`, `inventory_movements`, `orders`, `order_units`, `order_flags`, `order_status_history`, `payment_submissions`, `payment_reviews`, `deliveries`, `delivery_messages`, `delivery_errors`, `replacement_cases`, `refund_cases`, `support_cases`, `wallets`, `ledger_entries`, `transfers`, `expenses`, `audit_log`, `idempotency_keys`. Create all partial unique indexes (one open shift, one active unit per item, one default template per type, one active delivery per order, one sale per delivery, one reversal per entry). Add `CHECK` constraints (counters ≥ 0, amounts, enums). Write immutability triggers on 🔒 tables that `RAISE EXCEPTION` on `UPDATE/DELETE`. Implement the `expand/contract` migration pattern for future safety.

> **Critical:** The `UNIQUE (accepted_reference_norm) WHERE decision='accepted'` constraint from the original Architecture doc is **NOT created** (GAP-01 decision). The `waiting_for_account_owner` value is **NOT added** to the `order_flags.flag` enum (GAP-04 decision).

**Affected Models:** All 31 tables.

**Affected Modules:** Platform (Database).

**Dependencies:** NEX-001.

**Parallelizable:** No — all domain modules depend on this.

**Acceptance Criteria:**
- Running `psql -U nexora_app` cannot `UPDATE` or `DELETE` on any 🔒 table; trigger raises.
- Running as `nexora_app`, `INSERT` into `public.anything` fails with permission denied.
- The Supabase REST API returns 403 for any table in the `nexora` schema using the anon key.
- Partial unique index test: inserting two rows into `shifts` with `closed_at IS NULL` raises a unique violation.
- Partial unique index test: inserting the same `inventory_item_id` into two `order_units` with `state IN ('held','delivered')` raises a unique violation.
- All `stock_pools` counters reject negative values via `CHECK`.
- `ledger_entries.amount` accepts negative values (signed amounts allowed).
- `payment_reviews` does **not** have a `UNIQUE(accepted_reference_norm)` constraint.
- `order_flags.flag` CHECK does **not** include `waiting_for_account_owner`.
- `pg_dump` of the schema produces a valid restore on a fresh Postgres 17 instance.
- All UUIDs are v7 format.
- `migrate.ts` script applies all migrations idempotently (running twice is safe).

**Source References:** Architecture §3 (all subsections); Tech Stack §D3, §D4; GAP-01 (no unique constraint); GAP-04 (no waiting_for_account_owner flag).

---

### NEX-003 — Object Storage Setup

**Target:** Two Cloudflare R2 buckets operational — one public (product images with CDN) and one private (payment proofs with signed URLs) — with a server-side presigned upload flow and post-upload image processing.

**Description:**
Create two R2 buckets: `nexora-images` (public, CDN-served) and `nexora-proofs` (private). Implement the presigned PUT upload flow: client requests a presigned URL from the server, uploads directly to R2, then notifies the server to verify and process. Post-upload server-side verification: read magic bytes from R2, strip EXIF, reject non-image files. For product images: resize to WebP at 400/800/1200px using `sharp` and store all three variants. For payment proofs: store as-is (private); generate short-lived signed GET URLs (15 min expiry) for owner access. Implement orphan-file cleanup job registration (the job itself is NEX-037). Store only the `file_key` in the database — never the full URL.

**Affected Models:** `product_images` (file_key), `payment_submissions` (proof_file_key).

**Affected Modules:** Platform (Object Storage); Catalog (image upload); Payments (proof upload).

**Dependencies:** NEX-001.

**Parallelizable:** Yes — with NEX-002, NEX-004.

**Acceptance Criteria:**
- Uploading a valid JPEG via the presigned flow results in three WebP variants stored in `nexora-images`.
- Uploading a PHP file disguised as JPEG is rejected after magic-byte check.
- A signed GET URL for a proof file expires after 15 minutes (verified by attempting access after expiry).
- Uploading a 20MB file is rejected at the presigned-URL generation step with a file-size error.
- `sharp` WebP conversion runs on the application server, not on a CDN edge.
- `file_key` stored in DB; no full R2 URL is ever stored in any DB column.
- EXIF metadata is stripped from all processed images (verified with `exiftool` on output).

**Source References:** Tech Stack §D11; Requirements §27 (product images); Architecture §1.2 (Object storage).

---

### NEX-004 — Authentication Foundation

**Target:** Owner login with email + password + mandatory TOTP 2FA, server-side DB sessions with 7-day sliding expiry, instant revocation on deactivation, break-glass CLI, and a guest checkout token system.

**Description:**
Install and configure Better Auth with the Drizzle adapter. Disable public sign-up. Configure Argon2id password hashing. Implement email + password login, 7-day sliding session with `HttpOnly; Secure; SameSite=Lax` cookies. Enforce mandatory TOTP 2FA for all owner accounts (enroll on first login, block access until enrolled). Every request middleware re-checks `owners.status = 'active'`. Password reset: the other owner generates a one-time reset link from Settings. Break-glass CLI script for when both owners are locked out. Implement the guest **checkout token**: 256-bit random token, stored only as a hash (`access_token_hash`) on the order, delivered in an `HttpOnly` cookie scoped to `/checkout/[orderId]`. All public API handlers that need order access validate the token with constant-time comparison. Pin the Better Auth version; wrap behind `platform/auth.ts`.

**Affected Models:** `owners` (password_hash, status), `orders` (access_token_hash).

**Affected Modules:** Identity; Platform (Auth).

**Dependencies:** NEX-002.

**Parallelizable:** Yes — with NEX-003 once NEX-002 is done.

**Acceptance Criteria:**
- An owner with `status = 'deactivated'` cannot authenticate even with valid credentials.
- An owner without TOTP enrolled cannot access any protected route after password verification.
- A session cookie is `HttpOnly`, `Secure`, `SameSite=Lax` in all environments.
- Session re-validates `owners.status` on every request; deactivating a logged-in owner invalidates their next request.
- The checkout token cookie is scoped to `/checkout/[orderId]` and not readable by JavaScript (`HttpOnly`).
- Constant-time comparison is used for token validation (no early-exit string comparison).
- Public sign-up endpoint returns 404 or 405.
- Break-glass CLI script can reset an owner's password and TOTP seed from the server terminal.
- Session expiry slides: a request within the 7-day window resets the 7-day clock.
- `platform/auth.ts` is the only file that imports from `better-auth`; all other modules use the wrapper.

**Source References:** Tech Stack §D5; User Flow §5.1 (owner sign-in); Architecture §1.2; Requirements §32 (individual login, accountability); MD-ACC-02, MD-ACC-03.

---

## PHASE 1 — Core Domain Foundation

---

### NEX-005 — Identity Module

**Target:** The `owners` table and service with full accountability support — creation, deactivation, and attribution wiring.

**Description:**
Implement the `Identity` module: `owners` table operations (create, read, deactivate — never delete), owner listing for attribution dropdowns, and the seed script that creates the two initial owners. The module exposes `Identity.getOwner(id)`, `Identity.listOwners()`, `Identity.deactivate(id, actorId)`. Deactivation writes to `audit_log`. The module never accepts a delete command. Owner IDs are referenced as `actor_owner_id` across all history tables.

**Affected Models:** `owners`, `audit_log`.

**Affected Modules:** Identity.

**Dependencies:** NEX-002, NEX-004.

**Parallelizable:** Yes — with NEX-006, NEX-007, NEX-008, NEX-009, NEX-010.

**Acceptance Criteria:**
- `Identity.deactivate()` sets `status = 'deactivated'`; a subsequent login attempt fails.
- `Identity.deactivate()` writes a row to `audit_log` with `action='owner.deactivate'`, `actor_owner_id`, `before` and `after` JSONB.
- No `DELETE FROM owners` is permitted by any code path.
- Seed script creates exactly 2 owners with hashed passwords; running twice is idempotent.
- `Identity.listOwners()` includes deactivated owners (for attribution display).

**Source References:** Requirements §32; MD-ACC-01, MD-ACC-03; Architecture §3.1.

---

### NEX-006 — Settings Module

**Target:** A typed, audited global key-value settings store with validated ranges for all system-wide configuration used by other modules.

**Description:**
Implement the `StoreOps.Settings` sub-module: CRUD on `settings` table, typed schema for each key (`reservation_duration_min`, `max_extension_min`, `refund_period_default_days`, `customer_service_whatsapp`, `low_stock_threshold`, `review_hold_min`, `review_claim_min`, `late_payment_window_hours`, `max_active_reservations_per_contact`, `low_stock_threshold`). Every write validates with Zod (ranges per MD-SET-02), increments `version`, and writes an `audit_log` entry with old and new values. `Settings.get(key)` is used by Orders, Fulfillment, and Finance at the point of reservation/submission — never cached globally between requests. Expose a settings admin UI page (read-only until NEX-033).

**Affected Models:** `settings`, `audit_log`.

**Affected Modules:** Store Ops (Settings).

**Dependencies:** NEX-002, NEX-004, NEX-005.

**Parallelizable:** Yes — with NEX-007, NEX-008, NEX-009, NEX-010.

**Acceptance Criteria:**
- Setting `reservation_duration_min` to 0 or 61 returns a Zod validation error.
- Setting `customer_service_whatsapp` to a non-E.164 string returns a validation error.
- Every setting write produces an `audit_log` row with `setting name`, `previous value`, `new value`, `actor_owner_id`, `timestamp` (MD-SET-04).
- `Settings.get('reservation_duration_min')` returns the current value from the DB on every call (no in-process cache).
- Optimistic concurrency: updating a setting with a stale `version` returns a conflict error.
- `customer_service_whatsapp` is mandatory and validated as E.164 before the first shift can open (enforced in Store Ops module, see NEX-007).

**Source References:** Architecture §3.1 (`settings` table); MD-SET-01, MD-SET-02, MD-SET-03, MD-SET-04; Tech Stack §D4.

---

### NEX-007 — Store Ops Module (Shifts)

**Target:** The shift open/close lifecycle with single-active-shift enforcement, in-flight customer warning, force-close by the other owner, and attribution recording.

**Description:**
Implement `StoreOps.openShift(actorId)` and `StoreOps.closeShift(actorId, options)`. `openShift`: checks `customer_service_whatsapp` is configured (MD-SET-03), checks actor has ≥1 active payment account (MD-CHK-06), checks no shift currently open (partial unique index enforces this at DB level). Inserts `shifts` row, writes `audit_log`. `closeShift`: counts in-flight customers (`status IN ('reserved','payment_submitted','under_review')`), returns warning count to caller (the API layer warns the owner), then on confirmation sets `closed_at` and `closed_by_owner_id`. `forceClose(actorId, targetShiftId, reason)`: same as close but records `close_kind='forced'`. Exposes `StoreOps.isOpen()` (checks for `closed_at IS NULL` row) and `StoreOps.getActiveShift()`.

**Affected Models:** `shifts`, `settings`, `audit_log`.

**Affected Modules:** Store Ops.

**Dependencies:** NEX-005, NEX-006.

**Parallelizable:** Yes — with NEX-008, NEX-009, NEX-010.

**Acceptance Criteria:**
- `openShift()` when a shift is already open returns `SHIFT_ALREADY_OPEN` error (enforced by partial unique index violation, caught at service layer).
- `openShift()` when owner has no active payment account returns `NO_PAYMENT_ACCOUNT` error.
- `openShift()` when `customer_service_whatsapp` is not set returns `CS_WHATSAPP_NOT_CONFIGURED`.
- `closeShift()` with active reservations returns `{ warningCount: N }` without closing; second call with `force: true` closes.
- `forceClose()` by the acting owner (not shift owner) records `close_kind='forced'` and `closed_by_owner_id = actorId`.
- Both `openShift` and `closeShift` write to `audit_log`.
- `StoreOps.isOpen()` returns `false` within the same transaction as `closeShift` commit.
- Concurrent `openShift` calls from two owners: exactly one succeeds (DB partial unique index).

**Source References:** Requirements §15; MD-SHF-01, MD-SHF-02, MD-SHF-03, MD-SHF-04; Architecture §3.1 (`shifts`), §5.1, §8 (concurrency C9); GAP-04 (both owners may operate).

---

### NEX-008 — Catalog Module

**Target:** Full product and category lifecycle — create, edit, activate/deactivate, archive — with image association, product field definitions, delivery-type × stock-type validation, and optimistic concurrency.

**Description:**
Implement the `Catalog` module: `categories` CRUD (activate/deactivate, hard-delete blocked if products exist per MD-PRD-04), `products` CRUD with status lifecycle (`active → inactive → archived`), `product_fields` management (per-field: key, label, type, required, validation JSONB, is_sensitive, sort_order per MD-PRD-01), `product_images` management (main image partial unique index, sort_order). Validate delivery-type × stock-type combinations (MD-PRD-02): unique stock requires inventory items, counted requires pool, unlimited requires no inventory. Optimistic concurrency on `products.version` (MD-PRD-06). Products with order or inventory history cannot be hard-deleted (MD-PRD-03) — archived instead. Every product write records to `audit_log`. Storefront read queries: `Catalog.listActiveProducts()`, `Catalog.getProduct(id)` (for checkout snapshot). ISR cache tag `'catalog'` invalidated on every product write.

**Affected Models:** `categories`, `products`, `product_fields`, `product_images`, `audit_log`.

**Affected Modules:** Catalog.

**Dependencies:** NEX-002, NEX-004, NEX-005.

**Parallelizable:** Yes — with NEX-007, NEX-009, NEX-010.

**Acceptance Criteria:**
- Creating a product with `stock_type='unique'` and `delivery_type='manual'` succeeds.
- Creating a product with `stock_type='unique'` and `delivery_type='link'` is validated and accepted.
- Attempting to hard-delete a product with existing orders returns `PRODUCT_HAS_HISTORY` error; product is archived instead.
- Attempting to hard-delete a category with active products returns `CATEGORY_HAS_PRODUCTS`.
- Editing a product with a stale `version` returns `OPTIMISTIC_CONFLICT`.
- Deactivating a product writes to `audit_log` with `before` and `after`.
- `Catalog.getProduct()` returns `null` for archived products.
- `product_images` partial unique index enforces exactly one `is_main=true` per product.
- Setting `is_sensitive=true` on a `product_field` causes its value to be excluded from all tracking/public responses.
- `revalidateTag('catalog')` is called inside every product-write service function.

**Source References:** Requirements §7, §27, §28; MD-PRD-01–07; Architecture §3.2; Tech Stack §D2 (ISR + revalidation).

---

### NEX-009 — Messaging Module

**Target:** Message templates with immutable versioning, controlled placeholder catalogue, one active default per type, and version pinning on orders.

**Description:**
Implement the `Messaging` module: `message_templates` CRUD (type: `delivery | replacement | refund_return | customer_service`), one active default per type enforced by partial unique index (MD-TPL-02). Editing a template creates a new `message_template_versions` row (🔒 — never updated/deleted). `Messaging.renderTemplate(versionId, orderData)`: resolves placeholders from the controlled catalogue (`{{order_number}}`, `{{customer_name}}`, `{{product_name}}`, `{{quantity}}`, `{{price}}`, `{{delivery_info}}`, `{{tracking_link}}`). A required placeholder with no value for this order raises `PLACEHOLDER_MISSING` and blocks generation (MD-TPL-03). Rendered bodies are independent of later template changes (MD-TPL-04). The module exposes `Messaging.getCurrentVersionId(templateId)` for snapshot capture at delivery time.

**Affected Models:** `message_templates`, `message_template_versions`, `audit_log`.

**Affected Modules:** Messaging.

**Dependencies:** NEX-002, NEX-004, NEX-005.

**Parallelizable:** Yes — with NEX-007, NEX-008, NEX-010.

**Acceptance Criteria:**
- Editing a template body creates a new version row; the old version row is unchanged and immutable (UPDATE trigger raises).
- Attempting to create a second `is_default=true` template for the same type raises a unique violation.
- `renderTemplate()` with a missing required placeholder raises `PLACEHOLDER_MISSING`.
- `renderTemplate()` with all placeholders present returns a correctly substituted Arabic string.
- The rendered string is independent of any subsequent template edits (snapshot by version ID).
- LTR-sensitive content (order numbers, credentials) inside Arabic template bodies renders correctly in isolation tests.
- Every template create/edit/archive writes to `audit_log`.

**Source References:** Requirements §21; MD-TPL-01–05; Architecture §3.3; User Flow §5.10.

---

### NEX-010 — Payment Accounts Module

**Target:** Per-owner payment account management with snapshot support, active/inactive lifecycle, and deactivation-only deletion guard.

**Description:**
Implement the `Payments.PaymentAccounts` sub-module: create, edit, activate, deactivate payment accounts for each owner. Fields per MD-PAC-01: method_type (`vodafone_cash | instapay | other`), identifier, holder_name, display_name, instructions, status. Hard-delete blocked if the account has ever been referenced by an order (MD-PAC-02). All active accounts of the current shift owner are available for checkout (MD-PAC-03). Snapshot interface: `PaymentAccounts.buildSnapshot(accountId)` returns the JSONB snapshot frozen at the moment of method selection. Every write to `audit_log`.

**Affected Models:** `payment_accounts`, `audit_log`.

**Affected Modules:** Payments (PaymentAccounts sub-module).

**Dependencies:** NEX-002, NEX-004, NEX-005.

**Parallelizable:** Yes — with NEX-007, NEX-008, NEX-009.

**Acceptance Criteria:**
- An account referenced by at least one order cannot be hard-deleted; deactivation succeeds instead.
- An account never referenced by any order can be hard-deleted.
- `buildSnapshot()` returns a frozen JSONB with method, identifier, holder_name, instructions at the time of call.
- Deactivating an account while a customer has a `reserved` order showing that account does not alter the order's `payment_snapshot`.
- A shift cannot be opened when the owner has zero active payment accounts (validated in NEX-007).
- Every account create/edit/deactivate writes to `audit_log`.

**Source References:** Requirements §14, §24; MD-PAC-01, MD-PAC-02, MD-PAC-03; Architecture §3.4; User Flow §5.3.

---

## PHASE 2 — Inventory & Concurrency Tests

---

### NEX-011 — Inventory Module & Allocation Primitive

**Target:** The single allocation API covering all three stock models (unique, counted, unlimited) behind one interface, with full movement history, deduplication, and lazy expiry reclaim.

**Description:**
Implement the `Inventory` module: `inventory_items` CRUD (add, retire — never edit reserved/sold content per MD-INV-06), `stock_pools` management for counted products, `inventory_movements` append-only logging. The core `allocate(order, product, qty, tx)` primitive: for **unique** — `SELECT ... FOR UPDATE SKIP LOCKED`, fewer than qty → raise; for **counted** — conditional `UPDATE stock_pools SET available=available-n, reserved=reserved+n WHERE available>=n` with row-count check; for **unlimited** — check `is_available`, no inventory effect. `release(units, tx)` and `sell(units, tx)` as the inverse operations. `reclaim_expired_holds(productId, tx)`: runs inside caller's transaction to release holds on expired orders before allocation (lazy expiry rule). Content stored encrypted (AES-256-GCM); `content_fingerprint` stored as HMAC-SHA-256 (not plain hash). Duplicate fingerprint blocked (MD-INV-04). Removal blocked for reserved/sold items (MD-INV-05). Item content cannot be edited once reserved/sold (MD-INV-06). All state changes append `inventory_movements`.

**Affected Models:** `inventory_items`, `stock_pools`, `inventory_movements`.

**Affected Modules:** Inventory.

**Dependencies:** NEX-002, NEX-008.

**Parallelizable:** No — NEX-012 and NEX-013 depend on this.

**Acceptance Criteria:**
- `allocate()` for unique with 1 available item and 2 concurrent callers: exactly one succeeds, one raises `INSUFFICIENT_STOCK`.
- `allocate()` for counted with `available=5` and concurrent requests for qty=3 and qty=3: the second conditional UPDATE affects 0 rows and raises `INSUFFICIENT_STOCK`.
- `content_fingerprint` is computed as `HMAC-SHA-256(normalizedContent, HMAC_SECRET)` — verified by inspecting the stored value against independent HMAC computation.
- Attempting to add an item with a duplicate normalized fingerprint to the same product returns `DUPLICATE_ITEM`.
- Attempting to remove a `reserved` item returns `ITEM_RESERVED`.
- `reclaim_expired_holds()` inside a transaction sets expired `held` units to `released` and returns items to `available` before the calling `allocate()` proceeds.
- Every state change produces an `inventory_movements` row with correct `from_state`, `to_state`, `reason`, `actor_type`.
- AES-256-GCM encrypted content decrypts correctly with the known key and per-row AAD (row id).
- Unique item content cannot be `UPDATE`ed via the app role after `status ∈ {reserved, sold}` — service layer guard confirmed by unit test.

**Source References:** Requirements §10, §11, §29; MD-INV-01–06; Architecture §3.5, §5.4; Tech Stack §D3 (SKIP LOCKED), §D12 (encryption, HMAC).

---

### NEX-012 — Inventory Concurrency Tests

**Target:** A comprehensive suite of concurrency integration tests running against real PostgreSQL — written and passing **before** any checkout UI is built.

**Description:**
Using Vitest with a Postgres service container (Docker Compose), implement parallel integration tests for every concurrency risk identified in Architecture §8:
- C1: Two customers reserve the last unique item — one succeeds, one fails cleanly.
- C2: Two customers' counted quantities together exceed stock — second rejected, counters never go negative.
- C3: `allocate()` races with `reclaim_expired_holds()` — correct final state.
- C4: Owner removes an item while it is being reserved — only one outcome.
- C7/C8: Two late payers for one unit — one wins, one gets CS.
- C19: Two owners add the same unique item simultaneously — duplicate fingerprint blocked.
- Parallel double-click `confirmDelivery` — exactly one sale posted.
- Parallel double transfer reversal on the same entry — second blocked by guard + unique constraint.
- A→B and B→A transfers simultaneously — deadlock-free, both succeed.
- Wallet balance = Σ ledger after 100 concurrent random operations (invariant check).

**Affected Models:** `inventory_items`, `stock_pools`, `order_units`, `ledger_entries`, `wallets`, `transfers`.

**Affected Modules:** Inventory, Orders, Finance.

**Dependencies:** NEX-011.

**Parallelizable:** No — must pass before NEX-013 is started.

**Acceptance Criteria:**
- All concurrency tests pass with zero flakiness over 10 consecutive runs.
- No test leaves dirty state (each test wraps in a transaction rolled back at teardown or uses schema isolation).
- `stock_pools.available` never goes negative across all test scenarios (verified by post-test query).
- Wallet `balance = SUM(ledger_entries.amount)` invariant holds after every parallel scenario.
- Test suite runs in < 60 seconds on CI.
- All tests run against real Postgres 17, not an in-memory mock.

**Source References:** Tech Stack §D13; Architecture §8 (concurrency table); Requirements §29 (double-sale protection).

---

## PHASE 3 — Orders & Checkout

---

### NEX-013 — Orders Domain Service

**Target:** The full order state machine: `reserve`, `extend`, `release`, `expire` — with idempotency, lazy expiry, fingerprint-based abuse cap, and snapshot capture.

**Description:**
Implement `Orders.reserve(productId, qty, clientRequestId, fingerprintHash, actorContext)`: within one DB transaction — lock open shift `FOR SHARE`, validate product active/available/qty rules, run `reclaim_expired_holds(productId)`, run `allocate()`, insert `orders` row with full snapshot (product, price, currency, delivery_type, refund rules, field definitions, hold timing from Settings, `offered_payments` from shift owner's active accounts, `payment_owner_id`), insert `order_units` (held), `inventory_movements`, `order_status_history (reserved)`, generate checkout token (hash stored on order). 3-reservation cap check: count active orders by `client_fingerprint_hash` (≥3 → `RESERVATION_LIMIT_EXCEEDED`). Idempotency: `client_request_id` unique — duplicate returns the existing order. `Orders.extend(orderId, token, extSec)`: CAS while `status='reserved'` AND `hold_expires_at > now()` AND `extended_sec=0` AND `extSec <= max_extension_sec`. `Orders.release(orderId, token, reason)`: CAS `reserved → expired` (or `cancelled`), release units. `Orders.expire(orderId, reason)`: same release path, `closing_reason` set. `Orders.getForCheckout(orderId, token)`: returns order + countdown computed as `hold_expires_at - now()` from DB.

**Affected Models:** `orders`, `order_units`, `order_status_history`, `inventory_items`, `stock_pools`, `inventory_movements`, `idempotency_keys`.

**Affected Modules:** Orders & Checkout, Inventory (allocation), Store Ops (shift lock), Settings (snapshot values).

**Dependencies:** NEX-007, NEX-008, NEX-010, NEX-011, NEX-012.

**Parallelizable:** No — NEX-014, NEX-015, NEX-016 depend on this.

**Acceptance Criteria:**
- `reserve()` with a `client_request_id` already in use returns the original order (no second reservation).
- `reserve()` when the shift is closed returns `STORE_CLOSED`.
- `reserve()` when requested qty > available returns `INSUFFICIENT_STOCK` with zero stock side effects.
- `reserve()` when `client_fingerprint_hash` has 3 active reservations returns `RESERVATION_LIMIT_EXCEEDED`.
- Snapshot JSONB on order contains: product name, price, delivery_type, refund_allowed, refund_period_days, field definitions, reservation_duration_sec, max_extension_sec, offered_payments.
- `extend()` succeeds once and fails on second call with `EXTENSION_ALREADY_USED`.
- `extend()` after expiry returns `RESERVATION_EXPIRED`.
- `release()` sets units to `released`, items to `available` / pool counters decremented-and-restored, within a single transaction.
- `getForCheckout()` computes remaining seconds from `hold_expires_at - DB_now()` — never from client clock.
- `order_status_history` row inserted in the same transaction as every status change.

**Source References:** Requirements §12, §16; MD-CHK-01–09; MD-RSV-01–04; Architecture §5.1, §5.4; GAP-02 (fingerprint cap), GAP-03 (payment_owner_id at reserve).

---

### NEX-014 — Payment Method Selection Command

**Target:** The `selectPaymentMethod` command that locks `payment_account_id` and `payment_snapshot` onto an active order — implementing the second half of the two-step payment locking (GAP-03).

**Description:**
Implement `Orders.selectPaymentMethod(orderId, token, accountId)`: validates the order is `reserved` and `hold_expires_at > now()`, validates `accountId` is in `orders.offered_payments` (belongs to shift owner, is active), performs CAS update to set `payment_account_id` and `payment_snapshot` (from `PaymentAccounts.buildSnapshot(accountId)`). Selecting a different method overwrites the previous selection (allowed within the reservation window). This is the command that must succeed before `Orders.submit()` is permitted. Returns the updated snapshot for the customer to review.

**Affected Models:** `orders` (`payment_account_id`, `payment_snapshot`).

**Affected Modules:** Orders & Checkout, Payments (PaymentAccounts).

**Dependencies:** NEX-013, NEX-010.

**Parallelizable:** Yes — with NEX-015 (different commands on the same module).

**Acceptance Criteria:**
- `selectPaymentMethod()` on an expired order returns `RESERVATION_EXPIRED`.
- `selectPaymentMethod()` with an `accountId` not in `offered_payments` returns `INVALID_PAYMENT_ACCOUNT`.
- After a successful call, `orders.payment_account_id` and `orders.payment_snapshot` are set.
- Selecting a different valid method before submission overwrites the previous selection.
- `submit()` called before `selectPaymentMethod()` returns `PAYMENT_METHOD_NOT_SELECTED`.
- The returned `payment_snapshot` JSONB contains method, identifier, holder_name, instructions at the moment of selection.

**Source References:** MD-CHK-04, MD-CHK-05; Architecture §5.1 (step 4, interpretation note); GAP-03.

---

### NEX-015 — Payment Submission Service

**Target:** All three submission paths — normal, correction (with hold restart), and late (including `review_timeout` recovery) — with WhatsApp-cap re-check and idempotency.

**Description:**
Implement `Orders.submit(orderId, token, fields, kind)`: **Normal path** (`status='reserved'`, `hold_expires_at > now()`): validate all fields (E.164 normalization per MD-PAY-04, per-product-field Zod schemas including Arabic-Indic digit normalization), check payment method selected, re-check WhatsApp cap (≤3 active by same E.164), insert `payment_submissions(kind='normal')`, copy customer fields to `orders` columns, CAS `reserved → payment_submitted`, set `hold_kind='review'`, `hold_expires_at = now() + review_hold_min`. **Correction path** (`kind='correction'`, `status='payment_submitted'`, `needs_correction` flag active): insert `payment_submissions(kind='correction')`, clear `needs_correction` flag, CAS hold restart: `hold_expires_at = now() + review_hold_min` (GAP-06). **Late path** `Orders.lateSubmit(orderId, transferNum, whatsappE164, fields)`: requires `status='expired'` AND `now() < expired_at + late_payment_window_hours` (accepts `closing_reason='review_timeout'` per GAP-05), validates, runs `reclaim_expired_holds`, runs `allocate()` — success → new units, CAS `expired → payment_submitted`, flag `late_submission`; failure → flag `needs_customer_service`, create `support_cases(origin='late_payment_no_stock')`, submission `outcome='no_stock'`. All paths: `UNIQUE(order_id, attempt_no)` ensures idempotency.

**Affected Models:** `orders`, `payment_submissions`, `order_flags`, `order_units`, `support_cases`, `order_status_history`, `inventory_items`, `stock_pools`, `inventory_movements`.

**Affected Modules:** Orders & Checkout, Payments (submissions), Inventory, Aftercare (CS case creation).

**Dependencies:** NEX-013, NEX-014, NEX-011.

**Parallelizable:** Yes — with NEX-016 (API layer built on top of these services).

**Acceptance Criteria:**
- Normal submit with Arabic-Indic digits in the phone number (`٠١٢٣`) normalizes to E.164 and matches on tracking lookups.
- Submit without a selected payment method returns `PAYMENT_METHOD_NOT_SELECTED`.
- Submit on an expired reservation enters the late path automatically.
- Late path with available stock: new `order_units` created, `late_submission` flag raised, `status = payment_submitted`.
- Late path with no stock: `needs_customer_service` flag raised, `support_cases` row created, submission `outcome='no_stock'`, order stays `expired`.
- `review_timeout` expired orders are accepted by the late path within the 24-hour window (GAP-05).
- Correction submit resets `hold_expires_at = now() + review_hold_min` (GAP-06) — verified by checking DB timestamp.
- WhatsApp re-check at submit: a customer with 3 active orders on the same WhatsApp returns `RESERVATION_LIMIT_EXCEEDED`.
- Submitting twice with the same `attempt_no` returns the original result (idempotency).
- `payment_submissions` row is 🔒 — UPDATE trigger verified.

**Source References:** Requirements §13, §16; MD-PAY-01–05; MD-LTE-01–05; Architecture §5.2, §5.3; GAP-05, GAP-06; Tech Stack §D6 (normalization).

---

### NEX-016 — Public Checkout API & Security Layer

**Target:** All public (unauthenticated) API Route Handlers for the storefront with rate limiting, Cloudflare Turnstile protection, beacon endpoint, and server-time exposure.

**Description:**
Implement all public Route Handlers under `/api/public/`: `GET /products` (catalog), `GET /products/[id]` (product page, `no-store` for availability), `POST /checkout/reserve` (returns checkout token in cookie), `GET /checkout/[orderId]` (reads order with countdown = `hold_expires_at - server_now`; returns both so client can compute offset), `PATCH /checkout/[orderId]/method` (calls NEX-014), `POST /checkout/[orderId]/extend`, `POST /checkout/[orderId]/release` (beacon endpoint — accepts `sendBeacon` format), `POST /checkout/[orderId]/submit`, `POST /orders/late-submit`, `GET /orders/track`. Rate limiting: Cloudflare rules + server-side per-IP counters for tracking (10/10 min per MD-TRK-04) and reservation abuse. Turnstile integration on track and reserve endpoints. All 404/mismatch responses for tracking use identical response bodies and timing (no enumeration). `server_now` returned alongside every `hold_expires_at` so the client can compute the display offset.

**Affected Models:** `orders`, `idempotency_keys`.

**Affected Modules:** Platform (Public API, rate limiting, auth tokens).

**Dependencies:** NEX-013, NEX-014, NEX-015.

**Parallelizable:** Yes — with NEX-017 (frontend built on top of this API).

**Acceptance Criteria:**
- `GET /products/[id]` is served with `Cache-Control: no-store` so availability is never cached.
- Reserve endpoint returns checkout token as `HttpOnly` cookie scoped to `/checkout/[orderId]`.
- Beacon endpoint (`POST /checkout/[orderId]/release`) accepts `Content-Type: text/plain` (sendBeacon format).
- Tracking endpoint returns identical response body and HTTP status for "not found" vs "wrong number" (no enumeration).
- 11th tracking attempt within 10 minutes returns 429.
- Turnstile token is validated server-side on track and reserve requests.
- `GET /checkout/[orderId]` returns both `hold_expires_at` (ISO UTC) and `server_now` (ISO UTC).
- All Route Handlers use `postgres.js` with `prepare: false` (transaction pooler compatibility).

**Source References:** MD-TRK-04; Tech Stack §D2 (Route Handlers), §D5 (checkout token), §D9 (polling), §D14 (Turnstile); Architecture §1.2 (Public API).

---

### NEX-017 — Customer Storefront

**Target:** The complete Arabic-first, RTL, mobile-first customer storefront: category/product browsing, product detail, checkout flow with live countdown, payment method selection, submission form, and confirmation screen.

**Description:**
Build all customer-facing pages using Next.js App Router, Tailwind CSS v4, shadcn/ui, and next-intl (Arabic, ICU plurals). Pages: Home (category list + product grid), Product Detail (images, description, price, duration, fields required, delivery info, availability badge per MD-BRW-01: Available / Low Stock / Out of Stock), Checkout (countdown timer, payment method cards, information form, submit). Countdown: API returns `hold_expires_at + server_now`; client computes `offset = server_now - Date.now()` and ticks locally; re-sync on `visibilitychange` and every 15s. Countdown color transitions: `#2563FF` (normal) → `#E8A300` (< 2 min) → `#D92D4A` (< 30 sec). Payment method selection: customer selects one method, calls NEX-014. Store-closed banner when `isOpen = false`. All LTR content (phone numbers, IBANs, order numbers, credentials) wrapped in `<Ltr>` component (`dir="ltr"`, `unicode-bidi: isolate`, monospace). Arabic form validation messages. `sendBeacon` on `pagehide` for reservation release. Refresh must resume the same reservation (checkout token cookie). Two-tab idempotency: second tab reads the same order.

**Affected Models:** None (reads only via API).

**Affected Modules:** Platform (Storefront).

**Dependencies:** NEX-016.

**Parallelizable:** Yes — with NEX-018.

**Acceptance Criteria:**
- Product availability shows "متاح" / "مخزون محدود" / "نفذ المخزون" (not exact count).
- Countdown displays server-derived remaining time; after switching to another app for 5 minutes and returning, countdown reflects true elapsed time.
- Submitting the form with Arabic-Indic phone digits succeeds after normalization.
- Pressing Buy when the store is closed shows "المتجر مغلق حالياً" and does not attempt a reservation.
- Refreshing the checkout page resumes the same countdown without creating a new reservation.
- `pagehide` event fires `sendBeacon` to the release endpoint.
- All RTL layout passes visual inspection: icons flip per Design System rules, LTR content is isolated.
- Minimum touch target on all interactive elements is 44px (mobile).
- `<html lang="ar" dir="rtl">` is set.
- No Google Fonts requests in the browser (fonts served from `next/font`).
- Playwright RTL test on iPhone profile passes for the checkout golden path.
- `axe` accessibility check passes on the checkout page with zero critical violations.

**Source References:** Requirements §6, §9, §11, §12, §16; MD-BRW-01; MD-CHK-08 (pagehide); Tech Stack §D7 (countdown), §D8 (RTL, ICU); Design System (countdown banner, status badges, RTL rules).

---

### NEX-018 — Order Tracking

**Target:** The guest order tracking page with two-factor lookup, constant-time comparison, masking, rate limiting, and clear Arabic status presentation for all 10 order statuses.

**Description:**
Build `GET /track` page and the underlying `Orders.track(orderNumber, identifier)` service. Two-factor lookup: `order_number` + either `transfer_number_norm` or `customer_whatsapp_e164`. Normalize both identifiers (Arabic-Indic digits, E.164) before matching. Constant-time comparison on the matched field. Identical response for "not found" and "mismatch" (MD-TRK-05). Display all 10 statuses with Arabic copy and semantic color per Design System. Never display: credentials, full payment details, sensitive fields. Display: order number, product name, quantity, status, status reason (for Rejected), `needs_customer_service` flag with CS WhatsApp link. Copy-to-clipboard for order number. Order recovery by WhatsApp + transfer number (MD-TRK-03). TanStack Query refetch every 15s on tab focus.

**Affected Models:** `orders`, `payment_submissions` (read-only, masked).

**Affected Modules:** Orders & Checkout (tracking read), Platform (rate limit).

**Dependencies:** NEX-016, NEX-017.

**Parallelizable:** Yes — with NEX-017.

**Acceptance Criteria:**
- Correct order number + wrong phone: identical response to non-existent order number (same body, same timing ±5ms).
- Typing the phone in a different format (local vs E.164 vs Arabic-Indic) still matches if it's the same number.
- Sensitive `product_field` values are never present in the tracking response body.
- `needs_customer_service` flag shows the global CS WhatsApp link with a `wa.me/` deep link.
- The "Rejected" status displays the rejection reason.
- Order with `delivered` status: inventory credentials are not shown (MD-TRK-05).
- Rate limit: 11th attempt in 10 minutes returns 429.
- TanStack Query polling updates the displayed status without a full page reload.

**Source References:** Requirements §19; MD-TRK-01–05; Architecture §5.2 (tracking note); MD-PAY-04 (normalization).

---

## PHASE 4 — Payment Review

---

### NEX-019 — Payment Review Service

**Target:** The full payment review cycle — claim, multi-factor conflict detection, accept, reject (with reason and stock release), needs-correction flag, reopen — with both owners able to act on any order and dual attribution recorded.

**Description:**
Implement `Payments.claim(orderId, actorId)`: CAS `payment_submitted → under_review` if unclaimed or claim expired; set `review_claimed_by`, `review_claim_expires_at = now() + review_claim_min`. `Payments.accept(orderId, actorId, transferNum, verifiedAmount)`: guard — order must be `under_review` AND claim held by actor; multi-factor conflict check: query `payment_reviews WHERE accepted AND transfer_number_norm=? AND verified_amount=? AND payment_account_id=?` within `late_payment_window_hours` — match → raise `payment_conflict` flag, do not accept (GAP-01); no conflict → CAS `under_review → accepted`, insert `payment_reviews(decision='accepted', reviewer_owner_id=actor, payment_owner_id=order.payment_owner_id)`, clear hold (`hold_kind='none'`, `hold_expires_at=NULL`). Both owners may call `accept()` — no `canVerify()` check (GAP-04). `Payments.reject(orderId, actorId, reason)`: mandatory reason, CAS `under_review → rejected`, release all held units (`Inventory.release()`), insert `payment_reviews(rejected)`. `Payments.needsCorrection(orderId, actorId, reason)`: insert review `needs_correction`, raise `needs_correction` flag, return order to `payment_submitted`. `Payments.reopen(orderId, actorId, reason)`: mandatory reason, recheck stock, CAS `rejected → under_review`. All commands write `order_status_history`.

**Affected Models:** `orders`, `order_status_history`, `order_flags`, `payment_reviews`, `inventory_items`, `stock_pools`, `inventory_movements`.

**Affected Modules:** Payments (Review), Inventory, Orders.

**Dependencies:** NEX-013, NEX-015, NEX-011.

**Parallelizable:** No — NEX-020, NEX-021 depend on this.

**Acceptance Criteria:**
- Two owners `claim()` the same order simultaneously: exactly one succeeds; second returns `ALREADY_CLAIMED`.
- After 10 minutes of inactivity, the claim lapses and a second owner can claim (verified by advancing DB time in test).
- `accept()` by Owner B on an order with `payment_owner_id = Owner A`: succeeds (GAP-04); `payment_reviews.payment_owner_id = A`, `reviewer_owner_id = B`.
- Multi-factor conflict: `accept()` with a `transfer_number_norm + verified_amount + payment_account_id` matching an already-accepted review raises `payment_conflict` flag without changing order status (GAP-01).
- Same transfer number with different amount on same account: **not** flagged as conflict (multi-factor, not single-field).
- `reject()` without a reason is rejected by Zod validation.
- `reject()` releases all held `order_units` and returns inventory to available in the same transaction.
- `reopen()` on a `rejected` order runs stock re-check before transitioning to `under_review`.
- `needsCorrection()` raises `needs_correction` flag and returns order to `payment_submitted`.
- No `waiting_for_account_owner` flag is ever set or referenced (GAP-04).

**Source References:** Requirements §17; MD-REV-01–08; Architecture §5.5; GAP-01 (multi-factor conflict), GAP-04 (both owners, dual attribution).

---

### NEX-020 — Admin Order Management UI

**Target:** The complete owner-facing order list, order detail page, and payment review interface — with actionable review controls, dual-attribution display, and real-time queue updates.

**Description:**
Build admin pages: Order List (filterable by status, date, product, customer, search by order number / WhatsApp / transfer number — MD-ORD-01), Order Detail (all fields from Requirements §18 including `payment_owner_id` labeled separately from the reviewing owner — GAP-04), Review Panel (claim button, accept form with transfer number + amount, reject form with mandatory reason, needs-correction form, reopen form). Proof image shown as signed URL (15-min expiry). Status badges per Design System. TanStack Query `refetchInterval: 10000` on the awaiting-review list. Order detail: show `payment_owner_id` as "حساب الدفع" and `reviewer_owner_id` as "مراجع الدفع" — always both visible. Order status history timeline. Order flag chips (needs_customer_service, late_submission, needs_correction, payment_conflict).

**Affected Models:** (reads) `orders`, `order_status_history`, `order_flags`, `payment_submissions`, `payment_reviews`, `payment_accounts`.

**Affected Modules:** Platform (Admin UI), Payments (Review UI).

**Dependencies:** NEX-019, NEX-016.

**Parallelizable:** Yes — with NEX-021.

**Acceptance Criteria:**
- Order list shows "awaiting payment review" count matching DB query.
- Order detail shows both `payment_owner_id` owner name and `reviewer_owner_id` owner name in separate labeled fields.
- Review panel shows claim button only when `status = 'payment_submitted'`.
- Accept button shows only when the actor holds the claim.
- Reject form blocks submission without a reason field filled.
- Proof image loads via a signed URL; the URL is not a public permanent link.
- `payment_conflict` flag displayed with Design System violet badge.
- Order status history displays as a vertical timeline with actor name, timestamp, and reason.
- Refreshing the order list reflects status changes within 10 seconds (polling).
- No `waiting_for_account_owner` UI element exists anywhere in the codebase.

**Source References:** Requirements §17, §18, §31; MD-ORD-01; User Flow §5.6, §5.7; GAP-04; Design System (status badges).

---

## PHASE 5 — Delivery & Initial Finance

---

### NEX-021 — Wallets & Ledger Core

**Target:** The Finance module foundation: wallet table, immutable ledger, `Finance.post()`, `Finance.reverse()` with re-reversal guard, and balance verification.

**Description:**
Implement the `Finance` module core: `wallets` table (one per owner, cached balance), `ledger_entries` (🔒 immutable). `Finance.post(walletId, kind, signedAmount, sourceType, sourceId, orderId, performedBy, idempotencyKey?)`: `SELECT wallets FOR UPDATE` → insert entry (unique indexes reject duplicate source+kind) → `UPDATE wallets SET balance = balance + amount`. `Finance.reverse(entryId, actorId, reason)`: guard — if `ledger_entries WHERE id=entryId` already has `reverses_entry_id IS NOT NULL` → raise `ENTRY_ALREADY_REVERSED` (GAP-09); then: `SELECT wallets FOR UPDATE` → insert negated entry with `reverses_entry_id=entryId` → update balance. Unique `(reverses_entry_id)` DB constraint as final backstop. Balance display: `balance` column is the cached sum; reconciliation job verifies it nightly. Pending money query: `orders WHERE status IN ('accepted','preparing')` — not included in balance (MD-WAL-02).

**Affected Models:** `wallets`, `ledger_entries`.

**Affected Modules:** Finance.

**Dependencies:** NEX-019.

**Parallelizable:** No — NEX-022 (sale posting) depends on this.

**Acceptance Criteria:**
- `Finance.post()` with the same `(source_type, source_id, kind)` pair raises a unique constraint error on the second call.
- `Finance.reverse()` on an already-reversed entry raises `ENTRY_ALREADY_REVERSED` before hitting the DB (GAP-09).
- Attempting to directly `UPDATE ledger_entries` as `nexora_app` role: immutability trigger raises.
- Concurrent `Finance.post()` calls on the same wallet: row lock serializes them; final `balance = SUM(amounts)`.
- `wallets.balance` after any series of posts and reverses equals `SELECT SUM(amount) FROM ledger_entries WHERE wallet_id = ?`.
- Negative balance is stored and displayed correctly (not blocked).
- `Finance.reverse()` with empty `reason` is rejected by Zod validation.

**Source References:** Requirements §23; MD-WAL-01–06; Architecture §3.10, §5.10, §5.13; GAP-09 (re-reversal guard).

---

### NEX-022 — Delivery Service

**Target:** The complete delivery lifecycle: prepare, WhatsApp message generation trigger, `confirmDelivery` (single atomic action), partial delivery support, reverse delivery, and delivery error recording without auto-posting.

**Description:**
Implement `Fulfillment.prepare(orderId, actorId)`: CAS `accepted → preparing`, insert `deliveries(state='preparing', prepared_by)` — partial unique index rejects second concurrent delivery. Select `held` units for this delivery; attach `delivery_id`. Decrypt unique item content in memory only. `Fulfillment.generateMessage(deliveryId, actorId)`: call `Messaging.renderTemplate()`, insert `delivery_messages(status='generated')`, delivery → `ready_to_send`. Owner may edit `body_final`. `Fulfillment.openWhatsApp(deliveryId, actorId)`: build `wa.me/E164?text=...` link, mark `delivery_messages.status='opened'`, delivery → `sent_waiting_confirmation`. Return link to UI. `Fulfillment.confirmDelivery(deliveryId, actorId)`: **single atomic transaction** — CAS `deliveries.state: sent_waiting_confirmation → delivered`, set `delivery_messages.status='marked_sent'`, CAS `order_units: held → delivered`, for unique items: `inventory_items: reserved → sold`, for counted: `stock_pools.reserved-n, sold+n`, append `inventory_movements(sold)`, invoke `Finance.post(sale, amount=qty*unit_price, wallet=order.payment_owner_id's wallet, source=delivery)`, `orders.delivered_quantity += qty`, if `delivered_quantity = total_quantity`: CAS `preparing → delivered` then `delivered → completed` (both history rows in same TX) (GAP-08). `Fulfillment.reverseDelivery(deliveryId, actorId, reason)`: delivery → `reversed`, units `delivered → held`, items `sold → reserved`, `Finance.reverse(saleEntry)`, `delivered_quantity -= qty`, order `completed/delivered → preparing`. `Fulfillment.recordDeliveryError(orderId, actorId, errorType, valueAmount?, description)`: insert `delivery_errors` only — **no Finance call** (GAP-10).

**Affected Models:** `deliveries`, `delivery_messages`, `order_units`, `inventory_items`, `stock_pools`, `inventory_movements`, `ledger_entries`, `wallets`, `orders`, `order_status_history`, `delivery_errors`.

**Affected Modules:** Fulfillment, Finance, Inventory, Orders.

**Dependencies:** NEX-021, NEX-009, NEX-011.

**Parallelizable:** No — NEX-023, NEX-024 depend on this.

**Acceptance Criteria:**
- Two owners call `prepare()` on the same order simultaneously: exactly one `deliveries` row created; second fails on partial unique index.
- `confirmDelivery()` double-clicked by same owner: idempotent — second call returns existing delivery state with no additional ledger entry.
- After `confirmDelivery()`, `ledger_entries` has exactly one `(source_type='delivery', source_id=deliveryId, kind='sale')` row.
- Sale amount = `order.quantity * order.unit_price`; posted to `order.payment_owner_id`'s wallet, not the delivering owner's.
- `delivery_messages.status = 'marked_sent'` is set in the same transaction as delivery `delivered`.
- Order with qty=3 delivered as qty=1 then qty=1 then qty=1: `delivered_quantity` increments correctly; `completed` only after last unit.
- `reverseDelivery()` reverses the exact sale entry; `Finance.reverse()` guard prevents re-reversing the reversed entry.
- `recordDeliveryError()` inserts only into `delivery_errors`; `ledger_entries` count is unchanged (GAP-10).
- Decrypted unique item content is never logged or written to any column outside of `delivery_messages.body_generated`.

**Source References:** Requirements §20, §23; MD-DLV-01–06; MD-WA-01–04; Architecture §3.8, §5.6; GAP-08 (single confirm action), GAP-10 (no auto-post); FD-17, FD-24.

---

### NEX-023 — WhatsApp Message Generation & Delivery Admin UI

**Target:** The owner-facing delivery preparation flow — message generation, review, WhatsApp link, confirm button — as a single cohesive workflow screen.

**Description:**
Build the delivery admin UI: Order accepted → "Prepare Delivery" button → delivery enters `preparing`. Message card: show generated `body_final` (editable textarea), delivery info (unique item content decrypted inline, LTR wrapper, monospace). "Open WhatsApp" button: calls `openWhatsApp()`, renders `wa.me/` link opening in a new tab/app. After return: single "Confirm Delivery" button — calls `confirmDelivery()` atomically (GAP-08). On success: order status changes to `completed`, sale posted (visible in Finance). "Record Delivery Error" secondary action: form with error type + value + description, no financial effect (GAP-10). Resend flow: new message generation with mandatory reason. Partial delivery: show "Delivering X of Y" and "Confirm Partial" variant. Reverse Delivery: accessible from delivered/completed orders with mandatory reason confirmation dialog.

**Affected Models:** (reads/triggers) `deliveries`, `delivery_messages`, `orders`.

**Affected Modules:** Platform (Admin UI), Fulfillment.

**Dependencies:** NEX-022, NEX-019.

**Parallelizable:** Yes — with NEX-024.

**Acceptance Criteria:**
- "Confirm Delivery" button is the only delivery-confirming action (no separate "Mark as Sent" button).
- Unique item content is displayed in an LTR-isolated monospace block with a copy button.
- "Open WhatsApp" opens `wa.me/<E164>?text=<URLencoded message>`.
- "Record Delivery Error" form submits without a Finance ledger entry (verified by checking `ledger_entries` count before and after).
- Reverse Delivery requires a reason; confirmation dialog warns "هذا الإجراء لا يمكن التراجع عنه" before committing.
- Resend "WhatsApp" creates a new `delivery_messages` row with a reason and previous message is unchanged.
- After `confirmDelivery()`, the order status badge on the page shows "مكتمل".

**Source References:** Requirements §20, §21; MD-DLV-01–06; MD-WA-01–04; User Flow §5.8, §5.9; GAP-08, GAP-10.

---

### NEX-024 — Delivery Admin UI — Finance Integration Verification

**Target:** Verify end-to-end that the sale ledger entry appears correctly in the Finance module immediately after delivery confirmation, with correct wallet attribution.

**Description:**
This task covers the integration wiring between Fulfillment and Finance in the admin UI: after `confirmDelivery()`, the owner's wallet balance in the Finance section must update. Build the wallet balance display component (used in Dashboard and Finance views): reads `wallets.balance` + computes `pending_money` from `orders WHERE status IN ('accepted','preparing')`. Negative balance displayed in `#D92D4A` with a warning indicator. "Pending Money" shown separately, never added to balance (MD-WAL-02). Delivery confirmation test: place order → accept → confirm delivery → verify `ledger_entries` has one sale row → verify `wallets.balance` increased by `qty × unit_price`.

**Affected Models:** `wallets`, `ledger_entries` (reads).

**Affected Modules:** Finance (read), Platform (Admin UI).

**Dependencies:** NEX-022, NEX-021.

**Parallelizable:** Yes — with NEX-023.

**Acceptance Criteria:**
- After `confirmDelivery()`, `wallets.balance` for `payment_owner_id`'s owner increases by exactly `qty × unit_price`.
- Pending money counter decreases by the same order's value after delivery.
- Negative balance: wallet shows balance in danger color with "رصيد سالب" label.
- `wallets.balance` for the delivering owner (if different from payment owner) is unchanged.

**Source References:** MD-WAL-01, MD-WAL-02, MD-WAL-06; Architecture §5.10; FD-15, FD-17.

---

## PHASE 6 — Full Finance Module

---

### NEX-025 — Transfers Module

**Target:** Owner-to-owner transfer recording with immediate dual-ledger effect, deadlock-free locking, idempotency, and unconditional reversal (even to negative receiver balance).

**Description:**
Implement `Finance.transfer(senderOwnerId, receiverOwnerId, amount, note, actorId, idempotencyKey)`: validate `sender ≠ receiver`, `amount > 0`, balance check — sender balance ≥ amount (MD-TRF-01); lock both wallets `FOR UPDATE` in ascending `id` order (deadlock prevention); insert `transfers` row; insert two `ledger_entries` (`transfer_out −amount` for sender, `transfer_in +amount` for receiver, same `group_id`); update both balances atomically. `Finance.reverseTransfer(transferId, actorId, reason)`: validate not already reversed (`UNIQUE(reversal_of_transfer_id)`); lock both wallets ascending `id` order; **no balance check on receiver** (GAP-07); insert reversing `transfers` row with `reversal_of_transfer_id`; insert two reversing ledger entries; update both balances. History: both transfer and reversal visible in wallet history with `group_id` linking the legs.

**Affected Models:** `wallets`, `ledger_entries`, `transfers`.

**Affected Modules:** Finance.

**Dependencies:** NEX-021.

**Parallelizable:** Yes — with NEX-026, NEX-027.

**Acceptance Criteria:**
- Transfer of 500 EGP from A to B: `wallets[A].balance -= 500`, `wallets[B].balance += 500`, both in one transaction.
- Transfer where `sender.balance < amount` returns `INSUFFICIENT_BALANCE` (no ledger entries created).
- A→B and B→A transfers concurrently: both succeed, no deadlock, final balances correct.
- `reverseTransfer()` when receiver's balance would go negative: succeeds (GAP-07). Receiver's balance is negative; displayed in danger color.
- Attempting to reverse an already-reversed transfer returns `TRANSFER_ALREADY_REVERSED`.
- Idempotency key prevents duplicate transfer on network retry.
- Transfer does not back-date: `expense_date` is Cairo server time, not client-provided.

**Source References:** Requirements §25; MD-TRF-01–04; Architecture §5.11; GAP-07 (unchecked reversal).

---

### NEX-026 — Expenses Module

**Target:** Business expense recording against a responsible owner's wallet, with category validation, 7-day backdating limit, and reversal support.

**Description:**
Implement `Finance.recordExpense(responsibleOwnerId, category, amount, description, expenseDate, actorId, idempotencyKey)`: validate `amount > 0`, category from fixed enum + `other` (requires `category_note` per MD-EXP-01), `expenseDate` within today − 7 days … today in Cairo time (MD-EXP-04), `responsibleOwnerId` may differ from `actorId` (MD-EXP-02); insert `expenses`; invoke `Finance.post(expense, −amount)` on the responsible owner's wallet. Reversal: any owner may call `Finance.reverseExpense(expenseId, actorId, reason)` with mandatory reason (MD-EXP-03). Negative balance allowed after expense (MD-WAL-03).

**Affected Models:** `expenses`, `wallets`, `ledger_entries`.

**Affected Modules:** Finance.

**Dependencies:** NEX-021.

**Parallelizable:** Yes — with NEX-025, NEX-027.

**Acceptance Criteria:**
- Expense with `category='other'` and no `category_note` returns validation error.
- Expense with `expenseDate` 8 days ago (Cairo) returns `DATE_OUT_OF_RANGE`.
- Expense with future date returns `DATE_OUT_OF_RANGE`.
- Responsible owner differs from actor: `ledger_entries.wallet_id` is the responsible owner's wallet, `performed_by_owner_id` is the actor's id.
- Expense pushes wallet balance negative: allowed, balance stored as negative number.
- `reverseExpense()` by either owner with mandatory reason creates a positive reversing ledger entry.
- `idempotency_key` on expense prevents double-submit.

**Source References:** Requirements §26; MD-EXP-01–04; MD-WAL-03; Architecture §5.12.

---

### NEX-027 — Financial Adjustments, Reversals & Delivery Error Linking

**Target:** The manual `Finance.adjust()` command for arbitrary corrections, the delivery-error-to-adjustment linking flow, and the complete Finance history view.

**Description:**
Implement `Finance.adjust(walletId, signedAmount, reason, actorId, sourceType?, sourceId?)`: mandatory reason; `sourceType='delivery_error'` with `sourceId=delivery_error.id` is the canonical path for financial consequences of delivery errors (GAP-10). Inserts a `ledger_entries(kind='adjustment')` row. Finance history view: all ledger entries grouped by date (Cairo `business_date`), filterable by kind, owner, date range. Show reversal linkage: reversed entries display "محول" badge; the reversing entry shows a link to the original. For delivery error adjustments: show a link to the source `delivery_error` row. Finance summary: balance, total sales, total expenses, total refunds, pending money — by date range (MD-DSH-01 ranges).

**Affected Models:** `wallets`, `ledger_entries`, `delivery_errors` (read).

**Affected Modules:** Finance.

**Dependencies:** NEX-021, NEX-022.

**Parallelizable:** Yes — with NEX-025, NEX-026.

**Acceptance Criteria:**
- `Finance.adjust()` without a reason string returns validation error.
- `Finance.adjust(sourceType='delivery_error', sourceId=X)` links to `delivery_errors` row X in the Finance history view.
- `Finance.reverse(entryId)` on an entry that already has a `reverses_entry_id`: raises `ENTRY_ALREADY_REVERSED`; no ledger entry created (GAP-09).
- Finance history groups entries by Cairo `business_date`, not UTC date.
- "محول" badge appears on original reversed entries in the Finance list view.
- Filtering by owner shows only entries on that owner's wallet.

**Source References:** Architecture §5.13; MD-WAL-04, MD-WAL-05; GAP-09, GAP-10.

---

## PHASE 7 — Aftercare

---

### NEX-028 — Replacement Cases

**Target:** The complete replacement case lifecycle — case creation on a delivered order, replacement allocation, delivery via the normal flow, and financial recording (no new sale).

**Description:**
Implement `Aftercare.openReplacementCase(orderId, unitIds, reason, actorId)`: validates order `delivered` or `completed` (MD-ORD-04), validates units are `delivered` and not already in a case (`replaces_unit_id` unique), inserts `replacement_cases(status='open')`. No shift required (MD-RPL-04). `Aftercare.allocateReplacement(caseId, actorId)`: `FOR UPDATE` lock on order; allocate new item(s) from same product using `Inventory.allocate()` — if no stock, case → `failed`; insert replacement `order_units(state='held', replaces_unit_id=original, replacement_case_id)` — `UNIQUE(replaces_unit_id)` enforces one replacement per unit (MD-RPL-03). Deliver through normal `Fulfillment.prepare/confirmDelivery()` with `deliveries.kind='replacement'` using the replacement template (MD-TPL-01). On replacement delivery confirmation: replacement unit `held → delivered`, original unit `delivered → replaced`, original item `sold → defective`, new item `reserved → sold`. **No `Finance.post(sale)`** (MD-RPL-05). Case → `completed`. If replacement also fails → case → `failed`; owner may open refund case.

**Affected Models:** `replacement_cases`, `order_units`, `inventory_items`, `stock_pools`, `inventory_movements`, `deliveries`.

**Affected Modules:** Aftercare, Inventory, Fulfillment, Orders.

**Dependencies:** NEX-022, NEX-011.

**Parallelizable:** Yes — with NEX-029, NEX-030.

**Acceptance Criteria:**
- Opening a replacement case on a `preparing` order (not yet delivered) returns `ORDER_NOT_DELIVERED`.
- Attempting a second replacement on the same unit: `UNIQUE(replaces_unit_id)` violation.
- Replacement allocation with no stock: case → `failed`.
- Successful replacement delivery: original unit → `replaced`, original item → `defective`; no `ledger_entries` sale row created (MD-RPL-05).
- Order status remains `delivered` or `completed` after replacement (MD-ORD-04).
- `order_units.replaces_unit_id` uniqueness: database rejects concurrent replacement on the same unit.
- Replacement case created without an active shift: succeeds (MD-RPL-04).

**Source References:** Requirements §22; MD-RPL-01–05; MD-ORD-04; Architecture §5.7.

---

### NEX-029 — Refund Cases

**Target:** The full refund case lifecycle — eligibility check from order snapshot, per-quantity refund, ledger posting to the payment-owning wallet, payment-return variant with no ledger posting.

**Description:**
Implement `Aftercare.openRefundCase(orderId, unitIds, reason, actorId, overrideReason?)`: lock order row; eligibility from order **snapshot** (not current product): `refund_allowed=true` AND `now() <= unit.delivered_at + refund_period_days * interval '1 day'` (MD-RFD-02); outside period only with `overrideReason` (MD-RFD-04); units must be `delivered` and not in another case; link units via `order_units.refund_case_id`; CAS ensures no concurrent duplicate (MD-RFD-05). `Aftercare.completeRefund(caseId, externalRef, actorId)`: CAS `open → completed`; units `delivered → refunded`; `Finance.post(refund, −amount, wallet=order.payment_owner_id's wallet)` (MD-RFD-06); negative balance allowed. **`payment_return` kind** (paid but no delivery): same lifecycle but **no Finance.post** (MD-RFD-03, FD-15 — sale never posted). `Aftercare.cancelRefundCase(caseId, actorId, reason)`: CAS `open → cancelled`; units released from case.

**Affected Models:** `refund_cases`, `order_units`, `wallets`, `ledger_entries`.

**Affected Modules:** Aftercare, Finance, Orders.

**Dependencies:** NEX-021, NEX-022.

**Parallelizable:** Yes — with NEX-028, NEX-030.

**Acceptance Criteria:**
- Refund on a product with `refund_allowed=false` (from snapshot) returns `NOT_REFUND_ELIGIBLE`.
- Refund outside `refund_period_days` without `overrideReason` returns `REFUND_PERIOD_EXPIRED`.
- `completeRefund()` posts a negative `ledger_entries(kind='refund')` on the payment owner's wallet (MD-RFD-06), not the initiating owner's.
- Two owners call `openRefundCase()` concurrently on the same units: exactly one succeeds (row lock + `refund_case_id` CAS).
- A unit that already has a `refund_case_id` cannot also get a `replacement_case_id` for the same unit (MD-RFD-05).
- `payment_return` kind: `completeRefund()` does not create any `ledger_entries` row.
- Refund completes even when it pushes the wallet to a negative balance.
- `Aftercare.completeRefund()` called twice returns `CASE_ALREADY_COMPLETED` (idempotency via CAS).

**Source References:** Requirements §22; MD-RFD-01–07; MD-WAL-03; Architecture §5.8; FD-17, FD-19.

---

### NEX-030 — Customer Service Cases

**Target:** Customer-service case management — created from late-payment-no-stock events, delivery problems, and standalone inquiries — with claim, assignment, resolution outcomes, and stock-alert integration.

**Description:**
Implement `Aftercare.openSupportCase(origin, orderId?, customerName?, contactE164?, subject, actorId)`: for `origin='late_payment_no_stock'` — created automatically in `Orders.lateSubmit()` failure path (NEX-015); for `origin='delivery_problem'` or `general` — created manually by owners. `Aftercare.claimCase(caseId, actorId)`: CAS `assigned_owner_id IS NULL → actorId` (MD-CS-03). Resolution commands: `fulfillOrder(caseId)` — runs `Orders.lateSubmit()` re-path; `waitForStock(caseId)` — status → `waiting`; `refundReturn(caseId)` — opens `payment_return` refund case; `closeReject(caseId, reason)`. Stock-alert query: when owner adds stock to a product, Finance module dashboard query surfaces one consolidated alert per product with waiting support cases (MD-CS-04 — query, not a stored notification). Standalone cases (no order) supported (MD-CS-05).

**Affected Models:** `support_cases`, `order_flags`, `orders` (read), `replacement_cases`, `refund_cases`.

**Affected Modules:** Aftercare, Orders (re-path), Finance (dashboard query).

**Dependencies:** NEX-015, NEX-028, NEX-029, NEX-011.

**Parallelizable:** Yes — with NEX-028, NEX-029.

**Acceptance Criteria:**
- Late-submit with no stock: `support_cases` row inserted in the same transaction as `needs_customer_service` flag.
- `claimCase()` by two owners concurrently: exactly one gets assigned (CAS).
- `fulfillOrder()` resolution re-runs `lateSubmit()` path; if stock now available, order moves to `payment_submitted`.
- Standalone case (no `order_id`) created with customer name + contact only: succeeds (MD-CS-05).
- Stock-alert query: adding 5 units to a product with 2 waiting cases returns one row (product, 2 waiting) — not 2 rows.
- `needs_customer_service` flag on the order is cleared when the case is resolved.
- Case lifecycle: `open → contacted → waiting → resolved → closed` in order; any open state → `resolved` with a resolution.

**Source References:** Requirements §30; MD-CS-01–05; Architecture §5.9; MD-LTE-03 (auto-case creation).

---

## PHASE 8 — Dashboard & Settings UI

---

### NEX-031 — Admin Dashboard

**Target:** The real-time operational dashboard covering all counters, queues, financial summaries, stock alerts, and customer-service cases — refreshing without full-page reload.

**Description:**
Build the admin dashboard using RSC for initial load + TanStack Query `refetchInterval: 5000` for live counters. Sections: Store Status (open/closed, active shift owner, shift duration), Order Queues (awaiting review count with per-order age, awaiting delivery count with time since acceptance + 15-min flag per MD-DLV-06, reserved stock count), Stock Alerts (out-of-stock products, low-stock products at threshold per MD-DSH-02), Financial Summary (each owner: balance, pending money, today's sales — date range picker per MD-DSH-01: Today / Last 7 / Last 30 / Custom), Customer Service Cases (open count by origin), Recent Activity (last 20 `audit_log` + `order_status_history` entries), Owner Wallets (both owners' balances, negative shown in danger color). Pulse endpoint `/api/admin/pulse` returns monotonically increasing counters; dashboard polls this to decide whether to refetch panels.

**Affected Models:** (reads) all domain tables.

**Affected Modules:** Platform (Admin Dashboard).

**Dependencies:** NEX-019, NEX-022, NEX-025, NEX-026, NEX-030.

**Parallelizable:** Yes — with NEX-032, NEX-033.

**Acceptance Criteria:**
- Dashboard reflects a new "payment submitted" order within 10 seconds of submission (polling).
- Orders awaiting delivery for > 15 minutes show a warning indicator (MD-DLV-06).
- Low-stock products at threshold (≤ 3 by default) appear in stock alert section.
- Negative wallet balance displayed in `#D92D4A` with "رصيد سالب" label.
- Pending money counter shows the total of `quantity * unit_price` for `status IN ('accepted','preparing')` orders.
- "Today" date range uses Cairo timezone boundary, not UTC.
- Store Status banner changes within 10 seconds of a shift open/close event.

**Source References:** Requirements §31; MD-DSH-01–04; MD-DLV-06; Architecture §1.4 (pulse); Tech Stack §D9.

---

### NEX-032 — Activity & Audit History Views

**Target:** Filterable activity history pages covering order timeline, stock movements, delivery actions, financial records, and the general audit log.

**Description:**
Build admin history pages: Order History (all orders with filters: date, status, owner, product, customer — MD-DSH-04), Order Status Timeline (per order — sourced from `order_status_history`), Stock Movement History (per product — `inventory_movements`), Delivery History (per order — `deliveries + delivery_messages + delivery_errors`), Financial History (per owner — `ledger_entries` with reversal linkage, grouped by Cairo `business_date`), Shift History (`shifts` table), General Audit Log (`audit_log` with before/after JSONB diff view). All history is read-only with no delete. Pagination on all lists. Export to CSV for financial records.

**Affected Models:** (reads) `order_status_history`, `inventory_movements`, `deliveries`, `delivery_messages`, `delivery_errors`, `ledger_entries`, `shifts`, `audit_log`.

**Affected Modules:** Platform (Admin UI).

**Dependencies:** NEX-031.

**Parallelizable:** Yes — with NEX-031, NEX-033.

**Acceptance Criteria:**
- Order history filter by owner returns only orders where `payment_owner_id` OR `review_claimed_by` matches.
- Audit log entry shows `before` and `after` JSONB in a readable diff format.
- Financial history grouping uses Cairo `business_date` from `ledger_entries` — not `created_at` UTC.
- Reversed ledger entries show the reversing entry linked inline.
- CSV export of financial records includes: date, kind, amount (EGP), order_id, performed_by.
- No history entry can be deleted from the UI (no delete button exists).

**Source References:** Requirements §33; MD-DSH-04; MD-ORD-01; Architecture §9.

---

### NEX-033 — Settings & Owner Management UI

**Target:** The complete settings management interface and owner account management (create, deactivate) with audit trail display.

**Description:**
Build the Settings admin page: reservation duration slider (1–60 min), max extension (0–60 min), refund period default (0–30 days), customer service WhatsApp E.164 input, low-stock threshold. Every save shows the old and new value for confirmation. Settings change history pulled from `audit_log`. Owner Management: list both owners with status, deactivation button (with confirmation), password reset link generation (for the other owner). Payment accounts management UI (per owner): CRUD, activate/deactivate, deletion guard on accounts with order history. Message template management UI (CRUD, version history, placeholder hint panel).

**Affected Models:** `settings`, `owners`, `payment_accounts`, `message_templates`, `message_template_versions`, `audit_log`.

**Affected Modules:** Store Ops (Settings), Identity, Payments (PaymentAccounts), Messaging.

**Dependencies:** NEX-006, NEX-007, NEX-008, NEX-009, NEX-010, NEX-031.

**Parallelizable:** Yes — with NEX-031, NEX-032.

**Acceptance Criteria:**
- Saving a setting with an out-of-range value shows an Arabic inline error; DB is not written.
- Setting `customer_service_whatsapp` to a non-E.164 string shows a validation error.
- Settings change is visible in the audit log immediately with old and new values.
- Deactivating an owner shows a confirmation dialog: "هل أنت متأكد؟ لن يتمكن من تسجيل الدخول".
- Deactivated owner's historical records remain attributed to them in all history views.
- Payment account with order history: "Delete" button replaced with "Deactivate" button.
- Template editor shows a placeholder hint panel listing all valid placeholders (MD-TPL-03).
- Saving a template creates a new version (not an update); old version row is immutable.

**Source References:** MD-SET-01–04; MD-ACC-03; MD-PAC-01–02; MD-TPL-02; User Flow §5.17; Requirements §32.

---

## PHASE 9 — Background Jobs, Notifications & Hardening

---

### NEX-034 — Hold Sweeper Job

**Target:** A 1-minute idempotent background job that expires overdue reservations and releases held stock — providing the safety net for cases where the lazy expiry path was not triggered.

**Description:**
Implement `/api/internal/jobs/hold-sweeper` Route Handler protected by HMAC shared-secret header + IP allow-list. On each run: `pg_try_advisory_xact_lock(1)` within a transaction to prevent overlapping runs. Query: `orders WHERE status IN ('reserved','payment_submitted','under_review') AND hold_expires_at < now()`. For each: run `Orders.expire(orderId, reason=closing_reason)` using the same service path as lazy expiry. Triggered every 1 minute by Cloudflare Workers Cron Trigger (also serves as keep-warm to prevent Supabase Free pause). GitHub Actions schedule as secondary trigger for nightly jobs. Log each sweep with count of expired orders to Pino.

**Affected Models:** `orders`, `order_units`, `inventory_items`, `stock_pools`, `inventory_movements`, `order_status_history`.

**Affected Modules:** Orders, Inventory (via expiry path).

**Dependencies:** NEX-013, NEX-011.

**Parallelizable:** Yes — with NEX-035, NEX-036, NEX-037.

**Acceptance Criteria:**
- Sweeper called with an invalid HMAC secret returns 401.
- Two concurrent sweeper runs: `pg_try_advisory_xact_lock` ensures only one proceeds; the second returns 200 with `skipped: true`.
- An order with `hold_expires_at < now()` in `reserved` status is expired by the sweeper and its units released.
- Sweeper is idempotent: running on an already-expired order has no effect.
- Cloudflare cron trigger fires every minute in production (verified via Cloudflare dashboard).
- Sweeper runtime logged to Pino with `{ job: 'hold-sweeper', expired_count: N, duration_ms: M }`.

**Source References:** Architecture §1.4; Tech Stack §D10; Requirements §12 (expiry).

---

### NEX-035 — Claim Sweeper Job

**Target:** A 1-minute idempotent job that releases expired payment review claims, allowing the other owner to take over.

**Description:**
Implement `/api/internal/jobs/claim-sweeper`: query `orders WHERE review_claim_expires_at < now() AND review_claimed_by IS NOT NULL`. For each: `UPDATE orders SET review_claimed_by=NULL, review_claim_expires_at=NULL` — CAS to avoid race with an owner actively deciding. Log count.

**Affected Models:** `orders`.

**Affected Modules:** Payments (Review).

**Dependencies:** NEX-019.

**Parallelizable:** Yes — with NEX-034, NEX-036, NEX-037.

**Acceptance Criteria:**
- An order with `review_claim_expires_at < now()` has its claim cleared by the sweeper.
- If an owner accepted the order between the sweeper query and the update, the CAS has no effect on the now-decided order.
- Sweeper HMAC-protected; idempotent.

**Source References:** Architecture §1.4; MD-REV-01.

---

### NEX-036 — Ledger Reconciliation Job

**Target:** A nightly job that verifies wallet balance integrity and stock counter accuracy, alerting on any drift.

**Description:**
Implement `/api/internal/jobs/reconcile`: for each wallet — `SELECT SUM(amount) FROM ledger_entries WHERE wallet_id=?` and compare to `wallets.balance`; drift → Telegram alert + log. For each product with `stock_type IN ('unique','counted')` — recompute available/reserved/sold from `inventory_items` states or `order_units` states and compare to `stock_pools` counters; drift → alert. For `order_units`: verify no active unit (`state='held'`) is linked to two different orders with live status. Insert reconciliation result to a `reconciliation_log` table (simplified: a JSON record in `audit_log` with `action='reconcile.nightly'`).

**Affected Models:** `wallets`, `ledger_entries`, `stock_pools`, `inventory_items`, `order_units`.

**Affected Modules:** Finance, Inventory.

**Dependencies:** NEX-021, NEX-011.

**Parallelizable:** Yes — with NEX-034, NEX-035, NEX-037.

**Acceptance Criteria:**
- After 100 concurrent random test operations (sales, refunds, transfers), reconciliation job finds zero drift.
- A manually introduced drift in `wallets.balance` triggers a Telegram alert within the next nightly run.
- Reconciliation result is written to `audit_log` with `action='reconcile.nightly'` and the full result JSON.
- Job is triggered by GitHub Actions nightly schedule; also callable manually via HMAC endpoint.

**Source References:** Architecture §1.4; Tech Stack §D10, §D16; Requirements §23 (financial integrity).

---

### NEX-037 — Backup Export & Orphan Cleanup Jobs

**Target:** Nightly encrypted database backup exported to two locations, and periodic orphan file cleanup for object storage.

**Description:**
Implement `/api/internal/jobs/backup`: runs `pg_dump` (custom format) via the `pg_dump` binary or a Postgres client library dump, encrypts with `age` using the owners' public key, uploads to R2 `nexora-backups` bucket and rclone-syncs to an owner-controlled secondary drive. Verify the dump by reading the header before uploading. Log backup size and duration. Orphan cleanup: `/api/internal/jobs/cleanup-files`: query `file_keys` referenced in `product_images` and `payment_submissions`; list R2 bucket objects older than 24h not in either list; delete orphans. Monthly restore drill reminder: emit a Telegram message on the first of each month prompting owners to run the restore drill.

**Affected Models:** `product_images`, `payment_submissions` (read for file keys).

**Affected Modules:** Platform (Backup, Storage).

**Dependencies:** NEX-003, NEX-002.

**Parallelizable:** Yes — with NEX-034, NEX-035, NEX-036.

**Acceptance Criteria:**
- Backup file is AES-encrypted with `age` (plaintext `pg_dump` is never stored in R2 unencrypted).
- Backup uploaded to R2; rclone sync confirmation logged.
- Running the orphan cleanup removes R2 objects that are not referenced in the DB.
- Orphan cleanup does not delete objects that were just uploaded (24h grace period).
- Monthly Telegram reminder message sent on the 1st of the month.

**Source References:** Tech Stack §D15; Requirements §3 (backup, recovery, portability).

---

### NEX-038 — Admin Pulse Endpoint & Polling Infrastructure

**Target:** The `/api/admin/pulse` endpoint with monotonically increasing counters that drive dashboard polling — and the full TanStack Query polling wiring across all admin panels.

**Description:**
Implement `GET /api/admin/pulse` (owner-auth required): returns `{ review_queue_count, cs_case_count, low_stock_count, delivery_queue_count, last_event_id }` computed from indexed queries. `last_event_id` is the max `id` from `order_status_history` — monotonically increasing, so the dashboard only refetches panels when this changes. Dashboard polls every 5s while tab is visible (`document.visibilityState === 'visible'`), stops when hidden. Order-detail pages use TanStack Query `refetchInterval: 10000`. Customer checkout page uses `refetchInterval: 15000`. All polling uses `refetchOnWindowFocus: true` for re-sync after mobile app-switch.

**Affected Models:** (reads) `orders`, `support_cases`, `inventory_items`, `stock_pools`, `order_status_history`.

**Affected Modules:** Platform (Admin API, pulse).

**Dependencies:** NEX-031.

**Parallelizable:** Yes — with NEX-039.

**Acceptance Criteria:**
- `last_event_id` in the pulse response increases after every order status change.
- Dashboard stops polling when the browser tab is hidden (verified by pausing and observing network requests).
- Dashboard resumes polling and immediately refetches on tab focus.
- Pulse endpoint responds in < 100ms (indexed queries only).
- Pulse endpoint returns 401 if the owner session is invalid.

**Source References:** Tech Stack §D7, §D9; Architecture §1.2 (realtime); MD-DSH-03.

---

### NEX-039 — Web Push Notifications & Telegram Fallback

**Target:** PWA Web Push notifications for owners (new payment submissions, review expiring, CS cases) with Telegram bot as the fallback channel.

**Description:**
Implement PWA manifest and service worker registration. Generate VAPID key pair; store private key in server secrets. `POST /api/admin/push/subscribe` (owner-auth): stores push subscription (endpoint, keys) associated with the owner. Notification triggers (server-side, called from relevant service functions after commit): new `payment_submitted` order → push to both owners; review hold < 5 min remaining → push to claimed owner; new `support_case` → push to all owners; delivery stuck > 15 min → push (via reconciliation check). Telegram bot: `TELEGRAM_BOT_TOKEN` + `CHAT_ID` env vars; bot sends same events as Web Push. If Web Push delivery fails → fall back to Telegram. "Install to Home Screen" banner in the admin app.

**Affected Models:** (no new domain tables — subscription stored in a `push_subscriptions` platform table).

**Affected Modules:** Platform (Notifications).

**Dependencies:** NEX-034, NEX-038.

**Parallelizable:** Yes — with NEX-040, NEX-041.

**Acceptance Criteria:**
- An owner who has installed the PWA receives a push notification within 10 seconds of a new "payment submitted" order.
- Push notification works on Android Chrome; on iOS requires PWA to be added to Home Screen.
- Telegram bot sends the same event when Web Push fails or is not subscribed.
- VAPID private key is never logged or stored in any DB column.
- Service worker registration does not break the customer storefront (service worker is scoped to `/admin/`).

**Source References:** Tech Stack §D9; Requirements §31 (operational clarity, notifications).

---

### NEX-040 — Concurrency Integration Test Suite (Full)

**Target:** The complete integration test suite covering all concurrency risks, state-machine invariants, and financial integrity — running against real PostgreSQL.

**Description:**
Extend NEX-012 with all remaining concurrency tests now that full domain services exist: parallel `accept()` by both owners on same order (one wins, attribution correct for each outcome), `confirmDelivery()` double-click (exactly one sale entry), `reverseTransfer()` to negative receiver balance (succeeds, balance correctly negative), `Finance.reverse()` on an already-reversed entry (raises `ENTRY_ALREADY_REVERSED`), two owners simultaneously open refund case on same order (one wins), two owners simultaneously open replacement case on same unit (one wins), late payer vs new customer race (one gets stock). Invariant checks after each scenario: wallet balance = Σ ledger, stock counters = recomputed states, no unit held by two orders. Schema immutability: verify UPDATE on `ledger_entries` as `nexora_app` raises.

**Affected Models:** All domain models.

**Affected Modules:** All domain modules.

**Dependencies:** NEX-025, NEX-026, NEX-027, NEX-028, NEX-029.

**Parallelizable:** Yes — with NEX-039, NEX-041.

**Acceptance Criteria:**
- 100% pass rate over 10 consecutive CI runs with no flakiness.
- `Finance.reverse()` on an already-reversed entry: service-layer error raised before DB constraint fires.
- Two owners accept the same order: exactly one `payment_reviews(decision='accepted')` row; the other gets an `ALREADY_DECIDED` error.
- After 1000 random concurrent operations across all modules: `wallet.balance = SUM(ledger_entries.amount)` for all wallets.
- Schema immutability test: `UPDATE ledger_entries SET amount=0` as `nexora_app` raises trigger error.
- Test suite completes in < 90 seconds on CI.

**Source References:** Tech Stack §D13; Architecture §8 (full concurrency table); all GAP decisions.

---

### NEX-041 — Playwright End-to-End Tests

**Target:** Automated E2E test suite covering the customer golden path, the owner review-and-deliver path, expiry/late-payment, and RTL layout — on Chromium and WebKit with an iPhone profile.

**Description:**
Implement Playwright tests in the `e2e/` directory. Golden path: Browse → Product → Buy → Checkout (countdown visible) → Select payment method → Fill form → Submit → Owner claims → Accepts → Prepares → Confirm Delivery → Order completed → Customer tracks. Expiry path: Create reservation → advance DB time past expiry → customer tracks → sees expired → late submit → stock available → review → delivered. Late payment no-stock path: expire → late submit → no stock → CS case created → CS WhatsApp shown. RTL test: run golden path on iPhone WebKit profile with RTL layout; verify no LTR layout leaks. Rejection path: owner rejects → customer sees rejected + reason on tracking. `axe` accessibility scan on: storefront home, product page, checkout, tracking, admin dashboard, order detail, delivery page.

**Affected Models:** (full system).

**Affected Modules:** All.

**Dependencies:** NEX-017, NEX-018, NEX-020, NEX-023, NEX-031.

**Parallelizable:** Yes — with NEX-040.

**Acceptance Criteria:**
- Golden path test passes on Chromium and WebKit.
- iPhone WebKit profile: all interactive elements have ≥ 44px touch targets.
- RTL test: no `margin-left`, `margin-right`, `padding-left`, `padding-right`, `left:`, `right:` CSS properties on RTL layout elements (logical properties only).
- Expiry path: advancing `hold_expires_at` to the past in the test DB causes the checkout countdown to show "00:00" and submission to enter the late path.
- `axe` scan: zero critical or serious violations on all listed pages.
- All tests run on CI in < 10 minutes.

**Source References:** Tech Stack §D13; Requirements §4 (RTL, mobile); User Flow §4.2–4.6.

---

### NEX-042 — k6 Load Test & Security Hardening

**Target:** A k6 reservation stress test (200 simultaneous reservations for 1 item) proving no double-sell, plus a full security review covering rate limits, CAPTCHA, PII scrubbing, and headers.

**Description:**
k6 script: 200 virtual users simultaneously call `POST /api/public/checkout/reserve` for the same product with `qty=1` (the product has `unique` stock with exactly 1 available item). Expected result: exactly 1 succeeds, 199 receive `INSUFFICIENT_STOCK`. Security review checklist: Cloudflare WAF rules configured (country, bot score), Turnstile validated server-side on reserve + track endpoints, rate limits verified (10 tracking per 10 min, configurable reserve burst), no PII in server logs (phone numbers truncated, credentials not logged), no secrets in `process.env` logs, `Content-Security-Policy`, `X-Frame-Options`, `Referrer-Policy` headers on all pages, `gitleaks` CI scan passes, Sentry replay disabled on admin screens.

**Affected Models:** None (operational test).

**Affected Modules:** Platform (Security).

**Dependencies:** NEX-016, NEX-040, NEX-041.

**Parallelizable:** Yes — with NEX-041.

**Acceptance Criteria:**
- k6: exactly 1 of 200 concurrent reserve calls succeeds; 199 return `INSUFFICIENT_STOCK`; `stock_pools.available` is 0.
- k6: no database errors, no 500 responses, no orphan held units (verified by `SELECT count(*) FROM order_units WHERE state='held'` after run = 1).
- Sentry capture strips all phone numbers and order credentials before transmission.
- `Content-Security-Policy` header present on all HTML responses.
- `gitleaks` CI scan: zero secrets found.
- Turnstile validation fails gracefully when the token is missing (returns 422, not 500).

**Source References:** Tech Stack §D12, §D13, §D14, §D16; Requirements §29 (double-sale protection).

---

## PHASE 10 — Production Deployment

---

### NEX-043 — Production Deployment & CI/CD Pipeline

**Target:** The complete production deployment pipeline: Docker image built and pushed, migrations applied, Cloudflare cron configured, container host live, and all environment variables set.

**Description:**
Finalize GitHub Actions CI pipeline: lint → typecheck → unit tests → integration tests (Postgres service container) → build Docker `standalone` image → push to container registry → apply migrations (`nexora_migrator` role) → deploy to container host (Render/Koyeb or Oracle Always-Free ARM + Caddy). Verify host checklist: commercial use allowed, no forced sleep, Docker supported, secrets manager, no WebSocket/SSE requirement. Configure Cloudflare: DNS, WAF/rate rules, Turnstile, cron trigger (every 1 min → hold sweeper). Set all environment variables: `DATABASE_URL`, `DATABASE_URL_POOLED`, `ENCRYPTION_KEY`, `HMAC_SECRET`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `CRON_SECRET`, `BETTER_AUTH_SECRET`, `VAPID_PRIVATE_KEY`, `TELEGRAM_BOT_TOKEN`, `SENTRY_DSN`. Boot-time Zod validation of all env vars (fail fast if missing).

**Affected Models:** None.

**Affected Modules:** Platform (Deployment).

**Dependencies:** NEX-042.

**Parallelizable:** No.

**Acceptance Criteria:**
- `GET /api/health` returns `{ status: 'ok', db: 'ok' }` in production.
- Full CI pipeline (lint → deploy) completes in < 15 minutes.
- Boot fails fast with a clear error message if any required env var is missing.
- Cloudflare cron trigger fires every 1 minute (verified in Cloudflare dashboard Workers analytics).
- Migration is idempotent: re-running `migrate.ts` on a fully migrated DB makes zero changes.
- `docker run` of the production image starts with no compilation step required.

**Source References:** Tech Stack §D14; Requirements §3 (zero-cost, online, portable).

---

### NEX-044 — Monitoring, Uptime & Alerting

**Target:** Uptime monitoring on the health endpoint and a product page, structured logging with PII scrubbing, Sentry error tracking, and business health alerts.

**Description:**
Configure Better Stack / UptimeRobot on `GET /api/health` (DB round-trip) and one public product page. Pino structured JSON logs with `request_id`, `order_id`, `actor_owner_id` on every log line. Log scrubbing: phone numbers truncated to last 4 digits, credentials and tokens never logged, request bodies of sensitive routes never logged. Sentry free tier: source maps uploaded, PII scrubbing configured, session replay disabled on admin screens. Business health alerts (Telegram + Web Push): reconciliation drift, orders in `under_review` > 20 min, `expired` orders with a payment submission, delivery stuck in `sent_waiting_confirmation` > 15 min, hold sweeper silent > 5 min.

**Affected Models:** None.

**Affected Modules:** Platform (Monitoring).

**Dependencies:** NEX-043, NEX-039.

**Parallelizable:** Yes — with NEX-045.

**Acceptance Criteria:**
- Uptime monitor alerts within 2 minutes of the `/api/health` endpoint returning non-200.
- Log output contains `request_id` on every line; phone numbers appear as `***XXXX` (last 4 digits only).
- Sentry captures a test error; the error report contains no PII.
- Business alert: an order in `under_review` for 21 minutes triggers a Telegram message.
- Hold sweeper silence > 5 minutes (stopped cron) triggers an alert.

**Source References:** Tech Stack §D16; Requirements §3 (monitoring, recovery).

---

### NEX-045 — Backup Verification & Encryption Key Ceremony

**Target:** A verified backup restore drill, confirmed offline key storage, and a documented break-glass runbook — all completed before the first production inventory item is added.

**Description:**
Run the monthly restore drill: restore the latest `age`-encrypted backup to a scratch Postgres instance, run the reconciliation invariant checks, verify all tables are present and populated, document the result in `audit_log` (manual entry). Encryption key ceremony: generate the AES-256-GCM `ENCRYPTION_KEY` and `HMAC_SECRET` on an air-gapped machine, store in the host's secrets manager, provide an offline printed/stored copy to each owner in a sealed envelope. Break-glass runbook: documented step-by-step procedure for: DB restore, owner account unlock via CLI, encryption key recovery from offline copy. Cloudflare cron keep-warm confirmed operational (Supabase never pauses).

**Affected Models:** None.

**Affected Modules:** Platform (Backup, Security).

**Dependencies:** NEX-037, NEX-043.

**Parallelizable:** Yes — with NEX-044.

**Acceptance Criteria:**
- Restore drill: backup restored to a scratch DB; reconciliation job finds zero drift on the restored data.
- Restore drill result documented in `audit_log` with action `'backup.restore_drill'`.
- Both owners have a physical copy of the encryption key stored separately from the DB backup.
- Break-glass runbook exists as a markdown document in the project repository (not in the DB).
- Supabase project has not paused in the 7 days leading to launch (verified via Supabase dashboard).
- Running `node scripts/breakglass-reset.ts --owner=A` on the server terminal successfully resets Owner A's password without a browser.

**Source References:** Tech Stack §D12 (key management), §D15 (backup); Requirements §3 (portability, recovery).

---

## Dependency Graph

```
NEX-001
  ├── NEX-002
  │     ├── NEX-003 (parallel)
  │     ├── NEX-004
  │     │     ├── NEX-005
  │     │     │     ├── NEX-006
  │     │     │     │     └── NEX-007
  │     │     │     │           └── [required for shifts in NEX-013]
  │     │     │     ├── NEX-007 (parallel with NEX-006)
  │     │     │     ├── NEX-008 (parallel)
  │     │     │     │     └── NEX-011
  │     │     │     │           └── NEX-012
  │     │     │     │                 └── NEX-013
  │     │     │     │                       ├── NEX-014
  │     │     │     │                       └── NEX-015
  │     │     │     │                             └── NEX-016
  │     │     │     │                                   ├── NEX-017 (parallel)
  │     │     │     │                                   └── NEX-018 (parallel)
  │     │     │     ├── NEX-009 (parallel)
  │     │     │     └── NEX-010 (parallel)
  │     │     │           └── [required for NEX-013 payment accounts]
  │     │     └── [NEX-013 depends on all B-module services]
  ├── NEX-003 (parallel with NEX-004)
  │
  NEX-015 → NEX-019
              ├── NEX-020 (parallel with NEX-021)
              └── NEX-021
                    └── NEX-022
                          ├── NEX-023 (parallel with NEX-024)
                          └── NEX-024
                                ├── NEX-025 (parallel)
                                ├── NEX-026 (parallel)
                                └── NEX-027 (parallel)
                                      ├── NEX-028 (parallel)
                                      ├── NEX-029 (parallel)
                                      └── NEX-030 (parallel)
                                            └── NEX-031
                                                  ├── NEX-032 (parallel)
                                                  └── NEX-033 (parallel)
                                                        ├── NEX-034 (parallel)
                                                        ├── NEX-035 (parallel)
                                                        ├── NEX-036 (parallel)
                                                        ├── NEX-037 (parallel)
                                                        └── NEX-038
                                                              └── NEX-039 (parallel)
                                                                    ├── NEX-040 (parallel)
                                                                    └── NEX-041 (parallel)
                                                                          └── NEX-042
                                                                                └── NEX-043
                                                                                      ├── NEX-044 (parallel)
                                                                                      └── NEX-045 (parallel)
```

---

## Critical Path

```
NEX-001 → NEX-002 → NEX-004 → NEX-005 → NEX-008 → NEX-011 → NEX-012 → NEX-013
→ NEX-015 → NEX-019 → NEX-021 → NEX-022 → NEX-025/026/027 → NEX-028/029/030
→ NEX-031 → NEX-038 → NEX-040 → NEX-042 → NEX-043 → NEX-044/045
```

**Total tasks on critical path:** 18 of 45.
**Tasks that can never be parallelized with their predecessor:** NEX-002, NEX-012, NEX-013, NEX-019, NEX-021, NEX-022, NEX-042, NEX-043.

---

## Parallel Workstreams

| Stream | Tasks | Starts After |
|---|---|---|
| **Backend (critical path)** | NEX-001 → NEX-002 → NEX-004 → NEX-005 → NEX-008 → NEX-011 → NEX-012 → NEX-013 → NEX-015 → NEX-019 → NEX-021 → NEX-022 → NEX-031 | Day 1 |
| **Infrastructure** | NEX-003 (R2), NEX-037 (backup job) | After NEX-001 / NEX-002 |
| **Domain Foundation** | NEX-006, NEX-007, NEX-009, NEX-010 | After NEX-005 (all parallel) |
| **Frontend** | NEX-017 (storefront), NEX-018 (tracking) | After NEX-016 |
| **Admin UI** | NEX-020 (order mgmt), NEX-023 (delivery UI), NEX-024 (finance check) | After NEX-019 / NEX-022 |
| **Finance** | NEX-025, NEX-026, NEX-027 | After NEX-021 (all parallel) |
| **Aftercare** | NEX-028, NEX-029, NEX-030 | After NEX-022 (all parallel) |
| **Admin UI Phase 2** | NEX-031, NEX-032, NEX-033 | After NEX-030 (all parallel) |
| **Jobs & Monitoring** | NEX-034, NEX-035, NEX-036, NEX-037, NEX-038 | After NEX-031 (all parallel) |
| **Testing** | NEX-040, NEX-041 | After NEX-029 / NEX-017 (parallel with each other) |
| **Launch Prep** | NEX-044, NEX-045 | After NEX-043 (parallel with each other) |

---

## MVP Completion Checklist

The MVP is complete when **all** of the following are verified in production:

### Core Business Flow
- [ ] Owner can open a shift (NEX-007)
- [ ] Customer can browse products in Arabic RTL (NEX-017)
- [ ] Customer can reserve stock and see a live countdown (NEX-013, NEX-017)
- [ ] Customer can select a payment method (NEX-014)
- [ ] Customer can submit payment information with E.164-normalized phone (NEX-015)
- [ ] Customer can track their order using order number + phone (NEX-018)
- [ ] Owner receives a notification of new payment submission (NEX-039)
- [ ] Owner can claim, accept, or reject a payment (NEX-019)
- [ ] Owner can prepare delivery and generate a WhatsApp message (NEX-022, NEX-023)
- [ ] Owner can confirm delivery in one click; sale is posted atomically (NEX-022, GAP-08)
- [ ] Customer sees "مكتمل" status on tracking after delivery (NEX-018)
- [ ] Financial sale record is visible in owner's wallet (NEX-024)

### Inventory & Stock Safety
- [ ] Unique item cannot be sold to two customers simultaneously (NEX-011, NEX-012)
- [ ] Counted stock never goes below zero (NEX-011)
- [ ] Late payment re-checks stock; no-stock → CS case (NEX-015, NEX-030)
- [ ] Stock reserved is released on expiry (NEX-013, NEX-034)

### Finance & Ledger Integrity
- [ ] Wallet balance = Σ ledger after any operation (NEX-036)
- [ ] Sale posted only at delivery, not at acceptance (NEX-022)
- [ ] Reversal of a reversal is blocked (NEX-021, GAP-09)
- [ ] Transfer reversal works even when receiver goes negative (NEX-025, GAP-07)
- [ ] Delivery error records no auto-post (NEX-022, GAP-10)

### Security & Reliability
- [ ] Supabase public schema locked (NEX-002)
- [ ] Encryption key ceremony completed, offline copy with owners (NEX-045)
- [ ] 200 concurrent reserve calls → exactly 1 success, 199 clean rejections (NEX-042)
- [ ] Backup restore drill passes with zero drift (NEX-045)
- [ ] Hold sweeper running every 1 minute in production (NEX-034, NEX-043)
- [ ] Web Push notifications delivered to owner phones (NEX-039)

### Arabic & RTL
- [ ] All customer-facing text is Arabic (NEX-017)
- [ ] LTR content (phones, IBANs, credentials, order numbers) isolated in LTR wrappers (NEX-017)
- [ ] Arabic plural rules use ICU syntax (NEX-017, NEX-033)
- [ ] Playwright RTL iPhone test passes (NEX-041)

---

## Remaining Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Supabase Free pause if keep-warm cron fails | High | UptimeRobot alert on `/api/health`; redundant GitHub Actions keep-warm |
| Encryption key loss before offline copy stored | Critical | Block first production item until NEX-045 key ceremony is complete |
| Money arithmetic coerced to JS `number` | High | Biome lint rule banning `parseFloat`/`Number()` on monetary values; `big.js` enforced |
| HMAC fingerprint implemented as plain `sha256` by mistake | High | Code review gate; NEX-012 invariant test verifies HMAC via independent computation |
| `pagehide` beacon dropped by browser | Medium | Sweeper (NEX-034) is safety net; no correctness dependency on beacon |
| Web Push not delivered on iOS without PWA install | Medium | Telegram fallback (NEX-039); owner onboarding instructs Home Screen install |
| Arabic ICU plural strings hand-rolled (incorrect) | Medium | CI lint rule on next-intl message files; NEX-041 visual test on plural strings |
| Multi-factor conflict detection query slow at scale | Low | Composite index on `(transfer_number_norm, payment_account_id)` added in NEX-019 migration |
| Transfer reversal leaving receiver deeply negative (GAP-07) | Low | Wallet display uses danger color; reconciliation job alerts; no business blocker |
| Container host introducing forced cold start | Low | Cloudflare cron keep-warm (NEX-034); verify host terms before lock-in (NEX-043) |

---

## Finalized Decisions Register

All 10 architectural decisions are final. No open decisions remain.

| ID | Decision Summary | Implementing Task |
|---|---|---|
| GAP-01 | Multi-factor conflict detection (transfer# + amount + account + time); no single-column unique constraint | NEX-019 |
| GAP-02 | 3-reservation cap: fingerprint at reserve, WhatsApp at submit | NEX-013, NEX-015 |
| GAP-03 | `payment_owner_id` at reserve; `payment_account_id + snapshot` at method selection | NEX-013, NEX-014 |
| GAP-04 | Both owners may accept/reject any order; dual attribution always recorded | NEX-019, NEX-020 |
| GAP-05 | Review-timeout expired orders recover via 24-hour late-payment path | NEX-015, NEX-030 |
| GAP-06 | Correction resubmission resets 30-minute review hold | NEX-015 |
| GAP-07 | Transfer reversal unconditionally allowed; receiver may go negative | NEX-025 |
| GAP-08 | Single `Confirm Delivery` action; atomic sale post + message mark + order advance | NEX-022 |
| GAP-09 | Re-reversal blocked at service layer before DB constraint | NEX-021 |
| GAP-10 | Delivery error has no auto-post; manual `Finance.adjust()` only | NEX-022, NEX-027 |
