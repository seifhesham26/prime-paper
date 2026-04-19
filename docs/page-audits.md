# Page Audit: Landing Page (`/`)

**File:** `src/app/page.tsx` (138 lines)  
**Type:** Server Component  
**Auth:** Public (no login required)

---

## Hardcoded Strings (Not i18n)

| Line | String | Should Be |
|---|---|---|
| 76 | `"Access Management Portal"` | `t("accessPortal")` |
| 82 | `"Enterprise Secure"` | `t("trustBadge1")` |
| 83 | `"Multi-lingual Support"` | `t("trustBadge2")` |
| 84 | `"Inventory Optimized"` | `t("trustBadge3")` |
| 116 | `"Production Yield"` | `t("productionYield")` |
| 117 | `"+94%"` | Should be dynamic data or `t("yieldValue")` |
| 127 | `"© 2026 Prime Paper Company. Professional Factory Management."` | `t("copyright")` |
| 129 | `"Privacy"` | `t("privacy")` |
| 130 | `"Terms"` | `t("terms")` |
| 131 | `"Contact Support"` | `t("contactSupport")` |

## Hardcoded Numbers

| Line | Value | Context |
|---|---|---|
| 117 | `+94%` | Fake production yield statistic — purely decorative |

## Security Issues
- ✅ Session check is done correctly (`auth.api.getSession`)
- ✅ Page is intentionally public

## UX Issues
- Footer links all point to `#` — dead links
- Hero visual (lines 90-120) is a placeholder made of gray skeleton rectangles
- No real content or screenshots — just CSS shapes

## i18n Coverage
- `t("title")`, `t("description")`, `t("getStarted")`, `t("viewDashboard")`, `t("heroTagline")` are properly translated
- Everything else is hardcoded English

---

# Page Audit: Dashboard (`/dashboard`)

**Files:** `src/app/(app)/dashboard/page.tsx` (17 lines), `src/components/analytics/ui/AnalyticsClient.tsx` (221 lines), `src/components/analytics/ui/StatCard.tsx` (41 lines)  
**Type:** Server Page + Client Component  
**Auth:** Protected by middleware (cookie check)

---

## Hardcoded Strings (Not i18n)

| File | Line | String |
|---|---|---|
| `AnalyticsClient.tsx` | 58 | `"إجمالي المواد الخام"` — Arabic hardcoded, breaks English mode |
| `AnalyticsClient.tsx` | 60 | `"طن"` — Should be `t("tons")` |
| `AnalyticsClient.tsx` | 65 | `"إجمالي المنتجات"` |
| `AnalyticsClient.tsx` | 67 | `"لفة"` — Should be `t("rolls")` |
| `AnalyticsClient.tsx` | 72 | `"مبيعات الشهر"` |
| `AnalyticsClient.tsx` | 74 | `"ج.م"` — Should be `t("egp")` |
| `AnalyticsClient.tsx` | 79 | `"المدفوعات المعلقة"` |
| `AnalyticsClient.tsx` | 81 | `"ج.م"` |

> **Note:** The `t()` function IS imported and used elsewhere in the file. The StatCard props just bypass i18n entirely.

## Hardcoded Numbers

| File | Line | Value | Context |
|---|---|---|---|
| `services.ts` | 48 | `5` | Months lookback (sixMonthsAgo calculation) |
| `services.ts` | 75 | `6` | Chart month range |
| `services.ts` | 121 | `5` | Max top unpaid companies |
| `services.ts` | 134 | `5` | Recent deliveries limit |

## Security Issues
- ⚠️ **tRPC endpoint `analytics.getDashboardStats` is `publicProcedure`** — all financial data accessible without auth
- ✅ Page-level protection via middleware
- ⚠️ `paymentStatus` badge displays raw value (line 200) without translating. It should use `t(delivery.paymentStatus)`.

## i18n Coverage
- Table headers, section titles, and tooltips use `t()` correctly ✅
- StatCard titles/units are hardcoded Arabic ❌

---

# Page Audit: Companies (`/companies`)

**Files:** `src/app/(app)/companies/page.tsx` (17 lines), `src/components/companies/ui/CompaniesClient.tsx` (264 lines)  
**Type:** Server Page + Client Component  
**Auth:** Protected by middleware

---

## Hardcoded Strings

| File | Line | String |
|---|---|---|
| `CompaniesClient.tsx` | 204 | `"Add your first company to get started."` |

## Hardcoded Numbers

| File | Line | Value | Context |
|---|---|---|---|
| `CompaniesClient.tsx` | 40 | `limit: 100` | Max companies fetched — silently drops data beyond 100 |

## Security Issues
- ⚠️ **All CRUD endpoints (`companies.*`) are `publicProcedure`** — no auth
- ⚠️ `confirm()` for delete — weak confirmation mechanism
- ⚠️ No server-side validation that the user has permission for the operation

## i18n Coverage
- All field labels, table headers, buttons use `t()` ✅
- Empty state subtitle is hardcoded English ❌

---

# Page Audit: Deliveries (`/deliveries`)

**Files:** `src/app/(app)/deliveries/page.tsx` (21 lines), `src/components/deliveries/ui/DeliveriesClient.tsx` (379 lines)  
**Type:** Server Page + Client Component  
**Auth:** Protected by middleware

---

## Hardcoded Strings

| File | Line | String |
|---|---|---|
| `DeliveriesClient.tsx` | 280 | `"No products added to this delivery yet."` |
| `DeliveriesClient.tsx` | 316 | `"Create your first delivery to get started."` |
| `DeliveriesClient.tsx` | 343 | `"EGP"` — currency unit hardcoded |

## Hardcoded Numbers

| File | Line | Value | Context |
|---|---|---|---|
| `DeliveriesClient.tsx` | 68 | `limit: 100` | Max deliveries |
| `DeliveriesClient.tsx` | 69 | `limit: 1000` | Max companies in dropdown |
| `deliveries/page.tsx` | 8 | `1000` | Products service call limit |

## Hardcoded Locale

| File | Line | Value |
|---|---|---|
| `DeliveriesClient.tsx` | 337 | `"ar-EG"` — date always formatted as Arabic |

## Security Issues
- ⚠️ All delivery CRUD endpoints are `publicProcedure`
- ⚠️ `confirm()` for delete
- ⚠️ Product list passed as server-side prop using `JSON.parse(JSON.stringify(...))` — data serialization hack

## i18n Coverage
- All labels and headers are translated ✅
- Empty states, currency label, and date locale are hardcoded ❌

---

# Page Audit: Delivery Detail (`/deliveries/[id]`)

**Files:** `src/app/(app)/deliveries/[id]/page.tsx` (22 lines), `src/components/deliveries/ui/DeliveryDetailClient.tsx` (305 lines)  
**Type:** Server Page + Client Component  
**Auth:** Protected by middleware

---

## Hardcoded Strings

| File | Line | String |
|---|---|---|
| `DeliveryDetailClient.tsx` | 73 | `"Delivery not found"` |
| `DeliveryDetailClient.tsx` | 75 | `"Back to Deliveries"` |
| `DeliveryDetailClient.tsx` | 128 | `"EGP"` |
| `DeliveryDetailClient.tsx` | 140 | `"EGP"` |
| `DeliveryDetailClient.tsx` | 157 | `"EGP"` |
| `DeliveryDetailClient.tsx` | 175 | `"لا توجد عناصر"` — hardcoded Arabic |
| `DeliveryDetailClient.tsx` | 273 | `"لا توجد مدفوعات"` — hardcoded Arabic |
| `DeliveryDetailClient.tsx` | 291 | `"EGP"` |

## Hardcoded Locale

| Line | Value |
|---|---|
| 288 | `"ar-EG"` — date always Arabic |

## Security Issues
- ⚠️ `getById` and `addPayment` endpoints are `publicProcedure`
- ⚠️ No validation that `deliveryId` params is a valid UUID before passing to tRPC
- ✅ Null-safe check on delivery (`if (!delivery)`)

## i18n Coverage
- Card titles and table headers use `t()` ✅
- Error states, empty states, currency — all hardcoded ❌

---

# Page Audit: Products (`/products`)

**Files:** `src/app/(app)/products/page.tsx` (22 lines), `src/components/products/ui/ProductsClient.tsx` (348 lines)  
**Type:** Server Page + Client Component  
**Auth:** Protected by middleware

---

## Hardcoded Strings

| File | Line | String |
|---|---|---|
| `ProductsClient.tsx` | 175 | `"طن"` — hardcoded Arabic unit (Tons) |
| `ProductsClient.tsx` | 280 | `"Add your first product to inventory."` |
| `ProductsClient.tsx` | 312 | `"kg"` — unit hardcoded |

## Hardcoded Numbers

| File | Line | Value | Context |
|---|---|---|---|
| `ProductsClient.tsx` | 58 | `limit: 100` | Max products |

## Hardcoded Locale

| Line | Value |
|---|---|
| 175 | `"ar-EG"` — raw material dropdown date |
| 302 | `"ar-EG"` — table date column |

## Security Issues
- ⚠️ All CRUD endpoints are `publicProcedure`
- ⚠️ Raw materials passed as server-side prop via page.tsx

---

# Page Audit: Raw Materials (`/raw-materials`)

**Files:** `src/app/(app)/raw-materials/page.tsx` (17 lines), `src/components/raw-materials/ui/RawMaterialsClient.tsx` (295 lines)  
**Type:** Server Page + Client Component  
**Auth:** Protected by middleware

---

## Hardcoded Strings

| File | Line | String |
|---|---|---|
| `RawMaterialsClient.tsx` | 221 | `"Add your first incoming raw material shipment."` |
| `RawMaterialsClient.tsx` | 251 | `"Tons"` — English unit |
| `RawMaterialsClient.tsx` | 254 | `"EGP"` |
| `RawMaterialsClient.tsx` | 258 | `"EGP"` |

## Hardcoded Numbers

| File | Line | Value | Context |
|---|---|---|---|
| `RawMaterialsClient.tsx` | 39 | `limit: 100` | Max materials |

## Hardcoded Locale

| Line | Value |
|---|---|
| 247 | `"ar-EG"` — always Arabic |

## Security Issues
- ⚠️ All CRUD endpoints are `publicProcedure`
- ⚠️ `confirm()` for delete

---

# Page Audit: Settings (`/settings`)

**Files:** `src/app/(app)/settings/page.tsx` (84 lines), `src/components/settings/ui/user-settings-client.tsx` (158 lines), `src/components/settings/ui/LanguageSettingsClient.tsx`  
**Type:** Client Components  
**Auth:** Protected by middleware

---

## Hardcoded Strings

| File | Line | String |
|---|---|---|
| `settings/page.tsx` | 44 | `"System & Language"` — tab label |
| `settings/page.tsx` | 64 | `"System Language"` |
| `settings/page.tsx` | 65 | `"Select your preferred language for the interface."` |
| `user-settings-client.tsx` | 65 | `"Unable to load user profile."` |

## Hardcoded Numbers

| File | Line | Value | Context |
|---|---|---|---|
| `settings/page.tsx` | 23 | `31536000` | Cookie max-age (1 year in seconds) |
| `user-settings-client.tsx` | 130 | `8` | Minimum password length |

## Security Issues
- ✅ Password change uses Better Auth client API
- ✅ `revokeOtherSessions: false` is explicit
- ⚠️ No password complexity requirements beyond min length 8
- ⚠️ Language toggle uses `document.cookie` directly — no httpOnly flag

---

# Page Audit: Invite / Admin Portal (`/invite`)

**Files:** `src/app/(app)/invite/page.tsx` (25 lines), `src/app/(app)/invite/client.tsx` (245 lines)  
**Type:** Server Page + Client Component  
**Auth:** Server-side `session.user.role === "dev"` check

---

## Hardcoded Strings

| File | Line | String |
|---|---|---|
| `client.tsx` | 60 | `"Create User"` — tab label |
| `client.tsx` | 61 | `"Password Resets"` — tab label |
| `client.tsx` | 179 | `"Password must be 8+ chars"` |
| `client.tsx` | 200 | `"Failed to reset password: "` |
| `client.tsx` | 212 | `"No pending password resets."` |
| `client.tsx` | 230 | `"New Password"` — placeholder |
| `client.tsx` | 236 | `"Resolve"` — button text |

## Hardcoded Numbers

| File | Line | Value | Context |
|---|---|---|---|
| `client.tsx` | 179 | `8` | Min password length |
| `client.tsx` | 184 | `1000` | listUsers query limit |

## Security Issues
- ✅ Page has server-side role check (`role === "dev"`)
- ⚠️ `admin` role users blocked from page — inconsistent with documented intent
- ⚠️ `type="text"` for password input — visible on screen (line 229)
- ⚠️ All users fetched client-side to find one by email (line 184)
- ⚠️ `alert()` for error display — unprofessional, no i18n

---

# Page Audit: Login (`/auth/login`)

**File:** `src/app/auth/login/page.tsx` (119 lines)  
**Type:** Client Component  
**Auth:** Public

---

## Hardcoded Strings

| Line | String |
|---|---|
| 57 | `"Prime Paper \| برايم بيبر"` — card title |
| 60 | `"Paper Factory Management System"` |
| 73 | `"admin@primepaper.com"` — placeholder |
| 85 | `"••••••••"` — placeholder |

## Security Issues
- ⚠️ **Login redirects to `/` instead of `/dashboard`** (line 39)
- ⚠️ No rate limiting on login attempts
- ✅ Passwords use `dir="ltr"` to prevent RTL rendering issues

---

# Page Audit: Signup (`/auth/signup`)

**File:** `src/app/auth/signup/page.tsx` (135 lines)  
**Type:** Client Component  
**Auth:** Public

---

## Hardcoded Strings

| Line | String |
|---|---|
| 64 | `"Prime Paper Factory Management"` |
| 77 | `"John Doe"` — placeholder |
| 88 | `"admin@primepaper.com"` — placeholder |
| 100 | `"••••••••"` — placeholder |

## Hardcoded Numbers

| Line | Value | Context |
|---|---|---|
| 103 | `8` | Minimum password length |

## Security Issues
- 🔴 **All new signups get `dev` role** (from auth.ts hook)
- ⚠️ No rate limiting
- ⚠️ No CAPTCHA or bot protection

---

# Page Audit: Forgot Password (`/auth/forgot-password`)

**File:** `src/app/auth/forgot-password/page.tsx` (115 lines)  
**Type:** Client Component  
**Auth:** Public

---

## Hardcoded Strings

| Line | String |
|---|---|
| 71 | `"admin@primepaper.com"` — placeholder |

## Missing Translation Keys
The component references 4 translation keys that **don't exist** in any locale file:
- `auth.forgotPasswordTitle` (line 54)
- `auth.forgotPasswordDesc` (line 57)
- `auth.sendResetLink` (line 85)
- `auth.checkEmail` (line 102)

## Security Issues
- ⚠️ `requestReset` tRPC endpoint is `publicProcedure` — intentional, but no rate limiting
- ⚠️ No feedback about whether the email exists — good for security but confusing UX

---

# Page Audit: Sidebar & Header (Layout)

**Files:** `src/components/layout/app-sidebar.tsx` (128 lines), `src/components/layout/header.tsx` (38 lines)  
**Type:** Client Components

---

## Hardcoded Strings — Sidebar

| Line | String |
|---|---|
| 55 | `"برايم بيبر"` / `"Prime Paper"` — manual locale check instead of `t()` |
| 58 | `"إدارة المصنع"` / `"Factory Manager"` — manual locale check |
| 93 | `"دعوة مستخدم"` / `"Invite User"` — manual locale check |

## Hardcoded Numbers — Header

| Line | Value | Context |
|---|---|---|
| 15 | `31536000` | Cookie max-age |

## Security Issues
- ⚠️ Invite link visibility check only for `dev` role, not `admin`
- ✅ Sidebar uses `useSession()` for role-based visibility
- ✅ Logout correctly calls `signOut()` with redirect
