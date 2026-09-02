# UI/UX Overhaul — Design

Date: 2026-09-01
Status: draft — awaiting review
Branch base: `feat/raw-materials-remodel`

## Goal

Bring the whole application up to a usable, responsive, themed standard, then
give it a visual identity. Two phases, in that order: **usability first, looks
second.** Phase 1 stands on its own — the work is worth shipping even if phase 2
never happens.

The backend architecture is sound and stays as it is. The only server changes in
scope are the ones required to make search and sort honest (Section 5).

## Decisions taken

| Question | Answer |
| --- | --- |
| Scope | Usability first, then visual identity |
| Devices | Desktop and mobile matter equally |
| Visual direction | Deep teal / forest professional |
| Approach | Shared primitives first, then migrate pages |
| New dependencies | `next-themes`, `sonner`. Nothing else. |

`@tanstack/react-table` was considered and rejected: pagination is already
server-side, so client-side table state would fight it, and it is a heavy
dependency for five tables of at most six columns.

## What is actually wrong today

Findings from a full read of `src/`, in rough severity order.

1. **Dark mode is unreachable.** `globals.css` defines a complete `.dark`
   token set and roughly ten files use `dark:` utilities, but nothing ever puts
   the `dark` class on an element. Every one of those utilities is dead code.
2. **26 native `alert()` / `confirm()` calls across 9 files.** Blocking,
   unstyled, ignore the page's RTL direction, and cannot be themed.
3. **Create and update failures are silent.** `CompaniesClient` and
   `ProductsClient` register `onError` on the delete mutation only. A failed
   save leaves the dialog open with no message anywhere.
4. **No search, filter, or sort on any list.** `common.search` and
   `common.noResults` exist in both message files and are never used.
5. **Tables do not survive small screens.** Six-column tables with no card
   fallback; only `RawMaterialTypesClient` and the detail pages even wrap in
   `overflow-x-auto`.
6. **`error.tsx` and `not-found.tsx` are hardcoded English** while `ar` is the
   default locale.
7. **Loading is a centered `Loader2`** in four clients rather than a skeleton
   shaped like the content it replaces. `AnalyticsClient` is the exception and
   does it properly.
8. **`--card` and `--background` are both `oklch(1 0 0)` in light mode.** Cards
   have no surface distinction, which is why nearly every `<Card>` in the app
   carries `border-0 shadow-md dark:bg-card/50` to fake one by hand.
9. **The chart palette is incoherent across themes.** `--chart-1..5` in `:root`
   and `.dark` are unrelated hues, so toggling the theme changes what colour a
   data series is.
10. **No brand identity.** Tokens are stock shadcn `neutral`; `--primary` is
    near-black.
11. **The header is thin.** No breadcrumbs, no user menu, not sticky, and the
    language toggle does a full `window.location.reload()`.
12. **RTL handling is ad-hoc.** `isArabic ? "text-right" : "text-left"` in
    place of `text-start`, and `ml-1 rtl:mr-1` in `AnalyticsClient` (lines 133
    and 230) is a real bug — in RTL both margins apply, because `rtl:mr-1` adds
    a margin rather than replacing `ml-1`. The fix is `ms-1`.
13. **Back arrows are inverted on both detail pages.**
    `RawMaterialDetailClient:149` and `DeliveryDetailClient:114` show
    `ArrowRight` in LTR for a "back to list" link. `PaginationControls` gets the
    equivalent case right, so the app contradicts itself.
14. **Money and measure formatting is inconsistent.** `DeliveriesClient`
    hardcodes the string `"EGP"`, `AnalyticsClient` uses `t("egp")`,
    `ProductsClient` inlines `isArabic ? "كجم" : "kg"`.
15. **Status colour is hardcoded per site.** `PaymentBadge` maps to
    `default`/`secondary`/`destructive`, so "paid" renders as plain black;
    balance and payment figures reach for literal `emerald-600` / `rose-600`.

## Phase 1 — Usability

### Section 1: Token layer (`src/app/globals.css`)

One source of truth for colour, elevation, and type, defined for light and dark
together.

- **Deep teal primary**, approximately `oklch(0.45 0.075 195)` in light and
  `oklch(0.72 0.09 190)` in dark, with the sidebar on a teal-tinted surface so
  it reads as chrome rather than content.
- **Real surface separation**: `--background` takes a faint cool tint,
  `--card` stays white. This is what allows the `border-0 shadow-md
  dark:bg-card/50` incantation to be deleted app-wide rather than reproduced.
- **Semantic status tokens** — `--status-paid`, `--status-partial`,
  `--status-unpaid`, each with a foreground pair. Consumed by `PaymentBadge`,
  the raw-material balance column, and the delivery remaining/paid figures.
- **A coherent chart ramp**: teal → sea-green → sand → clay → slate, the same
  hues in both themes with lightness adjusted per theme.
- **Elevation and type as tokens**, replacing per-file `shadow-md` /
  `shadow-2xl` / `text-2xl` choices.

Phase 2 is then largely a matter of revisiting the values in this one file.

### Section 2: Shared primitives

New files under `src/components/ui/` and `src/components/layout/`.

| Primitive | Replaces | Notes |
| --- | --- | --- |
| `ThemeProvider` + `ThemeToggle` | nothing — dark mode is unreachable today | `next-themes`, class strategy, `defaultTheme="system"`, `suppressHydrationWarning` on `<html>`. Makes the existing `dark:` utilities live. |
| `<Toaster />` and `toast.*` | 12 `alert()` calls | `sonner`. Also adds success feedback, which does not exist anywhere today. Position flips with locale direction. |
| `ConfirmDialog` / `useConfirm` | 9 `confirm()` calls | Built on the existing `Dialog`. Names the record, destructive styling, pending state on the confirm button. |
| `DataTable` | ~80 duplicated lines in each of 5 list clients | Takes `columns` + `rows`; renders a sticky-header dense table at `md` and above, and a stacked card list below. Owns empty state, skeleton rows, and the pagination footer. This is what makes responsive-everywhere affordable. |
| `PageHeader` | the `flex justify-between` + `h3` + Add-button block, repeated 5× | Title, description, search slot, primary action, optional breadcrumb. |
| `Money` / `Measure` | inline formatting in 6 files | `dir="ltr"`, locale-aware `toLocaleString`, translated unit suffix, in one place. |

`DataTable`'s column descriptor carries `header`, `cell`, `align`,
`mobileLabel`, `sortKey?`, and `priority` (which columns survive into the mobile
card). Its own logic — column-to-card projection, sort-param round-tripping —
goes in a plain `.ts` module beside it so it is testable under the project's
"pure logic only" testing rule.

### Section 3: App shell

- Header becomes sticky with a backdrop blur, and gains breadcrumbs on detail
  pages, the theme toggle, and a user dropdown (name, role badge, settings,
  sign out).
- The language toggle drops `window.location.reload()` for `router.refresh()`.
  Locale is read from the cookie by a server component, so a refresh re-renders
  `<html lang dir>` correctly while preserving scroll position and client state.
- Sidebar: grouped nav, correct active state for detail routes (currently
  `pathname === item.href`, so `/raw-materials/abc` highlights nothing).

### Section 4: Page migration

Every page moves onto the primitives, and each carries the same checklist:
toasts on success and failure, `ConfirmDialog` for destructive actions,
skeletons shaped like the content, responsive layout, and logical CSS
properties instead of direction conditionals.

- `AnalyticsClient` + `StatCard` (dashboard)
- `RawMaterialTypesClient`, `RawMaterialDetailClient`
- `ProductsClient`
- `CompaniesClient`
- `DeliveriesClient`, `DeliveryDetailClient`
- `settings/page.tsx` and its three sub-clients
- `invite/client.tsx`
- `auth/login`, `auth/signup`, `auth/forgot-password`
- `app/page.tsx` (landing)
- `error.tsx`, `not-found.tsx` — translated, on the shared shell

### Section 5: Server-side search and sort

Search must reach the server. Pagination is server-side, so filtering the
current page would silently search page 1 of N and report a wrong total.

For `raw-materials`, `products`, `companies`, and `deliveries`:

- `GetXSchema` gains `search?: string`, `sortBy?: <per-domain enum>`,
  `sortDir?: "asc" | "desc"`.
- `services.ts` passes them through; `db.ts` applies `ilike` and `orderBy`.
- **The count query and the data query must share one `where` clause**, or
  `totalPages` disagrees with the rows returned.
- **`sortBy` is a Zod enum mapped through a column whitelist**, never a string
  interpolated into `orderBy` — the same posture the equation engine already
  takes with `resolveVariable`.
- Search columns: raw materials `name`, `notes`; products `notes` and the
  joined material name; companies `name`, `contactPerson`, `phone`, `address`;
  deliveries the joined company name and `notes`.
- Existing behaviour is preserved when the new fields are absent, so
  `forDropdown` and current callers are unaffected.

Client side, search and sort round-trip through URL params next to the existing
`?page=`, and changing either resets to page 1.

## Plan decomposition

Phase 1 and phase 2 get **separate implementation plans**. Phase 1 is large
enough on its own (five sections, roughly eighteen files) and is the phase that
has to land first regardless. Phase 2's plan is written after phase 1 ships,
against the token layer as actually built rather than as imagined here.

## Phase 2 — Visual identity

Deep teal / forest professional, applied on the token layer built in phase 1.

- Final palette, tuned for AA contrast in both themes and checked against the
  Cairo typeface's weight distribution.
- A type scale that suits Cairo specifically — its Arabic forms sit differently
  from the Latin defaults shadcn assumes.
- Stat cards move off DB-stored raw Tailwind gradient strings with hardcoded
  `text-white` and onto named token-driven tones. Existing stored values keep
  working through a mapping, so no data migration is required.
- Chart restyle on the new ramp.
- Landing page redesigned around the identity. It is currently a generic SaaS
  hero with placeholder skeleton blocks standing in for a product screenshot.

## Invariants this work must not break

Carried from `CLAUDE.md`, all of which this design respects:

- Raw material stock stays derived; no balance column, and the scalar-subquery
  pattern in `types.db.ts` is not to be rewritten as joins.
- `paymentStatus` stays derived; nothing here creates or deletes payments.
- Authorization stays in the procedure builders. `useUserRole().canWrite`
  remains cosmetic — new UI gating changes nothing about the real gate.
- `ar.json` and `en.json` move together. They are at 257 keys each today; every
  key added in this work lands in both.
- Equation tokens and settings keys are untouched.

## Verification

- `pnpm test` — pure logic, including new tests for the `DataTable` column/sort
  helpers and a message-parity test that fails when `ar.json` and `en.json`
  diverge.
- `npx tsc --noEmit`
- `pnpm lint` — one pre-existing error in `src/components/ui/sidebar.tsx`
  (`Math.random` during render) is expected and is not to be counted as new
  breakage.
- Manual: every page across both locales × both themes × mobile and desktop.

## Explicitly out of scope

- Any change to the equation engine, settings registry, or auth flow.
- The `dev` role bootstrap hook in `auth.ts`, and the second stale `dev`
  account. Both are noted in `CLAUDE.md` as open items and are not UI work.
- Fixing the pre-existing `sidebar.tsx` lint error, which is generated shadcn
  code.
- Data migrations of any kind.
