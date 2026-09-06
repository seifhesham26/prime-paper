# Factory Process Automation — Design

- **Date:** 2026-09-06
- **Status:** Approved, ready for implementation planning
- **Approach:** B — materialize on mutation

## Context

Every step of the factory process is currently hand-typed. The only automated
derivation in the system is `paymentStatus`, which `insertPayment` recomputes
after each payment.

| Step | Today | After |
|---|---|---|
| Receipt | weight + cost typed, `costPerTon` nullable | unchanged (already derivable) |
| Consumption | fully manual | auto-written when a product is produced |
| Product weight | typed | auto-suggested from `gsm` and dimensions |
| Delivery price | typed | auto-computed from items, frozen at save |
| Roll availability | nothing tracks it | derived from `delivery_items` |
| Overdue payments | invisible | derived from `due_date` |
| Low stock | invisible | derived against a per-material threshold |

Deployment is Vercel; alerts are **in-app only**, so no scheduler, mail, or
WhatsApp provider is introduced.

## Goals

1. The owner types only what he actually measures or negotiates.
2. Derived facts stay derived; financial records stay frozen.
3. No existing dashboard equation breaks.
4. No change to the onion architecture or the authorization model.

## Non-goals

- Outbound notifications (email/SMS/WhatsApp) — explicitly deferred.
- Scheduled jobs or cron endpoints.
- Backfilling historical products with consumption rows.
- Any change to Better Auth, roles, or the middleware.

## Decision: materialize on mutation

Creating a product auto-writes a linked consumption row. Delivery price is
auto-computed but **stored**. Availability and overdue status are computed at
read time.

**Why not derive everything (approach A).** Three blockers:

1. `products.rawMaterialTypeId` is nullable with `onDelete: "set null"`.
   Derived consumption anchored to it disappears when a material type is
   deleted. `raw_material_consumptions.typeId` is `notNull`, so rows survive.
2. Spoilage, damaged rolls, and raw material sold on never become products and
   would become unrepresentable.
3. A delivery's price would recompute from current product prices, so editing a
   product would rewrite historical revenue — and because `paymentStatus`
   derives from price, a paid delivery could silently flip to `partial`.

**Why not denormalized columns and triggers (approach C).** Violates the "stock
is derived, never stored" and "`paymentStatus` is always derived" invariants,
moves business logic into Postgres where vitest cannot reach it, and makes a
wrong aggregate persist instead of self-correcting — the failure mode that
produced the 21.000 t / 10.500 t fan-out bug.

**Why B fits this codebase.** It is the shape `insertPayment` already uses:
write, then recompute the derived field in the same service call.

## Schema delta

All columns are nullable or defaulted, so every migration is purely additive —
no `drizzle-kit generate` rename prompt, no backfill, no existing row changes
meaning. Apply the SQL by hand; `drizzle-kit migrate` would try to replay `0000`.

```sql
-- Phase 1
ALTER TABLE raw_material_types ADD COLUMN waste_percent decimal(5,2);
ALTER TABLE products           ADD COLUMN gsm decimal(10,2);
ALTER TABLE raw_material_consumptions
  ADD COLUMN product_id uuid REFERENCES products(id),
  ADD COLUMN source text NOT NULL DEFAULT 'manual';

-- Phase 2
ALTER TABLE products           ADD COLUMN selling_price_per_ton_egp decimal(12,2);

-- Phase 3
ALTER TABLE deliveries         ADD COLUMN due_date timestamp;

-- Phase 4
ALTER TABLE raw_material_types ADD COLUMN low_stock_tons decimal(10,3);
```

`source` is `'manual' | 'production'`. A NULL `waste_percent` or
`low_stock_tons` falls back to the global setting.

New keys in `settings/registry.ts` (which supports only `int` and `boolean`, so
these are integers; per-material overrides carry the decimal precision):

- `default_waste_percent` — int, operational, 0–50, default 5
- `low_stock_default_tons` — int, operational, 0–1000, default 0 (0 = off)
- `allow_negative_stock` — boolean, operational, default `"true"`

## Formulas

Pure functions, no DB access, so vitest can cover them under the existing
"pure logic only" testing rule. All comparisons run through `toUnits(...)`;
never compare decimal strings as floats.

`src/server/products/production.ts`

```
weightKg     = lengthM * (widthCm / 100) * gsm / 1000
consumedTons = weightKg * quantity * (1 + wastePercent / 100) / 1000
```

`src/server/deliveries/pricing.ts`

```
unitPriceEgp  = (weightKg / 1000) * sellingPricePerTonEgp
deliveryTotal = sum over items of (item.quantity * unitPriceEgp)
```

`src/server/products/availability.ts`

```
available = product.quantity - sum(deliveryItems.quantity for that product)
```

## Phase 1 — Production math

**`gsm` auto-fills `weightKg` as a suggestion the user can overwrite.** The
stored weight must be what the scale said, not what geometry predicted; the
computed value renders beside the field as a cross-check.

The cascade lives in exactly one helper, `syncProductConsumption(productId, tx)`
in `src/server/products/services.ts`, called from create, update, and delete and
nowhere else:

- **create** — if `rawMaterialTypeId` is set, insert a consumption row with
  `source: 'production'` and the `productId` FK
- **update** — upsert that row when weight, quantity, date, or material type
  changes
- **delete** — delete the row. Safe: `deleteProductService` already refuses to
  delete a product that appears in any delivery item.
- `rawMaterialTypeId` absent — no row written; the product stays informational,
  exactly as today

Product write and consumption write share one transaction, so a product can
never exist without its consumption row.

**Negative stock is permitted by default.** Auto-consumption naturally routes
through `canConsume`, which would refuse production exceeding stock. That is
correct in theory but blocks the owner whenever he records a roll before the
receipt that fed it, and data entry in a real factory is not chronological. The
`allow_negative_stock` setting defaults to permissive; the UI warns loudly and
renders a negative balance in red. Flipping the setting to `"false"` restores
hard blocking.

Manual consumption entry is unchanged and remains the path for spoilage,
damaged rolls, and raw material sold on.

**Pre-existing bug fixed here.** `weightKg` is per roll, so the resolver
`SUM(products.weight_kg)` must become `SUM(weight_kg * quantity)`. It currently
under-reports total product weight for every row with quantity above 1. The
token string stays unchanged so saved dashboard cards keep resolving; only the
SQL behind it changes.

**Files:** `db/schema.ts`, `products/{types,services,db,production}.ts`,
`raw-materials/{types,consumptions.db}.ts`,
`components/products/ui/ProductsClient.tsx`,
`components/raw-materials/ui/RawMaterialTypesClient.tsx`,
`settings/registry.ts`, `messages/{ar,en}.json`, new `drizzle/0003_*.sql`.

## Phase 2 — Sales math and roll tracking

No `status` column on products. Availability is derived from `delivery_items`,
consistent with "stock is derived, never stored." Compute it with a scalar
subquery, never a `LEFT JOIN` under `GROUP BY`, and write the outer column as
literal SQL text — an interpolated drizzle column renders unqualified inside a
correlated subquery and silently matches nothing.

- The delivery form auto-computes `sellingPriceEgp` from the chosen items; the
  field stays editable and the value **freezes at save**.
- The product picker shows available quantity and hides fully-delivered rolls.
- `deliveries/services.ts` rejects a delivery item whose quantity exceeds
  availability, in the same guard shape as `canConsume`.
- Any path that changes a delivery's price calls the existing
  `recomputeDeliveryStatus`.

**Files:** `deliveries/{types,services,db,pricing}.ts`,
`products/{db,availability}.ts`,
`components/deliveries/ui/DeliveriesClient.tsx`,
`components/products/ui/ProductsClient.tsx`, `messages/{ar,en}.json`,
`drizzle/0004_*.sql`.

## Phase 3 — Money follow-up

`due_date` on deliveries. Overdue is derived, never stored:
`due_date < now() AND paymentStatus <> 'paid'`. `derivePaymentUrgency` ships
beside `derivePaymentStatus` in `deliveries/status.ts`, and its SQL twin beside
`PAYMENT_STATUS_SQL` — change both or neither.

Outstanding remains `SUM(MAX(price - paid, 0))` per delivery; overpayment on one
delivery must not cancel another's debt.

PDFs use the already-installed, currently unused `@react-pdf/renderer`:

- `src/app/api/pdf/delivery/[id]/route.ts` — delivery receipt
- `src/app/api/pdf/statement/[companyId]/route.ts` — statement of account

Both verify the session the same way `middleware.ts` does, and both render
bilingual RTL/LTR.

**Files:** `deliveries/{types,services,db,status}.ts`, `lib/pdf/*`,
`app/api/pdf/**`, `components/deliveries/ui/DeliveryDetailClient.tsx`,
`messages/{ar,en}.json`, `drizzle/0005_*.sql`.

## Phase 4 — Alerts

Live-computed on dashboard load. No scheduler, no stored alert rows.

- balance below `low_stock_tons` (or the global default) — warning banner
- negative balance — error banner
- overdue deliveries — count and link

New equation tokens, each requiring a `resolveVariable` case **and** an
`EQUATION_VARIABLES` entry with `label` and `labelAr`:

- `COUNT_LOW_STOCK(raw_material_types)`
- `COUNT_OVERDUE(deliveries)`
- `SUM(products.selling_value)`

Existing tokens stay in `ALIASES` so saved cards never silently render zero.

**Files:** `analytics/{equation-variables,services}.ts`,
`raw-materials/types.db.ts`, `components/analytics/*`, `settings/registry.ts`,
`messages/{ar,en}.json`, `drizzle/0006_*.sql`.

## Cross-cutting

- **Authorization:** new reads use `protectedProcedure`, new writes
  `writerProcedure`. No session checks inside handlers.
- **Validation:** every new money or measure field uses a
  `shared/validation.ts` helper — `moneySchema`, `weightTonsSchema`,
  `dimensionSchema` — never bare `z.string()`. `gsm` and `wastePercent` get
  their own helpers there.
- **i18n:** roughly 40 new keys, added to `ar.json` and `en.json` together. A
  key present in only one throws `MISSING_MESSAGE`; `t()` throws rather than
  returning undefined, so `t("x") || "fallback"` does not fall back.
- **Decimals:** all money and weight columns arrive from Drizzle as strings.
  Coerce with `Number(...)`, compare with `toUnits(...)`.
- **Tests:** `production.test.ts`, `pricing.test.ts`, `availability.test.ts`,
  and a case added to `status.test.ts` for urgency. Pure logic only, no DB.

## Risks and open items

1. **Cascade drift** — the top risk. Every product write path must go through
   `syncProductConsumption`. Mitigated by keeping it a single exported helper
   and never inlining the consumption write.
2. **No backfill.** Products created before phase 1 have no linked consumption
   row; backfilling would double-count against consumption already entered by
   hand. Products behave differently either side of the cutover. Record the
   cutover date in CLAUDE.md.
3. **Editing a product's price does not change past deliveries.** Intended, but
   it will surprise someone. Surface the frozen price in the delivery UI.
4. **`gsm` is nullable**, so auto-weight only assists products that declare it.
   Old products keep their typed weight.
5. Two pre-existing dashboard cards ("Total Raw Materials" and "Raw Material
   Balance") already overlap; phase 4 adds cards near them. Not fixed here.
6. **RESOLVED — `products.weightKg` is per roll.** Confirmed with the owner:
   quantity 5 at 200 kg means five 200 kg rolls, 1000 kg total. The formulas
   above multiply by `quantity` and are correct. This exposes a pre-existing
   bug: the resolver `SUM(products.weight_kg)` sums weight without multiplying
   by `quantity`, so the "Total Products Weight" card under-reports whenever a
   row has quantity above 1. Fixed in phase 1 (see below).
