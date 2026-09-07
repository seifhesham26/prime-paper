# Factory Automation — Phase 1 (Production Math) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make raw material consumption record itself when a product is produced, and make product weight compute itself from paper grammage, so the owner types only what he measures.

**Architecture:** Approach B — materialize on mutation. Creating a product writes a linked `raw_material_consumptions` row (`source: 'production'`, `product_id` FK) alongside the product, atomically via `db.batch()`. All arithmetic lives in pure functions so vitest can cover it without a database. Nothing is denormalized: the balance stays `SUM(receipts) − SUM(consumptions)`.

**Tech Stack:** Next.js 16, tRPC 11, Drizzle ORM 0.45 on `neon-http`, Zod 4, vitest 4, next-intl, shadcn/ui.

**Spec:** `docs/superpowers/specs/2026-09-06-factory-automation-design.md`

## Global Constraints

- **Do not commit.** Seif reviews the working tree himself. Each task ends by staging with `git add` and printing a suggested commit message; he runs `git commit`.
- **`neon-http` has no transactions.** `db.transaction()` throws `"No transactions support in neon-http driver"`. Use `db.batch([...])`, which routes through one `client.transaction()` HTTP call. Every statement in a batch must be built up front — no statement may consume an id returned by another.
- **Decimal columns are strings.** Drizzle returns and accepts `decimal` as `string`. Coerce with `Number(...)`; compare with `toUnits(value, scale)` from `src/server/shared/validation.ts`. Never compare decimal strings as floats.
- **`products.weightKg` is per roll**, not per row. Row total is `weightKg × quantity`.
- **Scales:** tons `decimal(10,3)`, money `decimal(12,2)`, dimensions/gsm `decimal(10,2)`, percent `decimal(5,2)`.
- **Both message files move together.** A key in `en.json` but not `ar.json` throws `MISSING_MESSAGE` at runtime. `t()` throws rather than returning undefined.
- **Authorization is procedure-level.** Reads use `protectedProcedure`, writes use `writerProcedure`. Never check the session inside a handler.
- **Never interpolate a drizzle column into a correlated subquery.** It renders unqualified and silently binds to the subquery's own table. Write the outer column as literal SQL text.
- **Tests cover pure logic only.** No DB tests, no component tests. Anything DB-coupled must have its logic extracted into a pure module first.
- **Migrations are applied by hand.** `drizzle-kit migrate` would replay `0000` and fail, and it hangs on the http driver.
- **Section comments** use the `// ─── Title ───` box-drawing style in files that already use it.

---

## Scope note

The spec has four phases. This plan covers **Phase 1 only**, which is independently shippable: after it, production auto-deducts stock and product weight auto-computes. Phases 2 (sales math and roll tracking), 3 (money follow-up), and 4 (alerts) each get their own plan, written when their turn comes so they can build on what Phase 1 actually produced.

## File structure

**Created**

| File | Responsibility |
|---|---|
| `src/server/products/production.ts` | All Phase 1 arithmetic and policy, pure. No imports from `@/db`. |
| `src/server/products/production.test.ts` | Unit tests for the above. |
| `drizzle/0003_production_automation.sql` | Additive migration. |
| `src/scripts/apply-migration.mjs` | Applies one `.sql` file to Neon over HTTP. |

**Modified**

| File | Change |
|---|---|
| `src/db/schema.ts` | `waste_percent` on types, `gsm` on products, `product_id` + `source` on consumptions. |
| `src/server/shared/validation.ts` | `gsmSchema`, `percentSchema`. |
| `src/server/shared/validation.test.ts` | Tests for the two new schemas. |
| `src/server/settings/registry.ts` | `default_waste_percent`, `allow_negative_stock`. |
| `src/server/settings/db.ts` | Surface both in `SettingsMap`. |
| `src/server/raw-materials/types.ts` | `wastePercent` on create/update type schemas + `RawMaterialType`. |
| `src/server/raw-materials/types.db.ts` | Persist and select `wastePercent`. |
| `src/server/raw-materials/consumptions.db.ts` | Query builders for product-linked rows. |
| `src/server/raw-materials/services.ts` | Refuse manual edits of `source: 'production'` rows. |
| `src/server/products/types.ts` | `gsm` on create/update schemas + `Product`. |
| `src/server/products/db.ts` | Query builders taking an explicit id; select `gsm`. |
| `src/server/products/services.ts` | `syncProductConsumption` + batched create/update/delete. |
| `src/server/analytics/equation-variables.ts` | Fix `SUM(products.weight_kg)` to multiply by quantity. |
| `src/components/products/ui/ProductsClient.tsx` | GSM field, computed-weight assist. |
| `src/components/raw-materials/ui/RawMaterialTypesClient.tsx` | Waste percent field, negative balance warning. |
| `messages/en.json`, `messages/ar.json` | ~14 new keys each. |

---

### Task 1: Pure production arithmetic

**Files:**
- Create: `src/server/products/production.ts`
- Test: `src/server/products/production.test.ts`

**Interfaces:**
- Consumes: nothing. This module must import nothing at all — it is imported by a `"use client"` component in Task 10, so any transitive server-only import would break the client bundle.
- Produces:
  - `computeWeightKg(lengthM: string, widthCm: string, gsm: string): string` — 2dp
  - `computeConsumedTons(weightKg: string, quantity: number, wastePercent: string): string` — 3dp
  - `resolveWastePercent(typeWastePercent: string | null, defaultWastePercent: number): string`
  - `isSystemManaged(source: string): boolean`

- [ ] **Step 1: Write the failing test**

Create `src/server/products/production.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  computeWeightKg,
  computeConsumedTons,
  resolveWastePercent,
  isSystemManaged,
} from "./production";

describe("computeWeightKg", () => {
  it("computes grammage over area: 1000 m x 100 cm at 80 gsm is 80 kg", () => {
    expect(computeWeightKg("1000", "100", "80")).toBe("80.00");
  });

  it("halves the weight when the roll is half as wide", () => {
    expect(computeWeightKg("1000", "50", "80")).toBe("40.00");
  });

  it("returns 2 decimal places", () => {
    expect(computeWeightKg("123.45", "67.8", "90")).toBe("7.53");
  });

  it("rejects a non-positive dimension", () => {
    expect(() => computeWeightKg("0", "100", "80")).toThrow(RangeError);
    expect(() => computeWeightKg("1000", "-5", "80")).toThrow(RangeError);
  });

  it("rejects a non-positive gsm", () => {
    expect(() => computeWeightKg("1000", "100", "0")).toThrow(RangeError);
  });
});

describe("computeConsumedTons", () => {
  it("multiplies by quantity because weight is per roll", () => {
    expect(computeConsumedTons("80", 5, "0")).toBe("0.400");
  });

  it("adds the waste percentage on top", () => {
    expect(computeConsumedTons("80", 5, "5")).toBe("0.420");
  });

  it("treats zero waste as an exact conversion", () => {
    expect(computeConsumedTons("1000", 1, "0")).toBe("1.000");
  });

  it("returns 3 decimal places", () => {
    expect(computeConsumedTons("33.33", 3, "7.5")).toBe("0.107");
  });

  it("rejects a non-positive weight", () => {
    expect(() => computeConsumedTons("0", 1, "5")).toThrow(RangeError);
  });

  it("rejects a non-integer or non-positive quantity", () => {
    expect(() => computeConsumedTons("80", 0, "5")).toThrow(RangeError);
    expect(() => computeConsumedTons("80", 1.5, "5")).toThrow(RangeError);
  });

  it("rejects a negative waste percentage", () => {
    expect(() => computeConsumedTons("80", 1, "-1")).toThrow(RangeError);
  });
});

describe("resolveWastePercent", () => {
  it("prefers the material's own override", () => {
    expect(resolveWastePercent("12.5", 5)).toBe("12.50");
  });

  it("falls back to the global default when unset", () => {
    expect(resolveWastePercent(null, 5)).toBe("5.00");
  });

  it("treats an explicit zero override as a real value, not as unset", () => {
    expect(resolveWastePercent("0", 5)).toBe("0.00");
  });
});

describe("isSystemManaged", () => {
  it("is true for production-sourced rows", () => {
    expect(isSystemManaged("production")).toBe(true);
  });

  it("is false for hand-entered rows", () => {
    expect(isSystemManaged("manual")).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/server/products/production.test.ts`
Expected: FAIL — `Failed to resolve import "./production"`.

- [ ] **Step 3: Write the implementation**

Create `src/server/products/production.ts`:

```ts
const KG_SCALE = 2;
const TON_SCALE = 3;
const PERCENT_SCALE = 2;
const CM_PER_M = 100;
const G_PER_KG = 1000;
const KG_PER_TON = 1000;

/**
 * Weight of a single roll, from its geometry and the paper's grammage.
 *
 *   area m²  = length_m × (width_cm / 100)
 *   weight g = area × gsm
 *   weight kg = weight g / 1000
 *
 * This is a suggestion for the operator, not a replacement for the scale —
 * the stored weight should be what was actually measured.
 */
export function computeWeightKg(lengthM: string, widthCm: string, gsm: string): string {
  const length = Number(lengthM);
  const width = Number(widthCm);
  const grammage = Number(gsm);

  if (!(length > 0) || !(width > 0)) {
    throw new RangeError("Length and width must be greater than zero");
  }
  if (!(grammage > 0)) {
    throw new RangeError("GSM must be greater than zero");
  }

  return ((length * (width / CM_PER_M) * grammage) / G_PER_KG).toFixed(KG_SCALE);
}

/**
 * Tons of raw material a production run consumes.
 *
 * weightKg is PER ROLL, so quantity multiplies it. Waste covers trim loss:
 * a run that yields 1 ton of product eats more than 1 ton of material.
 */
export function computeConsumedTons(
  weightKg: string,
  quantity: number,
  wastePercent: string,
): string {
  const weight = Number(weightKg);
  const waste = Number(wastePercent);

  if (!(weight > 0)) {
    throw new RangeError("Weight must be greater than zero");
  }
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new RangeError("Quantity must be a positive integer");
  }
  if (!(waste >= 0)) {
    throw new RangeError("Waste percent must be zero or greater");
  }

  const totalKg = weight * quantity * (1 + waste / 100);
  return (totalKg / KG_PER_TON).toFixed(TON_SCALE);
}

/**
 * A material's own waste percentage, or the global default when it has none.
 * NULL means "not set"; "0" is a deliberate zero and must survive.
 */
export function resolveWastePercent(
  typeWastePercent: string | null,
  defaultWastePercent: number,
): string {
  const source = typeWastePercent ?? String(defaultWastePercent);
  return Number(source).toFixed(PERCENT_SCALE);
}

/**
 * Rows the application writes and owns. A user editing one by hand would
 * desynchronise it from its product, so those paths refuse.
 */
export function isSystemManaged(source: string): boolean {
  return source === "production";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/server/products/production.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Stage**

```bash
git add src/server/products/production.ts src/server/products/production.test.ts
```

Suggested message: `feat(products): add pure production arithmetic for weight and consumption`

---

### Task 2: Validation helpers for gsm and percent

**Files:**
- Modify: `src/server/shared/validation.ts`
- Test: `src/server/shared/validation.test.ts`

**Interfaces:**
- Produces: `gsmSchema`, `percentSchema` — both Zod string schemas, used by Tasks 5 and 7.

- [ ] **Step 1: Write the failing test**

Append to `src/server/shared/validation.test.ts`:

```ts
describe("gsmSchema", () => {
  it("accepts a positive grammage", () => {
    expect(gsmSchema.safeParse("80").success).toBe(true);
    expect(gsmSchema.safeParse("80.50").success).toBe(true);
  });

  it("rejects zero and negatives", () => {
    expect(gsmSchema.safeParse("0").success).toBe(false);
    expect(gsmSchema.safeParse("-80").success).toBe(false);
  });

  it("rejects more than 2 decimal places", () => {
    expect(gsmSchema.safeParse("80.123").success).toBe(false);
  });
});

describe("percentSchema", () => {
  it("accepts zero through one hundred", () => {
    expect(percentSchema.safeParse("0").success).toBe(true);
    expect(percentSchema.safeParse("7.5").success).toBe(true);
    expect(percentSchema.safeParse("100").success).toBe(true);
  });

  it("rejects negatives and anything above one hundred", () => {
    expect(percentSchema.safeParse("-1").success).toBe(false);
    expect(percentSchema.safeParse("100.01").success).toBe(false);
  });
});
```

Add `gsmSchema` and `percentSchema` to the existing import at the top of that file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm vitest run src/server/shared/validation.test.ts`
Expected: FAIL — `gsmSchema` is not exported.

- [ ] **Step 3: Write the implementation**

Append to `src/server/shared/validation.ts`, below `dimensionSchema`:

```ts
/** Paper grammage in g/m² — decimal(10,2), must be positive. */
export const gsmSchema = decimalString({ scale: 2, min: 0, minExclusive: true });

/** A percentage 0–100 — decimal(5,2). Zero is meaningful, so it is allowed. */
export const percentSchema = decimalString({ scale: 2, min: 0, max: 100 });
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm vitest run src/server/shared/validation.test.ts`
Expected: PASS.

- [ ] **Step 5: Stage**

```bash
git add src/server/shared/validation.ts src/server/shared/validation.test.ts
```

Suggested message: `feat(shared): add gsm and percent validation schemas`

---

### Task 3: Schema columns and migration

**Files:**
- Modify: `src/db/schema.ts`
- Create: `drizzle/0003_production_automation.sql`
- Create: `src/scripts/apply-migration.mjs`

**Interfaces:**
- Produces: `rawMaterialTypes.wastePercent`, `products.gsm`, `rawMaterialConsumptions.productId`, `rawMaterialConsumptions.source` — consumed by Tasks 5, 6, 7.

There is no test here; correctness is verified by the migration applying and `tsc` passing.

- [ ] **Step 1: Add the columns to the Drizzle schema**

In `src/db/schema.ts`, add to `rawMaterialTypes`, after `notes`:

```ts
  wastePercent: decimal("waste_percent", { precision: 5, scale: 2 }),
```

Add to `products`, after `widthCm`:

```ts
  gsm: decimal("gsm", { precision: 10, scale: 2 }),
```

Add to `rawMaterialConsumptions`, after `weightTons`:

```ts
  productId: uuid("product_id").references(() => products.id),
  source: text("source", { enum: ["manual", "production"] })
    .notNull()
    .default("manual"),
```

`rawMaterialConsumptions` is declared before `products` in this file. That is fine — the `() => products.id` callback is lazy, so the forward reference resolves at query build time, not at module evaluation.

- [ ] **Step 2: Write the migration SQL by hand**

Create `drizzle/0003_production_automation.sql`:

```sql
ALTER TABLE "raw_material_types" ADD COLUMN "waste_percent" numeric(5, 2);
--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "gsm" numeric(10, 2);
--> statement-breakpoint
ALTER TABLE "raw_material_consumptions" ADD COLUMN "product_id" uuid;
--> statement-breakpoint
ALTER TABLE "raw_material_consumptions" ADD COLUMN "source" text DEFAULT 'manual' NOT NULL;
--> statement-breakpoint
ALTER TABLE "raw_material_consumptions" ADD CONSTRAINT "raw_material_consumptions_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "raw_material_consumptions_product_id_idx" ON "raw_material_consumptions" ("product_id");
```

Written by hand rather than generated: this change is purely additive, so `drizzle-kit generate` would not prompt, but the database was built with `push` and `__drizzle_migrations` is empty, so generated files are not replayable anyway. The index matters because Task 6 looks consumptions up by `product_id` on every product write.

- [ ] **Step 3: Write the migration runner**

Create `src/scripts/apply-migration.mjs`:

```js
// Applies one .sql file to the database over the Neon HTTP driver.
// drizzle-kit migrate cannot be used here: __drizzle_migrations is empty
// while 0000 is already applied, so it would try to replay it and fail.
//
// Usage: node src/scripts/apply-migration.mjs drizzle/0003_production_automation.sql
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";
import "dotenv/config";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node src/scripts/apply-migration.mjs <path-to.sql>");
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const statements = readFileSync(file, "utf8")
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

for (const [i, statement] of statements.entries()) {
  console.log(`[${i + 1}/${statements.length}] ${statement.slice(0, 80)}...`);
  await sql.query(statement);
}

console.log(`Applied ${statements.length} statement(s) from ${file}`);
```

- [ ] **Step 4: Apply the migration**

Run: `node src/scripts/apply-migration.mjs drizzle/0003_production_automation.sql`
Expected: six numbered lines, then `Applied 6 statement(s)`.

If it fails partway, the statements are individually idempotent-unsafe — inspect which ones landed with `\d raw_material_consumptions` in `pnpm drizzle-kit studio` before re-running, and delete the already-applied statements from a scratch copy rather than re-running the whole file.

- [ ] **Step 5: Verify the schema typechecks**

Run: `npx tsc --noEmit`
Expected: no errors. (`pnpm lint` still reports one pre-existing error in `src/components/ui/sidebar.tsx` — that is not yours.)

- [ ] **Step 6: Stage**

```bash
git add src/db/schema.ts drizzle/0003_production_automation.sql src/scripts/apply-migration.mjs
```

Suggested message: `feat(db): add waste_percent, gsm, and production-sourced consumption columns`

---

### Task 4: Settings for default waste and negative stock

**Files:**
- Modify: `src/server/settings/registry.ts`
- Modify: `src/server/settings/db.ts`
- Modify: `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Produces: `getSettingsMap()` gains `defaultWastePercent: number` and `allowNegativeStock: boolean` — consumed by Task 7.

- [ ] **Step 1: Declare the settings**

Append to `SETTINGS_REGISTRY` in `src/server/settings/registry.ts`:

```ts
  {
    key: "default_waste_percent",
    type: "int",
    category: "operational",
    min: 0,
    max: 50,
    default: 5,
    label: "Default waste percent",
    labelAr: "نسبة الهالك الافتراضية",
  },
  {
    key: "allow_negative_stock",
    type: "boolean",
    category: "operational",
    default: "true",
    label: "Allow negative stock",
    labelAr: "السماح بالرصيد السالب",
  },
```

A key not declared here is editable but inert, so this must land before anything reads it.

- [ ] **Step 2: Surface them in the settings map**

In `src/server/settings/db.ts`, add both fields to the `SettingsMap` type and to the object `getSettingsMap()` returns, following the existing `coerce(...)` pattern exactly:

```ts
    defaultWastePercent: coerce("default_waste_percent", stored.get("default_waste_percent")),
    allowNegativeStock: coerce("allow_negative_stock", stored.get("allow_negative_stock")),
```

The existing `coerce` **throws** on anything that is not an `int` (`if (!def || def.type !== "int") throw new Error(...)`), so the boolean key needs its own helper. Add it beside `coerce`:

```ts
function coerceBoolean(key: string, raw: string | undefined): boolean {
  const def = SETTINGS_BY_KEY.get(key);
  if (!def || def.type !== "boolean") throw new Error(`Not a boolean setting: ${key}`);
  if (raw !== "true" && raw !== "false") return def.default === "true";
  return raw === "true";
}
```

Then the two map entries are:

```ts
    defaultWastePercent: coerce("default_waste_percent", stored.get("default_waste_percent")),
    allowNegativeStock: coerceBoolean("allow_negative_stock", stored.get("allow_negative_stock")),
```

Add `defaultWastePercent: number` and `allowNegativeStock: boolean` to the `SettingsMap` type in `registry.ts`.

- [ ] **Step 3: Seed the new settings rows**

`src/scripts/seed-settings.mjs` is a standalone `.mjs` script — it does **not** import `registry.ts`, it carries its own hardcoded array. Add both keys to that array, matching the existing shape exactly (it currently holds `page_size_default`, `dropdown_list_limit`, `dashboard_recent_deliveries`, `dashboard_top_unpaid`, `dashboard_chart_months`, `allow_public_signup`):

```js
      { key: "default_waste_percent", value: "5", category: "operational" },
      { key: "allow_negative_stock", value: "true", category: "operational" },
```

Then run: `node src/scripts/seed-settings.mjs`
Expected: idempotent upsert; the two new keys appear. Confirm by loading `/settings`.

The app does not strictly depend on this — `coerce`/`coerceBoolean` fall back to the registry default when a row is absent — but seeding keeps the database and the registry in agreement.

- [ ] **Step 4: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Stage**

```bash
git add src/server/settings/registry.ts src/server/settings/db.ts
```

Suggested message: `feat(settings): add default waste percent and negative stock toggle`

---

### Task 5: Waste percent through the raw-materials stack

**Files:**
- Modify: `src/server/raw-materials/types.ts`
- Modify: `src/server/raw-materials/types.db.ts`

**Interfaces:**
- Consumes: `percentSchema` (Task 2), `rawMaterialTypes.wastePercent` (Task 3).
- Produces: `CreateTypeSchema`/`UpdateTypeSchema` accept optional `wastePercent`; `RawMaterialType` gains `wastePercent: string | null`; `findTypeTotals` returns it — consumed by Task 7.

- [ ] **Step 1: Add the field to the Zod schemas**

In `src/server/raw-materials/types.ts`, import `percentSchema` alongside the existing validation imports, then extend:

```ts
export const CreateTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  wastePercent: percentSchema.optional(),
  notes: z.string().optional(),
});
```

`UpdateTypeSchema` already extends `CreateTypeSchema`, so it inherits the field. Add to the `RawMaterialType` output type:

```ts
  wastePercent: string | null;
```

- [ ] **Step 2: Persist and select it**

In `src/server/raw-materials/types.db.ts`:

- add `wastePercent: data.wastePercent ?? null` to the `.values({...})` of `insertType`
- add `wastePercent: data.wastePercent ?? null` to the `.set({...})` of `editType`
- add `wastePercent: rawMaterialTypes.wastePercent` to the `.select({...})` in `findTypes`, `findTypeById`, **and `findTypeTotals`**

`findTypeTotals` also needs it returned. It currently returns only three fields; add the fourth:

```ts
  return {
    receivedTons: derived.receivedTons,
    consumedTons: derived.consumedTons,
    balanceTons: derived.balanceTons,
    wastePercent: row.wastePercent,
  };
```

This matters: Task 7 runs on every product write and needs both the waste percentage and the balance. `findTypeTotals` is one query; `findTypeById` is four (it also loads receipts, consumptions, and linked products for the detail page) and must not be used on a write path.

Leave `withDerived` untouched — waste percent is an input, not a derived value.

- [ ] **Step 3: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors. All three functions use an explicit `.select({...})` object, so the column will not appear unless you add it to each one — a missing entry shows up as a TypeScript error at the call site, not at the query.

- [ ] **Step 4: Run the full test suite**

Run: `pnpm test`
Expected: PASS — existing raw-material tests are pure and unaffected.

- [ ] **Step 5: Stage**

```bash
git add src/server/raw-materials/types.ts src/server/raw-materials/types.db.ts
```

Suggested message: `feat(raw-materials): allow a per-material waste percentage`

---

### Task 6: Consumption query builders for product-linked rows

**Files:**
- Modify: `src/server/raw-materials/consumptions.db.ts`

**Interfaces:**
- Consumes: `rawMaterialConsumptions.productId`, `.source` (Task 3).
- Produces, all **returning unawaited Drizzle query objects** so Task 7 can pass them to `db.batch()`:
  - `buildInsertProductConsumption(input: ProductConsumptionInput)`
  - `buildDeleteConsumptionForProduct(productId: string)`
  - and one awaited helper: `findConsumptionByProductId(productId: string)`
  - exported type `ProductConsumptionInput = { typeId: string; productId: string; date: Date; weightTons: string; userId: string }`

- [ ] **Step 1: Add the builders**

Append to `src/server/raw-materials/consumptions.db.ts`:

```ts
// ─── Production-sourced rows ─────────────────────────────
// These return the query WITHOUT awaiting it, so the caller can hand them to
// db.batch(). neon-http has no transactions; batch is the only atomic path,
// and it requires every statement to be built up front.

export type ProductConsumptionInput = {
  typeId: string;
  productId: string;
  date: Date;
  weightTons: string;
  userId: string;
};

export function buildInsertProductConsumption(input: ProductConsumptionInput) {
  return db.insert(rawMaterialConsumptions).values({
    typeId: input.typeId,
    productId: input.productId,
    source: "production",
    date: input.date,
    weightTons: input.weightTons,
    notes: null,
    createdBy: input.userId,
  });
}

export function buildDeleteConsumptionForProduct(productId: string) {
  return db
    .delete(rawMaterialConsumptions)
    .where(eq(rawMaterialConsumptions.productId, productId));
}

export async function findConsumptionByProductId(productId: string) {
  const [row] = await db
    .select()
    .from(rawMaterialConsumptions)
    .where(eq(rawMaterialConsumptions.productId, productId));
  return row ?? null;
}
```

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Stage**

```bash
git add src/server/raw-materials/consumptions.db.ts
```

Suggested message: `feat(raw-materials): add batchable builders for product-linked consumption`

---

### Task 7: Auto-consumption on product write

This is the task the whole phase exists for, and the one carrying the drift risk. Every product write path must go through `syncProductConsumption` — never inline a consumption write anywhere else.

**Files:**
- Modify: `src/server/products/types.ts`
- Modify: `src/server/products/db.ts`
- Modify: `src/server/products/services.ts`

**Interfaces:**
- Consumes: `computeConsumedTons`, `resolveWastePercent` (Task 1); `gsmSchema` (Task 2); `getSettingsMap` (Task 4); `findTypeTotals` (Task 5); `buildInsertProductConsumption`, `buildDeleteConsumptionForProduct`, `ProductConsumptionInput` (Task 6).
- Produces: `buildInsertProduct(data, userId, id)`, `buildUpdateProduct(data)`, `buildDeleteProduct(id)` in `db.ts`; `syncProductConsumption` in `services.ts`.

- [ ] **Step 1: Add `gsm` to the product schemas**

In `src/server/products/types.ts`, import `gsmSchema` and add to `CreateProductSchema`:

```ts
  gsm: gsmSchema.optional(),
```

Add to the `Product` output type:

```ts
  gsm: string | null;
```

- [ ] **Step 2: Add batchable query builders**

In `src/server/products/db.ts`, add `gsm: products.gsm` to the `.select({...})` in `findProducts`, then append:

```ts
// ─── Batchable builders ──────────────────────────────────
// The id is supplied by the caller rather than defaulted by Postgres, because
// db.batch() cannot feed a returned id into a later statement in the batch.

export function buildInsertProduct(
  data: z.infer<typeof CreateProductSchema>,
  userId: string,
  id: string,
) {
  return db.insert(products).values({
    id,
    rawMaterialTypeId: data.rawMaterialTypeId || null,
    dateProduced: data.dateProduced,
    lengthM: data.lengthM,
    widthCm: data.widthCm,
    gsm: data.gsm ?? null,
    weightKg: data.weightKg,
    quantity: data.quantity,
    notes: data.notes || null,
    createdBy: userId,
  });
}

export function buildUpdateProduct(data: z.infer<typeof UpdateProductSchema>) {
  return db
    .update(products)
    .set({
      rawMaterialTypeId: data.rawMaterialTypeId || null,
      dateProduced: data.dateProduced,
      lengthM: data.lengthM,
      widthCm: data.widthCm,
      gsm: data.gsm ?? null,
      weightKg: data.weightKg,
      quantity: data.quantity,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(products.id, data.id));
}

export function buildDeleteProduct(id: string) {
  return db.delete(products).where(eq(products.id, id));
}
```

Keep the existing `insertProduct` / `editProduct` / `removeProduct` exports in place until Step 4 removes their last caller.

- [ ] **Step 3: Write the sync helper and rewire the services**

Replace the create/update/delete services in `src/server/products/services.ts`:

```ts
import { randomUUID } from "node:crypto";
import { db } from "@/db";
import { computeConsumedTons, resolveWastePercent } from "./production";
import { toUnits } from "../shared/validation";
import { getSettingsMap } from "../settings/db";
import { findTypeTotals } from "../raw-materials/types.db";
import {
  buildInsertProductConsumption,
  buildDeleteConsumptionForProduct,
} from "../raw-materials/consumptions.db";
import { buildInsertProduct, buildUpdateProduct, buildDeleteProduct } from "./db";

/**
 * The single place a production-sourced consumption row is built.
 *
 * Returns null when the product declares no raw material — such a product is
 * informational and moves no weight, exactly as before this feature existed.
 *
 * Nothing else in the codebase may write a row with source 'production'. If a
 * second writer ever appears, the derived balance will drift and there is no
 * stored value to check it against.
 */
async function syncProductConsumption(
  productId: string,
  data: { rawMaterialTypeId?: string; dateProduced: Date; weightKg: string; quantity: number },
  userId: string,
) {
  if (!data.rawMaterialTypeId) return null;

  // findTypeTotals, not findTypeById: one query instead of four, and this runs
  // on every product write.
  const [totals, settings] = await Promise.all([
    findTypeTotals(data.rawMaterialTypeId),
    getSettingsMap(),
  ]);
  if (!totals) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Raw material type not found" });
  }

  const wastePercent = resolveWastePercent(totals.wastePercent, settings.defaultWastePercent);
  const weightTons = computeConsumedTons(data.weightKg, data.quantity, wastePercent);

  if (!settings.allowNegativeStock) {
    const remaining = toUnits(totals.balanceTons, 3) - toUnits(weightTons, 3);
    if (remaining < 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Not enough stock: this run needs ${weightTons} t but only ${totals.balanceTons} t remain.`,
      });
    }
  }

  return buildInsertProductConsumption({
    typeId: data.rawMaterialTypeId,
    productId,
    date: data.dateProduced,
    weightTons,
    userId,
  });
}

export async function createProductService(
  data: z.infer<typeof CreateProductSchema>,
  userId: string,
) {
  const id = randomUUID();
  const consumption = await syncProductConsumption(id, data, userId);
  const product = buildInsertProduct(data, userId, id);

  if (consumption) {
    await db.batch([product, consumption]);
  } else {
    await product;
  }
  return { id };
}

export async function updateProductService(
  data: z.infer<typeof UpdateProductSchema>,
  userId: string,
) {
  const consumption = await syncProductConsumption(data.id, data, userId);
  const product = buildUpdateProduct(data);
  const clear = buildDeleteConsumptionForProduct(data.id);

  // Delete-then-insert rather than read-then-update: deterministic, idempotent,
  // and it correctly drops the row when the material type is cleared.
  if (consumption) {
    await db.batch([product, clear, consumption]);
  } else {
    await db.batch([product, clear]);
  }
  return { id: data.id };
}

export async function deleteProductService(id: string) {
  const linked = await countProductDeliveryItems(id);
  if (linked > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Cannot delete this product: it appears in ${linked} delivery item(s).`,
    });
  }
  // Consumption first: it holds the foreign key to the product.
  await db.batch([buildDeleteConsumptionForProduct(id), buildDeleteProduct(id)]);
  return { success: true };
}
```

Keep the existing `TRPCError`, `countProductDeliveryItems`, and `getProductsService` imports and exports.

- [ ] **Step 4: Update the router for the new update signature**

`updateProductService` now takes `userId`. In `src/server/products/router.ts`, pass it from the context the same way `create` already does — `ctx.session.user.id`. Both stay on `writerProcedure`.

Then delete the now-unused `insertProduct`, `editProduct`, and `removeProduct` from `src/server/products/db.ts`.

- [ ] **Step 5: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors. A `db.batch` type error almost always means an array was built conditionally — batch needs a literal non-empty tuple, which is why the branches above are written out explicitly rather than pushing into an array.

- [ ] **Step 6: Verify against the running app**

Run: `pnpm dev`, then:

1. Set a waste percent of `10` on a raw material type that has stock.
2. Create a product on that material: 100 kg, quantity 5.
3. Open the material's detail page. Expected: a new consumption row of `0.550` t (100 × 5 × 1.10 / 1000), and the balance reduced by that amount.
4. Edit the product to quantity 10. Expected: still exactly **one** consumption row, now `1.100` t.
5. Clear the product's raw material. Expected: the consumption row is gone.
6. Delete the product. Expected: no orphan consumption row remains.

- [ ] **Step 7: Stage**

```bash
git add src/server/products/types.ts src/server/products/db.ts src/server/products/services.ts src/server/products/router.ts
```

Suggested message: `feat(products): auto-record raw material consumption on production`

---

### Task 8: Refuse manual edits of system-managed consumption rows

Without this, a user can edit an auto-created row by hand, and it silently stops matching its product.

**Files:**
- Modify: `src/server/raw-materials/services.ts`

**Interfaces:**
- Consumes: `isSystemManaged` (Task 1), `findConsumptionById` (already exists).

- [ ] **Step 1: Guard the update and delete services**

In `src/server/raw-materials/services.ts`, import `isSystemManaged` from `@/server/products/production`, then add this check at the top of both `updateConsumptionService` and `deleteConsumptionService`, after the existing "not found" lookup:

```ts
  if (isSystemManaged(existing.source)) {
    throw new TRPCError({
      code: "CONFLICT",
      message:
        "This consumption was recorded automatically from a production run. Edit the product instead.",
    });
  }
```

Both services already fetch the row via `findConsumptionById` to produce their NOT_FOUND error; reuse that result rather than querying again.

- [ ] **Step 2: Verify it typechecks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Verify against the running app**

With `pnpm dev` running, open a material that has an auto-created consumption row and try to edit it. Expected: the mutation fails with the message above rather than saving.

- [ ] **Step 4: Stage**

```bash
git add src/server/raw-materials/services.ts
```

Suggested message: `fix(raw-materials): block hand-editing of production-sourced consumption`

---

### Task 9: Fix the product weight metric

`weightKg` is per roll, so `SUM(products.weight_kg)` under-reports every row with quantity above 1. Pre-existing bug, surfaced while specifying this phase.

**Files:**
- Modify: `src/server/analytics/equation-variables.ts`

- [ ] **Step 1: Multiply by quantity in the resolver**

Replace the `"SUM(products.weight_kg)"` resolver body:

```ts
  "SUM(products.weight_kg)": () =>
    scalar(
      db
        .select({
          v: sql<string>`COALESCE(SUM(${products.weightKg} * ${products.quantity}), 0)`,
        })
        .from(products),
    ),
```

The token string is deliberately unchanged, so every saved dashboard card keeps resolving. Only the SQL behind it changes. No `ALIASES` entry is needed for the same reason.

- [ ] **Step 2: Verify it typechecks and tests pass**

Run: `npx tsc --noEmit && pnpm test`
Expected: no errors; all tests pass. `equation-parser.test.ts` covers tokenizing, not resolution, so it is unaffected.

- [ ] **Step 3: Verify against the running app**

With `pnpm dev` running, compare the "Total Products Weight" card against a product list containing a row with quantity > 1. Expected: the card now counts every roll, not one per row.

- [ ] **Step 4: Stage**

```bash
git add src/server/analytics/equation-variables.ts
```

Suggested message: `fix(analytics): count every roll in total product weight`

---

### Task 10: Product form — GSM field and computed weight

**Files:**
- Modify: `src/components/products/ui/ProductsClient.tsx`
- Modify: `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `computeWeightKg` (Task 1); the `gsm` field on the product schemas (Task 7).

- [ ] **Step 1: Add the message keys**

Add to the `products` namespace in `messages/en.json`:

```json
    "gsm": "GSM (g/m²)",
    "computedWeight": "Computed: {value} kg",
    "useComputed": "Use computed",
    "computedWeightHint": "From length, width and GSM. Override it with the scale reading."
```

And the same four keys in `messages/ar.json`:

```json
    "gsm": "الجرامات (جم/م²)",
    "computedWeight": "المحسوب: {value} كجم",
    "useComputed": "استخدم المحسوب",
    "computedWeightHint": "محسوب من الطول والعرض والجرامات. يمكنك تعديله حسب قراءة الميزان."
```

Both files must gain all four. A key present in only one throws `MISSING_MESSAGE` at render.

- [ ] **Step 2: Make the three inputs controlled**

The form is currently uncontrolled (`defaultValue` plus `FormData`). Add state above the returned JSX:

```tsx
const [lengthM, setLengthM] = useState("");
const [widthCm, setWidthCm] = useState("");
const [gsm, setGsm] = useState("");
const [weightKg, setWeightKg] = useState("");
```

Reset all four whenever the dialog opens or `editItem` changes, so an edit prefills and a create starts blank:

```tsx
useEffect(() => {
  setLengthM(editItem?.lengthM ?? "");
  setWidthCm(editItem?.widthCm ?? "");
  setGsm(editItem?.gsm ?? "");
  setWeightKg(editItem?.weightKg ?? "");
}, [editItem, open]);
```

Convert the `lengthM`, `widthCm`, and `weightKg` inputs from `defaultValue={...}` to `value={...}` with the matching `onChange`, and add a `gsm` input beside them with `type="number" step="0.01" dir="ltr"` and the same `className`. GSM is optional — do not mark it `required`.

- [ ] **Step 3: Show the computed weight as an assist**

Compute it defensively — `computeWeightKg` throws on non-positive input, and a half-typed form has plenty of those:

```tsx
const computedWeight = useMemo(() => {
  try {
    return computeWeightKg(lengthM, widthCm, gsm);
  } catch {
    return null;
  }
}, [lengthM, widthCm, gsm]);
```

Below the weight input, render the hint only when there is something to show and it differs from what is typed:

```tsx
{computedWeight && computedWeight !== weightKg && (
  <p className="text-xs text-muted-foreground">
    {t("computedWeight", { value: computedWeight })}{" "}
    <button
      type="button"
      onClick={() => setWeightKg(computedWeight)}
      className="text-primary underline underline-offset-2"
    >
      {t("useComputed")}
    </button>
  </p>
)}
```

The weight is never silently overwritten. The operator's scale reading wins unless they click through.

- [ ] **Step 4: Send `gsm` in the mutation payload**

In the submit handler, add `gsm` alongside the existing fields, sending `undefined` rather than an empty string so the optional Zod schema accepts it:

```ts
  gsm: (formData.get("gsm") as string) || undefined,
```

Keep reading from `formData` for consistency with the surrounding code — the inputs are controlled but still named, so `FormData` sees them.

- [ ] **Step 5: Verify parity, types, and lint**

Run: `npx tsc --noEmit && pnpm lint`
Expected: no new errors (the pre-existing `sidebar.tsx` error remains).

Confirm both message files still have equal key counts:

Run: `node -e "const a=require('./messages/ar.json'),e=require('./messages/en.json');const c=o=>JSON.stringify(o).split('\":').length;console.log(c(a),c(e))"`
Expected: two identical numbers.

- [ ] **Step 6: Verify against the running app**

With `pnpm dev` running: enter length `1000`, width `100`, GSM `80`. Expected: the hint reads `Computed: 80.00 kg`; clicking "Use computed" fills the weight field; typing a different weight keeps the hint visible; saving stores the typed weight. Switch the locale cookie to `en` and back to `ar` and confirm both render and the layout stays RTL-correct.

- [ ] **Step 7: Stage**

```bash
git add src/components/products/ui/ProductsClient.tsx messages/en.json messages/ar.json
```

Suggested message: `feat(products): add GSM input with computed weight assist`

---

### Task 11: Raw material form — waste percent and negative balance warning

**Files:**
- Modify: `src/components/raw-materials/ui/RawMaterialTypesClient.tsx`
- Modify: `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `wastePercent` on the type schemas (Task 5).

- [ ] **Step 1: Add the message keys**

Add to the `rawMaterials` namespace in `messages/en.json`:

```json
    "wastePercent": "Waste %",
    "wastePercentHint": "Trim loss added to consumption. Blank uses the system default.",
    "negativeBalance": "Negative balance — more material recorded as used than received."
```

And in `messages/ar.json`:

```json
    "wastePercent": "نسبة الهالك %",
    "wastePercentHint": "الفاقد المضاف إلى الاستهلاك. اتركه فارغًا لاستخدام الافتراضي.",
    "negativeBalance": "رصيد سالب — المسجل كمستهلك أكبر مما تم استلامه."
```

- [ ] **Step 2: Add the waste percent input**

In the type create/edit dialog, add an optional input beside `name`, matching the surrounding markup:

```tsx
<div className="space-y-2">
  <Label htmlFor="wastePercent" className="text-muted-foreground">
    {t("wastePercent")}
  </Label>
  <Input
    id="wastePercent"
    name="wastePercent"
    type="number"
    step="0.01"
    min="0"
    max="100"
    defaultValue={editItem?.wastePercent ?? ""}
    dir="ltr"
    className="bg-muted/50 focus-visible:ring-primary/50"
  />
  <p className="text-xs text-muted-foreground">{t("wastePercentHint")}</p>
</div>
```

Send it as `undefined` when blank, so the optional schema accepts it:

```ts
  wastePercent: (formData.get("wastePercent") as string) || undefined,
```

- [ ] **Step 3: Flag negative balances in the list**

Negative stock is allowed by default, so it must be visible. In the `balanceTons` cell, colour the value and append a warning when it goes below zero:

```tsx
cell: (row) =>
  Number(row.balanceTons) < 0 ? (
    <span className="text-destructive font-medium" title={t("negativeBalance")}>
      <Measure value={row.balanceTons} unit="t" />
    </span>
  ) : (
    <Measure value={row.balanceTons} unit="t" />
  ),
```

Match the existing cell's component and props — read the current `balanceTons` column definition before editing and keep whatever formatter it already uses.

- [ ] **Step 4: Verify parity, types, and lint**

Run: `npx tsc --noEmit && pnpm lint && pnpm test`
Expected: no new errors, all tests pass.

Run the key-count check from Task 10 Step 5 again. Expected: two identical numbers.

- [ ] **Step 5: Verify against the running app**

With `pnpm dev` running: set a waste percent of `10` on a material and confirm it persists across a reload. Then produce more than the available stock and confirm the balance renders red with the warning tooltip rather than being blocked.

- [ ] **Step 6: Stage**

```bash
git add src/components/raw-materials/ui/RawMaterialTypesClient.tsx messages/en.json messages/ar.json
```

Suggested message: `feat(raw-materials): add waste percent input and negative balance warning`

---

## Final verification

- [ ] `npx tsc --noEmit` — clean
- [ ] `pnpm test` — all pass, including the new `production.test.ts`
- [ ] `pnpm lint` — only the pre-existing `sidebar.tsx` error
- [ ] `pnpm build` — succeeds
- [ ] Message key counts equal between `ar.json` and `en.json`
- [ ] End-to-end: create a product on a material with stock → consumption appears, balance drops; edit it → exactly one consumption row, updated; delete it → no orphan row
- [ ] Set `allow_negative_stock` to `false` in `/settings`, then try to over-produce → the mutation is rejected with the shortfall message

## Documentation to update when done

`CLAUDE.md` states: *"Weight leaves only via a consumption entry. Creating a product does not deduct anything; `products.rawMaterialTypeId` is informational. This is deliberate — the owner records consumption by hand."*

Phase 1 changes that. Replace it with the new rule, and record:

- Creating a product with a raw material type auto-writes a consumption row (`source: 'production'`), sized by `weightKg × quantity × (1 + waste%)`.
- Manual consumption entry remains, and is the path for spoilage, damaged rolls, and raw material sold on.
- Only `syncProductConsumption` may write `source: 'production'` rows.
- Products created before the cutover date have no linked consumption row and were deliberately not backfilled — backfilling would double-count against consumption already entered by hand.
- `neon-http` has no transactions; atomic multi-statement writes use `db.batch()`, which requires every statement built up front.
