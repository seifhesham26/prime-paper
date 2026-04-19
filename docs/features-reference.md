# Features Reference — Complete Detail

> Exhaustive documentation of every feature in the application, how it works technically, and its current state.

---

## 1. Authentication & Authorization

### 1.1 Login (`/auth/login`)
- **How it works:** Email/password form → `signIn.email()` from Better Auth client → sets `better-auth.session_token` cookie → redirects to `/`
- **Fields:** Email (LTR enforced), Password (LTR enforced)
- **Error handling:** Shows red banner on failure with `t("error")` translation
- **Cross-links:** "Don't have an account?" → `/auth/signup`
- **Known issue:** Redirects to `/` instead of `/dashboard` after login

### 1.2 Signup (`/auth/signup`)
- **How it works:** Name/email/password form → `signUp.email()` → auto-assigns `dev` role via `user.create.before` hook → redirects to `/dashboard`
- **Fields:** Full Name, Email (LTR), Password (LTR, min 8 chars)
- **Error handling:** Shows error banner on failure
- **Cross-links:** "Already have an account?" → `/auth/login`
- **Known issue:** `dev` role is the highest permission — anyone can self-register as admin

### 1.3 Forgot Password (`/auth/forgot-password`)
- **How it works:** Email form → `api.users.requestReset.useMutation()` → inserts a row in `reset_requests` table with status `"pending"` → shows success state with checkmark
- **Flow:** This is a **manual** system — no email is sent. Admins see pending requests in `/invite` Tab 2 and manually set new passwords.
- **Known issue:** Translation keys for this page are missing from locale files

### 1.4 Password Reset Queue (`/invite` — Tab 2)
- **How it works:** Lists all pending `reset_requests` → admin types a new password → client fetches all users via `admin.listUsers()` → finds user by email → calls `admin.updateUser({ data: { password } })` → marks ticket as resolved via `api.users.resolveReset`
- **Access:** `dev` role only (server-side check)
- **Known issue:** Fetches all users to find one by email; password input is `type="text"` (visible)

### 1.5 Route Protection
- **Middleware (`src/middleware.ts`):** Checks for `better-auth.session_token` cookie on every request
- **Public routes:** `/`, `/auth/*`, `/api/*` — bypass auth check
- **Protected routes:** Everything else — redirects to `/auth/login` if no cookie
- **Known issue:** Middleware only checks cookie existence, not validity. The tRPC layer has NO auth checks.

### 1.6 Role System

| Role | How Assigned | Access Level | Can Invite Users? |
|---|---|---|---|
| `dev` | Auto-assigned on signup | Full access + invite | ✅ |
| `admin` | Via invite system | Full access | ❌ (page blocked) |
| `viewer` | Via invite system | Unclear — no enforcement | ❌ |
| `user` | Better Auth default | Not used | ❌ |

> **Important:** The `viewer` role exists in the invite dropdown but there is NO code anywhere that restricts viewer access. All CRUD operations are available to all authenticated users.

---

## 2. Landing Page (`/`)

### 2.1 Navigation Bar
- Fixed top navbar with glassmorphic blur
- Shows "Prime Paper" branding with ScrollText icon
- **Logged out:** Shows "Login" ghost button + "Get Started" primary button
- **Logged in:** Shows "View Dashboard" button with arrow icon

### 2.2 Hero Section
- Left side: Tagline badge ("Efficiency, Redefined."), large title, description, two CTA buttons, trust badges
- Right side: Decorative glassmorphic card with placeholder skeleton shapes + floating "Production Yield +94%" badge
- Background: Two blurred gradient circles (primary + accent) with subtle animation

### 2.3 Footer
- Copyright text
- Three links: Privacy, Terms, Contact Support — **all link to `#`**

---

## 3. Dashboard (`/dashboard`)

### 3.1 Stat Cards (4 cards in a grid)
- **Total Raw Materials:** Sum of all `weight_tons` → displayed in tons
- **Total Products:** Sum of all `quantity` → displayed in rolls
- **Sales This Month:** Sum of `selling_price_egp` for deliveries in current month → displayed in EGP
- **Outstanding Payments:** (Unpaid deliveries total + Partial deliveries total) − Total payments → displayed in EGP
- Each card has a colored gradient strip, lift animation on hover, and formatted number with unit

### 3.2 Top Unpaid Companies (Left panel)
- Server-side calculation: For each company, total deliveries − total payments = balance
- Filters to companies with balance > 0
- Sorted by balance descending, limited to top 5
- "View All" button links to `/companies`

### 3.3 Revenue vs Payments Chart (Right panel — top)
- **Recharts** `BarChart` with two bars per month
- Revenue bar (blue): Monthly sum of `selling_price_egp`
- Payments bar (green): Monthly sum of `amount_egp` from payments table
- Last 6 months using `date_trunc` aggregation
- Missing months filled with zero values
- Tooltip shows full month name + formatted currency
- Y-axis shows abbreviated values (`23k`)
- Locale-aware month labels (Arabic or English)

### 3.4 Recent Deliveries Table (Right panel — bottom)
- Last 5 deliveries ordered by date descending
- Columns: Company Name, Date, Amount, Payment Status badge
- "View All" links to `/deliveries`

---

## 4. Companies (`/companies`)

### 4.1 Company List
- Table with columns: Name, Contact Person, Phone, Address, Notes, Actions
- Phone numbers render LTR regardless of locale
- Edit/Delete action buttons appear on row hover (fade-in transition)

### 4.2 Add Company (Dialog)
- **Fields:**
  - Name (required)
  - Contact Person (optional)
  - Phone (optional, `type="tel"`, LTR)
  - Address (optional)
  - Notes (optional, multiline textarea)
- Submit → `api.companies.create.useMutation()` → auto-invalidates `getAll` query

### 4.3 Edit Company (Same dialog, pre-filled)
- Opens with `defaultValue` for each field
- Submit → `api.companies.update.useMutation()` with `id`

### 4.4 Delete Company
- `confirm()` dialog → `api.companies.delete.useMutation()`
- Button disabled while mutation is pending

### 4.5 Empty State
- Dashed border card with Building2 icon + "No companies yet" message

---

## 5. Deliveries (`/deliveries`)

### 5.1 Delivery List
- Table with columns: Date, Company, Selling Price (EGP), Payment Status, Notes, Actions
- View detail button (Eye icon) → `/deliveries/[id]`
- Delete button with confirmation
- Payment status shown as colored badge: green (paid), gray (partial), red (unpaid)

### 5.2 Add Delivery (Dialog)
- **Fields:**
  - Date (required, default today)
  - Company (required, dropdown from companies tRPC query)
  - Selling Price EGP (required, numeric, 0.01 step)
  - Payment Status (dropdown: Paid/Partial/Unpaid, default Unpaid)
  - **Items** (dynamic list):
    - Each item: Product dropdown + Quantity input
    - "Add Item" button to add rows
    - X button to remove rows
    - Product dropdown shows: `{length}m × {width}cm ({weight}kg)`
  - Notes (optional)
- Products list passed as server-side prop from `getProductsService(1, 1000)`

### 5.3 Empty State
- Truck icon + "No deliveries yet" message

---

## 6. Delivery Detail (`/deliveries/[id]`)

### 6.1 Summary Cards (4-card grid)
- **Company:** Name + Payment Status badge
- **Selling Price:** Formatted EGP amount
- **Total Paid:** Green color, sum of all payments
- **Remaining:** Red if > 0, green if 0. Calculated as `sellingPrice - totalPaid`

### 6.2 Delivery Items Table
- Columns: Product (formatted as `{length}m × {width}cm ({weight}kg)`), Quantity
- Empty state: "لا توجد عناصر" (hardcoded Arabic)

### 6.3 Payments Table + Add Payment
- Columns: Payment Date, Amount (green), Notes
- "Add Payment" button opens dialog:
  - Amount EGP (required, 0.01 step)
  - Payment Date (required, default today)
  - Notes (optional)
- On payment added: Auto-invalidates both `getById` and `getAll` queries
- Empty state: "لا توجد مدفوعات" (hardcoded Arabic)

### 6.4 Back Navigation
- "← Deliveries" ghost button with RTL-aware arrow icon

---

## 7. Products (`/products`)

### 7.1 Product List
- Table with columns: Date Produced, Raw Material (supplier name), Length (m), Width (cm), Weight (kg), Quantity, Actions
- Edit/Delete on hover

### 7.2 Add/Edit Product (Dialog)
- **Fields:**
  - Date Produced (required, default today)
  - Raw Material (optional dropdown showing: `{supplier} - {date} ({weight} طن)`)
  - Length in meters (required, 0.01 step)
  - Width in cm (required, 0.01 step)
  - Weight in kg (required, 0.01 step)
  - Quantity (required integer, min 1, default 1)
  - Notes (optional)
- Raw materials passed as server-side prop

### 7.3 Empty State
- Factory icon + "No products yet" message

---

## 8. Raw Materials (`/raw-materials`)

### 8.1 Materials List
- Table with columns: Date Received, Supplier Name, Weight (Tons), Cost (EGP), Cost/Ton (EGP, auto-calculated), Notes, Actions
- Cost/Ton shown in emerald green — calculated server-side by the service layer

### 8.2 Add/Edit Material (Dialog)
- **Fields:**
  - Date Received (required, default today)
  - Supplier Name (required)
  - Weight in Tons (required, 0.001 step)
  - Cost EGP (required, 0.01 step)
  - Notes (optional)
- **Auto-calculation:** `costPerTon = costEgp / weightTons` — computed in service layer on create and update

### 8.3 Empty State
- Package icon + "No raw materials yet" message

---

## 9. Settings (`/settings`)

### 9.1 Account Tab
- **Profile Information:** Read-only display of user's Name and Email (from session)
- **Change Password:**
  - Fields: Current Password, New Password (min 8 chars)
  - Uses `authClient.changePassword()` with `revokeOtherSessions: false`
  - Shows green success or red error banner

### 9.2 System & Language Tab
- Language toggle button: Switches between Arabic and English
- Sets `locale` cookie to `ar` or `en` with 1-year expiry
- Reloads the page to apply new locale

---

## 10. Invite / Admin Portal (`/invite`)

### 10.1 Create User Tab
- **Fields:**
  - Name (required)
  - Email (required, LTR)
  - Password (required, min 8), LTR
  - Role (dropdown: Admin with shield icon, Viewer with eye icon)
- Uses `authClient.admin.createUser()` — Better Auth admin plugin
- Shows animated success/error banners

### 10.2 Password Resets Tab
- Lists all `reset_requests` with status `"pending"`
- Each card shows: email, request date, password input + "Resolve" button
- Resolution flow: Fetches all users → finds by email → `admin.updateUser()` → marks DB ticket resolved

---

## 11. Sidebar Navigation

### 11.1 Menu Items
| Icon | Label | Route | Visible To |
|---|---|---|---|
| LayoutDashboard | Dashboard | `/dashboard` | All |
| Package | Raw Materials | `/raw-materials` | All |
| Factory | Products | `/products` | All |
| Building2 | Companies | `/companies` | All |
| Truck | Deliveries | `/deliveries` | All |
| UserPlus | Invite User | `/invite` | `dev` only |
| Settings | Settings | `/settings` | All |
| LogOut | Logout | (signOut action) | All |

### 11.2 Behaviors
- Active route highlighted with `isActive` prop
- Sidebar positioned right for Arabic (RTL), left for English (LTR)
- Collapsible to icon-only mode
- Branding shows "Prime Paper" / "برايم بيبر" based on locale

---

## 12. Header Bar

- Sidebar toggle button
- Dynamic page title (passed as prop)
- Language toggle button showing the opposite language name

---

## 13. Localization (`next-intl`)

### 13.1 How It Works
- Locale determined by `locale` cookie (default: `ar`)
- `src/i18n/request.ts` resolves locale from cookie
- Server components: `getTranslations("namespace")`
- Client components: `useTranslations("namespace")`
- `dir` attribute on `<html>` set dynamically (`rtl` for Arabic, `ltr` for English)

### 13.2 Available Namespaces
`app`, `nav`, `dashboard`, `rawMaterials`, `products`, `companies`, `deliveries`, `invite`, `settings`, `auth`, `landing`, `common`

### 13.3 Known Gaps
- Dashboard StatCard labels are hardcoded Arabic
- Multiple empty state messages hardcoded English
- Currency units ("EGP", "Tons", "kg") hardcoded
- Date formatting locales hardcoded to `"ar-EG"` in most pages
- FooterEntirely hardcoded English
- Several invite page strings hardcoded English
- Forgot password page has missing translation keys

---

## 14. Data Layer (tRPC + Drizzle)

### 14.1 tRPC Architecture (Onion)
```
Router → Service → Database Repository → Drizzle ORM → PostgreSQL
```

### 14.2 Domain Routers

| Domain | Endpoints | Notes |
|---|---|---|
| `analytics` | `getDashboardStats` | Complex aggregation query |
| `companies` | `getAll`, `create`, `update`, `delete` | Standard CRUD |
| `deliveries` | `getAll`, `getById`, `create`, `delete`, `addPayment` | Nested items + payment tracking |
| `products` | `getAll`, `create`, `update`, `delete` | Links to raw materials |
| `rawMaterials` | `getAll`, `create`, `update`, `delete` | Auto costPerTon calculation |
| `users` | `requestReset`, `getPendingResets`, `resolveReset` | Password reset ticket system |

### 14.3 Data Fetching Strategy
- Client-side: `useQuery()` for reads, `useMutation()` for writes
- Cache invalidation: `utils.{domain}.{query}.invalidate()` on mutation success
- Loading states: Animated spinner or skeleton placeholders
- Error handling: tRPC Zod error formatting in error responses
