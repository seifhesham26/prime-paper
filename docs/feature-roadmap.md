# Feature Roadmap — Prioritized Proposals

> Compiled from all conversation discussions and the existing `v2.0-roadmap.md`. These are features that were discussed or proposed but **never implemented**.

---

## Priority 1: Quick Wins (Low Effort, High Impact)

These can be done in a single session:

### 🔧 Fix Forgot Password Translations
Add missing `auth.forgotPasswordTitle`, `auth.forgotPasswordDesc`, `auth.sendResetLink`, `auth.checkEmail` keys to `en.json` and `ar.json`.

### 🔧 Fix Login Redirect
Change `window.location.href = "/"` to `"/dashboard"` in login page.

### 🔧 Localize Landing Page
Move all hardcoded English strings on the landing page and settings page into the `next-intl` translation files.

### 🔧 Fix Footer Links
Either create Privacy/Terms/Contact pages or remove the dead `#` links.

### 🔧 Clean Up Empty Directories
Delete `src/app/auth/reset-password/` (empty, unused).

---

## Priority 2: PDF Export (Medium Effort, High Impact)

**Originally planned in Session 1, never built.**

### Delivery Receipt PDF
- Install `@react-pdf/renderer`
- Create `src/lib/pdf/delivery-receipt.tsx` — bilingual PDF template
- Create `src/app/api/pdf/[id]/route.ts` — generation endpoint
- Add "Download PDF" / "Print" button on delivery detail page

### Statement of Account PDF
- Generate per-company financial statements
- List all deliveries, payments, and outstanding balance
- Usable as a WhatsApp-ready invoice reminder

---

## Priority 3: Inventory Intelligence (High Effort, High Impact)

**Proposed in conversation as "Phase 1" — no user decision recorded.**

### Smart Warehouse Dashboard
A new view calculating real-time inventory levels:
- **Current Raw Material Stock:** `Total Weight Received` − `Total Weight Used in Products`
- **Product Availability:** Track which products are still in warehouse vs. delivered

### DB Changes Required
```sql
ALTER TABLE products ADD COLUMN status TEXT DEFAULT 'in_warehouse'; -- 'in_warehouse' | 'delivered'
ALTER TABLE raw_materials ADD COLUMN scrap_weight DECIMAL(10,3) DEFAULT 0;
```

### Supplier Yield Analysis
Auto-calculate efficiency per supplier:
```
Yield % = (Total Product Weight from Supplier) / (Total Raw Material Weight from Supplier) × 100
```

---

## Priority 4: Financial Ledger (High Effort, Very High Impact)

**Proposed in conversation as "Phase 2" — no user decision recorded.**

### Client Statement of Account
- Dedicated per-company page showing: total lifetime value, total paid, outstanding debt
- Timeline view of all deliveries and payments for that company

### Profitability Engine
- Auto-calculate per-delivery profit: `selling_price_egp - raw_material_cost_allocation`
- Dashboard widget showing overall profit margin trends

### Expenses Tracking
New `expenses` table for factory overhead:
```sql
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'electricity', 'maintenance', 'wages', 'transport', etc.
  amount_egp DECIMAL(12,2) NOT NULL,
  date TIMESTAMP NOT NULL,
  notes TEXT,
  created_by TEXT REFERENCES "user"(id),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Priority 5: Global System Configuration (Medium Effort, Medium Impact)

**Documented in `v2.0-roadmap.md` and discussed in conversations.**

### `system_settings` Table
```sql
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  metadata JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### tRPC Router
- `api.systemSettings.getAll` — fetch all config
- `api.systemSettings.update` — update specific keys

### Settings UI Expansion
Add new tabs to `/settings`:
- **Application Preferences:** Default locale, UI theme
- **Financial Settings:** Currency symbol (EGP/USD), default tax/VAT rate
- **Operational Limits:** Max unpaid balance warning threshold, pagination limits

---

## Priority 6: Mobile / Worker Dashboard (High Effort, Long-Term)

**Proposed in conversation as "Phase 4".**

### Warehouse Worker View
- Simplified, mobile-optimized interface
- Role-restricted: workers see inventory only, no financial data
- Quick-entry form for registering newly cut rolls
- Tablet-friendly large buttons and touch targets

### Role Enhancements
| Role | Dashboard | CRUD | Financial Data | Settings |
|---|---|---|---|---|
| `dev` | ✅ | ✅ | ✅ | ✅ |
| `admin` | ✅ | ✅ | ✅ | ✅ |
| `viewer` | ✅ (read-only) | ❌ | ✅ (read-only) | ❌ |
| `worker` (new) | Inventory only | Products only | ❌ | ❌ |

---

## Decision Needed

> [!IMPORTANT]
> In the last conversation, you were asked which phase to prioritize. No decision was recorded. The question was:
> 
> - **Track who owes money?** → Go with Priority 4 (Financial Ledger)
> - **Track warehouse inventory?** → Go with Priority 3 (Inventory Intelligence)
> - **Just want quick polish?** → Go with Priority 1 (Quick Wins) + Priority 2 (PDF Export)
