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
npx tsc --noEmit    # typecheck (no dedicated script)
```

Database (drizzle-kit is a devDependency; there are no db scripts in package.json):

```bash
pnpm drizzle-kit generate   # emit SQL migration from src/db/schema.ts into drizzle/
pnpm drizzle-kit migrate    # apply migrations
pnpm drizzle-kit push       # push schema directly (used during development)
pnpm drizzle-kit studio
node src/scripts/seed-settings.mjs   # seed system_settings + default dashboard_cards
```

Requires `DATABASE_URL` (Neon PostgreSQL) in `.env`. There is **no test framework** in this repo — verify changes by running the app.

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

## Known landmines

Verified against the code, not the docs. Don't assume any of these are already handled:

- **The invite role selector is a no-op.** `/invite` passes `role` to `authClient.admin.createUser`, but the `databaseHooks` hook in `src/lib/auth.ts` overwrites it with `"dev"`, so every invited user gets full write access. Fixing the hook to only apply on self-signup is the intended shape.
- **`paymentStatus` has two sources of truth.** `CreateDeliverySchema` lets the user pick it, but `insertPayment` recomputes it from the payment sum. A delivery created as `"paid"` with no payments stays `"paid"` while `remaining` shows the full price.
- **`outstandingPayments` double-counts.** `getDashboardStats` computes `unpaid + partial - ALL payments`, subtracting payments that belong to already-`paid` deliveries. The seeded "Outstanding Payments" dashboard card uses the same wrong equation.
- **Money/measure fields are only `z.string().min(1)`** — no numeric validation anywhere. Non-numeric input reaches Postgres as a raw `decimal` cast error, and `weightTons: "0"` makes `costPerTon` `Infinity`.
- **No transactions.** The neon-http driver can't do interactive transactions, so `insertDelivery` writes the delivery and its items as separate statements and can half-fail.
- **`createdBy` is dead on every table.** The column exists on 5 tables and no insert ever populates it; services take only `input`, never `ctx.session`.
- **Deliveries can't be edited and payments can't be edited or deleted** — only create/delete on deliveries, create on payments.
- **Deleting a referenced row throws a raw FK error** (company with deliveries, product in delivery_items, raw material with products). Only `delivery_items`/`payments` cascade, and only from `deliveries`.
- **Delivering does not decrement `products.quantity`.** There is no stock/consumption model anywhere.
- **Pagination is dead code.** `PaginationControls`, `InfiniteScrollSpinner`, and `useInfiniteScroll` are never imported; every list hardcodes `{ page: 1, limit: 100 }`, silently capping the UI at 100 rows.
- **Most `system_settings` keys are decorative.** Only `allow_public_signup` is read. `page_size_default`, `dropdown_list_limit`, `dashboard_recent_deliveries`, `dashboard_top_unpaid`, and `dashboard_chart_months` are editable in Settings but read by nothing.
- **Unused files:** `src/app/(app)/dashboard-client.tsx` (superseded by `AnalyticsClient`), `src/scripts/seed-settings.ts` (uses the `@/` alias so it can't run — the `.mjs` twin is the live one), and the `invitation` table in `drizzle/0000_ambiguous_patch.sql`, which `schema.ts` doesn't define.

## `docs/`

`docs/` holds hand-maintained references (architecture, feature reference, audits, roadmaps, AR/EN user manuals). Good for *intent* and history, unreliable on current state — several entries describe bugs since fixed (login redirect, missing `auth` translation keys, absent `error.tsx`/`not-found.tsx`) and it documents a `viewer` role that has never existed in code. Verify against source before acting, and update the doc when you change what it describes.
