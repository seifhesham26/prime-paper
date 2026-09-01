# Raw Materials Remodel & Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the per-shipment `raw_materials` table with a parent type plus a receipts/consumptions ledger and a computed balance, and fix the ~22 defects found in the codebase audit.

**Architecture:** Existing tRPC onion architecture is preserved (`router → services → db → types` per domain). Pure logic is extracted out of DB-coupled modules so it can be unit-tested with Vitest. Money figures move to a single derived source of truth. Numeric input is validated at the Zod layer instead of failing as a Postgres cast error.

**Tech Stack:** Next.js 16 App Router, TypeScript, tRPC 11, Drizzle ORM, Neon PostgreSQL (neon-http), Better Auth, next-intl, Tailwind v4 + shadcn/ui, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-01-raw-materials-remodel-and-hardening-design.md`

## Global Constraints

- Package manager is **pnpm**. `node_modules` is absent — Task 1 installs.
- Path alias `@/*` → `src/*`.
- Every user-facing string must be added to **both** `messages/en.json` and `messages/ar.json`. A key in only one throws `MISSING_MESSAGE`; `t()` throws rather than returning undefined, so `t("x") || "fallback"` never falls back.
- Reads use `protectedProcedure`, writes use `writerProcedure`, account administration uses `devProcedure` (Task 3). Never check the session inside a handler.
- All `decimal` columns come back from Drizzle as **strings**. Never do float arithmetic on them for correctness-critical comparisons — convert to integer smallest-units (Task 2).
- Money scale is 2 decimal places; tonnage scale is 3.
- Section comments use the existing `// ─── Title ───` box-drawing style.
- Commit after every task. Never use `--no-verify`.

---

## File Structure

**Created:**
| File | Responsibility |
|---|---|
| `vitest.config.ts` | Test runner config with `@` alias |
| `src/server/shared/validation.ts` | `decimalString` Zod helper, `toUnits` |
| `src/server/shared/validation.test.ts` | Its tests |
| `src/server/raw-materials/balance.ts` | Pure balance/cost arithmetic |
| `src/server/raw-materials/balance.test.ts` | Its tests |
| `src/server/raw-materials/types.db.ts` | Queries for `raw_material_types` incl. balance |
| `src/server/raw-materials/receipts.db.ts` | Queries for receipts |
| `src/server/raw-materials/consumptions.db.ts` | Queries for consumptions |
| `src/server/analytics/equation-parser.ts` | Pure tokenizer/evaluator, injected resolver |
| `src/server/analytics/equation-parser.test.ts` | Its tests |
| `src/server/analytics/equation-variables.ts` | Token registry + DB resolvers |
| `src/server/deliveries/status.ts` | `derivePaymentStatus` + the matching SQL fragment |
| `src/server/deliveries/status.test.ts` | Its tests |
| `src/server/settings/registry.ts` | Known setting keys: type, range, default, labels |
| `src/components/raw-materials/ui/RawMaterialTypesClient.tsx` | Types list screen |
| `src/components/raw-materials/ui/RawMaterialDetailClient.tsx` | Type detail screen |
| `src/app/(app)/raw-materials/[id]/page.tsx` | Detail route |

**Deleted:**
`src/server/analytics/equation-engine.ts` (split), `src/app/(app)/dashboard-client.tsx`, `src/scripts/seed-settings.ts`, `src/hooks/use-infinite-scroll.ts`, `src/components/ui/infinite-scroll.tsx`, `src/components/raw-materials/ui/RawMaterialsClient.tsx` (replaced).

---

## Task 1: Project setup and Vitest

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: `pnpm test` runs Vitest over `src/**/*.test.ts` with the `@` alias resolved.

- [ ] **Step 1: Install dependencies**

```bash
pnpm install
pnpm add -D vitest
```

- [ ] **Step 2: Create the Vitest config**

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 3: Add the test scripts**

In `package.json`, add to `"scripts"`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify the toolchain is green before changing anything**

Run: `pnpm test`
Expected: exits 0 with "No test files found" — this is success, it proves the runner and alias resolve.

Run: `npx tsc --noEmit`
Expected: no errors. If there are pre-existing errors, record them; they must not grow.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts
git commit -m "chore: add vitest for pure logic tests"
```

---

## Task 2: Numeric validation helper

The seven money/measure fields are currently `z.string().min(1)`, so `"abc"` reaches Postgres as a cast error and `weightTons: "0"` makes cost-per-ton `Infinity`.

**Files:**
- Create: `src/server/shared/validation.ts`
- Test: `src/server/shared/validation.test.ts`

**Interfaces:**
- Produces:
  - `decimalString(opts: { scale: number; min?: number; max?: number; minExclusive?: boolean }): z.ZodType<string>`
  - `toUnits(value: string, scale: number): number` — exact integer in the smallest unit (`toUnits("10.5", 3) === 10500`)

- [ ] **Step 1: Write the failing tests**

Create `src/server/shared/validation.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { decimalString, toUnits } from "./validation";

describe("toUnits", () => {
  it("scales a decimal string to an exact integer", () => {
    expect(toUnits("10.5", 3)).toBe(10500);
    expect(toUnits("0.001", 3)).toBe(1);
    expect(toUnits("7", 2)).toBe(700);
  });

  it("does not accumulate float error", () => {
    expect(toUnits("0.1", 3) + toUnits("0.2", 3)).toBe(toUnits("0.3", 3));
  });

  it("truncates beyond the given scale", () => {
    expect(toUnits("1.2349", 3)).toBe(1234);
  });
});

describe("decimalString", () => {
  const weight = decimalString({ scale: 3, min: 0, minExclusive: true });
  const money = decimalString({ scale: 2, min: 0 });

  it("accepts well-formed numbers", () => {
    expect(weight.safeParse("10.5").success).toBe(true);
    expect(money.safeParse("0").success).toBe(true);
    expect(money.safeParse("1200.75").success).toBe(true);
  });

  it("rejects non-numeric input", () => {
    expect(money.safeParse("abc").success).toBe(false);
    expect(money.safeParse("").success).toBe(false);
    expect(money.safeParse("12abc").success).toBe(false);
  });

  it("rejects negatives when min is 0", () => {
    expect(money.safeParse("-5").success).toBe(false);
  });

  it("rejects zero when minExclusive", () => {
    expect(weight.safeParse("0").success).toBe(false);
    expect(weight.safeParse("0.001").success).toBe(true);
  });

  it("rejects more decimal places than the column allows", () => {
    expect(money.safeParse("1.234").success).toBe(false);
    expect(weight.safeParse("1.2345").success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(money.safeParse("  12.50  ").success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/server/shared/validation.test.ts`
Expected: FAIL — cannot resolve `./validation`.

- [ ] **Step 3: Write the implementation**

Create `src/server/shared/validation.ts`:

```ts
import { z } from "zod";

const NUMERIC = /^-?\d+(\.\d+)?$/;

/**
 * Convert a decimal string to an exact integer in the smallest unit.
 * Avoids float arithmetic, which cannot be trusted for balance comparisons.
 * toUnits("10.5", 3) === 10500
 */
export function toUnits(value: string, scale: number): number {
  const negative = value.trim().startsWith("-");
  const [whole, fraction = ""] = value.trim().replace("-", "").split(".");
  const padded = (fraction + "0".repeat(scale)).slice(0, scale);
  const magnitude = Number(whole) * 10 ** scale + Number(padded || "0");
  return negative ? -magnitude : magnitude;
}

export type DecimalStringOptions = {
  scale: number;
  min?: number;
  max?: number;
  minExclusive?: boolean;
};

/**
 * Zod schema for a decimal column supplied as a string.
 * Drizzle returns and accepts `decimal` columns as strings, so values stay
 * strings end to end; this validates them before Postgres ever sees them.
 */
export function decimalString(opts: DecimalStringOptions) {
  const { scale, min, max, minExclusive = false } = opts;

  return z
    .string()
    .trim()
    .refine((v) => v.length > 0, { message: "Required" })
    .refine((v) => NUMERIC.test(v), { message: "Must be a number" })
    .refine((v) => Number.isFinite(Number(v)), { message: "Must be a finite number" })
    .refine((v) => (v.split(".")[1]?.length ?? 0) <= scale, {
      message: `At most ${scale} decimal places`,
    })
    .refine((v) => (min === undefined ? true : minExclusive ? Number(v) > min : Number(v) >= min), {
      message: minExclusive ? `Must be greater than ${min}` : `Must be at least ${min}`,
    })
    .refine((v) => (max === undefined ? true : Number(v) <= max), {
      message: `Must be at most ${max}`,
    });
}

/** Weight in tons — decimal(10,3), must be positive. */
export const weightTonsSchema = decimalString({ scale: 3, min: 0, minExclusive: true });

/** Money in EGP — decimal(12,2), non-negative. */
export const moneySchema = decimalString({ scale: 2, min: 0 });

/** A positive money amount — for payments, which must move something. */
export const positiveMoneySchema = decimalString({ scale: 2, min: 0, minExclusive: true });

/** Product dimensions — decimal(10,2), must be positive. */
export const dimensionSchema = decimalString({ scale: 2, min: 0, minExclusive: true });
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/server/shared/validation.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/shared/validation.ts src/server/shared/validation.test.ts
git commit -m "feat: add decimal string validation helper with exact unit conversion"
```

---

## Task 3: `devProcedure` middleware

**Files:**
- Modify: `src/server/trpc.ts`

**Interfaces:**
- Produces: `devProcedure` — a tRPC procedure that throws `FORBIDDEN` unless `ctx.session.user.role === "dev"`.

- [ ] **Step 1: Add the middleware**

In `src/server/trpc.ts`, after `enforceWriter` (line 52), add:

```ts
/** Enforce the dev role — account administration only */
const enforceDev = t.middleware(({ ctx, next }) => {
  if (!ctx.session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  if (ctx.session.user.role !== "dev") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Requires the dev role" });
  }
  return next({ ctx: { ...ctx, session: ctx.session } });
});
```

- [ ] **Step 2: Export the procedure**

At the end of `src/server/trpc.ts`, after `writerProcedure`:

```ts
/** Only dev can call (user administration, password resets) */
export const devProcedure = t.procedure.use(enforceDev);
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/server/trpc.ts
git commit -m "feat: add devProcedure for account administration"
```

---

## Task 4: Fix the role override and lock invites to dev

Today `src/lib/auth.ts:27-40` hard-sets `role: "dev"` on every user row the adapter creates, including via `authClient.admin.createUser`. The `/invite` role selector is a no-op and **every invited user gets full write access.**

**Files:**
- Modify: `src/lib/auth.ts:27-40`, `src/server/users/router.ts`, `src/app/(app)/invite/page.tsx:10`, `src/app/(app)/invite/client.tsx`, `src/components/layout/app-sidebar.tsx:88`
- Modify: `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `devProcedure` from Task 3.
- Produces: `users.invite({ name, email, password, role })` — a `devProcedure` mutation returning `{ id: string }`.

- [ ] **Step 1: Make the auth hook bootstrap-only**

Replace the `databaseHooks` block in `src/lib/auth.ts` (lines 27-40) with:

```ts
  // The FIRST user to register bootstraps the system as "dev". Everyone
  // after that defaults to the read-only "user" role. Roles for invited
  // accounts are set explicitly server-side by users.invite, not here.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          const existing = await db.select({ id: schema.user.id }).from(schema.user).limit(1);
          const isFirstUser = existing.length === 0;
          return {
            data: {
              ...user,
              role: (user as { role?: string }).role ?? (isFirstUser ? "dev" : "user"),
            },
          };
        },
      },
    },
  },
```

- [ ] **Step 2: Add a server-side invite procedure**

The role must not depend on Better Auth's hook payload. In `src/server/users/router.ts`, change the import line to use `devProcedure` and add:

```ts
  // Dev only — create an account and set its role explicitly.
  invite: devProcedure
    .input(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        password: z.string().min(8),
        role: z.enum(["admin", "user"]),
      }),
    )
    .mutation(async ({ input }) => {
      const created = await auth.api.createUser({
        body: {
          name: input.name,
          email: input.email.toLowerCase(),
          password: input.password,
          role: input.role,
        },
      });

      // Set the role explicitly afterwards so it cannot be overridden
      // by a database hook, whatever Better Auth does internally.
      await db
        .update(user)
        .set({ role: input.role, updatedAt: new Date() })
        .where(eq(user.id, created.user.id));

      return { id: created.user.id };
    }),
```

Add `import { auth } from "@/lib/auth";` to the top of the file.

- [ ] **Step 3: Move the other account procedures to devProcedure**

In the same file, change `getPendingResets`, `resolveReset`, and `getUserIdByEmail` from `writerProcedure` to `devProcedure`. Leave `requestReset` as `publicProcedure` — unauthenticated users must be able to ask for a reset.

- [ ] **Step 4: Restrict the invite page and sidebar link to dev**

`src/app/(app)/invite/page.tsx` line 10 — replace the condition with:

```ts
  if (!session || session.user.role !== "dev") {
    redirect("/dashboard");
  }
```

`src/components/layout/app-sidebar.tsx` line 88 — replace `{(isDev || session?.user?.role === "admin") && (` with `{isDev && (`.

- [ ] **Step 5: Rewrite the invite form to use the procedure**

In `src/app/(app)/invite/client.tsx`, replace the `handleSubmit` body (lines 31-54) with a tRPC mutation. Better Auth returns `{ error }` rather than throwing, which is why the old `catch` never fired and failures reported success:

```ts
  const inviteMutation = api.users.invite.useMutation({
    onSuccess: () => {
      setSuccess(true);
      setError("");
      setName("");
      setEmail("");
      setPassword("");
      setRole("user");
    },
    onError: (err) => {
      setSuccess(false);
      setError(err.message || t("error"));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    inviteMutation.mutate({ name, email, password, role: role as "admin" | "user" });
  };
```

Replace `loading` with `inviteMutation.isPending` in the submit button, and delete the now-unused `loading` state and the `authClient` import if nothing else uses it.

- [ ] **Step 6: Label the roles that actually exist**

In the same file, the `SelectItem` for `user` currently reads `{t("user")}`. Change the two role labels to `{t("roleAdmin")}` and `{t("roleViewer")}`, then add to `messages/en.json` under `invite`:

```json
"roleAdmin": "Admin — full access",
"roleViewer": "Viewer — read only"
```

and to `messages/ar.json` under `invite`:

```json
"roleAdmin": "مدير — صلاحية كاملة",
"roleViewer": "مشاهد — قراءة فقط"
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit`
Expected: no new errors.

Manual check after `pnpm dev`: sign in as an `admin` user — `/invite` must redirect to `/dashboard` and the sidebar link must be absent. As `dev`, create a user with role Viewer, then confirm in the database: `SELECT email, role FROM "user" ORDER BY created_at DESC LIMIT 1;` must return `user`, not `dev`.

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/server/users/router.ts src/app/\(app\)/invite src/components/layout/app-sidebar.tsx messages/
git commit -m "fix: stop overriding invited user roles with dev, restrict invites to dev"
```

---

## Task 5: Pure balance arithmetic

**Files:**
- Create: `src/server/raw-materials/balance.ts`
- Test: `src/server/raw-materials/balance.test.ts`

**Interfaces:**
- Consumes: `toUnits` from Task 2.
- Produces:
  - `balanceUnits(receivedTons: string, consumedTons: string): number`
  - `canConsume(balanceTons: string, amountTons: string): boolean`
  - `costPerTon(costEgp: string, weightTons: string): string` — throws `RangeError` if weight is not positive
  - `weightedAvgCostPerTon(totalCostEgp: string, totalWeightTons: string): string | null`

- [ ] **Step 1: Write the failing tests**

Create `src/server/raw-materials/balance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { balanceUnits, canConsume, costPerTon, weightedAvgCostPerTon } from "./balance";

describe("balanceUnits", () => {
  it("subtracts consumed from received in exact units", () => {
    expect(balanceUnits("10.5", "3.25")).toBe(7250);
  });

  it("returns zero when fully consumed", () => {
    expect(balanceUnits("10.5", "10.5")).toBe(0);
  });

  it("is exact where float subtraction is not", () => {
    expect(balanceUnits("0.3", "0.1")).toBe(200);
  });
});

describe("canConsume", () => {
  it("allows less than the balance", () => {
    expect(canConsume("10", "3")).toBe(true);
  });

  it("allows exactly the balance — full conversion", () => {
    expect(canConsume("10.5", "10.5")).toBe(true);
  });

  it("rejects more than the balance", () => {
    expect(canConsume("10.5", "10.501")).toBe(false);
  });

  it("rejects any consumption against a zero balance", () => {
    expect(canConsume("0", "0.001")).toBe(false);
  });
});

describe("costPerTon", () => {
  it("divides cost by weight to 2 places", () => {
    expect(costPerTon("1000", "4")).toBe("250.00");
  });

  it("rounds to 2 places", () => {
    expect(costPerTon("1000", "3")).toBe("333.33");
  });

  it("throws on zero weight rather than producing Infinity", () => {
    expect(() => costPerTon("1000", "0")).toThrow(RangeError);
  });

  it("throws on negative weight", () => {
    expect(() => costPerTon("1000", "-2")).toThrow(RangeError);
  });
});

describe("weightedAvgCostPerTon", () => {
  it("weights by tonnage, not by receipt count", () => {
    // 1t at 100/t and 9t at 200/t -> 1900 total over 10t -> 190, not 150
    expect(weightedAvgCostPerTon("1900", "10")).toBe("190.00");
  });

  it("returns null for an empty set instead of NaN", () => {
    expect(weightedAvgCostPerTon("0", "0")).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/server/raw-materials/balance.test.ts`
Expected: FAIL — cannot resolve `./balance`.

- [ ] **Step 3: Write the implementation**

Create `src/server/raw-materials/balance.ts`:

```ts
import { toUnits } from "@/server/shared/validation";

const TON_SCALE = 3;
const MONEY_SCALE = 2;

/**
 * Balance in milli-tons. Decimal columns arrive as strings; comparing them
 * as floats can report 2.9999999996 for what is exactly 3, so all balance
 * arithmetic is done on integers.
 */
export function balanceUnits(receivedTons: string, consumedTons: string): number {
  return toUnits(receivedTons, TON_SCALE) - toUnits(consumedTons, TON_SCALE);
}

/** Consuming exactly the balance is allowed; consuming more is not. */
export function canConsume(balanceTons: string, amountTons: string): boolean {
  const amount = toUnits(amountTons, TON_SCALE);
  if (amount <= 0) return false;
  return amount <= toUnits(balanceTons, TON_SCALE);
}

/** Cost per ton for a single receipt. Weight must be positive. */
export function costPerTon(costEgp: string, weightTons: string): string {
  const weight = Number(weightTons);
  if (!(weight > 0)) {
    throw new RangeError("Weight must be greater than zero to compute cost per ton");
  }
  return (Number(costEgp) / weight).toFixed(MONEY_SCALE);
}

/**
 * Weighted average across receipts: total cost over total tonnage.
 * NOT the mean of per-receipt rates, which would over-weight small receipts.
 * Returns null when there is nothing to average.
 */
export function weightedAvgCostPerTon(
  totalCostEgp: string,
  totalWeightTons: string,
): string | null {
  const weight = Number(totalWeightTons);
  if (!(weight > 0)) return null;
  return (Number(totalCostEgp) / weight).toFixed(MONEY_SCALE);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/server/raw-materials/balance.test.ts`
Expected: PASS, 13 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/raw-materials/balance.ts src/server/raw-materials/balance.test.ts
git commit -m "feat: add exact raw material balance and cost arithmetic"
```

---

## Task 6: Reshape the schema

**Files:**
- Modify: `src/db/schema.ts:79-105` (replace `rawMaterials`, adjust `products`)
- Create: `drizzle/0001_*.sql` (generated)

**Interfaces:**
- Produces: Drizzle tables `rawMaterialTypes`, `rawMaterialReceipts`, `rawMaterialConsumptions`; `products.rawMaterialTypeId`.

- [ ] **Step 1: Replace the raw materials table**

In `src/db/schema.ts`, delete the `rawMaterials` block (lines 79-90) and insert in its place:

```ts
// ─── Raw Material Types (Parent Material) ────────────────
export const rawMaterialTypes = pgTable("raw_material_types", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull().unique(),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Raw Material Receipts (Incoming Shipments) ──────────
export const rawMaterialReceipts = pgTable("raw_material_receipts", {
  id: uuid("id").defaultRandom().primaryKey(),
  typeId: uuid("type_id")
    .notNull()
    .references(() => rawMaterialTypes.id),
  dateReceived: timestamp("date_received").notNull(),
  weightTons: decimal("weight_tons", { precision: 10, scale: 3 }).notNull(),
  costEgp: decimal("cost_egp", { precision: 12, scale: 2 }).notNull(),
  costPerTon: decimal("cost_per_ton", { precision: 12, scale: 2 }),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Raw Material Consumptions (Converted to Rolls) ──────
export const rawMaterialConsumptions = pgTable("raw_material_consumptions", {
  id: uuid("id").defaultRandom().primaryKey(),
  typeId: uuid("type_id")
    .notNull()
    .references(() => rawMaterialTypes.id),
  date: timestamp("date").notNull(),
  weightTons: decimal("weight_tons", { precision: 10, scale: 3 }).notNull(),
  notes: text("notes"),
  createdBy: text("created_by").references(() => user.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
```

- [ ] **Step 2: Repoint the products foreign key**

In the `products` table, replace the `rawMaterialId` line with:

```ts
  rawMaterialTypeId: uuid("raw_material_type_id").references(() => rawMaterialTypes.id, {
    onDelete: "set null",
  }),
```

- [ ] **Step 3: Generate and apply the migration**

Run:

```bash
pnpm drizzle-kit generate
pnpm drizzle-kit migrate
```

Expected: a new `drizzle/0001_*.sql` dropping `raw_materials`, creating the three tables, and altering `products`.

Open the generated SQL and confirm it drops `raw_materials` and creates all three new tables. If drizzle-kit prompts about renaming versus dropping the column, choose **drop and create** — there is no data to preserve.

- [ ] **Step 4: Drop the orphaned invitation table**

The `invitation` table exists in `drizzle/0000_ambiguous_patch.sql` but is not defined in `schema.ts` and is used by nothing. Append to the generated `0001` migration:

```sql
DROP TABLE IF EXISTS "invitation";
```

Re-run `pnpm drizzle-kit migrate`.

- [ ] **Step 5: Verify the schema landed**

Run:

```bash
node -e "const{neon}=require('@neondatabase/serverless');require('dotenv').config();const s=neon(process.env.DATABASE_URL);s('select table_name from information_schema.tables where table_schema=\'public\' order by 1').then(r=>console.log(r.map(x=>x.table_name).join('\n')))"
```

Expected: `raw_material_types`, `raw_material_receipts`, `raw_material_consumptions` present; `raw_materials` and `invitation` absent.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts drizzle/
git commit -m "feat: replace raw_materials with type/receipt/consumption tables"
```

---

## Task 7: Raw materials data layer

**Files:**
- Create: `src/server/raw-materials/types.db.ts`, `receipts.db.ts`, `consumptions.db.ts`
- Delete: `src/server/raw-materials/db.ts`

**Interfaces:**
- Consumes: schema from Task 6.
- Produces:
  - `findTypes(page, limit)` → `{ data: TypeRow[], total, totalPages }` where `TypeRow = { id, name, notes, receivedTons, consumedTons, balanceTons, totalCostEgp, avgCostPerTon, createdAt }` (all decimals as strings, `avgCostPerTon: string | null`)
  - `findTypeById(id)` → `{ ...TypeRow, receipts, consumptions, products } | null`
  - `findTypeTotals(id)` → `{ receivedTons: string; consumedTons: string; balanceTons: string } | null`
  - `insertType`, `editType`, `removeType`, `countTypeChildren(id)` → `{ receipts: number; consumptions: number; products: number }`
  - `insertReceipt`, `editReceipt`, `removeReceipt`, `findReceiptById`
  - `insertConsumption`, `editConsumption`, `removeConsumption`, `findConsumptionById`

- [ ] **Step 1: Write the types data layer**

Create `src/server/raw-materials/types.db.ts`. The balance uses **scalar subqueries** — joining both child tables under one `GROUP BY` produces a Cartesian fan-out that inflates both sums:

```ts
import { db } from "@/db";
import {
  rawMaterialTypes,
  rawMaterialReceipts,
  rawMaterialConsumptions,
  products,
} from "@/db/schema";
import { eq, desc, asc, sql } from "drizzle-orm";
import { weightedAvgCostPerTon } from "./balance";

const receivedSql = sql<string>`COALESCE((
  SELECT SUM(r.weight_tons) FROM raw_material_receipts r WHERE r.type_id = ${rawMaterialTypes.id}
), 0)`;

const consumedSql = sql<string>`COALESCE((
  SELECT SUM(c.weight_tons) FROM raw_material_consumptions c WHERE c.type_id = ${rawMaterialTypes.id}
), 0)`;

const totalCostSql = sql<string>`COALESCE((
  SELECT SUM(r.cost_egp) FROM raw_material_receipts r WHERE r.type_id = ${rawMaterialTypes.id}
), 0)`;

function withDerived<T extends { receivedTons: string; consumedTons: string; totalCostEgp: string }>(
  row: T,
) {
  return {
    ...row,
    balanceTons: (Number(row.receivedTons) - Number(row.consumedTons)).toFixed(3),
    avgCostPerTon: weightedAvgCostPerTon(row.totalCostEgp, row.receivedTons),
  };
}

export async function findTypes(page = 1, limit = 50) {
  const offset = (page - 1) * limit;

  const [totalResult] = await db
    .select({ count: sql<string>`count(*)` })
    .from(rawMaterialTypes);
  const total = Number(totalResult?.count || 0);

  const rows = await db
    .select({
      id: rawMaterialTypes.id,
      name: rawMaterialTypes.name,
      notes: rawMaterialTypes.notes,
      createdAt: rawMaterialTypes.createdAt,
      receivedTons: receivedSql,
      consumedTons: consumedSql,
      totalCostEgp: totalCostSql,
    })
    .from(rawMaterialTypes)
    .orderBy(asc(rawMaterialTypes.name))
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map(withDerived),
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function findTypeTotals(id: string) {
  const [row] = await db
    .select({
      receivedTons: receivedSql,
      consumedTons: consumedSql,
      totalCostEgp: totalCostSql,
    })
    .from(rawMaterialTypes)
    .where(eq(rawMaterialTypes.id, id));

  if (!row) return null;
  const derived = withDerived({ ...row });
  return {
    receivedTons: derived.receivedTons,
    consumedTons: derived.consumedTons,
    balanceTons: derived.balanceTons,
  };
}

export async function findTypeById(id: string) {
  const [row] = await db
    .select({
      id: rawMaterialTypes.id,
      name: rawMaterialTypes.name,
      notes: rawMaterialTypes.notes,
      createdAt: rawMaterialTypes.createdAt,
      receivedTons: receivedSql,
      consumedTons: consumedSql,
      totalCostEgp: totalCostSql,
    })
    .from(rawMaterialTypes)
    .where(eq(rawMaterialTypes.id, id));

  if (!row) return null;

  const receipts = await db
    .select()
    .from(rawMaterialReceipts)
    .where(eq(rawMaterialReceipts.typeId, id))
    .orderBy(desc(rawMaterialReceipts.dateReceived));

  const consumptions = await db
    .select()
    .from(rawMaterialConsumptions)
    .where(eq(rawMaterialConsumptions.typeId, id))
    .orderBy(desc(rawMaterialConsumptions.date));

  const linkedProducts = await db
    .select({
      id: products.id,
      dateProduced: products.dateProduced,
      lengthM: products.lengthM,
      widthCm: products.widthCm,
      weightKg: products.weightKg,
      quantity: products.quantity,
    })
    .from(products)
    .where(eq(products.rawMaterialTypeId, id))
    .orderBy(desc(products.dateProduced));

  return { ...withDerived(row), receipts, consumptions, products: linkedProducts };
}

export async function countTypeChildren(id: string) {
  const [r] = await db
    .select({ count: sql<string>`count(*)` })
    .from(rawMaterialReceipts)
    .where(eq(rawMaterialReceipts.typeId, id));
  const [c] = await db
    .select({ count: sql<string>`count(*)` })
    .from(rawMaterialConsumptions)
    .where(eq(rawMaterialConsumptions.typeId, id));
  const [p] = await db
    .select({ count: sql<string>`count(*)` })
    .from(products)
    .where(eq(products.rawMaterialTypeId, id));

  return {
    receipts: Number(r?.count || 0),
    consumptions: Number(c?.count || 0),
    products: Number(p?.count || 0),
  };
}

export async function insertType(data: { name: string; notes?: string }, userId: string) {
  const [row] = await db
    .insert(rawMaterialTypes)
    .values({ name: data.name, notes: data.notes || null, createdBy: userId })
    .returning();
  return row;
}

export async function editType(data: { id: string; name: string; notes?: string }) {
  const [row] = await db
    .update(rawMaterialTypes)
    .set({ name: data.name, notes: data.notes || null, updatedAt: new Date() })
    .where(eq(rawMaterialTypes.id, data.id))
    .returning();
  return row;
}

export async function removeType(id: string) {
  await db.delete(rawMaterialTypes).where(eq(rawMaterialTypes.id, id));
  return { success: true };
}
```

- [ ] **Step 2: Write the receipts data layer**

Create `src/server/raw-materials/receipts.db.ts`:

```ts
import { db } from "@/db";
import { rawMaterialReceipts } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function findReceiptById(id: string) {
  const [row] = await db
    .select()
    .from(rawMaterialReceipts)
    .where(eq(rawMaterialReceipts.id, id));
  return row ?? null;
}

export async function insertReceipt(
  data: {
    typeId: string;
    dateReceived: Date;
    weightTons: string;
    costEgp: string;
    notes?: string;
  },
  costPerTon: string,
  userId: string,
) {
  const [row] = await db
    .insert(rawMaterialReceipts)
    .values({
      typeId: data.typeId,
      dateReceived: data.dateReceived,
      weightTons: data.weightTons,
      costEgp: data.costEgp,
      costPerTon,
      notes: data.notes || null,
      createdBy: userId,
    })
    .returning();
  return row;
}

export async function editReceipt(
  data: {
    id: string;
    dateReceived: Date;
    weightTons: string;
    costEgp: string;
    notes?: string;
  },
  costPerTon: string,
) {
  const [row] = await db
    .update(rawMaterialReceipts)
    .set({
      dateReceived: data.dateReceived,
      weightTons: data.weightTons,
      costEgp: data.costEgp,
      costPerTon,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(rawMaterialReceipts.id, data.id))
    .returning();
  return row;
}

export async function removeReceipt(id: string) {
  await db.delete(rawMaterialReceipts).where(eq(rawMaterialReceipts.id, id));
  return { success: true };
}
```

- [ ] **Step 3: Write the consumptions data layer**

Create `src/server/raw-materials/consumptions.db.ts` with the same shape — `findConsumptionById`, `insertConsumption(data, userId)`, `editConsumption(data)`, `removeConsumption(id)` — over `rawMaterialConsumptions`, whose fields are `typeId`, `date`, `weightTons`, `notes`, `createdBy`:

```ts
import { db } from "@/db";
import { rawMaterialConsumptions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function findConsumptionById(id: string) {
  const [row] = await db
    .select()
    .from(rawMaterialConsumptions)
    .where(eq(rawMaterialConsumptions.id, id));
  return row ?? null;
}

export async function insertConsumption(
  data: { typeId: string; date: Date; weightTons: string; notes?: string },
  userId: string,
) {
  const [row] = await db
    .insert(rawMaterialConsumptions)
    .values({
      typeId: data.typeId,
      date: data.date,
      weightTons: data.weightTons,
      notes: data.notes || null,
      createdBy: userId,
    })
    .returning();
  return row;
}

export async function editConsumption(data: {
  id: string;
  date: Date;
  weightTons: string;
  notes?: string;
}) {
  const [row] = await db
    .update(rawMaterialConsumptions)
    .set({
      date: data.date,
      weightTons: data.weightTons,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(rawMaterialConsumptions.id, data.id))
    .returning();
  return row;
}

export async function removeConsumption(id: string) {
  await db.delete(rawMaterialConsumptions).where(eq(rawMaterialConsumptions.id, id));
  return { success: true };
}
```

- [ ] **Step 4: Delete the old data layer**

```bash
rm src/server/raw-materials/db.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/server/raw-materials/
git commit -m "feat: add raw material type, receipt and consumption data layers"
```

---

## Task 8: Raw materials services and router

**Files:**
- Rewrite: `src/server/raw-materials/types.ts`, `services.ts`, `router.ts`

**Interfaces:**
- Consumes: Task 2 schemas, Task 5 arithmetic, Task 7 data layer.
- Produces: `rawMaterials` router with `getAll`, `getById`, `create`, `update`, `delete`, `createReceipt`, `updateReceipt`, `deleteReceipt`, `createConsumption`, `updateConsumption`, `deleteConsumption`.

- [ ] **Step 1: Rewrite the schemas**

Replace `src/server/raw-materials/types.ts` entirely:

```ts
import { z } from "zod";
import { moneySchema, weightTonsSchema } from "@/server/shared/validation";

// ─── Types (Parent Material) ─────────────────────────────
export const CreateTypeSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  notes: z.string().optional(),
});

export const UpdateTypeSchema = CreateTypeSchema.extend({
  id: z.string().uuid(),
});

export const GetTypesSchema = z.object({
  page: z.number().int().min(1).default(1),
});

export const IdSchema = z.object({ id: z.string().uuid() });

// ─── Receipts ────────────────────────────────────────────
export const CreateReceiptSchema = z.object({
  typeId: z.string().uuid(),
  dateReceived: z.date(),
  weightTons: weightTonsSchema,
  costEgp: moneySchema,
  notes: z.string().optional(),
});

export const UpdateReceiptSchema = CreateReceiptSchema.omit({ typeId: true }).extend({
  id: z.string().uuid(),
});

// ─── Consumptions ────────────────────────────────────────
export const CreateConsumptionSchema = z.object({
  typeId: z.string().uuid(),
  date: z.date(),
  weightTons: weightTonsSchema,
  notes: z.string().optional(),
});

export const UpdateConsumptionSchema = CreateConsumptionSchema.omit({ typeId: true }).extend({
  id: z.string().uuid(),
});

export type RawMaterialType = {
  id: string;
  name: string;
  notes: string | null;
  createdAt: Date;
  receivedTons: string;
  consumedTons: string;
  balanceTons: string;
  totalCostEgp: string;
  avgCostPerTon: string | null;
};
```

- [ ] **Step 2: Write the services with the guards**

Replace `src/server/raw-materials/services.ts` entirely. The over-consumption guard must exclude the entry's own current contribution when editing, or editing 5t to 4t would compare against a balance that already counts the 5t:

```ts
import { TRPCError } from "@trpc/server";
import type { z } from "zod";
import { canConsume, costPerTon } from "./balance";
import { toUnits } from "@/server/shared/validation";
import {
  findTypes,
  findTypeById,
  findTypeTotals,
  countTypeChildren,
  insertType,
  editType,
  removeType,
} from "./types.db";
import {
  findReceiptById,
  insertReceipt,
  editReceipt,
  removeReceipt,
} from "./receipts.db";
import {
  findConsumptionById,
  insertConsumption,
  editConsumption,
  removeConsumption,
} from "./consumptions.db";
import type {
  CreateTypeSchema,
  UpdateTypeSchema,
  CreateReceiptSchema,
  UpdateReceiptSchema,
  CreateConsumptionSchema,
  UpdateConsumptionSchema,
} from "./types";

const TON_SCALE = 3;

function tons(units: number): string {
  return (units / 10 ** TON_SCALE).toFixed(TON_SCALE);
}

async function requireTotals(typeId: string) {
  const totals = await findTypeTotals(typeId);
  if (!totals) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Raw material type not found" });
  }
  return totals;
}

// ─── Types ───────────────────────────────────────────────
export async function getTypesService(page: number, limit: number) {
  return findTypes(page, limit);
}

export async function getTypeByIdService(id: string) {
  const type = await findTypeById(id);
  if (!type) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Raw material type not found" });
  }
  return type;
}

export async function createTypeService(
  data: z.infer<typeof CreateTypeSchema>,
  userId: string,
) {
  return insertType(data, userId);
}

export async function updateTypeService(data: z.infer<typeof UpdateTypeSchema>) {
  return editType(data);
}

export async function deleteTypeService(id: string) {
  const children = await countTypeChildren(id);
  const blockers: string[] = [];
  if (children.receipts > 0) blockers.push(`${children.receipts} receipt(s)`);
  if (children.consumptions > 0) blockers.push(`${children.consumptions} consumption(s)`);
  if (children.products > 0) blockers.push(`${children.products} product(s)`);

  if (blockers.length > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Cannot delete this material: it still has ${blockers.join(", ")}.`,
    });
  }

  return removeType(id);
}

// ─── Receipts ────────────────────────────────────────────
export async function createReceiptService(
  data: z.infer<typeof CreateReceiptSchema>,
  userId: string,
) {
  await requireTotals(data.typeId);
  return insertReceipt(data, costPerTon(data.costEgp, data.weightTons), userId);
}

export async function updateReceiptService(data: z.infer<typeof UpdateReceiptSchema>) {
  const existing = await findReceiptById(data.id);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Receipt not found" });
  }

  // Lowering a receipt must not drive the balance negative.
  const totals = await requireTotals(existing.typeId);
  const balanceAfter =
    toUnits(totals.balanceTons, TON_SCALE) -
    toUnits(existing.weightTons, TON_SCALE) +
    toUnits(data.weightTons, TON_SCALE);

  if (balanceAfter < 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Reducing this receipt would leave a negative balance (${tons(balanceAfter)} t). Remove consumption entries first.`,
    });
  }

  return editReceipt(data, costPerTon(data.costEgp, data.weightTons));
}

export async function deleteReceiptService(id: string) {
  const existing = await findReceiptById(id);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Receipt not found" });
  }

  const totals = await requireTotals(existing.typeId);
  const balanceAfter =
    toUnits(totals.balanceTons, TON_SCALE) - toUnits(existing.weightTons, TON_SCALE);

  if (balanceAfter < 0) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Deleting this receipt would leave a negative balance (${tons(balanceAfter)} t). Remove consumption entries first.`,
    });
  }

  return removeReceipt(id);
}

// ─── Consumptions ────────────────────────────────────────
export async function createConsumptionService(
  data: z.infer<typeof CreateConsumptionSchema>,
  userId: string,
) {
  const totals = await requireTotals(data.typeId);

  if (!canConsume(totals.balanceTons, data.weightTons)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot consume ${data.weightTons} t — only ${totals.balanceTons} t remain.`,
    });
  }

  return insertConsumption(data, userId);
}

export async function updateConsumptionService(
  data: z.infer<typeof UpdateConsumptionSchema>,
) {
  const existing = await findConsumptionById(data.id);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Consumption entry not found" });
  }

  // Compare against the balance with this entry's own weight added back.
  const totals = await requireTotals(existing.typeId);
  const available =
    toUnits(totals.balanceTons, TON_SCALE) + toUnits(existing.weightTons, TON_SCALE);

  if (toUnits(data.weightTons, TON_SCALE) > available) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Cannot consume ${data.weightTons} t — only ${tons(available)} t are available.`,
    });
  }

  return editConsumption(data);
}

export async function deleteConsumptionService(id: string) {
  const existing = await findConsumptionById(id);
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Consumption entry not found" });
  }
  return removeConsumption(id);
}
```

- [ ] **Step 3: Rewrite the router**

Replace `src/server/raw-materials/router.ts` entirely. Page size comes from settings on the server (Task 20 supplies `getSettingsMap`); until then use the literal `50` and Task 20 replaces it:

```ts
import { createTRPCRouter, protectedProcedure, writerProcedure } from "../trpc";
import {
  getTypesService,
  getTypeByIdService,
  createTypeService,
  updateTypeService,
  deleteTypeService,
  createReceiptService,
  updateReceiptService,
  deleteReceiptService,
  createConsumptionService,
  updateConsumptionService,
  deleteConsumptionService,
} from "./services";
import {
  GetTypesSchema,
  IdSchema,
  CreateTypeSchema,
  UpdateTypeSchema,
  CreateReceiptSchema,
  UpdateReceiptSchema,
  CreateConsumptionSchema,
  UpdateConsumptionSchema,
} from "./types";

export const rawMaterialsRouter = createTRPCRouter({
  getAll: protectedProcedure
    .input(GetTypesSchema)
    .query(async ({ input }) => getTypesService(input.page, 50)),

  getById: protectedProcedure
    .input(IdSchema)
    .query(async ({ input }) => getTypeByIdService(input.id)),

  create: writerProcedure
    .input(CreateTypeSchema)
    .mutation(async ({ input, ctx }) => createTypeService(input, ctx.session.user.id)),

  update: writerProcedure
    .input(UpdateTypeSchema)
    .mutation(async ({ input }) => updateTypeService(input)),

  delete: writerProcedure
    .input(IdSchema)
    .mutation(async ({ input }) => deleteTypeService(input.id)),

  createReceipt: writerProcedure
    .input(CreateReceiptSchema)
    .mutation(async ({ input, ctx }) => createReceiptService(input, ctx.session.user.id)),

  updateReceipt: writerProcedure
    .input(UpdateReceiptSchema)
    .mutation(async ({ input }) => updateReceiptService(input)),

  deleteReceipt: writerProcedure
    .input(IdSchema)
    .mutation(async ({ input }) => deleteReceiptService(input.id)),

  createConsumption: writerProcedure
    .input(CreateConsumptionSchema)
    .mutation(async ({ input, ctx }) => createConsumptionService(input, ctx.session.user.id)),

  updateConsumption: writerProcedure
    .input(UpdateConsumptionSchema)
    .mutation(async ({ input }) => updateConsumptionService(input)),

  deleteConsumption: writerProcedure
    .input(IdSchema)
    .mutation(async ({ input }) => deleteConsumptionService(input.id)),
});
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: errors only in the not-yet-updated `RawMaterialsClient.tsx` and products files, which Tasks 9-11 fix.

- [ ] **Step 5: Commit**

```bash
git add src/server/raw-materials/
git commit -m "feat: add raw material services and router with balance guards"
```

---

## Task 9: Raw materials list screen

**Files:**
- Create: `src/components/raw-materials/ui/RawMaterialTypesClient.tsx`
- Delete: `src/components/raw-materials/ui/RawMaterialsClient.tsx`
- Modify: `src/app/(app)/raw-materials/page.tsx`, `messages/en.json`, `messages/ar.json`

**Interfaces:**
- Consumes: `api.rawMaterials.getAll`, `create`, `update`, `delete` from Task 8.

- [ ] **Step 1: Add the translation keys**

In `messages/en.json`, replace the `rawMaterials` namespace body with (keeping `title`, `addNew`, `edit`, `notes`, `save`, `cancel`, `actions`, `noData`, `confirmDelete`, `emptyStateDesc` if already present):

```json
"materialName": "Material",
"received": "Received",
"consumed": "Consumed",
"balance": "Balance",
"avgCostPerTon": "Avg Cost / Ton",
"addType": "Add Material",
"editType": "Edit Material",
"viewDetail": "View",
"tons": "t",
"noTypes": "No materials yet",
"addReceipt": "Add Receipt",
"addConsumption": "Record Consumption",
"consumeAll": "Consume all remaining",
"dateReceived": "Date Received",
"weightTons": "Weight (tons)",
"costEgp": "Cost (EGP)",
"costPerTon": "Cost / Ton",
"consumptionDate": "Date",
"receipts": "Receipts",
"consumptions": "Consumptions",
"linkedProducts": "Rolls produced",
"noReceipts": "No receipts recorded",
"noConsumptions": "No consumption recorded",
"noLinkedProducts": "No rolls linked to this material",
"backToMaterials": "Materials"
```

Add the same keys to `messages/ar.json` with Arabic values:

```json
"materialName": "الخامة",
"received": "الوارد",
"consumed": "المستهلك",
"balance": "الرصيد",
"avgCostPerTon": "متوسط التكلفة / طن",
"addType": "إضافة خامة",
"editType": "تعديل الخامة",
"viewDetail": "عرض",
"tons": "طن",
"noTypes": "لا توجد خامات بعد",
"addReceipt": "إضافة وارد",
"addConsumption": "تسجيل استهلاك",
"consumeAll": "استهلاك الرصيد بالكامل",
"dateReceived": "تاريخ الاستلام",
"weightTons": "الوزن (طن)",
"costEgp": "التكلفة (جنيه)",
"costPerTon": "التكلفة / طن",
"consumptionDate": "التاريخ",
"receipts": "الواردات",
"consumptions": "الاستهلاك",
"linkedProducts": "اللفات المنتجة",
"noReceipts": "لا توجد واردات مسجلة",
"noConsumptions": "لا يوجد استهلاك مسجل",
"noLinkedProducts": "لا توجد لفات مرتبطة بهذه الخامة",
"backToMaterials": "الخامات"
```

- [ ] **Step 2: Build the list client**

Create `src/components/raw-materials/ui/RawMaterialTypesClient.tsx`. Mirror the structure of `src/components/companies/ui/CompaniesClient.tsx` — `"use client"`, `useTranslations("rawMaterials")`, `useUserRole()` for `canWrite`, a `Dialog` form for create/edit, a `Table` for rows, loading and empty states.

Differences from the companies pattern:

```tsx
const [page, setPage] = useState(1);
const { data, isLoading } = api.rawMaterials.getAll.useQuery({ page });

const createMutation = api.rawMaterials.create.useMutation({
  onSuccess: () => {
    utils.rawMaterials.getAll.invalidate();
    utils.analytics.getDashboardStats.invalidate();
    utils.analytics.evaluateCards.invalidate();
    setOpen(false);
    setEditItem(null);
  },
});
```

`update` and `delete` use the same `onSuccess` body. `delete` surfaces the server guard message:

```tsx
const deleteMutation = api.rawMaterials.delete.useMutation({
  onSuccess: () => {
    utils.rawMaterials.getAll.invalidate();
    utils.analytics.getDashboardStats.invalidate();
    utils.analytics.evaluateCards.invalidate();
  },
  onError: (err) => alert(err.message),
});
```

The table columns are: name (a `Link` to `/raw-materials/${row.id}`), `received`, `consumed`, `balance`, `avgCostPerTon`, actions. Numeric cells carry `dir="ltr"` and render `{Number(row.balanceTons).toLocaleString()} {t("tons")}`. `avgCostPerTon` may be `null` — render `"-"` in that case.

The form has two fields only: `name` (required) and `notes` (`Textarea`).

- [ ] **Step 3: Point the page at the new client**

Replace `src/app/(app)/raw-materials/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { RawMaterialTypesClient } from "@/components/raw-materials/ui/RawMaterialTypesClient";

export default async function RawMaterialsPage() {
  const t = await getTranslations("rawMaterials");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <RawMaterialTypesClient />
      </div>
    </>
  );
}
```

- [ ] **Step 4: Delete the old client**

```bash
rm src/components/raw-materials/ui/RawMaterialsClient.tsx
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit` — no errors in raw-materials files.
Run `pnpm dev`, visit `/raw-materials`, create a material, confirm it appears with `0.000` balance, and confirm deleting it succeeds while it has no children.

- [ ] **Step 6: Commit**

```bash
git add src/components/raw-materials src/app/\(app\)/raw-materials messages/
git commit -m "feat: add raw material types list screen"
```

---

## Task 10: Raw material detail screen

**Files:**
- Create: `src/components/raw-materials/ui/RawMaterialDetailClient.tsx`, `src/app/(app)/raw-materials/[id]/page.tsx`

**Interfaces:**
- Consumes: `api.rawMaterials.getById`, `createReceipt`, `deleteReceipt`, `createConsumption`, `deleteConsumption`.

- [ ] **Step 1: Create the route**

Create `src/app/(app)/raw-materials/[id]/page.tsx`, mirroring `src/app/(app)/deliveries/[id]/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { RawMaterialDetailClient } from "@/components/raw-materials/ui/RawMaterialDetailClient";

export default async function RawMaterialDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("rawMaterials");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <RawMaterialDetailClient typeId={id} />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Build the detail client**

Create `src/components/raw-materials/ui/RawMaterialDetailClient.tsx`, modelled on `src/components/deliveries/ui/DeliveryDetailClient.tsx`:

- a back `Link` to `/raw-materials`
- four summary `Card`s: received, consumed, **balance**, avg cost/ton — balance styled `text-emerald-600` when positive, `text-muted-foreground` when zero
- a receipts `Card` with a table (date, weight, cost, cost/ton, notes, delete) and an "Add Receipt" dialog
- a consumptions `Card` with a table (date, weight, notes, delete) and a "Record Consumption" dialog
- a linked-products `Card`, read-only, so balance and actual production can be compared

The consumption dialog holds the weight in state so the consume-all button can fill it:

```tsx
const [consumeWeight, setConsumeWeight] = useState("");

// inside the dialog, above the submit row:
<Button
  type="button"
  variant="outline"
  size="sm"
  onClick={() => setConsumeWeight(data.balanceTons)}
  disabled={Number(data.balanceTons) <= 0}
>
  {t("consumeAll")}
</Button>
```

Both mutations surface the server-side guard messages, which is how over-consumption reaches the user:

```tsx
const addConsumption = api.rawMaterials.createConsumption.useMutation({
  onSuccess: () => {
    utils.rawMaterials.getById.invalidate({ id: typeId });
    utils.rawMaterials.getAll.invalidate();
    utils.analytics.getDashboardStats.invalidate();
    utils.analytics.evaluateCards.invalidate();
    setConsumptionOpen(false);
    setConsumeWeight("");
  },
  onError: (err) => setFormError(err.message),
});
```

Render `formError` in a `text-destructive` block inside the dialog, as `user-settings-client.tsx:137` does.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Manual, via `pnpm dev`:
1. Add a receipt of 10 tons at 5000 EGP → balance 10.000, cost/ton 500.00.
2. Record consumption of 4 tons → balance 6.000.
3. Attempt consumption of 7 tons → rejected with "only 6.000 t remain".
4. Click "consume all remaining" → field fills with 6.000, submits, balance 0.000.
5. Attempt to delete the type → rejected naming the receipts and consumptions.

- [ ] **Step 4: Commit**

```bash
git add src/components/raw-materials src/app/\(app\)/raw-materials
git commit -m "feat: add raw material detail screen with receipts and consumptions"
```

---

## Task 11: Repoint products at material types

**Files:**
- Modify: `src/server/products/types.ts`, `src/server/products/db.ts`, `src/server/products/router.ts`, `src/server/products/services.ts`, `src/components/products/ui/ProductsClient.tsx`, `src/app/(app)/products/page.tsx`

- [ ] **Step 1: Update the product schemas**

In `src/server/products/types.ts`, replace `rawMaterialId` with `rawMaterialTypeId`, and swap the bare string validators for the shared ones:

```ts
import { z } from "zod";
import { dimensionSchema } from "@/server/shared/validation";

export const CreateProductSchema = z.object({
  rawMaterialTypeId: z.string().uuid().optional(),
  dateProduced: z.date(),
  lengthM: dimensionSchema,
  widthCm: dimensionSchema,
  weightKg: dimensionSchema,
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
});
```

In the `Product` type, replace `rawMaterialId: string | null` with `rawMaterialTypeId: string | null` and `supplierName: string | null` with `materialName: string | null`.

- [ ] **Step 2: Update the product queries**

In `src/server/products/db.ts`, change the import from `rawMaterials` to `rawMaterialTypes`, and in `findProducts` replace the selected `supplierName` and the join:

```ts
      rawMaterialTypeId: products.rawMaterialTypeId,
      materialName: rawMaterialTypes.name,
```

```ts
    .leftJoin(rawMaterialTypes, eq(products.rawMaterialTypeId, rawMaterialTypes.id))
```

In `insertProduct` and `editProduct`, replace `rawMaterialId: data.rawMaterialId || null` with `rawMaterialTypeId: data.rawMaterialTypeId || null`.

- [ ] **Step 3: Update the products screen**

`src/app/(app)/products/page.tsx` currently fetches raw materials server-side and passes them in. Delete that prop entirely — the client fetches its own list, so newly added materials appear without a reload:

```tsx
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { ProductsClient } from "@/components/products/ui/ProductsClient";

export default async function ProductsPage() {
  const t = await getTranslations("products");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <ProductsClient />
      </div>
    </>
  );
}
```

In `ProductsClient.tsx`: remove the `rawMaterials` prop and its type, add

```tsx
const { data: typesData } = api.rawMaterials.getAll.useQuery({ page: 1 });
const materialTypes = typesData?.data ?? [];
```

Rename the `selectedRawMaterial` state to `selectedMaterialType`, populate the `Select` from `materialTypes` showing `type.name`, send `rawMaterialTypeId: selectedMaterialType || undefined`, and render `product.materialName` where the table shows `supplierName`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: clean.
Manual: create a product linked to a material, then open that material's detail page and confirm the roll appears under "Rolls produced".

- [ ] **Step 5: Commit**

```bash
git add src/server/products src/components/products src/app/\(app\)/products
git commit -m "refactor: link products to raw material types"
```

---

## Task 12: Split the equation engine and fix the parser

The current tokenizer only splits `*` and `/` when they are surrounded by spaces, and `resolveVariable` is welded to the DB so none of it is testable. The `X * + Y` string the card editor can produce is silently mishandled.

**Files:**
- Create: `src/server/analytics/equation-parser.ts`, `src/server/analytics/equation-parser.test.ts`

**Interfaces:**
- Produces:
  - `type Resolver = (token: string) => Promise<number>`
  - `evaluateEquation(equation: string, resolve: Resolver): Promise<number>`
  - `extractTokens(equation: string): string[]`
  - `validateEquation(equation: string, known: Set<string>): { ok: true } | { ok: false; unknown: string[] }`

- [ ] **Step 1: Write the failing tests**

Create `src/server/analytics/equation-parser.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { evaluateEquation, extractTokens, validateEquation } from "./equation-parser";

const stub = async (token: string) => {
  const table: Record<string, number> = { A: 10, B: 4, C: 2, ZERO: 0 };
  if (token in table) return table[token];
  const n = Number(token);
  if (Number.isFinite(n)) return n;
  throw new Error(`Unknown equation variable: "${token}"`);
};

describe("evaluateEquation", () => {
  it("adds and subtracts", async () => {
    await expect(evaluateEquation("A + B", stub)).resolves.toBe(14);
    await expect(evaluateEquation("A - B", stub)).resolves.toBe(6);
    await expect(evaluateEquation("A - B + C", stub)).resolves.toBe(8);
  });

  it("multiplies and divides", async () => {
    await expect(evaluateEquation("A * C", stub)).resolves.toBe(20);
    await expect(evaluateEquation("A / B", stub)).resolves.toBe(2.5);
  });

  it("gives multiplication precedence over addition", async () => {
    await expect(evaluateEquation("A + B * C", stub)).resolves.toBe(18);
  });

  it("handles operators without surrounding spaces", async () => {
    await expect(evaluateEquation("A*C", stub)).resolves.toBe(20);
  });

  it("does not split inside a token's parentheses", async () => {
    const parens = async (t: string) => (t === "SUM(a.b - c.d)" ? 7 : Number(t));
    await expect(evaluateEquation("SUM(a.b - c.d)", parens)).resolves.toBe(7);
  });

  it("treats division by zero as zero rather than Infinity", async () => {
    await expect(evaluateEquation("A / ZERO", stub)).resolves.toBe(0);
  });

  it("resolves bare numeric constants", async () => {
    await expect(evaluateEquation("A * 2", stub)).resolves.toBe(20);
  });

  it("rejects a dangling operator — the card editor could emit this", async () => {
    await expect(evaluateEquation("A * + B", stub)).rejects.toThrow();
  });

  it("rejects an empty equation", async () => {
    await expect(evaluateEquation("", stub)).rejects.toThrow();
  });

  it("propagates an unknown token", async () => {
    await expect(evaluateEquation("A + NOPE", stub)).rejects.toThrow(/NOPE/);
  });

  it("rounds to two decimal places", async () => {
    const third = async () => 1 / 3;
    await expect(evaluateEquation("X", third)).resolves.toBe(0.33);
  });
});

describe("extractTokens", () => {
  it("lists the variable tokens, excluding operators and constants", () => {
    expect(extractTokens("A + B * 2")).toEqual(["A", "B"]);
  });
});

describe("validateEquation", () => {
  const known = new Set(["A", "B"]);

  it("accepts an equation built only from known tokens", () => {
    expect(validateEquation("A + B", known)).toEqual({ ok: true });
  });

  it("accepts numeric constants alongside tokens", () => {
    expect(validateEquation("A * 2", known)).toEqual({ ok: true });
  });

  it("reports unknown tokens instead of silently yielding zero", () => {
    expect(validateEquation("A + TYPO", known)).toEqual({ ok: false, unknown: ["TYPO"] });
  });

  it("rejects a malformed equation", () => {
    expect(validateEquation("A * + B", known).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/server/analytics/equation-parser.test.ts`
Expected: FAIL — cannot resolve `./equation-parser`.

- [ ] **Step 3: Write the parser**

Create `src/server/analytics/equation-parser.ts`:

```ts
/**
 * Pure equation parsing for dashboard cards.
 *
 * The resolver is injected so this module never touches the database and
 * can be unit-tested. DB-backed resolution lives in equation-variables.ts.
 */

export type Resolver = (token: string) => Promise<number>;

/** Split on the given operators, but only at parenthesis depth zero. */
function splitAtDepth(expr: string, operators: string[]) {
  const parts: string[] = [];
  const ops: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of expr) {
    if (char === "(") depth++;
    if (char === ")") depth--;

    if (depth === 0 && operators.includes(char)) {
      parts.push(current.trim());
      ops.push(char);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current.trim());
  return { parts, ops };
}

function assertWellFormed(parts: string[], equation: string) {
  if (parts.some((p) => p.length === 0)) {
    throw new Error(`Malformed equation: "${equation}"`);
  }
}

export async function evaluateEquation(equation: string, resolve: Resolver): Promise<number> {
  if (!equation.trim()) {
    throw new Error("Equation is empty");
  }

  const { parts: terms, ops: addOps } = splitAtDepth(equation, ["+", "-"]);
  assertWellFormed(terms, equation);

  let result = 0;

  for (let i = 0; i < terms.length; i++) {
    const { parts: factors, ops: mulOps } = splitAtDepth(terms[i], ["*", "/"]);
    assertWellFormed(factors, equation);

    let termValue = await resolve(factors[0]);
    for (let j = 0; j < mulOps.length; j++) {
      const next = await resolve(factors[j + 1]);
      if (mulOps[j] === "*") termValue *= next;
      else termValue = next === 0 ? 0 : termValue / next;
    }

    // addOps[i - 1] is the operator preceding this term; the first is implicitly "+"
    if (i === 0 || addOps[i - 1] === "+") result += termValue;
    else result -= termValue;
  }

  return Math.round(result * 100) / 100;
}

/** Variable tokens in an equation, excluding operators and numeric constants. */
export function extractTokens(equation: string): string[] {
  const { parts: terms } = splitAtDepth(equation, ["+", "-"]);
  return terms
    .flatMap((term) => splitAtDepth(term, ["*", "/"]).parts)
    .map((t) => t.trim())
    .filter((t) => t.length > 0 && !Number.isFinite(Number(t)));
}

export function validateEquation(
  equation: string,
  known: Set<string>,
): { ok: true } | { ok: false; unknown: string[] } {
  let tokens: string[];
  try {
    const { parts: terms } = splitAtDepth(equation, ["+", "-"]);
    assertWellFormed(terms, equation);
    for (const term of terms) {
      const { parts: factors } = splitAtDepth(term, ["*", "/"]);
      assertWellFormed(factors, equation);
    }
    tokens = extractTokens(equation);
  } catch {
    return { ok: false, unknown: [] };
  }

  if (!equation.trim()) return { ok: false, unknown: [] };

  const unknown = tokens.filter((t) => !known.has(t));
  return unknown.length === 0 ? { ok: true } : { ok: false, unknown };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/server/analytics/equation-parser.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/analytics/equation-parser.ts src/server/analytics/equation-parser.test.ts
git commit -m "feat: extract pure equation parser with precedence and validation"
```

---

## Task 13: Equation variables for the new schema

**Files:**
- Create: `src/server/analytics/equation-variables.ts`
- Delete: `src/server/analytics/equation-engine.ts`
- Modify: `src/server/analytics/router.ts`, `src/server/settings/router.ts`, `src/components/analytics/ui/AnalyticsClient.tsx`, `src/components/analytics/ui/StatCard.tsx`

**Interfaces:**
- Consumes: `evaluateEquation`, `validateEquation` from Task 12.
- Produces: `EQUATION_VARIABLES`, `KNOWN_TOKENS: Set<string>`, `resolveVariable: Resolver`.
- Changes: `analytics.evaluateCards` now returns `value: number | null` and `error: string | null` per card.

- [ ] **Step 1: Write the variables module**

Create `src/server/analytics/equation-variables.ts`. Legacy `raw_materials.*` tokens are kept as aliases so saved cards do not silently break:

```ts
import { db } from "@/db";
import {
  rawMaterialReceipts,
  rawMaterialConsumptions,
  rawMaterialTypes,
  products,
  deliveries,
  payments,
  companies,
} from "@/db/schema";
import { sql, eq, gte } from "drizzle-orm";

async function scalar(query: Promise<{ v: string }[]>): Promise<number> {
  const [row] = await query;
  return Number(row?.v || 0);
}

function firstOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}

const RESOLVERS: Record<string, () => Promise<number>> = {
  // ─── Raw materials ─────────────────────────────────────
  "SUM(raw_material_receipts.weight_tons)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${rawMaterialReceipts.weightTons}), 0)` })
        .from(rawMaterialReceipts),
    ),
  "SUM(raw_material_receipts.cost_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${rawMaterialReceipts.costEgp}), 0)` })
        .from(rawMaterialReceipts),
    ),
  "SUM(raw_material_consumptions.weight_tons)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${rawMaterialConsumptions.weightTons}), 0)` })
        .from(rawMaterialConsumptions),
    ),
  "BALANCE(raw_materials)": () =>
    scalar(
      db.select({
        v: sql<string>`COALESCE((SELECT SUM(weight_tons) FROM raw_material_receipts), 0)
                     - COALESCE((SELECT SUM(weight_tons) FROM raw_material_consumptions), 0)`,
      }),
    ),
  "AVG(raw_material_receipts.cost_per_ton)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(AVG(${rawMaterialReceipts.costPerTon}), 0)` })
        .from(rawMaterialReceipts),
    ),
  "COUNT(raw_material_types)": () =>
    scalar(db.select({ v: sql<string>`COUNT(*)` }).from(rawMaterialTypes)),
  "COUNT(raw_material_receipts)": () =>
    scalar(db.select({ v: sql<string>`COUNT(*)` }).from(rawMaterialReceipts)),

  // ─── Products ──────────────────────────────────────────
  "SUM(products.quantity)": () =>
    scalar(db.select({ v: sql<string>`COALESCE(SUM(${products.quantity}), 0)` }).from(products)),
  "SUM(products.weight_kg)": () =>
    scalar(db.select({ v: sql<string>`COALESCE(SUM(${products.weightKg}), 0)` }).from(products)),
  "COUNT(products)": () => scalar(db.select({ v: sql<string>`COUNT(*)` }).from(products)),

  // ─── Sales and payments ────────────────────────────────
  "SUM(deliveries.selling_price_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` })
        .from(deliveries),
    ),
  "SUM_THIS_MONTH(deliveries.selling_price_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` })
        .from(deliveries)
        .where(gte(deliveries.date, firstOfMonth())),
    ),
  "SUM(payments.amount_egp)": () =>
    scalar(
      db.select({ v: sql<string>`COALESCE(SUM(${payments.amountEgp}), 0)` }).from(payments),
    ),
  "SUM_UNPAID(deliveries.selling_price_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` })
        .from(deliveries)
        .where(eq(deliveries.paymentStatus, "unpaid")),
    ),
  "SUM_PARTIAL(deliveries.selling_price_egp)": () =>
    scalar(
      db
        .select({ v: sql<string>`COALESCE(SUM(${deliveries.sellingPriceEgp}), 0)` })
        .from(deliveries)
        .where(eq(deliveries.paymentStatus, "partial")),
    ),
  /**
   * Correct receivable: the positive remainder per delivery, summed.
   * A global "prices minus all payments" would let an overpaid delivery
   * cancel out debt on another.
   */
  "OUTSTANDING(deliveries)": () =>
    scalar(
      db.select({
        v: sql<string>`COALESCE((
          SELECT SUM(GREATEST(d.selling_price_egp - COALESCE(p.paid, 0), 0))
          FROM deliveries d
          LEFT JOIN (
            SELECT delivery_id, SUM(amount_egp) AS paid FROM payments GROUP BY delivery_id
          ) p ON p.delivery_id = d.id
        ), 0)`,
      }),
    ),
  "COUNT(deliveries)": () => scalar(db.select({ v: sql<string>`COUNT(*)` }).from(deliveries)),
  "COUNT(companies)": () => scalar(db.select({ v: sql<string>`COUNT(*)` }).from(companies)),
};

/**
 * Tokens from the previous schema, kept working so saved dashboard cards
 * do not silently start rendering zero after the raw materials remodel.
 */
const ALIASES: Record<string, string> = {
  "SUM(raw_materials.weight_tons)": "SUM(raw_material_receipts.weight_tons)",
  "SUM(raw_materials.cost_egp)": "SUM(raw_material_receipts.cost_egp)",
  "AVG(raw_materials.cost_per_ton)": "AVG(raw_material_receipts.cost_per_ton)",
  "COUNT(raw_materials)": "COUNT(raw_material_receipts)",
};

export const KNOWN_TOKENS = new Set([
  ...Object.keys(RESOLVERS),
  ...Object.keys(ALIASES),
]);

export async function resolveVariable(token: string): Promise<number> {
  const trimmed = token.trim();
  const key = ALIASES[trimmed] ?? trimmed;
  const resolver = RESOLVERS[key];
  if (resolver) return resolver();

  const num = parseFloat(trimmed);
  if (!Number.isNaN(num)) return num;

  throw new Error(`Unknown equation variable: "${trimmed}"`);
}

/** Offered in the card builder. Aliases are deliberately not listed. */
export const EQUATION_VARIABLES = [
  { token: "BALANCE(raw_materials)", label: "Raw Material Balance (in stock)", labelAr: "رصيد المواد الخام (المتاح)" },
  { token: "SUM(raw_material_receipts.weight_tons)", label: "Total Raw Materials Received", labelAr: "إجمالي المواد الخام الواردة" },
  { token: "SUM(raw_material_consumptions.weight_tons)", label: "Total Raw Materials Consumed", labelAr: "إجمالي المواد الخام المستهلكة" },
  { token: "SUM(raw_material_receipts.cost_egp)", label: "Total Raw Materials Cost", labelAr: "إجمالي تكلفة المواد الخام" },
  { token: "AVG(raw_material_receipts.cost_per_ton)", label: "Average Cost per Ton", labelAr: "متوسط التكلفة لكل طن" },
  { token: "COUNT(raw_material_types)", label: "Number of Material Types", labelAr: "عدد أنواع الخامات" },
  { token: "COUNT(raw_material_receipts)", label: "Number of Receipts", labelAr: "عدد الواردات" },
  { token: "SUM(products.quantity)", label: "Total Products Quantity", labelAr: "إجمالي كمية المنتجات" },
  { token: "SUM(products.weight_kg)", label: "Total Products Weight", labelAr: "إجمالي وزن المنتجات" },
  { token: "COUNT(products)", label: "Number of Products", labelAr: "عدد المنتجات" },
  { token: "SUM(deliveries.selling_price_egp)", label: "Total Sales (All Time)", labelAr: "إجمالي المبيعات (كل الوقت)" },
  { token: "SUM_THIS_MONTH(deliveries.selling_price_egp)", label: "Sales This Month", labelAr: "مبيعات الشهر" },
  { token: "SUM(payments.amount_egp)", label: "Total Payments Collected", labelAr: "إجمالي المدفوعات المحصلة" },
  { token: "OUTSTANDING(deliveries)", label: "Outstanding Receivable", labelAr: "إجمالي المستحقات" },
  { token: "SUM_UNPAID(deliveries.selling_price_egp)", label: "Total Unpaid Deliveries", labelAr: "إجمالي التسليمات غير المدفوعة" },
  { token: "SUM_PARTIAL(deliveries.selling_price_egp)", label: "Total Partial Deliveries", labelAr: "إجمالي التسليمات الجزئية" },
  { token: "COUNT(deliveries)", label: "Number of Deliveries", labelAr: "عدد التسليمات" },
  { token: "COUNT(companies)", label: "Number of Companies", labelAr: "عدد الشركات" },
];
```

- [ ] **Step 2: Delete the old engine**

```bash
rm src/server/analytics/equation-engine.ts
```

- [ ] **Step 3: Surface card errors instead of faking zero**

Replace the `evaluateCards` procedure in `src/server/analytics/router.ts`. Distinct tokens are resolved once each rather than per card, which cuts the query count on a typical dashboard:

```ts
  evaluateCards: protectedProcedure.query(async () => {
    const cards = await getVisibleDashboardCards();

    // Resolve each distinct token once, not once per card that uses it.
    const tokens = new Set(cards.flatMap((c) => extractTokens(c.equation)));
    const values = new Map<string, number>();
    await Promise.all(
      [...tokens].map(async (token) => {
        try {
          values.set(token, await resolveVariable(token));
        } catch {
          // Left unset; evaluation below reports it as a card error.
        }
      }),
    );

    const cached = async (token: string) => {
      if (values.has(token)) return values.get(token)!;
      return resolveVariable(token);
    };

    return Promise.all(
      cards.map(async (card) => {
        const base = {
          id: card.id,
          title: card.title,
          titleAr: card.titleAr,
          unit: card.unit,
          icon: card.icon,
          gradient: card.gradient,
          sortOrder: card.sortOrder,
        };
        try {
          return { ...base, value: await evaluateEquation(card.equation, cached), error: null };
        } catch (err) {
          console.error(`Error evaluating card "${card.title}":`, err);
          return {
            ...base,
            value: null,
            error: err instanceof Error ? err.message : "Invalid equation",
          };
        }
      }),
    );
  }),
```

Update the imports at the top of the file:

```ts
import { evaluateEquation, extractTokens } from "./equation-parser";
import { resolveVariable, EQUATION_VARIABLES } from "./equation-variables";
```

- [ ] **Step 4: Validate equations when a card is saved**

In `src/server/settings/router.ts`, add to the top:

```ts
import { TRPCError } from "@trpc/server";
import { validateEquation } from "../analytics/equation-parser";
import { KNOWN_TOKENS } from "../analytics/equation-variables";

function assertValidEquation(equation: string) {
  const result = validateEquation(equation, KNOWN_TOKENS);
  if (!result.ok) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: result.unknown.length
        ? `Unknown variables: ${result.unknown.join(", ")}`
        : "The equation is malformed",
    });
  }
}
```

Call `assertValidEquation(input.equation)` at the start of `createCard`, and in `updateCard` guard it with `if (input.equation) assertValidEquation(input.equation);`.

- [ ] **Step 5: Render the error state**

In `src/components/analytics/ui/StatCard.tsx`, change the `value` prop to `value: number | null` and add `error?: string | null`. Replace the value block:

```tsx
      <CardContent>
        {error ? (
          <div className="text-sm font-medium text-destructive" title={error}>
            —
          </div>
        ) : (
          <div className="text-2xl font-bold tracking-tight">
            {value?.toLocaleString() ?? "—"}{" "}
            <span className="text-sm font-normal text-muted-foreground">{unit}</span>
          </div>
        )}
      </CardContent>
```

In `AnalyticsClient.tsx`, pass `error={card.error}` alongside `value={card.value}`.

- [ ] **Step 6: Verify**

Run: `pnpm test` — all suites pass.
Run: `npx tsc --noEmit` — clean.
Manual: in Settings → Dashboard Cards, save a card with equation `SUM(nonsense)` — it must be rejected with "Unknown variables: SUM(nonsense)" rather than saving and showing 0.

- [ ] **Step 7: Commit**

```bash
git add src/server/analytics src/server/settings/router.ts src/components/analytics
git commit -m "feat: remap equation variables to new schema, validate on save"
```

---

## Task 14: Payment status and outstanding logic

**Files:**
- Create: `src/server/deliveries/status.ts`, `src/server/deliveries/status.test.ts`

**Interfaces:**
- Produces:
  - `derivePaymentStatus(paidEgp: string, priceEgp: string): "paid" | "partial" | "unpaid"`
  - `outstandingFor(paidEgp: string, priceEgp: string): number`
  - `PAYMENT_STATUS_SQL` — the SQL `CASE` encoding the same rule

- [ ] **Step 1: Write the failing tests**

Create `src/server/deliveries/status.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { derivePaymentStatus, outstandingFor } from "./status";

describe("derivePaymentStatus", () => {
  it("is unpaid when nothing has been paid", () => {
    expect(derivePaymentStatus("0", "1000")).toBe("unpaid");
  });

  it("is partial between zero and the full price", () => {
    expect(derivePaymentStatus("400", "1000")).toBe("partial");
  });

  it("is paid at exactly the price", () => {
    expect(derivePaymentStatus("1000", "1000")).toBe("paid");
  });

  it("is paid when overpaid — overpayment is allowed", () => {
    expect(derivePaymentStatus("1200", "1000")).toBe("paid");
  });

  it("is unpaid for a zero-price delivery with no payments", () => {
    expect(derivePaymentStatus("0", "0")).toBe("unpaid");
  });
});

describe("outstandingFor", () => {
  it("is the unpaid remainder", () => {
    expect(outstandingFor("400", "1000")).toBe(600);
  });

  it("is zero when settled", () => {
    expect(outstandingFor("1000", "1000")).toBe(0);
  });

  it("clamps overpayment to zero so it cannot offset other debts", () => {
    expect(outstandingFor("1200", "1000")).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/server/deliveries/status.test.ts`
Expected: FAIL — cannot resolve `./status`.

- [ ] **Step 3: Write the implementation**

Create `src/server/deliveries/status.ts`:

```ts
import { sql } from "drizzle-orm";

export type PaymentStatus = "paid" | "partial" | "unpaid";

/**
 * The single rule for delivery payment status.
 *
 * IMPORTANT: PAYMENT_STATUS_SQL below encodes this exact rule for the
 * atomic UPDATE. The two must be changed together — they are kept in
 * this one file so the pairing is impossible to miss.
 */
export function derivePaymentStatus(paidEgp: string, priceEgp: string): PaymentStatus {
  const paid = Number(paidEgp);
  const price = Number(priceEgp);

  if (paid <= 0) return "unpaid";
  if (paid >= price) return "paid";
  return "partial";
}

/** The positive remainder only — overpayment must not offset other debts. */
export function outstandingFor(paidEgp: string, priceEgp: string): number {
  return Math.max(Number(priceEgp) - Number(paidEgp), 0);
}

/** SQL twin of derivePaymentStatus, for the single-statement recompute. */
export const PAYMENT_STATUS_SQL = sql`(CASE
  WHEN (SELECT COALESCE(SUM(amount_egp), 0) FROM payments WHERE delivery_id = deliveries.id) <= 0
    THEN 'unpaid'
  WHEN (SELECT COALESCE(SUM(amount_egp), 0) FROM payments WHERE delivery_id = deliveries.id) >= deliveries.selling_price_egp
    THEN 'paid'
  ELSE 'partial'
END)::payment_status`;
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm test src/server/deliveries/status.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/server/deliveries/status.ts src/server/deliveries/status.test.ts
git commit -m "feat: add single source of truth for delivery payment status"
```

---

## Task 15: Derive payment status and make delivery writes atomic

**Files:**
- Modify: `src/server/deliveries/db.ts`, `src/server/deliveries/types.ts`, `src/server/deliveries/router.ts`, `src/server/deliveries/services.ts`, `src/components/deliveries/ui/DeliveriesClient.tsx`

**Interfaces:**
- Consumes: `PAYMENT_STATUS_SQL` from Task 14, `moneySchema`/`positiveMoneySchema` from Task 2.
- Produces: `recomputeDeliveryStatus(deliveryId: string): Promise<void>`; `deliveries.update`, `deliveries.updatePayment`, `deliveries.deletePayment`.

- [ ] **Step 1: Remove the user-supplied status and tighten validation**

In `src/server/deliveries/types.ts`, delete the `paymentStatus` line from `CreateDeliverySchema` — status is always derived — and swap in the shared validators:

```ts
import { z } from "zod";
import { moneySchema, positiveMoneySchema } from "@/server/shared/validation";

const DeliveryItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive(),
});

export const CreateDeliverySchema = z.object({
  date: z.date(),
  companyId: z.string().uuid(),
  sellingPriceEgp: moneySchema,
  notes: z.string().optional(),
  items: z.array(DeliveryItemSchema),
});

export const UpdateDeliverySchema = CreateDeliverySchema.extend({
  id: z.string().uuid(),
});

export const AddPaymentSchema = z.object({
  deliveryId: z.string().uuid(),
  amountEgp: positiveMoneySchema,
  date: z.date(),
  notes: z.string().optional(),
});

export const UpdatePaymentSchema = z.object({
  id: z.string().uuid(),
  amountEgp: positiveMoneySchema,
  date: z.date(),
  notes: z.string().optional(),
});
```

Keep the existing `GetDeliveriesSchema`, `DeleteDeliverySchema`, `GetDeliveryByIdSchema` and the exported types, but change `GetDeliveriesSchema` to `z.object({ page: z.number().int().min(1).default(1) })`.

- [ ] **Step 2: Add the recompute and make creation atomic**

In `src/server/deliveries/db.ts`, add the import and the recompute helper:

```ts
import { PAYMENT_STATUS_SQL } from "./status";

/** Recompute a delivery's status from its payments in one atomic statement. */
export async function recomputeDeliveryStatus(deliveryId: string) {
  await db
    .update(deliveries)
    .set({ paymentStatus: PAYMENT_STATUS_SQL as never, updatedAt: new Date() })
    .where(eq(deliveries.id, deliveryId));
}
```

Replace `insertDelivery`. `db.batch()` runs its statements in a single transaction, but it cannot feed one statement's result into the next — so the id is generated in application code and used by both inserts:

```ts
export async function insertDelivery(
  data: z.infer<typeof CreateDeliverySchema>,
  userId: string,
) {
  const deliveryId = crypto.randomUUID();

  const insertRow = db.insert(deliveries).values({
    id: deliveryId,
    date: data.date,
    companyId: data.companyId,
    sellingPriceEgp: data.sellingPriceEgp,
    paymentStatus: "unpaid",
    notes: data.notes || null,
    createdBy: userId,
  });

  if (data.items.length > 0) {
    await db.batch([
      insertRow,
      db.insert(deliveryItems).values(
        data.items.map((item) => ({
          deliveryId,
          productId: item.productId,
          quantity: item.quantity,
        })),
      ),
    ]);
  } else {
    await insertRow;
  }

  return { id: deliveryId };
}
```

Replace the tail of `insertPayment` (its manual status calculation, lines 125-148) with a call to the helper:

```ts
export async function insertPayment(
  data: z.infer<typeof AddPaymentSchema>,
  userId: string,
) {
  await db.insert(payments).values({
    deliveryId: data.deliveryId,
    amountEgp: data.amountEgp,
    date: data.date,
    notes: data.notes || null,
    createdBy: userId,
  });

  await recomputeDeliveryStatus(data.deliveryId);
  return { success: true };
}
```

- [ ] **Step 3: Add the missing mutations**

Append to `src/server/deliveries/db.ts`:

```ts
export async function editDelivery(data: z.infer<typeof UpdateDeliverySchema>) {
  await db
    .update(deliveries)
    .set({
      date: data.date,
      companyId: data.companyId,
      sellingPriceEgp: data.sellingPriceEgp,
      notes: data.notes || null,
      updatedAt: new Date(),
    })
    .where(eq(deliveries.id, data.id));

  await db.delete(deliveryItems).where(eq(deliveryItems.deliveryId, data.id));
  if (data.items.length > 0) {
    await db.insert(deliveryItems).values(
      data.items.map((item) => ({
        deliveryId: data.id,
        productId: item.productId,
        quantity: item.quantity,
      })),
    );
  }

  // The price may have changed, which can flip the status.
  await recomputeDeliveryStatus(data.id);
  return { id: data.id };
}

export async function findPaymentById(id: string) {
  const [row] = await db.select().from(payments).where(eq(payments.id, id));
  return row ?? null;
}

export async function editPayment(data: z.infer<typeof UpdatePaymentSchema>) {
  const [row] = await db
    .update(payments)
    .set({ amountEgp: data.amountEgp, date: data.date, notes: data.notes || null })
    .where(eq(payments.id, data.id))
    .returning({ deliveryId: payments.deliveryId });

  if (row) await recomputeDeliveryStatus(row.deliveryId);
  return { success: true };
}

export async function removePayment(id: string) {
  const [row] = await db
    .delete(payments)
    .where(eq(payments.id, id))
    .returning({ deliveryId: payments.deliveryId });

  if (row) await recomputeDeliveryStatus(row.deliveryId);
  return { success: true };
}
```

Add `UpdateDeliverySchema` and `UpdatePaymentSchema` to the type imports at the top of the file.

- [ ] **Step 4: Expose them through services and router**

In `src/server/deliveries/services.ts`, add pass-through services `updateDeliveryService`, `updatePaymentService`, `deletePaymentService`, and thread `userId` into `createDeliveryService` and `addPaymentService`.

In `src/server/deliveries/router.ts`, add:

```ts
  update: writerProcedure
    .input(UpdateDeliverySchema)
    .mutation(async ({ input }) => updateDeliveryService(input)),

  updatePayment: writerProcedure
    .input(UpdatePaymentSchema)
    .mutation(async ({ input }) => updatePaymentService(input)),

  deletePayment: writerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ input }) => deletePaymentService(input.id)),
```

and pass `ctx.session.user.id` into `create` and `addPayment`. Change `getById` to throw a proper error rather than a bare `Error`:

```ts
      if (!delivery) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Delivery not found" });
      }
```

- [ ] **Step 5: Drop the payment status picker from the form**

In `src/components/deliveries/ui/DeliveriesClient.tsx`, delete the `selectedStatus` state, the payment-status `Select` block (lines 212-227), and `paymentStatus` from the `createMutation.mutate` payload. Status is now shown but never chosen. Add analytics invalidation to `createMutation.onSuccess`:

```tsx
      utils.deliveries.getAll.invalidate();
      utils.analytics.getDashboardStats.invalidate();
      utils.analytics.evaluateCards.invalidate();
```

- [ ] **Step 6: Verify**

Run: `pnpm test` and `npx tsc --noEmit` — both clean.
Manual: create a delivery for 1000 EGP → status `unpaid`. Add a 400 payment → `partial`. Add 600 → `paid`. Delete the 600 payment → back to `partial`. Add 5000 → `paid`, remaining shows negative.

- [ ] **Step 7: Commit**

```bash
git add src/server/deliveries src/components/deliveries
git commit -m "fix: derive payment status from payments, add delivery and payment editing"
```

---

## Task 16: Correct the outstanding payments figure

`analytics/services.ts:155-158` computes `unpaid + partial − ALL payments`, subtracting payments that belong to already-paid deliveries.

**Files:**
- Modify: `src/server/analytics/services.ts`
- Modify: `src/scripts/seed-settings.mjs`

- [ ] **Step 1: Replace the outstanding query**

In `src/server/analytics/services.ts`, delete the `totalDeliveries`, `totalPayments` and `partialDeliveries` queries used for the outstanding figure and replace them with:

```ts
    const [outstandingResult] = await db.select({
      total: sql<string>`COALESCE((
        SELECT SUM(GREATEST(d.selling_price_egp - COALESCE(p.paid, 0), 0))
        FROM deliveries d
        LEFT JOIN (
          SELECT delivery_id, SUM(amount_egp) AS paid FROM payments GROUP BY delivery_id
        ) p ON p.delivery_id = d.id
      ), 0)`,
    });
```

and change the returned field to:

```ts
      outstandingPayments: Number(outstandingResult?.total || 0),
```

- [ ] **Step 2: Repoint the seeded card and make seeding idempotent**

In `src/scripts/seed-settings.mjs`, change the Outstanding Payments card equation to `"OUTSTANDING(deliveries)"` and the Total Raw Materials card equation to `"BALANCE(raw_materials)"` with title "Raw Material Balance" / "رصيد المواد الخام".

Replace the `if (existing.length === 0)` guard with an upsert by title, so existing databases receive the corrected equations:

```js
  for (const card of defaultCards) {
    const [found] = await db
      .select({ id: dashboardCards.id })
      .from(dashboardCards)
      .where(eq(dashboardCards.title, card.title));

    if (found) {
      await db
        .update(dashboardCards)
        .set({ equation: card.equation, unit: card.unit, updatedAt: new Date() })
        .where(eq(dashboardCards.id, found.id));
    } else {
      await db.insert(dashboardCards).values(card);
    }
  }
```

Add `import { eq } from "drizzle-orm";` and move the four card objects into a `const defaultCards = [...]` above the loop.

- [ ] **Step 3: Delete the unrunnable twin**

`src/scripts/seed-settings.ts` imports via the `@/` alias and cannot execute under `node`:

```bash
rm src/scripts/seed-settings.ts
```

- [ ] **Step 4: Verify**

Run: `node src/scripts/seed-settings.mjs` — completes without error and is safe to run twice.
Manual: create two deliveries of 1000 each; pay 1200 on the first and nothing on the second. Outstanding must read **1000**, not 800.

- [ ] **Step 5: Commit**

```bash
git add src/server/analytics/services.ts src/scripts/
git commit -m "fix: stop overpayment offsetting other debts in outstanding total"
```

---

## Task 17: Populate created_by across all domains

**Files:**
- Modify: `src/server/companies/{services,router}.ts`, `src/server/companies/db.ts`, `src/server/products/{services,router,db}.ts`

- [ ] **Step 1: Thread the user id through companies**

In `src/server/companies/db.ts`, `insertCompany(data, userId)` adds `createdBy: userId` to the inserted values. In `services.ts`, `createCompanyService(data, userId)` passes it through. In `router.ts`:

```ts
  create: writerProcedure
    .input(CreateCompanySchema)
    .mutation(async ({ input, ctx }) => createCompanyService(input, ctx.session.user.id)),
```

- [ ] **Step 2: Thread the user id through products**

Apply the identical change to `insertProduct`, `createProductService`, and the products `create` procedure.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit` — clean.
Manual: create a company, then confirm attribution landed:

```bash
node -e "const{neon}=require('@neondatabase/serverless');require('dotenv').config();const s=neon(process.env.DATABASE_URL);s('select name, created_by from companies order by created_at desc limit 1').then(r=>console.log(r))"
```

Expected: `created_by` is a user id, not `null`.

- [ ] **Step 4: Commit**

```bash
git add src/server/companies src/server/products
git commit -m "feat: record created_by on companies and products"
```

---

## Task 18: Friendly delete guards

Deleting a company that has deliveries, or a product that appears in a delivery, currently surfaces a raw Postgres foreign key error.

**Files:**
- Modify: `src/server/companies/{db,services}.ts`, `src/server/products/{db,services}.ts`

- [ ] **Step 1: Add the company guard**

In `src/server/companies/db.ts`:

```ts
export async function countCompanyDeliveries(id: string) {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(deliveries)
    .where(eq(deliveries.companyId, id));
  return Number(row?.count || 0);
}
```

Add `deliveries` to the schema import. In `services.ts`:

```ts
export async function deleteCompanyService(id: string) {
  const linked = await countCompanyDeliveries(id);
  if (linked > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Cannot delete this company: it has ${linked} delivery/deliveries. Delete those first.`,
    });
  }
  return removeCompany(id);
}
```

- [ ] **Step 2: Add the product guard**

The same shape in products, counting `deliveryItems` where `productId` matches:

```ts
export async function countProductDeliveryItems(id: string) {
  const [row] = await db
    .select({ count: sql<string>`count(*)` })
    .from(deliveryItems)
    .where(eq(deliveryItems.productId, id));
  return Number(row?.count || 0);
}
```

```ts
export async function deleteProductService(id: string) {
  const linked = await countProductDeliveryItems(id);
  if (linked > 0) {
    throw new TRPCError({
      code: "CONFLICT",
      message: `Cannot delete this product: it appears in ${linked} delivery item(s).`,
    });
  }
  return removeProduct(id);
}
```

- [ ] **Step 3: Show the message in the UI**

In `CompaniesClient.tsx` and `ProductsClient.tsx`, add to each `deleteMutation`:

```tsx
  onError: (err) => alert(err.message),
```

- [ ] **Step 4: Verify**

Manual: create a company, give it a delivery, then try to delete the company — an explanatory alert appears and the company survives.

- [ ] **Step 5: Commit**

```bash
git add src/server/companies src/server/products src/components/companies src/components/products
git commit -m "feat: explain why a referenced record cannot be deleted"
```

---

## Task 19: Make system settings real

Five settings keys are editable in the UI and read by nothing; the values they claim to control are hardcoded.

**Files:**
- Create: `src/server/settings/registry.ts`
- Modify: `src/server/settings/db.ts`, `src/server/settings/router.ts`, `src/server/settings/types.ts`, `src/components/settings/ui/system-config-client.tsx`
- Modify: `src/server/{raw-materials,companies,products,deliveries}/router.ts`, `src/server/analytics/services.ts`

**Interfaces:**
- Produces: `SETTINGS_REGISTRY`, `getSettingsMap(): Promise<SettingsMap>` where `SettingsMap = { pageSizeDefault: number; dropdownListLimit: number; dashboardRecentDeliveries: number; dashboardTopUnpaid: number; dashboardChartMonths: number }`

- [ ] **Step 1: Declare the registry**

Create `src/server/settings/registry.ts`:

```ts
export type SettingDefinition = {
  key: string;
  category: "operational" | "dashboard" | "ui";
  min: number;
  max: number;
  default: number;
  label: string;
  labelAr: string;
};

export const SETTINGS_REGISTRY: SettingDefinition[] = [
  { key: "page_size_default", category: "operational", min: 5, max: 200, default: 50,
    label: "Rows per page", labelAr: "عدد الصفوف في الصفحة" },
  { key: "dropdown_list_limit", category: "operational", min: 10, max: 2000, default: 1000,
    label: "Dropdown list limit", labelAr: "حد عناصر القائمة المنسدلة" },
  { key: "dashboard_recent_deliveries", category: "dashboard", min: 1, max: 50, default: 5,
    label: "Recent deliveries shown", labelAr: "عدد التسليمات الأخيرة المعروضة" },
  { key: "dashboard_top_unpaid", category: "dashboard", min: 1, max: 50, default: 5,
    label: "Top unpaid companies shown", labelAr: "عدد الشركات المدينة المعروضة" },
  { key: "dashboard_chart_months", category: "dashboard", min: 3, max: 24, default: 6,
    label: "Months in the revenue chart", labelAr: "عدد الأشهر في الرسم البياني" },
];

export const SETTINGS_BY_KEY = new Map(SETTINGS_REGISTRY.map((s) => [s.key, s]));

export type SettingsMap = {
  pageSizeDefault: number;
  dropdownListLimit: number;
  dashboardRecentDeliveries: number;
  dashboardTopUnpaid: number;
  dashboardChartMonths: number;
};
```

- [ ] **Step 2: Read the settings with defaults**

Add to `src/server/settings/db.ts`:

```ts
import { SETTINGS_BY_KEY, type SettingsMap } from "./registry";

function coerce(key: string, raw: string | undefined): number {
  const def = SETTINGS_BY_KEY.get(key)!;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < def.min || n > def.max) return def.default;
  return n;
}

/** Settings with validated fallbacks — a bad stored value never breaks a page. */
export async function getSettingsMap(): Promise<SettingsMap> {
  const rows = await getAllSettings();
  const stored = new Map(rows.map((r) => [r.key, r.value]));

  return {
    pageSizeDefault: coerce("page_size_default", stored.get("page_size_default")),
    dropdownListLimit: coerce("dropdown_list_limit", stored.get("dropdown_list_limit")),
    dashboardRecentDeliveries: coerce("dashboard_recent_deliveries", stored.get("dashboard_recent_deliveries")),
    dashboardTopUnpaid: coerce("dashboard_top_unpaid", stored.get("dashboard_top_unpaid")),
    dashboardChartMonths: coerce("dashboard_chart_months", stored.get("dashboard_chart_months")),
  };
}
```

- [ ] **Step 3: Validate on save**

In `src/server/settings/router.ts`, before `upsertSetting` in the `update` mutation:

```ts
      const def = SETTINGS_BY_KEY.get(input.key);
      if (def) {
        const n = Number(input.value);
        if (!Number.isInteger(n) || n < def.min || n > def.max) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `${def.label} must be a whole number between ${def.min} and ${def.max}`,
          });
        }
      }
```

- [ ] **Step 4: Consume the settings**

- `rawMaterials.getAll`, `companies.getAll`, `products.getAll`, `deliveries.getAll`: replace the hardcoded limit with `(await getSettingsMap()).pageSizeDefault`, and change each input schema to `{ page }` only.
- `deliveries.getAll`'s companies dropdown and `products` lookups: use `dropdownListLimit`.
- `analytics/services.ts`: replace `.slice(0, 5)` for `topUnpaidCompanies` with `dashboardTopUnpaid`, `.limit(5)` for `recentDeliveries` with `dashboardRecentDeliveries`, and the hardcoded 6-month window with `dashboardChartMonths` (both the `sixMonthsAgo` offset and the `for (let i = 0; i < 6; i++)` loop bound).

- [ ] **Step 5: Show real labels in the settings UI**

In `system-config-client.tsx`, replace the raw `<code>{setting.key}</code>` with the registry label, falling back to the key for any unregistered setting:

```tsx
const def = SETTINGS_BY_KEY.get(setting.key);
// ...
<span className="text-sm font-medium">{isArabic ? def?.labelAr ?? setting.key : def?.label ?? setting.key}</span>
<code className="block text-xs text-muted-foreground font-mono">{setting.key}</code>
```

Add `useLocale` and derive `isArabic`. Also surface save failures — add `onError: (err) => alert(err.message)` to `updateMutation`, and replace the hardcoded `categoryLabels` English strings with translated ones.

- [ ] **Step 6: Verify**

Manual: set `dashboard_top_unpaid` to 2 → the dashboard lists two companies. Set it to `abc` → rejected with the range message. Set `page_size_default` to 5 → lists paginate every 5 rows.

- [ ] **Step 7: Commit**

```bash
git add src/server/settings src/server/analytics/services.ts src/server/*/router.ts src/components/settings
git commit -m "feat: make system settings actually control the values they name"
```

---

## Task 20: Wire up pagination

`PaginationControls` exists but is imported nowhere; every list hardcodes `limit: 100` and silently truncates.

**Files:**
- Modify: `src/components/{companies,products,deliveries,raw-materials}/ui/*Client.tsx`
- Delete: `src/hooks/use-infinite-scroll.ts`, `src/components/ui/infinite-scroll.tsx`

- [ ] **Step 1: Read the current page from the URL**

In each of the four list clients, replace the hardcoded query with URL-driven paging so a page survives refresh and back-navigation:

```tsx
import { useRouter, useSearchParams, usePathname } from "next/navigation";

const router = useRouter();
const pathname = usePathname();
const searchParams = useSearchParams();
const page = Math.max(1, Number(searchParams.get("page") ?? "1"));

const setPage = (next: number) => {
  const params = new URLSearchParams(searchParams.toString());
  params.set("page", String(next));
  router.push(`${pathname}?${params.toString()}`);
};

const { data, isLoading } = api.companies.getAll.useQuery({ page });
```

- [ ] **Step 2: Render the control**

Below each table, inside the `Card`:

```tsx
{data && data.totalPages > 1 && (
  <PaginationControls
    currentPage={page}
    totalPages={data.totalPages}
    onPageChange={setPage}
  />
)}
```

Read `src/components/ui/pagination-controls.tsx` first and match its actual prop names; adjust the call if they differ.

- [ ] **Step 3: Delete the dead infinite-scroll code**

Neither has any consumer, and `PaginationControls` covers both desktop and mobile:

```bash
rm src/hooks/use-infinite-scroll.ts src/components/ui/infinite-scroll.tsx
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — clean, confirming nothing imported the deleted files.
Manual: with `page_size_default` at 5 and six companies, page 2 shows the sixth, and reloading on `?page=2` stays on page 2.

- [ ] **Step 5: Commit**

```bash
git add src/components src/hooks
git commit -m "feat: wire up pagination, remove unused infinite scroll"
```

---

## Task 21: Remaining UI defects

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`, `src/components/analytics/ui/AnalyticsClient.tsx`, `src/components/settings/ui/dashboard-card-editor.tsx`, `messages/en.json`, `messages/ar.json`
- Delete: `src/app/(app)/dashboard-client.tsx`

- [ ] **Step 1: Add the missing translation keys**

`AnalyticsClient.tsx:210` calls `t(delivery.paymentStatus)` in the `dashboard` namespace, which has no such keys, so the dashboard throws `MISSING_MESSAGE`. `dashboard-card-editor.tsx:524` calls `t("cancel")` in `settings`, which is also missing.

Add to `messages/en.json`, `dashboard` namespace: `"paid": "Paid"`, `"partial": "Partial"`, `"unpaid": "Unpaid"`. To `settings`: `"cancel": "Cancel"`.

Add to `messages/ar.json`, `dashboard`: `"paid": "مدفوع"`, `"partial": "جزئي"`, `"unpaid": "غير مدفوع"`. To `settings`: `"cancel": "إلغاء"`.

- [ ] **Step 2: Verify no other keys are missing**

Run:

```bash
node -e "
const fs=require('fs'),path=require('path');
const en=require('./messages/en.json'), ar=require('./messages/ar.json');
const flat=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'&&v?flat(v,p+k+'.'):[p+k]);
const E=new Set(flat(en)),A=new Set(flat(ar));
console.log('en-only:',[...E].filter(k=>!A.has(k)));
console.log('ar-only:',[...A].filter(k=>!E.has(k)));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>{const p=path.join(d,e.name);return e.isDirectory()?walk(p):(/\.tsx?$/.test(e.name)?[p]:[])});
let bad=[];
for(const f of walk('src')){
  const src=fs.readFileSync(f,'utf8'),ns={};
  for(const m of src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*(?:await\s+)?(?:useTranslations|getTranslations)\(\s*[\"'](\w+)[\"']\s*\)/g)) ns[m[1]]=m[2];
  for(const m of src.matchAll(/\b(\w+)\(\s*[\"']([\w.]+)[\"']\s*\)/g))
    if(ns[m[1]]&&en[ns[m[1]]]&&en[ns[m[1]]][m[2]]===undefined) bad.push(f+' '+ns[m[1]]+'.'+m[2]);
}
console.log(bad.length?bad.join('\n'):'no missing keys');
"
```

Expected: all three lines empty / "no missing keys".

- [ ] **Step 3: Make the settings tabs respect the URL**

`AnalyticsClient.tsx:72` links to `/settings?tab=cards` but the tabs use `defaultValue="account"` and ignore the parameter. In `src/app/(app)/settings/page.tsx`:

```tsx
import { useSearchParams } from "next/navigation";

const searchParams = useSearchParams();
const requested = searchParams.get("tab");
const validTabs = ["account", "global", "config", "cards"];
const initialTab = requested && validTabs.includes(requested) ? requested : "account";
```

Change `<Tabs defaultValue="account"` to `<Tabs defaultValue={initialTab}`.

- [ ] **Step 4: Fix the dynamic grid class**

`AnalyticsClient.tsx:79` builds `lg:grid-cols-${n}`, which Tailwind cannot see at build time, so no class is generated for 1 or 3 cards. Replace with a static map:

```tsx
const COLUMN_CLASS: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

const columns = COLUMN_CLASS[Math.min(Math.max(dynamicCards?.length ?? 4, 1), 4)];
```

and use `` className={`grid gap-4 sm:grid-cols-2 ${columns}`} ``.

- [ ] **Step 5: Fix the equation builder's operator handling**

`insertOperator` leaves a trailing operator, so a following `insertVariable` produces `X * + Y`. In `dashboard-card-editor.tsx`, replace both helpers:

```tsx
  const endsWithOperator = (eq: string) => /[+\-*/]\s*$/.test(eq);

  const insertVariable = (token: string) => {
    setForm((prev) => {
      if (!prev.equation.trim()) return { ...prev, equation: token };
      if (endsWithOperator(prev.equation)) return { ...prev, equation: `${prev.equation}${token}` };
      return { ...prev, equation: `${prev.equation} + ${token}` };
    });
  };

  const insertOperator = (op: string) => {
    setForm((prev) => {
      if (!prev.equation.trim()) return prev;
      const base = endsWithOperator(prev.equation)
        ? prev.equation.replace(/[+\-*/]\s*$/, "")
        : prev.equation;
      return { ...prev, equation: `${base.trimEnd()} ${op} ` };
    });
  };
```

Also surface save rejections from Task 13 — add `onError: (err) => alert(err.message)` to `createMutation` and `updateMutation`.

- [ ] **Step 6: Delete the superseded dashboard client**

`DashboardClient` is exported but imported nowhere; `AnalyticsClient` replaced it:

```bash
rm "src/app/(app)/dashboard-client.tsx"
```

- [ ] **Step 7: Verify**

Run: `npx tsc --noEmit` — clean.
Manual: the dashboard's Recent Deliveries badges read "Paid"/"Partial"/"Unpaid" translated; hide cards until three remain and the grid still lays out correctly; "Manage Cards" opens the Dashboard Cards tab directly; clicking `*` then a variable yields `X * Y`.

- [ ] **Step 8: Commit**

```bash
git add src/app src/components messages
git commit -m "fix: missing translations, settings tab param, grid class, equation builder"
```

---

## Task 22: Landing page and live product dropdown

**Files:**
- Modify: `src/app/page.tsx`, `src/app/(app)/deliveries/page.tsx`, `src/components/deliveries/ui/DeliveriesClient.tsx`, `messages/en.json`, `messages/ar.json`

- [ ] **Step 1: Add the landing translation keys**

To `messages/en.json` under `landing`: `"login": "Login"`, `"accessPortal": "Access Management Portal"`, `"badgeSecure": "Enterprise Secure"`, `"badgeMultilingual": "Multi-lingual Support"`, `"badgeInventory": "Inventory Optimized"`, `"productionYield": "Production Yield"`, `"copyright": "© 2026 Prime Paper Company. Professional Factory Management."`

To `messages/ar.json` under `landing`: `"login": "تسجيل الدخول"`, `"accessPortal": "الدخول إلى لوحة الإدارة"`, `"badgeSecure": "أمان على مستوى المؤسسات"`, `"badgeMultilingual": "دعم متعدد اللغات"`, `"badgeInventory": "إدارة مخزون محسّنة"`, `"productionYield": "كفاءة الإنتاج"`, `"copyright": "© 2026 شركة برايم بيبر. إدارة احترافية للمصانع."`

- [ ] **Step 2: Localize the landing page and gate the signup CTA**

In `src/app/page.tsx`, replace the hardcoded English at lines 34, 76, 82-84, 116, 127 with the keys above, and delete the three dead `href="#"` footer links (lines 128-132) along with their wrapping `div`.

The signup CTAs still appear when public signup is disabled, sending users to a 404. Read the toggle and branch:

```tsx
import { getSettingByKey } from "@/server/settings/db";

const allowSignup = (await getSettingByKey("allow_public_signup"))?.value === "true";
```

Use `allowSignup` so the nav CTA (line 37) and the hero CTA (line 70) fall back to `/auth/login` with `t("login")` when signup is closed.

- [ ] **Step 3: Make the delivery product dropdown live**

The products list is fetched server-side once and serialized through `JSON.parse(JSON.stringify())`, so newly added products never appear. Replace `src/app/(app)/deliveries/page.tsx`:

```tsx
import { getTranslations } from "next-intl/server";
import { Header } from "@/components/layout/header";
import { DeliveriesClient } from "@/components/deliveries/ui/DeliveriesClient";

export default async function DeliveriesPage() {
  const t = await getTranslations("deliveries");

  return (
    <>
      <Header title={t("title")} />
      <div className="p-6">
        <DeliveriesClient />
      </div>
    </>
  );
}
```

In `DeliveriesClient.tsx`, remove the `products` prop and its local `Product` type, and fetch instead:

```tsx
const { data: productsData } = api.products.getAll.useQuery({ page: 1 });
const products = productsData?.data ?? [];
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit` — clean.
Manual: with `allow_public_signup` false, the landing page shows only Login and no 404 route is reachable from it; switch to Arabic and confirm no English text remains. Add a product, then open the delivery dialog without reloading — the new product is listed.

- [ ] **Step 5: Commit**

```bash
git add src/app src/components/deliveries messages
git commit -m "fix: localize landing page, gate signup CTA, live product dropdown"
```

---

## Task 23: Final verification and documentation

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Run the whole suite**

```bash
pnpm test
npx tsc --noEmit
pnpm lint
pnpm build
```

Expected: tests pass, no type errors, no new lint errors, build succeeds. Fix anything that fails before continuing.

- [ ] **Step 2: Walk the critical paths manually**

Run `pnpm dev` and confirm each:

1. Sign in as `dev` → invite a Viewer → `SELECT role FROM "user"` returns `user`, not `dev`.
2. Sign in as that Viewer → no write buttons, no `/invite` link; `/invite` redirects.
3. Create a material, add a 10t receipt, consume 4t, attempt 7t → rejected; consume all → balance 0.
4. Create a product linked to that material → appears on the material's detail page.
5. Create a 1000 EGP delivery → `unpaid`; pay 400 → `partial`; pay 600 → `paid`; delete a payment → recalculates.
6. Dashboard cards render real numbers; a card with a bad equation shows "—", not 0.
7. Switch to Arabic — no untranslated keys anywhere, layout stays RTL.

- [ ] **Step 3: Update the landmines section**

In `CLAUDE.md`, replace the "Known landmines" section with what remains true after this work. Every bullet in it has now been addressed, so it should be rewritten to describe the new invariants instead:

- `raw_material_types` / `receipts` / `consumptions`, with the balance computed and never stored; the scalar-subquery requirement; consumption entries as the only way weight leaves.
- `paymentStatus` is always derived — never accept it as input.
- The SQL/TS pairing in `deliveries/status.ts`.
- Settings are declared in `settings/registry.ts`; add a key there before using it.
- Equation tokens live in `analytics/equation-variables.ts`; adding a metric means adding a resolver and a registry entry, and old tokens are aliased.

Update the Commands section to include `pnpm test`.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md for the new raw material and money invariants"
```

---

## Self-Review Notes

**Spec coverage.** Every numbered spec section maps to tasks: §3 → 5-11, §4 → 3-4, §5 → 14-16, §6 → 17-20, §7 → 21-22, §8 → 1, 2, 5, 12, 14, §9 → 6, 16.

**Deviation from the spec, deliberate.** §5.6 states that `db.batch()` makes the delivery + items write atomic. It cannot on its own — `batch()` cannot feed one statement's result into the next, and the items need the delivery id. Task 15 Step 2 generates the id with `crypto.randomUUID()` so both inserts can share a batch. Same guarantee, different mechanism.

**Type consistency.** `getAll` procedures take `{ page }` only from Task 19 onward; Tasks 8-11 write `{ page }` from the start, so no signature churn. `products.supplierName` becomes `products.materialName` in Task 11 and is used under that name in Tasks 11 and 19. `StatCard.value` widens to `number | null` in Task 13, matching `evaluateCards`.

**Ordering constraint.** Task 19 rewrites the `getAll` input schemas that Task 20 consumes; run them in order. Tasks 3 and 4 must precede any manual testing that relies on role separation.
