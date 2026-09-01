# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Prime Paper Company — a bilingual (Arabic RTL default / English LTR) paper-factory management system. Tracks raw material rolls → finished products → deliveries to client companies → installment payments, with a configurable analytics dashboard.

## Commands

Package manager is **pnpm** (`pnpm-lock.yaml`, `pnpm-workspace.yaml`).

```bash
pnpm dev            # next dev
pnpm build          # next build
pnpm start          # next start
pnpm lint           # eslint (flat config, eslint-config-next core-web-vitals + typescript)
pnpm test           # vitest, pure logic only
pnpm test:watch
npx tsc --noEmit    # typecheck (no dedicated script)
```

If `pnpm` is not on PATH, `corepack pnpm <cmd>` works — corepack ships with Node.

Database (drizzle-kit is a devDependency; there are no db scripts in package.json):

```bash
pnpm drizzle-kit generate   # emit SQL migration from src/db/schema.ts into drizzle/
pnpm drizzle-kit studio
node src/scripts/seed-settings.mjs   # idempotent: upserts settings + default cards
```

Requires `DATABASE_URL` (Neon PostgreSQL) in `.env`.

**Migrations, in practice.** The database was built with `push`, so `drizzle.__drizzle_migrations` is empty while `0000` is applied — `drizzle-kit migrate` would try to replay it and fail. Apply new migration SQL directly instead. `drizzle-kit migrate` also hangs on this setup (it wants a websocket connection the http driver doesn't provide).

**`generate` prompts and cannot be answered non-interactively.** When a diff both creates and deletes tables, drizzle asks whether it's a rename, and there is no flag to skip it. The way around it is two migrations: one purely additive, then one purely subtractive. Neither is ambiguous, so neither prompts. `drizzle/0001` and `0002` were produced this way.

**Tests cover pure logic only** — no DB or component tests. Anything DB-coupled must have its logic extracted to be testable (see `equation-parser.ts` vs `equation-variables.ts`).

## Architecture

### Onion architecture per domain (`src/server/{domain}/`)

Every backend domain follows the same four-file shape, and the call chain is strict:

```
router.ts    tRPC procedures — input validation + procedure-level authz only
services.ts  business logic; calls db.ts, never Drizzle directly
db.ts        Drizzle queries; the only layer that touches `db`
types.ts     Zod schemas (CreateXSchema / UpdateXSchema / GetXSchema) + inferred TS types
```

Domains: `analytics`, `companies`, `deliveries`, `products`, `raw-materials`, `settings`, `users`. All are merged in `src/server/root.ts` into `appRouter`; `AppRouter` type flows to the client via `src/trpc/react.tsx`. Two exceptions to the four-file shape: `analytics/` has no `db.ts` (queries live in `services.ts` + `equation-engine.ts`), and `users/` is router-only.

When adding a domain: create the four files, register it in `root.ts`, then consume it from a client component with `api.{domain}.{proc}`.

### Authorization lives in the procedure, not the handler

`src/server/trpc.ts` exports three procedure builders — always pick the right one instead of checking the session inside a handler:

- `publicProcedure` — unauthenticated (only `users.requestReset` legitimately uses this)
- `protectedProcedure` — any authenticated user; use for **all reads**
- `writerProcedure` — role is `dev` or `admin`; use for **all create/update/delete**

Roles that actually exist in code: `dev` and `admin` are full-access writers; anything else (the column default is `user`) is read-only. There is no `viewer` role — older docs claim one. On the client, `useUserRole()` (`src/hooks/use-role.ts`) gives `canWrite` for hiding write UI — that is cosmetic only; the real gate is `writerProcedure`.

Better Auth (`src/lib/auth.ts`) has a `databaseHooks.user.create.before` hook that hard-sets `role: "dev"` on **every** user row it creates. It is commented as a signup bootstrap (owner signs up once, then flips the `allow_public_signup` system setting to `"false"`, making `/auth/signup` return `notFound()`), but it is unconditional, so it also overrides the role passed by `authClient.admin.createUser` in `/invite` — see "Known landmines" below before touching either.

`src/middleware.ts` protects everything except `/`, `/auth/*`, `/api/*` by fetching `/api/auth/get-session` with the forwarded cookie header (deliberately, rather than guessing cookie names like `__Secure-`). A fetch failure fails closed to `/auth/login`.

### Data flow and cache invalidation

Server components (`src/app/(app)/*/page.tsx`) are thin: they call `getTranslations()`, render `<Header>` plus a client component. All data fetching happens client-side through tRPC hooks in `src/components/{domain}/ui/*Client.tsx`.

Mutations invalidate rather than mutate cache manually:

```ts
const utils = api.useUtils();
const create = api.companies.create.useMutation({
  onSuccess: () => { utils.companies.getAll.invalidate(); ... },
});
```

superjson is the transformer on both ends (dates cross the wire intact). Query `staleTime` is 5s.

### Configurable dashboard (equation engine)

Dashboard stat cards are database rows (`dashboard_cards`), not code. Each card stores an `equation` string like `SUM_UNPAID(deliveries.selling_price_egp) - SUM(payments.amount_egp)`. `src/server/analytics/equation-engine.ts` tokenizes it and resolves each token through a **hard-coded switch of pre-defined safe aggregations** — this is the injection guard. To expose a new metric you must add a `case` in `resolveVariable` *and* an entry in the exported `EQUATION_VARIABLES` list (with `label` + `labelAr`) that feeds the card editor dropdown. Unknown tokens that don't parse as numbers throw.

`system_settings` is a key/value/category table (`operational`, `dashboard`, `ui`) read for things like page sizes and the signup toggle; edited from `/settings`.

### Money and payment status

All monetary and weight columns are Postgres `decimal`, which Drizzle returns as **strings** — coerce with `Number(...)` and never assume numeric arithmetic works directly. Delivery `paymentStatus` (`paid` / `partial` / `unpaid`) is derived, not user-set: `insertPayment` in `src/server/deliveries/db.ts` re-sums payments after each insert and rewrites the status. Any new path that creates or deletes payments must recompute it the same way.

### i18n

Locale comes from a `locale` cookie, defaulting to `ar` (`src/i18n/request.ts`); the root layout sets `<html lang dir>` from it. Server components use `getTranslations("ns")`, client components `useTranslations("ns")`.

`ar.json` and `en.json` are currently in sync (216 keys each) — keep them that way, since a key present in only one throws `MISSING_MESSAGE`. Note that `t()` throws rather than returning undefined, so the `t("x") || "fallback"` idiom used in a few places does not actually fall back.

## Conventions

- Path alias `@/*` → `src/*`.
- shadcn/ui, "new-york" style, `neutral` base, CSS variables in `src/app/globals.css`; primitives in `src/components/ui/` are generated — prefer `npx shadcn@latest add <component>` over hand-writing them. Icons: lucide-react.
- Domain UI lives in `src/components/{domain}/ui/PascalCaseClient.tsx` and is `"use client"`.
- Zod schemas belong in `types.ts` and are the single source of both runtime validation and TS types (`z.infer<typeof Schema>`).
- Section comments use the `// ─── Title ───` box-drawing style; match it in files that already use it.

## Invariants — don't break these

- **Raw material stock is derived, never stored.** `balance = SUM(receipts) − SUM(consumptions)`. There is no balance column; do not add one.
- **Compute the balance with scalar subqueries, never two `LEFT JOIN`s under one `GROUP BY`.** The join fans out and inflates both sums — verified: 3 receipts + 2 consumptions reported 21.000 t instead of 10.500 t. See `types.db.ts`.
- **Never interpolate a drizzle column into a correlated subquery.** `sql\`... WHERE r.type_id = ${rawMaterialTypes.id}\`` renders the column **unqualified** as `"id"`, which Postgres then binds to the *subquery's* table. It matches nothing, `SUM` returns NULL, and every total silently reads 0 — no error, and it typechecks. Write the outer column as literal text (`raw_material_types.id`). This bit once already; check `.toSQL()` when writing correlated subqueries.
- **Weight leaves only via a consumption entry.** Creating a product does *not* deduct anything; `products.rawMaterialTypeId` is informational. This is deliberate — the owner records consumption by hand.
- **Balance comparisons run on integers**, via `toUnits(value, scale)`. Never compare decimal strings as floats; `2.9999999996 !== 3` will bite.
- **`paymentStatus` is always derived** from the payments recorded. It is not an input on any schema. Anything that changes payments or a delivery's price must call `recomputeDeliveryStatus`.
- **`derivePaymentStatus` (TS) and `PAYMENT_STATUS_SQL` encode the same rule** and live together in `deliveries/status.ts`. Change both or neither.
- **Outstanding is `SUM(MAX(price − paid, 0))` per delivery.** Overpayment is allowed, so a global "prices minus all payments" would let one overpaid delivery cancel another's debt.
- **Money and measure fields use the helpers in `shared/validation.ts`**, never bare `z.string()`.
- **Roles: `dev` > `admin` > everything else.** `dev` is bootstrap-only (first account) and the only role that can administer accounts. `admin` writes data. Better Auth needs `dev` declared in the `roles`/`adminRoles` config in `auth.ts` or its admin API rejects dev users.
- **Equation tokens live in `analytics/equation-variables.ts`.** Adding a metric means a resolver *and* an `EQUATION_VARIABLES` entry. Old tokens stay in `ALIASES` so saved cards don't silently render zero. Equations are validated on save; a bad one errors rather than showing `0`.
- **Settings must be declared in `settings/registry.ts`** before anything reads them, and are consumed via `getSettingsMap()`. An undeclared key is editable but inert.
- **Both message files move together.** 257 keys each; parity is checked by the script in the plan's Task 21.

## Still open

- Two accounts exist and both are `dev` (`seiffmuhammad199@`, `seifelden484@`). The second predates the role fix and probably wants demoting.
- Dashboard has both a legacy "Total Raw Materials" card (lifetime intake, via alias) and the new "Raw Material Balance" card. Harmless duplicate; hide one in Settings if unwanted.
- `pnpm lint` reports one pre-existing error in shadcn's `src/components/ui/sidebar.tsx` (`Math.random` during render). Untouched — don't mistake it for new breakage.
- Better Auth logs a startup warning that no base URL is set; set `BETTER_AUTH_URL` to silence it.

## `docs/`

`docs/` holds hand-maintained references (architecture, feature reference, audits, roadmaps, AR/EN user manuals). Good for *intent* and history, unreliable on current state — several entries describe bugs since fixed (login redirect, missing `auth` translation keys, absent `error.tsx`/`not-found.tsx`) and it documents a `viewer` role that has never existed in code. Verify against source before acting, and update the doc when you change what it describes.
