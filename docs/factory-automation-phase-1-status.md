# Factory Automation — Phase 1 Final Status & Security Review

> **Reference Plan:** [`docs/superpowers/plans/2026-09-06-factory-automation-phase-1.md`](file:///c:/dev/prime-paper/docs/superpowers/plans/2026-09-06-factory-automation-phase-1.md)  
> **Status Date:** September 27, 2026  
> **Active Branch:** `feat/factory-automation-phase-1`  
> **Target Goal:** Materialize raw material consumption upon product production (`source: 'production'`) atomically using `db.batch()`, compute product weight suggestions from geometry and paper grammage (GSM), support per-material trim waste %, and guard against inventory desynchronization.

---

## 📊 Executive Summary

| Category | Status | Details |
|---|---|---|
| **Overall Progress** | **100% Completed** | All 11 Tasks implemented, verified, and documented |
| **Committed Tasks** | **Tasks 1 & 2** | Commit [`b740481`](file:///c:/dev/prime-paper) (`feat: add production math utility functions...`) |
| **Working Tree (Ready for Review)** | **Tasks 3 – 11 & Docs** | All changes implemented, typecheck clean, tests passing, production build succeeded |
| **Database Migration** | **Applied** | `0003_production_automation.sql` applied cleanly to Neon DB |
| **Tests & Typecheck** | **Passing** | 109 unit tests passing (`vitest`), `tsc --noEmit` clean (0 errors) |
| **Production Build** | **Clean** | Next.js 16 build succeeded (`pnpm build` exited with code 0) |

---

## 📋 Task-by-Task Implementation Summary

### ✅ Task 1: Pure Production Arithmetic
*All arithmetic and policy functions isolated from `@/db` to enable fast, pure unit testing.*
- **Status:** **Completed & Committed** (Commit `b740481`)
- **Files:** [`src/server/products/production.ts`](file:///c:/dev/prime-paper/src/server/products/production.ts), [`src/server/products/production.test.ts`](file:///c:/dev/prime-paper/src/server/products/production.test.ts)
- 17 unit tests passing.

### ✅ Task 2: Validation Helpers for GSM and Percent
*Zod validation schemas for paper grammage and waste percentages.*
- **Status:** **Completed & Committed** (Commit `b740481`)
- **Files:** [`src/server/shared/validation.ts`](file:///c:/dev/prime-paper/src/server/shared/validation.ts), [`src/server/shared/validation.test.ts`](file:///c:/dev/prime-paper/src/server/shared/validation.test.ts)
- `gsmSchema` (positive decimal, scale 2) and `percentSchema` (decimal 0–100, scale 2).

### ✅ Task 3: Schema Columns and Migration
*Database columns for waste %, GSM, and consumption product linking.*
- **Status:** **Completed**
- **Files:**
  - [`src/db/schema.ts`](file:///c:/dev/prime-paper/src/db/schema.ts): Added `waste_percent` on raw material types, `gsm` on products, and `product_id` + `source` on raw material consumptions.
  - [`drizzle/0003_production_automation.sql`](file:///c:/dev/prime-paper/drizzle/0003_production_automation.sql): Additive migration with foreign key and index on `product_id`.
  - [`src/scripts/apply-migration.mjs`](file:///c:/dev/prime-paper/src/scripts/apply-migration.mjs): Runner for Neon HTTP. Applied successfully to database.

### ✅ Task 4: Settings for Default Waste and Negative Stock
*Operational settings configuration for fallback waste % and inventory overdraft policy.*
- **Status:** **Completed**
- **Files:**
  - [`src/server/settings/registry.ts`](file:///c:/dev/prime-paper/src/server/settings/registry.ts): Registered `default_waste_percent` (0–50, default 5) and `allow_negative_stock` (boolean, default true).
  - [`src/server/settings/db.ts`](file:///c:/dev/prime-paper/src/server/settings/db.ts): Added `coerceBoolean` helper and exposed both in `getSettingsMap()`.
  - [`src/scripts/seed-settings.mjs`](file:///c:/dev/prime-paper/src/scripts/seed-settings.mjs): Added default rows; seed executed successfully.

### ✅ Task 5: Waste Percent through Raw-Materials Stack
*Plumbing waste percentage through types, schemas, and queries.*
- **Status:** **Completed**
- **Files:**
  - [`src/server/raw-materials/types.ts`](file:///c:/dev/prime-paper/src/server/raw-materials/types.ts): Added `wastePercent` to `CreateTypeSchema` and `RawMaterialType`.
  - [`src/server/raw-materials/types.db.ts`](file:///c:/dev/prime-paper/src/server/raw-materials/types.db.ts): Persists and selects `wastePercent` in `insertType`, `editType`, `findTypes`, `findTypeById`, and single-query `findTypeTotals`.

### ✅ Task 6: Consumption Query Builders for Product-Linked Rows
*Query builders producing unawaited queries for atomic `db.batch()` execution.*
- **Status:** **Completed**
- **Files:**
  - [`src/server/raw-materials/consumptions.db.ts`](file:///c:/dev/prime-paper/src/server/raw-materials/consumptions.db.ts): Added `ProductConsumptionInput`, `buildInsertProductConsumption` (`source: 'production'`), `buildDeleteConsumptionForProduct`, and `findConsumptionByProductId`.

### ✅ Task 7: Auto-Consumption on Product Write (Core Engine)
*Atomic creation, synchronization, and removal of linked consumption rows when products are mutated.*
- **Status:** **Completed**
- **Files:**
  - [`src/server/products/types.ts`](file:///c:/dev/prime-paper/src/server/products/types.ts): Added `gsm` to `CreateProductSchema` and `Product`.
  - [`src/server/products/db.ts`](file:///c:/dev/prime-paper/src/server/products/db.ts): Added `gsm` to `findProducts` select, and `buildInsertProduct`, `buildUpdateProduct`, `buildDeleteProduct`.
  - [`src/server/products/services.ts`](file:///c:/dev/prime-paper/src/server/products/services.ts): Implemented `syncProductConsumption`, atomic `db.batch()` across create/update/delete.
  - [`src/server/products/router.ts`](file:///c:/dev/prime-paper/src/server/products/router.ts): Passed `ctx.session.user.id` into `updateProductService`.

### ✅ Task 8: Block Manual Edits of System-Managed Consumptions
*Prevent operators from manually altering rows generated by production runs.*
- **Status:** **Completed**
- **Files:**
  - [`src/server/raw-materials/services.ts`](file:///c:/dev/prime-paper/src/server/raw-materials/services.ts): Guards `updateConsumptionService` and `deleteConsumptionService` against `isSystemManaged(existing.source)` with `TRPCError(CONFLICT)`.

### ✅ Task 9: Fix Product Weight Metric in Analytics
*Correction of metric calculation to multiply per-roll weight by quantity.*
- **Status:** **Completed**
- **Files:**
  - [`src/server/analytics/equation-variables.ts`](file:///c:/dev/prime-paper/src/server/analytics/equation-variables.ts): Resolver updated to `COALESCE(SUM(${products.weightKg} * ${products.quantity}), 0)`.

### ✅ Task 10: Product Form UI — GSM Input & Computed Weight Assist
*Client-side form assistance suggesting roll weight based on geometry and GSM.*
- **Status:** **Completed**
- **Files:**
  - [`messages/en.json`](file:///c:/dev/prime-paper/messages/en.json) & [`messages/ar.json`](file:///c:/dev/prime-paper/messages/ar.json): Added `gsm`, `computedWeight`, `useComputed`, `computedWeightHint`.
  - [`src/components/products/ui/ProductsClient.tsx`](file:///c:/dev/prime-paper/src/components/products/ui/ProductsClient.tsx): Controlled inputs for length, width, GSM, and weight; real-time `computeWeightKg` calculation with "Use computed" assist; payload includes `gsm`. Clean event-handler based state prefilling without cascading render effects.

### ✅ Task 11: Raw Material Form UI — Waste % & Negative Balance Warning
*Client-side fields for material waste % and visual alert for overdrafted stock.*
- **Status:** **Completed**
- **Files:**
  - [`messages/en.json`](file:///c:/dev/prime-paper/messages/en.json) & [`messages/ar.json`](file:///c:/dev/prime-paper/messages/ar.json): Added `wastePercent`, `wastePercentHint`, `negativeBalance`.
  - [`src/components/raw-materials/ui/RawMaterialTypesClient.tsx`](file:///c:/dev/prime-paper/src/components/raw-materials/ui/RawMaterialTypesClient.tsx): Waste % input field added; negative balance formatted in red with tooltip warning.

### ✅ Invariants & Documentation
- **Status:** **Completed**
- **Files:**
  - [`AGENTS.md`](file:///c:/dev/prime-paper/AGENTS.md): Updated invariants to document automated production consumption and `db.batch()` transactional semantics.

---

## 🔒 Security Review Findings

1. **Authorization & RBAC**:
   - All write endpoints (`create`, `update`, `delete` for products, materials, settings) use `writerProcedure`, ensuring only authenticated users with `dev` or `admin` roles can mutate data.
   - Read operations use `protectedProcedure`.
2. **Data Tampering & Inventory Desynchronization Protection**:
   - `isSystemManaged(existing.source)` in `raw-materials/services.ts` prevents operators from manually editing or deleting production-sourced consumptions.
   - Any weight/quantity adjustments must be made on the product itself, ensuring product records and raw material stock stay in sync.
3. **Atomic Operations (`db.batch`)**:
   - Because `neon-http` does not support interactive transactions, multi-row mutations (e.g. insert product + insert consumption, or update product + delete old consumption + insert new consumption) are executed atomically in one HTTP transaction using `db.batch([...])`. This prevents orphan products without consumptions or partial state failure.
4. **Input Validation & Bound Checking**:
   - `percentSchema`: strictly validates 0–100, scale 2, rejecting negatives or non-numbers.
   - `gsmSchema`: strictly validates positive decimal, scale 2.
   - `default_waste_percent`: enforced min 0, max 50.
   - `allow_negative_stock`: validated against literal `"true"` | `"false"`.
   - Settings coercion: `coerce` and `coerceBoolean` degrade corrupted/unexpected database values to safe schema defaults.
   - Safe SQL execution: Drizzle parameterized queries and template tags protect against SQL injection.
