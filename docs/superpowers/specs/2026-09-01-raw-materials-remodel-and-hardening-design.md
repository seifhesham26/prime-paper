# Raw Materials Remodel & Application Hardening — Design

**Date:** 2026-09-01
**Status:** Approved design, pending implementation plan

---

## 1. Context

Prime Paper tracks raw material rolls → finished paper rolls → deliveries → installment payments. Two problems drive this work.

**The raw material model is wrong for the business.** Today `raw_materials` is one row per incoming shipment, each an independent record with its own supplier and weight. In reality the material is fungible: what matters is *which kind* it is (a label the owner chooses, usually reflecting where it came from) and *how much of it is left*. There is no concept of stock — delivering or producing never reduces anything.

**A codebase audit found ~22 defects**, several of which corrupt money figures or grant unintended access. They are fixed in the same pass because they touch the same tables and procedures.

## 2. Decisions taken

| Question | Decision |
|---|---|
| What defines a "type"? | A free-text label the owner chooses |
| Keep per-shipment records? | Yes — parent + receipts, balance computed |
| How is weight consumed? | Manually, but recorded as a **consumption entry**, not by overwriting a total |
| Supplier per receipt | **Dropped** — the type name carries origin |
| Overpayment on a delivery | **Allowed** — remaining may show negative |
| Who can invite users | **`dev` only** |
| Test framework | **Vitest**, for pure logic only |
| Scope | All five sections in one pass |

### Reconciling "computed balance" with "manual consumption"

These appear to conflict. They are reconciled by making consumption an *event* rather than an *edit*: the owner records how much went into rolls and when, and the balance is derived from the ledger of receipts minus consumptions. The owner keeps full control of when weight comes off; the system keeps the history and does the arithmetic.

**Accepted consequence:** a consumption entry is not tied to the products it produced. Products keep an informational link to a type, but never move weight. The balance can therefore disagree with the rolls actually recorded. This is deliberate — the type detail screen shows both so a mismatch is visible.

---

## 3. Section 1 — Raw material model

### 3.1 Schema

`raw_materials` is dropped and replaced by three tables.

**`raw_material_types`** — the parent
| column | type | constraints |
|---|---|---|
| `id` | uuid | PK, default random |
| `name` | text | not null, **unique** |
| `notes` | text | nullable |
| `created_by` | text | → `user.id` |
| `created_at`, `updated_at` | timestamp | not null, default now |

Unique `name` prevents the same label becoming two parents. No `origin` column: the name carries it.

**`raw_material_receipts`** — one row per arrival
| column | type | constraints |
|---|---|---|
| `id` | uuid | PK |
| `type_id` | uuid | → `raw_material_types.id`, not null |
| `date_received` | timestamp | not null |
| `weight_tons` | decimal(10,3) | not null, > 0 |
| `cost_egp` | decimal(12,2) | not null, ≥ 0 |
| `cost_per_ton` | decimal(12,2) | derived: `cost_egp / weight_tons` |
| `notes` | text | nullable |
| `created_by` | text | → `user.id` |
| `created_at`, `updated_at` | timestamp | |

No `supplier_name` — dropped per decision.

**`raw_material_consumptions`** — one row per "this went into rolls"
| column | type | constraints |
|---|---|---|
| `id` | uuid | PK |
| `type_id` | uuid | → `raw_material_types.id`, not null |
| `date` | timestamp | not null |
| `weight_tons` | decimal(10,3) | not null, > 0 |
| `notes` | text | nullable |
| `created_by` | text | → `user.id` |
| `created_at`, `updated_at` | timestamp | |

**`products`** — `raw_material_id` becomes `raw_material_type_id` → `raw_material_types.id`, nullable, `ON DELETE SET NULL`. The products list shows the type name where it currently shows `supplier_name`.

### 3.2 Balance

```
received  = SUM(receipts.weight_tons)
consumed  = SUM(consumptions.weight_tons)
balance   = received - consumed
```

Computed on read, never stored.

**Average cost per ton is weighted**, not a mean of rates:

```
avg_cost_per_ton = SUM(receipts.cost_egp) / SUM(receipts.weight_tons)
```

A 1-ton receipt at 100 and a 9-ton receipt at 200 give 190, not 150. The unweighted mean is only kept where the legacy `AVG(raw_materials.cost_per_ton)` equation token needs it for backward compatibility; every screen shows the weighted figure.

**Implementation constraint:** joining both child tables and grouping produces a Cartesian fan-out that inflates both sums. Balance must be computed with two scalar subqueries per type (the pattern already used by `topUnpaidCompanies` in `analytics/services.ts`), never with two `LEFT JOIN`s under one `GROUP BY`.

### 3.3 Invariants enforced server-side

1. **Consumption may not exceed balance.** Rejected with `TRPCError BAD_REQUEST` naming the available balance. Equality is allowed (full conversion).
2. **The same check runs on edit and delete of a receipt.** Lowering a receipt's weight, or deleting one, must not drive the balance negative.
3. **Editing a consumption** re-checks the balance excluding that entry's own contribution.
4. **A type with any receipts, consumptions, or linked products cannot be deleted.** The error names what blocks it. No raw Postgres FK errors reach the user.
5. **`weight_tons > 0`** is enforced before the cost-per-ton division, so the division can never produce `Infinity`.

### 3.4 tRPC surface

`rawMaterials` router, all reads `protectedProcedure`, all writes `writerProcedure`:

- **Types:** `getAll` (paginated, each row carrying received / consumed / balance / avg cost-per-ton), `getById` (detail: type + receipts + consumptions + linked products + totals), `create`, `update`, `delete`
- **Receipts:** `createReceipt`, `updateReceipt`, `deleteReceipt`
- **Consumptions:** `createConsumption`, `updateConsumption`, `deleteConsumption`

### 3.5 File layout

The domain outgrows a single `db.ts`:

```
src/server/raw-materials/
  router.ts
  services.ts
  types.ts
  types.db.ts           queries for raw_material_types (incl. balance)
  receipts.db.ts
  consumptions.db.ts
```

Every other domain keeps its existing four-file shape.

### 3.6 Screens

**`/raw-materials`** — table of types: name, total received, total consumed, **balance**, avg cost/ton, actions. "Add Type" dialog. Paginated.

**`/raw-materials/[id]`** — modelled on `/deliveries/[id]`:
- four summary cards: received, consumed, balance, avg cost/ton
- receipts table + "Add Receipt" dialog
- consumptions table + "Record Consumption" dialog, including a **"consume all remaining"** action that pre-fills the exact balance
- read-only list of rolls linked to this type, so balance vs. actual production is visible

All strings added to **both** `messages/en.json` and `messages/ar.json`.

### 3.7 Equation engine

Existing tokens are kept as aliases so no saved dashboard card silently breaks:

| existing token | remapped to |
|---|---|
| `SUM(raw_materials.weight_tons)` | total received across receipts |
| `SUM(raw_materials.cost_egp)` | total cost across receipts |
| `AVG(raw_materials.cost_per_ton)` | average over receipts |
| `COUNT(raw_materials)` | count of **receipts** (old rows were shipments) |

New tokens: `BALANCE(raw_materials)`, `SUM(raw_material_consumptions.weight_tons)`, `COUNT(raw_material_types)`.

---

## 4. Section 2 — Security

### 4.1 The role override

`src/lib/auth.ts` currently hard-sets `role: "dev"` on **every** user row created through the adapter, including those made by `authClient.admin.createUser`. The `/invite` role selector is therefore a no-op and every invited user receives full write access.

The fix does not rely on Better Auth's hook payload semantics:

1. **User creation moves server-side.** A new `users.invite` procedure creates the account and then sets the role explicitly, replacing the client-side `authClient.admin.createUser` call. The resulting role is guaranteed regardless of what the hook does.
2. **The hook shrinks to bootstrap only:** respect a supplied role; otherwise assign `dev` when the user table is empty and `user` thereafter.

### 4.2 `dev`-only administration

- A new `devProcedure` middleware in `src/server/trpc.ts`.
- `users.invite`, `getPendingResets`, `resolveReset`, `getUserIdByEmail` all move to `devProcedure`.
- `/invite` page rejects non-`dev` sessions; the sidebar link shows only for `dev`.

**Accepted consequence:** users with the `admin` role lose access to the invite screen and the password-reset queue. Only `dev` administers accounts.

### 4.3 Invite UI

Role options become **Admin** (full access) and **Viewer** (read-only, stored as `user`) — the roles that actually exist. The submit handler inspects the returned `{ error }` instead of relying on a `catch` that never fires, so failures stop reporting success.

---

## 5. Section 3 — Money correctness

### 5.1 Single source of truth for `paymentStatus`

`paymentStatus` is removed from `CreateDeliverySchema`. It is always derived:

```
paid == 0            -> unpaid
0 < paid < price     -> partial
paid >= price        -> paid       (price > 0)
```

Recomputed after: delivery create, delivery price edit, payment create/edit/delete.

**Write path:** a single `UPDATE deliveries SET payment_status = CASE … END` with the payment sum as a subquery — atomic in one statement, no read-then-write gap.

**Adjacency risk:** the same rule exists as SQL and as a pure TS function (`derivePaymentStatus`, needed for display). Both live side by side in `src/server/deliveries/status.ts` with a comment binding them, so they cannot drift unnoticed.

### 5.2 Outstanding payments

The current figure is `unpaid_total + partial_total − ALL payments`, which subtracts payments belonging to already-`paid` deliveries and understates the debt. Corrected to:

```
outstanding = SUM over deliveries of MAX(price - paid_for_that_delivery, 0)
```

Overpayment on one delivery no longer cancels out debt on another. A new `OUTSTANDING(deliveries)` equation token computes this correctly, and the seeded "Outstanding Payments" card is re-pointed at it.

### 5.3 Overpayment

Allowed, per decision. `remaining` may display negative and is styled to make that legible. Only the positive part contributes to `outstanding`.

### 5.4 Numeric validation

A shared helper `decimalString({ min, max, scale })` in `src/server/shared/validation.ts` replaces the bare `z.string().min(1)` on all seven money/measure fields: `weight_tons`, `cost_egp`, `selling_price_egp`, `amount_egp`, `length_m`, `width_cm`, `weight_kg`. Non-numeric input is rejected by Zod with a readable message instead of reaching Postgres as a cast error.

### 5.5 Missing mutations

Added: `deliveries.update`, `deliveries.updatePayment`, `deliveries.deletePayment`. All trigger a status recompute. Correcting a typo no longer requires deleting a delivery and its payment history.

### 5.6 Atomicity

`insertDelivery` currently writes the delivery and its items as two statements. neon-http cannot run interactive transactions, but `db.batch()` executes multiple statements as a single transaction — sufficient here. No driver change.

---

## 6. Section 4 — Plumbing

- **`created_by` populated** on all six tables. Routers pass `ctx.session.user.id` into services; service signatures gain a `userId` parameter.
- **Delete guards** on companies (with deliveries), products (in delivery items), and types (§3.3). Each returns a `TRPCError CONFLICT` naming the blocker.
- **Pagination wired up.** The existing but never-imported `PaginationControls` is connected to all four list screens via a `?page=` URL param, ending the silent 100-row cap. `InfiniteScrollSpinner` and `useInfiniteScroll` are deleted — the pagination control covers both cases and the hook has no consumer.
- **Settings actually read.** A `src/server/settings/registry.ts` declares each known key with its type, range, default, and bilingual label. It backs:
  - `getSettingsMap()`, consumed by list page sizes (`page_size_default`), dropdown limits (`dropdown_list_limit`), and dashboard limits (`dashboard_recent_deliveries`, `dashboard_top_unpaid`, `dashboard_chart_months`) — all currently hardcoded
  - validation on `settings.update`, so `page_size_default` can no longer be set to `"abc"`
  - the Settings UI, which shows real labels instead of raw snake_case keys
- **Cache invalidation** extended so every mutation affecting dashboard figures invalidates both `analytics.getDashboardStats` and `analytics.evaluateCards`.

---

## 7. Section 5 — UI defects

| Defect | Fix |
|---|---|
| `/settings?tab=cards` lands on Account | Tabs read the `tab` search param |
| `dashboard.paid\|partial\|unpaid` missing → `MISSING_MESSAGE` on the dashboard | Added to both message files |
| `settings.cancel` missing | Added to both message files |
| `lg:grid-cols-${n}` never generated by Tailwind | Static class map keyed by card count |
| Equation builder emits invalid `X * + Y` | Operator/variable concatenation made context-aware |
| A bad equation silently renders `0` | Equations validated on save (unknown token → error); at render, failures return `null` and the card shows a warning state rather than a fake zero |
| Landing page hardcoded English, dead footer links | Localized; footer links removed |
| Signup CTA shown when `allow_public_signup` is false → 404 | CTA hidden when signup is disabled |
| Deliveries product dropdown fetched once server-side and goes stale | Moved to a live tRPC query; `JSON.parse(JSON.stringify())` hack removed |
| Dead code | `src/app/(app)/dashboard-client.tsx`, `src/scripts/seed-settings.ts`, and the `invitation` table are deleted |

---

## 8. Testing

Vitest is added for **pure logic only** — no DB or component tests. This requires extracting pure functions from DB-coupled code, which is a design improvement in its own right.

`src/server/analytics/equation-engine.ts` splits into:
- `equation-parser.ts` — tokenizer and evaluator, taking a **resolver function as a parameter** so it can be tested with a stub
- `equation-variables.ts` — the token registry and its DB resolvers

Test coverage:

| Unit | Cases |
|---|---|
| Equation tokenizer/evaluator | precedence, nested parens, constants, the `X * + Y` regression, unknown token → error, divide by zero |
| `validateEquation` | accepts every registry token, rejects typos |
| `derivePaymentStatus` | zero, partial, exact, overpayment, zero-price |
| `outstandingFor` | clamps negative to zero |
| `decimalString` | non-numeric, negative, scale overflow, boundaries |
| `costPerTon` | normal, zero weight rejected |
| `weightedAvgCostPerTon` | weighting is by tonnage, empty set → null not NaN |
| Balance / consumption guard | under, exact, over, edit excluding own contribution |

Scripts added: `test` and `test:watch`.

---

## 9. Migration

There is no production data, so the schema is reshaped directly rather than migrated:

1. Drop `raw_materials` and the unused `invitation` table.
2. Create the three new tables.
3. Alter `products.raw_material_id` → `raw_material_type_id`.
4. Generate one migration with `drizzle-kit generate`.
5. `seed-settings.mjs` becomes idempotent — it **upserts** the four default dashboard cards by title rather than skipping when any card exists, so the corrected Outstanding equation reaches existing databases.

`pnpm install` is required first; `node_modules` is currently absent.

---

## 10. Out of scope

- Replacing the landing page's placeholder hero visual
- Self-service password reset (the manual ticket flow stays)
- PDF delivery receipts (`@react-pdf/renderer` is installed but unused)
- Optimising the middleware's per-request `fetch` to `/api/auth/get-session`
- Automatic deduction of raw material weight from product creation — explicitly rejected in §2

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Better Auth may not pass `role` through the create hook | Role is set server-side after creation, not via the hook |
| Balance queries fan out if joined naively | Scalar subqueries mandated in §3.2; covered by a unit test on the pure balance function |
| SQL `CASE` and TS `derivePaymentStatus` could diverge | Both in one file with a binding comment |
| Renaming `products.raw_material_id` breaks the products screen | Products list and form updated in the same change |
| Scope is large (~40 fixes) | Implementation plan sequences it: security → schema → money → plumbing → UI, each independently verifiable |
