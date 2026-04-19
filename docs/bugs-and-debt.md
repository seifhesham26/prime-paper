# Known Bugs & Technical Debt

> Issues discovered by analyzing the codebase and cross-referencing conversation logs.

---

## 🔴 Bugs

### 1. Missing Translation Keys — Forgot Password Page
**File:** `src/app/auth/forgot-password/page.tsx`  
**Severity:** High — page will show raw translation keys to users

The component references these translation keys:
- `auth.forgotPasswordTitle` (line 54)
- `auth.forgotPasswordDesc` (line 57)
- `auth.sendResetLink` (line 85)
- `auth.checkEmail` (line 102)

**None of these exist** in `messages/en.json` or `messages/ar.json`. The `auth` namespace only has: `login`, `signup`, `name`, `email`, `password`, `submit`, `signupSubmit`, `alreadyHaveAccount`, `dontHaveAccount`, `signupSuccess`, `error`, `signupError`.

**Fix:** Add the missing keys to both translation files.

---

### 2. Login Redirects to `/` Instead of `/dashboard`
**File:** `src/app/auth/login/page.tsx`, line 39  
**Severity:** Medium — UX confusion

```typescript
window.location.href = "/";  // Should be "/dashboard"
```

After successful login, users are sent to the landing page instead of the dashboard. Since the landing page detects the session and shows a "View Dashboard" button, this creates an unnecessary extra click.

**Fix:** Change to `window.location.href = "/dashboard";`

---

### 3. Reset Password Route is Empty
**File:** `src/app/auth/reset-password/` — directory exists, no `page.tsx`  
**Severity:** Low — the system uses manual admin resets, not self-service reset links

The directory was created but never populated. Since the forgot-password flow uses a manual ticket system (admin resets passwords from `/invite` Tab 2), this route isn't technically needed. However, the empty directory is confusing.

**Fix:** Either create a proper page or delete the empty directory.

---

### 4. Invitation Table Not Used by Current Invite Flow
**File:** `src/db/schema.ts`, lines 77-89  
**Severity:** Low — dead schema

The `invitation` table exists in the schema but the actual invite flow in `/invite` creates users directly via Better Auth Admin API — it doesn't use this table. This is leftover from early Better Auth setup.

**Fix:** Either integrate it into the invite flow or remove the schema definition.

---

## 🟡 Technical Debt

### 1. Hardcoded English Strings Throughout
Multiple components have English strings that bypass the i18n system:

| File | Line(s) | Hardcoded String |
|---|---|---|
| `src/app/page.tsx` | 76 | `"Access Management Portal"` |
| `src/app/page.tsx` | 82 | `"Enterprise Secure"` |
| `src/app/page.tsx` | 83 | `"Multi-lingual Support"` |
| `src/app/page.tsx` | 84 | `"Inventory Optimized"` |
| `src/app/page.tsx` | 116 | `"Production Yield"` |
| `src/app/page.tsx` | 127 | `"© 2026 Prime Paper Company..."` |
| `src/app/page.tsx` | 129-131 | `"Privacy"`, `"Terms"`, `"Contact Support"` |
| `src/app/(app)/settings/page.tsx` | 44 | `"System & Language"` |
| `src/app/(app)/settings/page.tsx` | 64 | `"System Language"` |
| `src/app/(app)/settings/page.tsx` | 65 | `"Select your preferred language..."` |
| `src/app/auth/signup/page.tsx` | 64 | `"Prime Paper Factory Management"` |
| `src/app/auth/login/page.tsx` | 57 | `"Prime Paper \| برايم بيبر"` |
| `src/app/auth/login/page.tsx` | 60 | `"Paper Factory Management System"` |

---

### 2. Footer Links Are Non-Functional
**File:** `src/app/page.tsx`, lines 129-131

All three footer links point to `#`:
- Privacy
- Terms
- Contact Support

These should either link to real pages or be removed.

---

### 3. Hero Visual Is Placeholder

**File:** `src/app/page.tsx`, lines 90-120

The right side of the hero section is composed entirely of gray placeholder rectangles and pulsing skeleton bars. This was clearly a mockup that was never replaced with real content (screenshot, dashboard preview, or illustration).

---

### 4. `publicProcedure` Used for Admin Routes
**File:** `src/server/users/router.ts`

The `getPendingResets` and `resolveReset` endpoints use `publicProcedure` with manual session checks inside the handler. This works but bypasses tRPC's built-in middleware pattern. Ideally, these should use a `protectedProcedure` or `adminProcedure` that enforces auth at the procedure level.

---

### 5. No Error Boundaries
The application has no `error.tsx` or `not-found.tsx` pages to handle runtime errors or 404s gracefully.

---

### 6. PDF Export Never Implemented
The original implementation plan listed `@react-pdf/renderer` for delivery receipt generation with an API route at `src/app/api/pdf/[id]/route.ts`. This was never built and `@react-pdf/renderer` is not in the dependencies.
