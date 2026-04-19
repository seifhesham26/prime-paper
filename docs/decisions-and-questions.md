# Decisions & Open Questions

> This document captures all design decisions confirmed by the owner and remaining open questions before implementation begins.

---

## Part 1: Confirmed Decisions (Owner's Answers)

### D1. Role System Simplification

**Question:** The app has 4 roles (`dev`, `admin`, `viewer`, `user`). `viewer` has no enforcement and `user` is Better Auth's default that's never used. How should roles work?

**Answer:** 
- **Remove the `viewer` role entirely.** Merge it into `user` — the `user` role IS the viewer.
- **Final role structure:**
  - `dev` → God mode. Full CRUD + invite + settings. Reserved for the owner.
  - `admin` → Full CRUD + invite + settings. Created via invite.
  - `user` → **View only.** Can see all data pages but cannot add, edit, or delete anything. This replaces `viewer`.

**Impact:**
- Remove `viewer` from the invite dropdown → replace with `user`
- Add `user` role enforcement: hide all Add/Edit/Delete buttons and disable mutations
- Sidebar "Invite User" should be visible to both `dev` AND `admin`
- Invite page server check should allow both `dev` and `admin`

---

### D2. Signup Page & Dev Role Default

**Question:** Every signup gets `dev` role — this is a critical security issue. Should we fix it?

**Answer:** 
- **This is intentional for deployment.** The workflow is: deploy → create owner account via signup → remove the signup page entirely.
- The signup page is a **temporary bootstrapping tool**, not a permanent feature.

**Implementation:**
- Keep the `dev` role hook as-is for now
- Add a clear comment in `auth.ts` explaining the intent
- Consider: Add an env variable flag (`ALLOW_SIGNUP=true/false`) to toggle signup page availability instead of deleting the file manually

**Open sub-question:** → See Q1 below

---

### D3. Landing Page Purpose

**Question:** The landing page has placeholder visuals, dead footer links, and hardcoded English. Should we invest in polishing it?

**Answer:**
- **The landing page is NOT important.** It only exists because having the login page as the root URL felt wrong.
- Don't invest time in polishing the hero section, footer links, or trust badges.
- It's a simple redirect gateway — not a marketing page.

**Implementation:**
- Leave the landing page as-is (low priority)
- Focus effort on the actual app pages instead
- Still fix any i18n issues on it since those are quick wins

---

### D4. Configurable Dashboard & Equations

**Question:** Dashboard stats are hardcoded calculations in `analytics/services.ts`. Should they stay fixed?

**Answer:**
- **Everything should be configurable.** All math, all equations, all dashboard cards.
- The owner wants to be able to **create new dashboard cards from the website itself.**
- Equations should use **fixed selectable options** (e.g., pick "Raw Material Cost", "Delivery Revenue", etc.) and build formulas from available data fields.

**This is a major feature — see detailed questions in Part 2.**

---

### D5. Known Gaps & Fixes

**Question:** Should we fix all the hardcoded strings, missing translations, locale issues, and security gaps?

**Answer:** **Yes, fix everything.** Specifically:
- All hardcoded English/Arabic strings → move to i18n
- Missing forgot-password translations → add them
- Login redirect → change to `/dashboard`
- Hardcoded `"ar-EG"` date locales → use dynamic locale
- Hardcoded `"EGP"` → use translation key
- Hardcoded magic numbers (limits, etc.) → make configurable
- tRPC security → add `protectedProcedure` with auth checks
- Empty `reset-password` directory → clean up

---

## Part 2: Open Questions (Need Owner Input)

### Q1. Signup Page Toggle Mechanism

The signup page currently always exists. After you create your account, you said you remove it. What approach do you prefer?

**Option A:** Add an environment variable `ALLOW_SIGNUP=true`. Set to `false` after creating your account. The signup page checks this and shows a 404 or redirect if disabled.

**Option B:** Add a database flag in `system_settings`. An admin can toggle "Allow Public Registration" from the Settings UI.

**Option C:** Keep it manual — just delete/comment out the signup route when done.

> ✅ **DECIDED: Option B** — but lowest priority. Since this is a family business app, it's not urgent. Will be built as part of the `system_settings` feature later.

---

### Q2. Configurable Dashboard — Scope & Complexity

You want dashboard cards and equations to be configurable from the UI. This is a significant feature. Let me break it down:

#### Q2a. What data sources should be available for card equations?

Here's what I can expose as selectable variables. Which do you want?

| Variable Name | Source | Example Value |
|---|---|---|
| `total_raw_materials_weight` | SUM of `raw_materials.weight_tons` | 150.5 |
| `total_raw_materials_cost` | SUM of `raw_materials.cost_egp` | 500,000 |
| `total_products_quantity` | SUM of `products.quantity` | 3,200 |
| `total_products_weight` | SUM of `products.weight_kg` | 12,500 |
| `total_deliveries_revenue` | SUM of `deliveries.selling_price_egp` | 800,000 |
| `total_deliveries_this_month` | SUM of deliveries in current month | 120,000 |
| `total_payments_collected` | SUM of `payments.amount_egp` | 650,000 |
| `total_outstanding` | Revenue − Payments | 150,000 |
| `total_unpaid_deliveries` | SUM where status = 'unpaid' | 80,000 |
| `total_partial_deliveries` | SUM where status = 'partial' | 70,000 |
| `avg_cost_per_ton` | AVG of `raw_materials.cost_per_ton` | 3,300 |
| `total_companies` | COUNT of companies | 25 |
| `total_deliveries_count` | COUNT of deliveries | 180 |

> ✅ **DECIDED: All of the above.** Plus investigate any additional aggregate options from the schema (e.g., scrap weight, yield percentage if those fields get added later).

#### Q2b. What operations should be available?

For building equations, I'm proposing these operators:

- **Math:** `+`, `-`, `×`, `÷`
- **Functions:** `SUM`, `AVG`, `COUNT`, `MIN`, `MAX`
- **Constants:** user-entered fixed numbers (e.g., tax rate = 0.14)
- **Filters:** by date range (this month, last 6 months, all time)

**Example card configurations:**
```
Card: "Profit Margin"
Equation: (total_deliveries_revenue - total_raw_materials_cost) / total_deliveries_revenue × 100
Unit: "%"
Color: emerald
```

```
Card: "Average Delivery Value"
Equation: total_deliveries_revenue / total_deliveries_count
Unit: "EGP"
Color: blue
```

> ✅ **DECIDED: Yes**, these operators are sufficient.

#### Q2c. How should the card builder UI work?

**Option A — Simple:** Dropdown to select a pre-built metric (from a fixed list of ~15 options). Admins can toggle which ones are visible on the dashboard and reorder them.

**Option B — Advanced:** Full equation builder. Pick variables from dropdowns, combine with operators, preview the result, set color/icon/unit. Stored as JSON in `system_settings`.

**Option C — Hybrid:** Start with Option A (pre-built metrics with toggle), add Option B later.

> ✅ **DECIDED: Option B (Full builder) with pre-built packages.** Ship with the current dashboard cards as pre-configured defaults that users can edit. Also allow creating entirely new cards. This means the current hardcoded stats become editable "template" cards.

---

### Q3. Configurable Magic Numbers

These numbers are currently hardcoded. Which should be configurable from the Settings UI?

| Current Value | Where Used | Make Configurable? |
|---|---|---|
| `100` | Default page size for CRUD lists | ❓ |
| `1000` | Dropdown list limits | ❓ |
| `5` | Recent deliveries on dashboard | ❓ |
| `5` | Top unpaid companies count | ❓ |
| `6` | Months shown in chart | ❓ |
| `8` | Minimum password length | ❓ |
| `31536000` | Cookie max-age (1 year) | ❓ |
| `"EGP"` | Currency symbol | ❓ |

> ✅ **DECIDED: Make ALL configurable EXCEPT:**
> - Cookie max-age (keep as code constant)
> - Currency symbol (keep as "EGP" — single-currency app)
> - Minimum password length (keep as code constant at 8)

---

### Q4. System Settings — Database Table

To support configurable cards, magic numbers, and toggles, we need the `system_settings` table from the v2.0 roadmap. Should I build it now as prerequisite?

**Proposed schema:**
```sql
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  category TEXT NOT NULL, -- 'dashboard', 'financial', 'operational', 'ui'
  metadata JSONB, -- description, type, default value
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**Initial seed values:**
```
currency_symbol = "EGP"
dashboard_recent_deliveries_limit = 5
dashboard_top_unpaid_limit = 5
dashboard_chart_months = 6
page_size_default = 100
min_password_length = 8
allow_public_signup = true
```

> ✅ **DECIDED: Yes, build it.** But the owner asked me to evaluate alternatives first. See the implementation plan for the chosen schema design.

---

### Q5. tRPC Auth — Role-Based Procedure Levels

For securing tRPC, I'll create multiple procedure levels:

```typescript
publicProcedure    → No auth (forgot-password only)
protectedProcedure → Any authenticated user (read operations)
writerProcedure    → dev + admin only (create/update/delete)
adminProcedure     → dev + admin only (invite, settings, resets)
```

**Does this mapping look right?**

| Endpoint | `user` (viewer) | `admin` | `dev` |
|---|---|---|---|
| `*.getAll` / `*.getById` | ✅ Read | ✅ Read | ✅ Read |
| `*.create` | ❌ Blocked | ✅ Create | ✅ Create |
| `*.update` | ❌ Blocked | ✅ Update | ✅ Update |
| `*.delete` | ❌ Blocked | ✅ Delete | ✅ Delete |
| `analytics.getDashboardStats` | ✅ Read | ✅ Read | ✅ Read |
| `users.requestReset` | ✅ Public | ✅ Public | ✅ Public |
| `users.getPendingResets` | ❌ Blocked | ✅ Admin | ✅ Admin |
| `users.resolveReset` | ❌ Blocked | ✅ Admin | ✅ Admin |
| `systemSettings.*` | ❌ Blocked | ✅ Admin | ✅ Admin |

> ✅ **DECIDED: Mostly correct.** One clarification:
> - `publicProcedure` scope = landing page, sign in, forget password ONLY (no other endpoints)
> - `user` role can **see everything** but **cannot edit or interact** with anything
> - The matrix above is approved as-is

---

### Q6. Viewer UI — Hide vs Disable

When a `user` (viewer) role visits a CRUD page, should we:

**Option A — Hide:** Don't render Add/Edit/Delete buttons at all. Clean read-only view.

**Option B — Disable:** Show buttons but grayed out with a tooltip like "You don't have permission."

> ✅ **DECIDED: Option A (Hide).** Don't render any write-action buttons for `user` role.

---

### Q7. Priority Order

Given everything above, I'd propose this execution order:

1. **Phase 1 — Security:** `protectedProcedure`, role enforcement, login redirect fix
2. **Phase 2 — i18n sweep:** Fix ALL hardcoded strings, missing translations, dynamic locales
3. **Phase 3 — Role simplification:** Remove `viewer`, enforce `user` as view-only, update invite page
4. **Phase 4 — System Settings:** DB table, tRPC router, Settings UI
5. **Phase 5 — Configurable Dashboard:** Pre-built metric cards with toggles
6. **Phase 6 — Equation Builder:** Advanced custom card formulas (if desired)
7. **Phase 7 — Cleanup:** Empty dirs, dead code, error boundaries

> ✅ **DECIDED: Approved as-is.**

---

## Summary of What I Need From You

| # | Question | Quick Answer Needed |
|---|---|---|
| Q1 | Signup toggle: env var, DB flag, or manual? | Pick A, B, or C |
| Q2a | Which data variables for dashboard cards? | All of them, or specific ones? |
| Q2b | Equation operators — is +, −, ×, ÷, SUM, AVG enough? | Yes/No + additions |
| Q2c | Card builder: Simple toggles, full builder, or hybrid? | Pick A, B, or C |
| Q3 | Which magic numbers to make configurable? | Check the table |
| Q4 | Build `system_settings` table now? | Yes/No |
| Q5 | Role → endpoint permission matrix correct? | Yes/No + changes |
| Q6 | Viewer sees hidden buttons or disabled buttons? | Pick A or B |
| Q7 | Priority order OK? | Yes/No + reorder |
