# Security Audit Report

> **Date:** April 18, 2026  
> **Scope:** Full codebase security review — authentication, authorization, API endpoints, hardcoded data, input validation

---

## 🔴 CRITICAL: All tRPC Endpoints Are Publicly Accessible

**This is the #1 security vulnerability in the entire application.**

Every single tRPC router uses `publicProcedure` — meaning **anyone who knows the API URL can read, create, edit, and delete ALL business data without authentication.**

### What This Means
The middleware (`middleware.ts`) protects the **UI pages** (browser redirects to login), but the **API endpoints themselves** are wide open. An attacker only needs to call:

```
POST /api/trpc/companies.getAll
POST /api/trpc/deliveries.delete
POST /api/trpc/rawMaterials.create
```

...without any session cookie, and it will **succeed**.

### Affected Endpoints (ALL of them)

| Router | Endpoint | Operation | Auth? |
|---|---|---|---|
| `analytics` | `getDashboardStats` | Read all financial data | ❌ None |
| `companies` | `getAll` | Read all companies | ❌ None |
| `companies` | `create` | Create company | ❌ None |
| `companies` | `update` | Edit company | ❌ None |
| `companies` | `delete` | Delete company | ❌ None |
| `deliveries` | `getAll` | Read all deliveries | ❌ None |
| `deliveries` | `getById` | Read delivery detail | ❌ None |
| `deliveries` | `create` | Create delivery | ❌ None |
| `deliveries` | `delete` | Delete delivery | ❌ None |
| `deliveries` | `addPayment` | Add payment | ❌ None |
| `products` | `getAll` | Read all products | ❌ None |
| `products` | `create` | Create product | ❌ None |
| `products` | `update` | Edit product | ❌ None |
| `products` | `delete` | Delete product | ❌ None |
| `rawMaterials` | `getAll` | Read all materials | ❌ None |
| `rawMaterials` | `create` | Create material | ❌ None |
| `rawMaterials` | `update` | Edit material | ❌ None |
| `rawMaterials` | `delete` | Delete material | ❌ None |
| `users` | `requestReset` | Create reset ticket | ❌ None (intentional) |
| `users` | `getPendingResets` | Read reset tickets | ⚠️ Manual check |
| `users` | `resolveReset` | Resolve ticket | ⚠️ Manual check |

### Root Cause
**File:** `src/server/trpc.ts` (line 26)

Only `publicProcedure` is exported. No `protectedProcedure` or `adminProcedure` exists.

### Required Fix
Create `protectedProcedure` that validates the session:

```typescript
// src/server/trpc.ts
const enforceAuth = t.middleware(async ({ ctx, next }) => {
  const session = await auth.api.getSession({ headers: ctx.headers });
  if (!session?.user) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, session } });
});

export const protectedProcedure = t.procedure.use(enforceAuth);
```

Then replace `publicProcedure` with `protectedProcedure` in **every** router except `users.requestReset`.

---

## 🔴 CRITICAL: All Signups Get `dev` Role (God Mode)

**File:** `src/lib/auth.ts` (lines 22-34)

```typescript
databaseHooks: {
  user: {
    create: {
      before: async (user) => {
        return { data: { ...user, role: "dev" } };
      },
    },
  },
},
```

Every new user who registers at `/auth/signup` automatically receives the `dev` role — the highest permission level. This means:
- Any anonymous visitor can create an account and get **full admin access**
- They can access `/invite` and create more admin users
- They can see all financial data, delete deliveries, etc.

### Required Fix
New signups should get `viewer` or `user` role. Only existing `dev`/`admin` users should promote roles via the Invite system.

---

## 🟡 HIGH: Invite Page Role Mismatch

**File:** `src/app/(app)/invite/page.tsx` (line 10)

The invite page blocks access unless `session.user.role === "dev"`. This means:
- Users with `admin` role **cannot** create other users, even though the `user-manual.md` says "Restricted to `dev` and `admin` roles"
- The sidebar shows "Invite User" only for `dev` role (`app-sidebar.tsx` line 88: `isDev`)

But the tRPC `users.getPendingResets` and `users.resolveReset` endpoints manually check for both `dev` AND `admin`. So the page permission is inconsistent with the API permission.

---

## 🟡 HIGH: Password Reset New Password Sent as Plaintext in Input

**File:** `src/app/(app)/invite/client.tsx` (line 229)

```tsx
<Input type="text" placeholder="New Password" .../>
```

The admin resets a user's password by typing it into a **visible text input** (`type="text"`, not `type="password"`). Anyone looking at the screen can see the password.

---

## 🟡 HIGH: `listUsers` Fetches All Users with limit=1000

**File:** `src/app/(app)/invite/client.tsx` (line 184)

```typescript
const usersRes = await authClient.admin.listUsers({ query: { limit: 1000 } });
```

To resolve a password reset, the client-side code fetches **ALL users** (up to 1000) from the Better Auth admin API, just to find one by email. This:
- Exposes all user data to the client
- Is extremely inefficient
- Could fail silently if there are 1000+ users

---

## 🟡 HIGH: `confirm()` for Destructive Operations

**Files:** All CRUD components  
Delete operations use the browser's native `confirm()` dialog — which provides no CSRF protection and can be spoofed. Should use a proper confirmation dialog component.

---

## 🟡 MEDIUM: Console.error Exposes Stack Traces

**File:** `src/server/analytics/services.ts` (line 164)

```typescript
console.error("Error fetching dashboard stats:", err);
```

Server-side errors are logged to console, which in production could leak stack traces, query structures, or database connection details.

**File:** `src/app/(app)/invite/client.tsx` (line 199)

```typescript
console.error(err);
```

---

## 🟡 MEDIUM: No Rate Limiting on Auth Endpoints

Neither the login page, signup page, nor the forgot-password page implement rate limiting. An attacker could brute-force passwords or flood the reset_requests table.

---

## 🟡 MEDIUM: No Input Sanitization on Text Fields

All text inputs (company name, supplier name, notes, etc.) are passed directly to the database. While Drizzle ORM prevents SQL injection via parameterized queries, there's no XSS sanitization for when data is rendered. For example, a company name of `<script>alert('xss')</script>` could be stored and rendered.

> React's JSX escaping provides built-in XSS protection for most cases, but any future use of `dangerouslySetInnerHTML` or SSR-side templating would be vulnerable.

---

## 📊 Hardcoded Values Inventory

### Hardcoded Numbers (Magic Numbers)

| File | Line | Value | Context |
|---|---|---|---|
| `CompaniesClient.tsx` | 40 | `limit: 100` | Max companies fetched |
| `DeliveriesClient.tsx` | 68 | `limit: 100` | Max deliveries fetched |
| `DeliveriesClient.tsx` | 69 | `limit: 1000` | Max companies in dropdown |
| `ProductsClient.tsx` | 58 | `limit: 100` | Max products fetched |
| `RawMaterialsClient.tsx` | 39 | `limit: 100` | Max raw materials fetched |
| `deliveries/page.tsx` | 8 | `1000` | Products service call limit |
| `invite/client.tsx` | 179 | `8` | Min password length |
| `invite/client.tsx` | 184 | `limit: 1000` | listUsers query limit |
| `analytics/services.ts` | 48 | `5` | Months lookback for chart |
| `analytics/services.ts` | 75 | `6` | Months in chart |
| `analytics/services.ts` | 121 | `5` | Top unpaid companies |
| `analytics/services.ts` | 134 | `5` | Recent deliveries limit |
| `signup/page.tsx` | 103 | `8` | Min password length |
| `user-settings-client.tsx` | 130 | `8` | Min password length |
| `header.tsx` | 15 | `31536000` | Cookie max-age (1 year) |
| `settings/page.tsx` | 23 | `31536000` | Cookie max-age (1 year) |

### Hardcoded Strings (Should Be in i18n)

| File | Line | String |
|---|---|---|
| `page.tsx` (landing) | 76 | `"Access Management Portal"` |
| `page.tsx` (landing) | 82 | `"Enterprise Secure"` |
| `page.tsx` (landing) | 83 | `"Multi-lingual Support"` |
| `page.tsx` (landing) | 84 | `"Inventory Optimized"` |
| `page.tsx` (landing) | 116 | `"Production Yield"` |
| `page.tsx` (landing) | 117 | `"+94%"` |
| `page.tsx` (landing) | 127 | `"© 2026 Prime Paper Company..."` |
| `page.tsx` (landing) | 129 | `"Privacy"` |
| `page.tsx` (landing) | 130 | `"Terms"` |
| `page.tsx` (landing) | 131 | `"Contact Support"` |
| `AnalyticsClient.tsx` | 58 | `"إجمالي المواد الخام"` (hardcoded Arabic) |
| `AnalyticsClient.tsx` | 60 | `"طن"` |
| `AnalyticsClient.tsx` | 65 | `"إجمالي المنتجات"` |
| `AnalyticsClient.tsx` | 67 | `"لفة"` |
| `AnalyticsClient.tsx` | 72 | `"مبيعات الشهر"` |
| `AnalyticsClient.tsx` | 74 | `"ج.م"` |
| `AnalyticsClient.tsx` | 79 | `"المدفوعات المعلقة"` |
| `AnalyticsClient.tsx` | 81 | `"ج.م"` |
| `CompaniesClient.tsx` | 204 | `"Add your first company to get started."` |
| `DeliveriesClient.tsx` | 280 | `"No products added to this delivery yet."` |
| `DeliveriesClient.tsx` | 316 | `"Create your first delivery to get started."` |
| `DeliveriesClient.tsx` | 343 | `"EGP"` (currency unit) |
| `DeliveryDetailClient.tsx` | 73 | `"Delivery not found"` |
| `DeliveryDetailClient.tsx` | 75 | `"Back to Deliveries"` |
| `DeliveryDetailClient.tsx` | 128 | `"EGP"` |
| `DeliveryDetailClient.tsx` | 140 | `"EGP"` |
| `DeliveryDetailClient.tsx` | 157 | `"EGP"` |
| `DeliveryDetailClient.tsx` | 175 | `"لا توجد عناصر"` (hardcoded Arabic) |
| `DeliveryDetailClient.tsx` | 273 | `"لا توجد مدفوعات"` (hardcoded Arabic) |
| `DeliveryDetailClient.tsx` | 291 | `"EGP"` |
| `ProductsClient.tsx` | 175 | `"طن"` (hardcoded Arabic) |
| `ProductsClient.tsx` | 280 | `"Add your first product to inventory."` |
| `ProductsClient.tsx` | 312 | `"kg"` |
| `RawMaterialsClient.tsx` | 221 | `"Add your first incoming raw material shipment."` |
| `RawMaterialsClient.tsx` | 251 | `"Tons"` |
| `RawMaterialsClient.tsx` | 254 | `"EGP"` |
| `RawMaterialsClient.tsx` | 258 | `"EGP"` |
| `settings/page.tsx` | 44 | `"System & Language"` |
| `settings/page.tsx` | 64 | `"System Language"` |
| `settings/page.tsx` | 65 | `"Select your preferred language for the interface."` |
| `user-settings-client.tsx` | 65 | `"Unable to load user profile."` |
| `app-sidebar.tsx` | 55 | `"برايم بيبر"` / `"Prime Paper"` |
| `app-sidebar.tsx` | 58 | `"إدارة المصنع"` / `"Factory Manager"` |
| `app-sidebar.tsx` | 93 | `"دعوة مستخدم"` / `"Invite User"` |
| `invite/client.tsx` | 60 | `"Create User"` |
| `invite/client.tsx` | 61 | `"Password Resets"` |
| `invite/client.tsx` | 179 | `"Password must be 8+ chars"` |
| `invite/client.tsx` | 200 | `"Failed to reset password: "` |
| `invite/client.tsx` | 212 | `"No pending password resets."` |
| `invite/client.tsx` | 230 | `"New Password"` |
| `invite/client.tsx` | 236 | `"Resolve"` |
| `auth/login/page.tsx` | 57 | `"Prime Paper \| برايم بيبر"` |
| `auth/login/page.tsx` | 60 | `"Paper Factory Management System"` |
| `auth/signup/page.tsx` | 64 | `"Prime Paper Factory Management"` |

### Hardcoded Locale in Date Formatting

| File | Line | Hardcoded Locale | Issue |
|---|---|---|---|
| `DeliveriesClient.tsx` | 337 | `"ar-EG"` | Always Arabic regardless of user setting |
| `DeliveryDetailClient.tsx` | 288 | `"ar-EG"` | Always Arabic |
| `ProductsClient.tsx` | 175 | `"ar-EG"` | Always Arabic |
| `ProductsClient.tsx` | 302 | `"ar-EG"` | Always Arabic |
| `RawMaterialsClient.tsx` | 247 | `"ar-EG"` | Always Arabic |

These should use a dynamic locale based on user preference, not hardcoded `"ar-EG"`.

> `AnalyticsClient.tsx` does this correctly — it uses `isArabic ? 'ar-EG' : 'en-US'`.
