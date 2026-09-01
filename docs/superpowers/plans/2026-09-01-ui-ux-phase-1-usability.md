# UI/UX Phase 1 (Usability) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page of Prime Paper themeable, responsive, searchable, and honest about success and failure — without changing any business rule.

**Architecture:** Build the missing shared primitives first (theme provider, toasts, confirm dialog, a responsive `DataTable`, `PageHeader`, formatting components), then migrate all pages onto them. Search and sort are pushed into the existing tRPC `getAll` procedures because pagination is already server-side. Pure logic is extracted into `.ts` modules so it can be tested under the project's node-only Vitest setup.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui (new-york, neutral base), tRPC v11 + TanStack Query v5, Drizzle ORM + Neon Postgres, next-intl, Vitest. New: `next-themes`, `sonner`.

**Spec:** `docs/superpowers/specs/2026-09-01-ui-ux-overhaul-design.md`

## Global Constraints

- **Do not commit.** The repository owner reviews the working tree himself. Every task ends with a **Checkpoint** step: run the verification commands, report what changed, and stop. Never run `git commit` or `git add` unless explicitly asked.
- **Package manager is `pnpm`.** If it is not on `PATH`, `corepack pnpm <cmd>` works.
- **Tests are pure logic only.** Vitest runs `environment: "node"` with `include: ["src/**/*.test.ts"]` — **`.tsx` test files are not picked up and there is no DOM**. Anything to be tested must live in a plain `.ts` module with no React and no database import.
- **`messages/ar.json` and `messages/en.json` move together.** They are at 257 keys each. `t()` throws `MISSING_MESSAGE` rather than returning undefined, so a key added to one file only is a crash, not a fallback.
- **Arabic (`ar`) is the default locale and the default direction is RTL.** Use logical CSS properties (`ms-*`, `me-*`, `ps-*`, `pe-*`, `text-start`, `text-end`) — never `ml-*`/`mr-*` with an `rtl:` override, which adds a second margin instead of replacing the first.
- **Authorization is enforced by the tRPC procedure builders**, never in the UI. `useUserRole().canWrite` hides write controls cosmetically; it is not a security boundary and nothing in this plan changes that.
- **Never interpolate a Drizzle column object into a correlated subquery** — it renders unqualified and silently binds to the wrong table. Write the outer column as literal SQL text. See the comment block at the top of `src/server/raw-materials/types.db.ts`.
- **Monetary and weight columns are Postgres `decimal`, returned by Drizzle as strings.** Coerce with `Number(...)`; never assume arithmetic works directly on them.
- **`pnpm lint` has one pre-existing error** in `src/components/ui/sidebar.tsx` (`Math.random` during render). It is generated shadcn code, it is out of scope, and it must not be counted as new breakage.
- **Do not touch:** the equation engine (`src/server/analytics/`), the settings registry, `src/lib/auth.ts`, or any Drizzle schema/migration. This phase adds no database changes.

---

## File Structure

**New — pure logic (tested):**

| File | Responsibility |
| --- | --- |
| `src/lib/format.ts` | Locale tag resolution, decimal/date formatting, `toDateInputValue` |
| `src/lib/format.test.ts` | Tests for the above |
| `src/components/ui/data-table/list-params.ts` | URL search-param round-tripping and sort-state cycling |
| `src/components/ui/data-table/list-params.test.ts` | Tests for the above |
| `src/server/shared/list-query.ts` | `listQuerySchema()`, `escapeLike()`, `likePattern()`, `pickSortKey()` |
| `src/server/shared/list-query.test.ts` | Tests for the above |
| `src/i18n/messages.test.ts` | Parity guard between `ar.json` and `en.json` |

**New — React (not tested; verified by typecheck, build, and manual pass):**

| File | Responsibility |
| --- | --- |
| `src/components/theme-provider.tsx` | `next-themes` wrapper |
| `src/components/layout/theme-toggle.tsx` | Light/dark/system control |
| `src/components/layout/user-menu.tsx` | Avatar dropdown: name, role, settings, sign out |
| `src/components/ui/sonner.tsx` | `<Toaster />`, direction-aware |
| `src/components/ui/confirm-dialog.tsx` | `ConfirmProvider` + `useConfirm()` |
| `src/components/ui/data-table/data-table.tsx` | Responsive table/card renderer |
| `src/components/ui/data-table/types.ts` | `Column<T>` descriptor type |
| `src/components/ui/page-header.tsx` | Title, description, search slot, action slot |
| `src/components/ui/row-actions.tsx` | The view/edit/delete icon trio every list row ends in |
| `src/components/ui/search-input.tsx` | Debounced input wired to URL params |
| `src/components/ui/money.tsx` | `<Money>` and `<Measure>` |
| `src/components/ui/empty-state.tsx` | Shared empty state |
| `src/components/ui/table-skeleton.tsx` | Skeletons shaped like the content |

**Modified:** `src/app/globals.css`, `src/app/layout.tsx`, `src/app/error.tsx`, `src/app/not-found.tsx`, `src/app/page.tsx`, `src/components/layout/header.tsx`, `src/components/layout/app-sidebar.tsx`, all seven domain clients, the three settings sub-clients, `src/app/(app)/invite/client.tsx`, the three auth pages, and `types.ts`/`services.ts`/`db.ts` for `companies`, `products`, `raw-materials`, `deliveries`.

---

## Task 1: Token layer

**Files:**
- Modify: `src/app/globals.css:50-117` (the `:root` and `.dark` blocks)

**Interfaces:**
- Consumes: nothing.
- Produces: CSS custom properties consumed by every later task — `--primary`, `--card`, `--background`, `--status-paid`, `--status-paid-foreground`, `--status-partial`, `--status-partial-foreground`, `--status-unpaid`, `--status-unpaid-foreground`, `--chart-1` … `--chart-5`. The `@theme inline` block at the top of the file must also expose the status tokens as Tailwind colours (`--color-status-paid`, etc.) so `bg-status-paid` works as a utility.

**Context:** Today `--card` and `--background` are both `oklch(1 0 0)` in light mode, which is why nearly every `<Card>` in the app carries `border-0 shadow-md dark:bg-card/50` to fake a surface distinction. Giving the background a tint is what lets those hacks be deleted in Tasks 11–13. Separately, `--chart-1..5` are unrelated hues between `:root` and `.dark`, so a revenue bar changes colour when the theme is toggled.

- [ ] **Step 1: Add the status tokens to the `@theme inline` block**

In `src/app/globals.css`, inside `@theme inline { ... }`, after the existing `--color-chart-1: var(--chart-1);` line, add:

```css
  --color-status-paid: var(--status-paid);
  --color-status-paid-foreground: var(--status-paid-foreground);
  --color-status-partial: var(--status-partial);
  --color-status-partial-foreground: var(--status-partial-foreground);
  --color-status-unpaid: var(--status-unpaid);
  --color-status-unpaid-foreground: var(--status-unpaid-foreground);
```

- [ ] **Step 2: Replace the `:root` block**

Replace the whole `:root { ... }` block (currently lines 50–83) with:

```css
:root {
  --radius: 0.625rem;

  /* Surfaces — background is tinted so cards read as raised without
     per-component shadow hacks. */
  --background: oklch(0.985 0.004 200);
  --foreground: oklch(0.21 0.015 220);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.21 0.015 220);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.21 0.015 220);

  /* Deep teal brand */
  --primary: oklch(0.45 0.075 195);
  --primary-foreground: oklch(0.99 0.005 200);
  --secondary: oklch(0.955 0.008 200);
  --secondary-foreground: oklch(0.3 0.03 205);
  --muted: oklch(0.955 0.008 200);
  --muted-foreground: oklch(0.52 0.02 210);
  --accent: oklch(0.93 0.025 195);
  --accent-foreground: oklch(0.3 0.05 200);

  --destructive: oklch(0.55 0.2 25);
  --border: oklch(0.9 0.008 205);
  --input: oklch(0.9 0.008 205);
  --ring: oklch(0.45 0.075 195);

  /* Payment status — the only place these three states get their colour. */
  --status-paid: oklch(0.55 0.12 160);
  --status-paid-foreground: oklch(0.99 0.005 160);
  --status-partial: oklch(0.72 0.13 75);
  --status-partial-foreground: oklch(0.25 0.05 75);
  --status-unpaid: oklch(0.55 0.2 25);
  --status-unpaid-foreground: oklch(0.99 0.005 25);

  /* One ramp, same hues in both themes — only lightness changes. */
  --chart-1: oklch(0.52 0.09 195);
  --chart-2: oklch(0.6 0.11 160);
  --chart-3: oklch(0.75 0.1 85);
  --chart-4: oklch(0.62 0.13 45);
  --chart-5: oklch(0.55 0.04 240);

  --sidebar: oklch(0.97 0.008 200);
  --sidebar-foreground: oklch(0.25 0.02 215);
  --sidebar-primary: oklch(0.45 0.075 195);
  --sidebar-primary-foreground: oklch(0.99 0.005 200);
  --sidebar-accent: oklch(0.92 0.025 195);
  --sidebar-accent-foreground: oklch(0.28 0.05 200);
  --sidebar-border: oklch(0.89 0.01 205);
  --sidebar-ring: oklch(0.45 0.075 195);
}
```

- [ ] **Step 3: Replace the `.dark` block**

Replace the whole `.dark { ... }` block (currently lines 85–117) with:

```css
.dark {
  --background: oklch(0.17 0.012 220);
  --foreground: oklch(0.96 0.005 200);
  --card: oklch(0.22 0.015 220);
  --card-foreground: oklch(0.96 0.005 200);
  --popover: oklch(0.22 0.015 220);
  --popover-foreground: oklch(0.96 0.005 200);

  --primary: oklch(0.72 0.09 190);
  --primary-foreground: oklch(0.18 0.02 210);
  --secondary: oklch(0.28 0.02 215);
  --secondary-foreground: oklch(0.96 0.005 200);
  --muted: oklch(0.28 0.02 215);
  --muted-foreground: oklch(0.72 0.015 205);
  --accent: oklch(0.32 0.04 200);
  --accent-foreground: oklch(0.95 0.01 195);

  --destructive: oklch(0.65 0.18 25);
  --border: oklch(1 0 0 / 12%);
  --input: oklch(1 0 0 / 16%);
  --ring: oklch(0.72 0.09 190);

  --status-paid: oklch(0.68 0.13 160);
  --status-paid-foreground: oklch(0.16 0.03 160);
  --status-partial: oklch(0.78 0.13 75);
  --status-partial-foreground: oklch(0.2 0.04 75);
  --status-unpaid: oklch(0.65 0.18 25);
  --status-unpaid-foreground: oklch(0.16 0.03 25);

  --chart-1: oklch(0.68 0.1 195);
  --chart-2: oklch(0.72 0.12 160);
  --chart-3: oklch(0.82 0.11 85);
  --chart-4: oklch(0.72 0.14 45);
  --chart-5: oklch(0.68 0.05 240);

  --sidebar: oklch(0.2 0.015 220);
  --sidebar-foreground: oklch(0.95 0.005 200);
  --sidebar-primary: oklch(0.72 0.09 190);
  --sidebar-primary-foreground: oklch(0.18 0.02 210);
  --sidebar-accent: oklch(0.3 0.04 200);
  --sidebar-accent-foreground: oklch(0.95 0.01 195);
  --sidebar-border: oklch(1 0 0 / 12%);
  --sidebar-ring: oklch(0.72 0.09 190);
}
```

- [ ] **Step 4: Verify the app still builds**

Run: `pnpm build`
Expected: build succeeds. Tailwind v4 reads `@theme inline` at build time, so a malformed token surfaces here.

- [ ] **Step 5: Checkpoint — stop for review**

Run `pnpm dev` and load `/dashboard`. Expect a teal primary and cards visibly raised off a faintly tinted background. Dark mode is still unreachable at this point — that is Task 2. Report and stop; do not commit.

---

## Task 2: Theme provider and toggle

**Files:**
- Create: `src/components/theme-provider.tsx`
- Create: `src/components/layout/theme-toggle.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `messages/ar.json`, `messages/en.json`

**Interfaces:**
- Consumes: the tokens from Task 1.
- Produces: `<ThemeProvider>` (default export-free named export), and `<ThemeToggle />` consumed by the header in Task 8.

**Context:** `globals.css` defines a full `.dark` token set and roughly ten files use `dark:` utilities, but nothing ever adds the `dark` class. All of it is currently dead code.

- [ ] **Step 1: Install `next-themes`**

Run: `pnpm add next-themes`

- [ ] **Step 2: Create the provider**

Create `src/components/theme-provider.tsx`:

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ComponentProps } from "react";

export function ThemeProvider({
  children,
  ...props
}: ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
```

- [ ] **Step 3: Add the message keys**

In `messages/en.json`, inside the `settings` object, add:

```json
      "theme": "Theme",
      "themeLight": "Light",
      "themeDark": "Dark",
      "themeSystem": "System",
```

In `messages/ar.json`, inside the `settings` object, add:

```json
      "theme": "المظهر",
      "themeLight": "فاتح",
      "themeDark": "داكن",
      "themeSystem": "تلقائي",
```

- [ ] **Step 4: Create the toggle**

Create `src/components/layout/theme-toggle.tsx`:

```tsx
"use client";

import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import { Moon, Sun, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function ThemeToggle() {
  const { setTheme } = useTheme();
  const t = useTranslations("settings");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("theme")}>
          {/* Both icons render; CSS picks one, so there is no hydration
              mismatch from reading the resolved theme during render. */}
          <Sun className="h-4 w-4 dark:hidden" />
          <Moon className="hidden h-4 w-4 dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setTheme("light")}>
          <Sun className="me-2 h-4 w-4" />
          {t("themeLight")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("dark")}>
          <Moon className="me-2 h-4 w-4" />
          {t("themeDark")}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme("system")}>
          <Monitor className="me-2 h-4 w-4" />
          {t("themeSystem")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 5: Wire the provider into the root layout**

In `src/app/layout.tsx`, add `import { ThemeProvider } from "@/components/theme-provider";` and replace the returned JSX with:

```tsx
  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <body className={`${cairo.variable} font-sans antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <NextIntlClientProvider messages={messages}>
            <TRPCReactProvider>{children}</TRPCReactProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
```

`suppressHydrationWarning` on `<html>` is required: `next-themes` writes the class before React hydrates, so the server and client markup differ by design.

- [ ] **Step 6: Verify message parity**

Run: `node -e "const a=require('./messages/ar.json'),e=require('./messages/en.json');const f=(o,p='')=>Object.entries(o).flatMap(([k,v])=>typeof v==='object'?f(v,p+k+'.'):[p+k]);const A=f(a),E=f(e);console.log(A.length,E.length);console.log('only ar:',A.filter(k=>!E.includes(k)));console.log('only en:',E.filter(k=>!A.includes(k)));"`
Expected: `261 261`, and both "only" lists empty.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Checkpoint — stop for review**

The toggle is not mounted anywhere yet (that is Task 8). To verify now, add `class="dark"` to `<html>` in the browser devtools and confirm the dark tokens apply cleanly. Report and stop.

---

## Task 3: Toasts

**Files:**
- Create: `src/components/ui/sonner.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `messages/ar.json`, `messages/en.json`
- Modify: `src/components/companies/ui/CompaniesClient.tsx`, `src/components/products/ui/ProductsClient.tsx`, `src/components/deliveries/ui/DeliveriesClient.tsx`, `src/components/deliveries/ui/DeliveryDetailClient.tsx`, `src/components/raw-materials/ui/RawMaterialTypesClient.tsx`, `src/components/raw-materials/ui/RawMaterialDetailClient.tsx`, `src/components/settings/ui/system-config-client.tsx`, `src/components/settings/ui/dashboard-card-editor.tsx`, `src/app/(app)/invite/client.tsx`

**Interfaces:**
- Consumes: tokens from Task 1.
- Produces: `<Toaster />` mounted globally; every module imports `toast` directly from `sonner`.

**Context:** There are 12 `alert(err.message)` calls. Worse, `CompaniesClient` and `ProductsClient` register `onError` on the **delete** mutation only — a failed create or update currently leaves the dialog open with no message anywhere. Every mutation gets both a success and an error toast in this task.

- [ ] **Step 1: Install `sonner`**

Run: `pnpm add sonner`

- [ ] **Step 2: Add the message keys**

In `messages/en.json`, inside `common`, add:

```json
    "saved": "Saved",
    "deleted": "Deleted",
    "somethingWentWrong": "Something went wrong",
```

In `messages/ar.json`, inside `common`, add:

```json
    "saved": "تم الحفظ",
    "deleted": "تم الحذف",
    "somethingWentWrong": "حدث خطأ ما",
```

- [ ] **Step 3: Create the Toaster**

Create `src/components/ui/sonner.tsx`:

```tsx
"use client";

import { useLocale } from "next-intl";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

export function Toaster(props: ToasterProps) {
  const { theme = "system" } = useTheme();
  const locale = useLocale();
  const isRtl = locale === "ar";

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      dir={isRtl ? "rtl" : "ltr"}
      // Toasts follow the reading direction: they settle on the side the
      // eye starts from.
      position={isRtl ? "top-left" : "top-right"}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "bg-popover text-popover-foreground border-border shadow-lg",
        },
      }}
      {...props}
    />
  );
}
```

- [ ] **Step 4: Mount it**

In `src/app/layout.tsx`, add `import { Toaster } from "@/components/ui/sonner";` and place `<Toaster />` immediately after `<TRPCReactProvider>{children}</TRPCReactProvider>`, still inside `NextIntlClientProvider` (it calls `useLocale`) and inside `ThemeProvider` (it calls `useTheme`):

```tsx
          <NextIntlClientProvider messages={messages}>
            <TRPCReactProvider>{children}</TRPCReactProvider>
            <Toaster />
          </NextIntlClientProvider>
```

- [ ] **Step 5: Replace every `alert()` and add success toasts**

In each of the nine files listed above, add `import { toast } from "sonner";` and apply these two rules:

1. Every `onError: (err) => alert(err.message)` becomes `onError: (err) => toast.error(err.message)`.
2. Every mutation's `onSuccess` gains a toast as its first statement — `toast.success(tc("saved"))` for create and update, `toast.success(tc("deleted"))` for delete — where `tc` comes from `const tc = useTranslations("common");`.
3. Every create and update mutation that has **no** `onError` gains `onError: (err) => toast.error(err.message)`. This applies to `CompaniesClient` create and update, and `ProductsClient` create and update.

Worked example — `src/components/companies/ui/CompaniesClient.tsx`, replacing lines 49–72:

```tsx
  const createMutation = api.companies.create.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      utils.companies.getAll.invalidate();
      setOpen(false);
      setEditItem(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = api.companies.update.useMutation({
    onSuccess: () => {
      toast.success(tc("saved"));
      utils.companies.getAll.invalidate();
      setOpen(false);
      setEditItem(null);
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = api.companies.delete.useMutation({
    onSuccess: () => {
      toast.success(tc("deleted"));
      utils.companies.getAll.invalidate();
      utils.analytics.getDashboardStats.invalidate();
    },
    // Surfaces the "still has deliveries" guard.
    onError: (err) => toast.error(err.message),
  });
```

Leave `RawMaterialDetailClient`'s `setFormError` paths alone — inline validation errors belong next to the form field, not in a toast. Only its two `alert()` calls (lines 73 and 89) become toasts.

- [ ] **Step 6: Confirm no `alert()` remains**

Run: `grep -rn "alert(" src/ --include=*.tsx`
Expected: no output.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Checkpoint — stop for review**

Manually create a company, then try to delete one that has deliveries. Expect a success toast and then an error toast carrying the server's guard message. Report and stop.

---

## Task 4: Confirm dialog

**Files:**
- Create: `src/components/ui/confirm-dialog.tsx`
- Modify: `src/app/(app)/layout.tsx`
- Modify: `messages/ar.json`, `messages/en.json`
- Modify: the same nine client files as Task 3

**Interfaces:**
- Consumes: the existing `Dialog` primitives in `src/components/ui/dialog.tsx`.
- Produces:
  - `<ConfirmProvider>` — wraps the authenticated app.
  - `useConfirm(): (opts: ConfirmOptions) => Promise<boolean>`
  - `type ConfirmOptions = { title: string; description?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean }`

**Context:** Nine `confirm()` calls. The native dialog ignores the page's RTL direction and cannot be themed.

- [ ] **Step 1: Add the message keys**

In `messages/en.json`, inside `common`, add:

```json
    "confirmTitle": "Are you sure?",
    "confirmDeleteDescription": "This cannot be undone.",
    "delete": "Delete",
```

In `messages/ar.json`, inside `common`, add:

```json
    "confirmTitle": "هل أنت متأكد؟",
    "confirmDeleteDescription": "لا يمكن التراجع عن هذا الإجراء.",
    "delete": "حذف",
```

- [ ] **Step 2: Create the provider**

Create `src/components/ui/confirm-dialog.tsx`:

```tsx
"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations("common");
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  // Held in a ref so re-renders while the dialog is open cannot drop the
  // pending promise's resolver.
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    setOptions(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOptions(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={options !== null}
        // Covers Escape and the overlay click, both of which mean "no".
        onOpenChange={(open) => {
          if (!open) settle(false);
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{options?.title ?? t("confirmTitle")}</DialogTitle>
            {options?.description && (
              <DialogDescription>{options.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="ghost" onClick={() => settle(false)}>
              {options?.cancelLabel ?? t("cancel")}
            </Button>
            <Button
              variant={options?.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
            >
              {options?.confirmLabel ?? t("confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
```

- [ ] **Step 3: Check `DialogDescription` and `DialogFooter` are exported**

Run: `grep -n "export {" -A 20 src/components/ui/dialog.tsx`
Expected: `DialogDescription` and `DialogFooter` both appear in the export list. If either is missing, run `npx shadcn@latest add dialog --overwrite` and re-check.

- [ ] **Step 4: Wrap the authenticated app**

Replace `src/app/(app)/layout.tsx` entirely:

```tsx
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { ConfirmProvider } from "@/components/ui/confirm-dialog";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConfirmProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>{children}</SidebarInset>
      </SidebarProvider>
    </ConfirmProvider>
  );
}
```

- [ ] **Step 5: Replace every `confirm()` call**

In each client, add `import { useConfirm } from "@/components/ui/confirm-dialog";`, call `const confirm = useConfirm();` in the component body, and convert each handler to async.

Worked example — `src/components/companies/ui/CompaniesClient.tsx`, replacing `handleDelete` (lines 95–99):

```tsx
  const handleDelete = async (company: Company) => {
    const ok = await confirm({
      title: t("confirmDelete"),
      description: `${company.name} — ${tc("confirmDeleteDescription")}`,
      confirmLabel: tc("delete"),
      destructive: true,
    });
    if (ok) deleteMutation.mutate({ id: company.id });
  };
```

The call site changes from `onClick={() => handleDelete(c.id)}` to `onClick={() => handleDelete(c)}` — passing the row rather than the id is what lets the dialog name the record.

Apply the same shape at all nine sites:

| File | Handler | Name shown in the description |
| --- | --- | --- |
| `CompaniesClient.tsx:95` | `handleDelete` | `company.name` |
| `ProductsClient.tsx:100` | `handleDelete` | `` `${p.lengthM}m × ${p.widthCm}cm` `` |
| `DeliveriesClient.tsx:137` | `handleDelete` | `d.companyName` |
| `RawMaterialTypesClient.tsx:104` | `handleDelete` | `row.name` |
| `RawMaterialDetailClient.tsx:301` | inline, receipts | formatted `dateReceived` |
| `RawMaterialDetailClient.tsx:449` | inline, consumptions | formatted `date` |
| `DeliveryDetailClient.tsx:320` | inline, payments | formatted amount |

The two `RawMaterialDetailClient` inline handlers and the `DeliveryDetailClient` one must be lifted out of JSX into named `async` handlers first — an inline `onClick` cannot `await`.

- [ ] **Step 6: Confirm no `confirm()` remains**

Run: `grep -rn "confirm(" src/ --include=*.tsx | grep -v "useConfirm\|const confirm\|await confirm\|ConfirmProvider\|ConfirmOptions\|confirmLabel"`
Expected: no output.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Checkpoint — stop for review**

Delete a company and confirm the dialog names it, that Escape cancels, and that cancelling does not fire the mutation. Report and stop.

---

## Task 5: Formatting helpers and components

**Files:**
- Create: `src/lib/format.ts`
- Create: `src/lib/format.test.ts`
- Create: `src/components/ui/money.tsx`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `localeTag(locale: string): "ar-EG" | "en-US"`
  - `formatDecimal(value: string | number, locale: string): string`
  - `toDateInputValue(date: Date): string` — local `YYYY-MM-DD`
  - `<Money value={string | number} />` — renders `dir="ltr"` with the translated EGP suffix
  - `<Measure value={string | number} unit="tons" | "kg" />`

**Context:** Formatting is inconsistent across the app — `DeliveriesClient` hardcodes `"EGP"`, `AnalyticsClient` uses `t("egp")`, `ProductsClient` inlines `isArabic ? "كجم" : "kg"`. Separately, `new Date().toISOString().split("T")[0]` appears as a date-input default in four places and is **wrong**: `toISOString` is UTC, so in Cairo (UTC+2/+3) between midnight and 03:00 local the field defaults to yesterday.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatDecimal, localeTag, toDateInputValue } from "./format";

describe("localeTag", () => {
  it("maps ar to the Egyptian tag", () => {
    expect(localeTag("ar")).toBe("ar-EG");
  });

  it("maps en to the US tag", () => {
    expect(localeTag("en")).toBe("en-US");
  });

  it("falls back to en-US for an unknown locale", () => {
    expect(localeTag("fr")).toBe("en-US");
  });
});

describe("formatDecimal", () => {
  it("accepts the strings Drizzle returns for decimal columns", () => {
    expect(formatDecimal("1234.5", "en")).toBe("1,234.5");
  });

  it("accepts numbers too", () => {
    expect(formatDecimal(1234.5, "en")).toBe("1,234.5");
  });

  it("renders an em dash rather than NaN for a non-numeric value", () => {
    expect(formatDecimal("", "en")).toBe("—");
    expect(formatDecimal("abc", "en")).toBe("—");
  });

  it("renders zero as zero, not as the empty placeholder", () => {
    expect(formatDecimal("0", "en")).toBe("0");
  });
});

describe("toDateInputValue", () => {
  it("uses local calendar date, not UTC", () => {
    // 01:30 on the 2nd in UTC+3 is still 22:30 on the 1st in UTC.
    // toISOString would report the 1st; the date input must show the 2nd.
    const d = new Date(2026, 8, 2, 1, 30);
    expect(toDateInputValue(d)).toBe("2026-09-02");
  });

  it("zero-pads month and day", () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/lib/format.test.ts`
Expected: FAIL — `Failed to resolve import "./format"`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/format.ts`:

```ts
/** The app has exactly two locales; anything else reads as English. */
export function localeTag(locale: string): "ar-EG" | "en-US" {
  return locale === "ar" ? "ar-EG" : "en-US";
}

/**
 * Format a value that may arrive as a decimal string (Drizzle returns every
 * `decimal` column as a string) or as a number. Non-numeric input renders an
 * em dash rather than "NaN".
 */
export function formatDecimal(value: string | number, locale: string): string {
  const n = typeof value === "number" ? value : Number(value);
  if (value === "" || value === null || !Number.isFinite(n)) return "—";
  return n.toLocaleString(localeTag(locale));
}

/**
 * Local calendar date as `YYYY-MM-DD`, for `<input type="date">` defaults.
 *
 * Deliberately not `toISOString().split("T")[0]`, which is UTC: east of
 * Greenwich that reports yesterday's date during the early hours of the
 * morning, so the form would silently default to the wrong day.
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/lib/format.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Create the display components**

Create `src/components/ui/money.tsx`:

```tsx
"use client";

import { useLocale, useTranslations } from "next-intl";
import { formatDecimal } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Money always reads left-to-right, including inside an RTL page. */
export function Money({
  value,
  className,
  showUnit = true,
}: {
  value: string | number;
  className?: string;
  showUnit?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("common");

  return (
    <span dir="ltr" className={cn("tabular-nums", className)}>
      {formatDecimal(value, locale)}
      {showUnit && (
        <span className="ms-1 text-xs font-normal text-muted-foreground">
          {t("egp")}
        </span>
      )}
    </span>
  );
}

export function Measure({
  value,
  unit,
  className,
}: {
  value: string | number;
  unit: "tons" | "kg";
  className?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("common");

  return (
    <span dir="ltr" className={cn("tabular-nums", className)}>
      {formatDecimal(value, locale)}
      <span className="ms-1 text-xs font-normal text-muted-foreground">
        {t(unit)}
      </span>
    </span>
  );
}
```

`common.egp`, `common.tons`, and `common.kg` already exist in both message files — no new keys are needed here.

- [ ] **Step 6: Full test run and typecheck**

Run: `pnpm test`
Expected: PASS, all suites.

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Checkpoint — stop for review**

Nothing consumes these yet; they land in Tasks 11–13. Report and stop.

---

## Task 6: List-param helpers

**Files:**
- Create: `src/components/ui/data-table/list-params.ts`
- Create: `src/components/ui/data-table/list-params.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SortDir = "asc" | "desc"`
  - `type ListParams = { page: number; search: string; sortBy: string | null; sortDir: SortDir }`
  - `parseListParams(params: URLSearchParams, allowedSortKeys: readonly string[]): ListParams`
  - `nextSortDir(current: ListParams, key: string): { sortBy: string | null; sortDir: SortDir }`
  - `buildListParams(current: URLSearchParams, patch: Partial<ListParams>): URLSearchParams`

**Context:** Pagination already round-trips through `?page=`. Search and sort join it there, so the browser back button works and a filtered view can be linked. This module is the pure half of the `DataTable` built in Task 7, isolated so the node-only Vitest setup can test it.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ui/data-table/list-params.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildListParams, nextSortDir, parseListParams } from "./list-params";

const ALLOWED = ["name", "createdAt"] as const;

describe("parseListParams", () => {
  it("defaults to page 1 with no search and no sort", () => {
    expect(parseListParams(new URLSearchParams(), ALLOWED)).toEqual({
      page: 1,
      search: "",
      sortBy: null,
      sortDir: "desc",
    });
  });

  it("reads a valid sort key", () => {
    const p = new URLSearchParams("sortBy=name&sortDir=asc");
    expect(parseListParams(p, ALLOWED)).toMatchObject({
      sortBy: "name",
      sortDir: "asc",
    });
  });

  it("drops a sort key that is not whitelisted", () => {
    const p = new URLSearchParams("sortBy=password&sortDir=asc");
    expect(parseListParams(p, ALLOWED).sortBy).toBeNull();
  });

  it("falls back to desc for a bogus direction", () => {
    const p = new URLSearchParams("sortBy=name&sortDir=sideways");
    expect(parseListParams(p, ALLOWED).sortDir).toBe("desc");
  });

  it("clamps a zero or negative page to 1", () => {
    expect(parseListParams(new URLSearchParams("page=0"), ALLOWED).page).toBe(1);
    expect(parseListParams(new URLSearchParams("page=-3"), ALLOWED).page).toBe(1);
  });

  it("clamps a non-numeric page to 1", () => {
    expect(parseListParams(new URLSearchParams("page=abc"), ALLOWED).page).toBe(1);
  });

  it("trims the search term", () => {
    const p = new URLSearchParams("search=  acme  ");
    expect(parseListParams(p, ALLOWED).search).toBe("acme");
  });
});

describe("nextSortDir", () => {
  const base = { page: 1, search: "", sortBy: null, sortDir: "desc" } as const;

  it("sorts ascending when a new column is chosen", () => {
    expect(nextSortDir({ ...base }, "name")).toEqual({
      sortBy: "name",
      sortDir: "asc",
    });
  });

  it("flips ascending to descending on the active column", () => {
    expect(nextSortDir({ ...base, sortBy: "name", sortDir: "asc" }, "name")).toEqual({
      sortBy: "name",
      sortDir: "desc",
    });
  });

  it("clears the sort on the third click", () => {
    expect(nextSortDir({ ...base, sortBy: "name", sortDir: "desc" }, "name")).toEqual({
      sortBy: null,
      sortDir: "desc",
    });
  });

  it("starts a different column fresh at ascending", () => {
    expect(
      nextSortDir({ ...base, sortBy: "name", sortDir: "desc" }, "createdAt"),
    ).toEqual({ sortBy: "createdAt", sortDir: "asc" });
  });
});

describe("buildListParams", () => {
  it("resets to page 1 when the search term changes", () => {
    const current = new URLSearchParams("page=5&search=old");
    const next = buildListParams(current, { search: "new" });
    expect(next.get("page")).toBeNull();
    expect(next.get("search")).toBe("new");
  });

  it("resets to page 1 when the sort changes", () => {
    const current = new URLSearchParams("page=5");
    const next = buildListParams(current, { sortBy: "name", sortDir: "asc" });
    expect(next.get("page")).toBeNull();
  });

  it("keeps the page when only the page changes", () => {
    const next = buildListParams(new URLSearchParams("search=acme"), { page: 3 });
    expect(next.get("page")).toBe("3");
    expect(next.get("search")).toBe("acme");
  });

  it("omits page=1 rather than writing a redundant param", () => {
    expect(buildListParams(new URLSearchParams(), { page: 1 }).get("page")).toBeNull();
  });

  it("drops an emptied search instead of leaving search= behind", () => {
    const next = buildListParams(new URLSearchParams("search=acme"), { search: "" });
    expect(next.get("search")).toBeNull();
  });

  it("drops both sort params when the sort is cleared", () => {
    const current = new URLSearchParams("sortBy=name&sortDir=asc");
    const next = buildListParams(current, { sortBy: null });
    expect(next.get("sortBy")).toBeNull();
    expect(next.get("sortDir")).toBeNull();
  });

  it("preserves unrelated params, such as the settings tab", () => {
    const next = buildListParams(new URLSearchParams("tab=cards"), { page: 2 });
    expect(next.get("tab")).toBe("cards");
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/components/ui/data-table/list-params.test.ts`
Expected: FAIL — `Failed to resolve import "./list-params"`.

- [ ] **Step 3: Write the implementation**

Create `src/components/ui/data-table/list-params.ts`:

```ts
export type SortDir = "asc" | "desc";

export type ListParams = {
  page: number;
  search: string;
  sortBy: string | null;
  sortDir: SortDir;
};

/**
 * Read list state out of the URL.
 *
 * `sortBy` is checked against a whitelist here as well as on the server. The
 * server's check is the one that matters for safety; this one keeps a stale or
 * hand-edited URL from rendering a sort indicator on a column that does not
 * exist.
 */
export function parseListParams(
  params: URLSearchParams,
  allowedSortKeys: readonly string[],
): ListParams {
  const rawPage = Number(params.get("page"));
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.floor(rawPage) : 1;

  const rawSortBy = params.get("sortBy");
  const sortBy = rawSortBy && allowedSortKeys.includes(rawSortBy) ? rawSortBy : null;

  const rawDir = params.get("sortDir");
  const sortDir: SortDir = rawDir === "asc" ? "asc" : "desc";

  return {
    page,
    search: (params.get("search") ?? "").trim(),
    sortBy,
    sortDir,
  };
}

/**
 * Cycle a column header through ascending, descending, then unsorted.
 * Clicking a different column starts that column fresh at ascending.
 */
export function nextSortDir(
  current: Pick<ListParams, "sortBy" | "sortDir">,
  key: string,
): { sortBy: string | null; sortDir: SortDir } {
  if (current.sortBy !== key) return { sortBy: key, sortDir: "asc" };
  if (current.sortDir === "asc") return { sortBy: key, sortDir: "desc" };
  return { sortBy: null, sortDir: "desc" };
}

/**
 * Merge a patch into the current query string.
 *
 * Changing the search term or the sort resets to the first page — page 4 of
 * the old result set is meaningless against the new one. Defaults are omitted
 * rather than written, so the common case stays a clean URL.
 */
export function buildListParams(
  current: URLSearchParams,
  patch: Partial<ListParams>,
): URLSearchParams {
  const next = new URLSearchParams(current);

  const resetsPage =
    patch.search !== undefined ||
    patch.sortBy !== undefined ||
    patch.sortDir !== undefined;

  if (patch.search !== undefined) {
    const term = patch.search.trim();
    if (term) next.set("search", term);
    else next.delete("search");
  }

  if (patch.sortBy !== undefined) {
    if (patch.sortBy) {
      next.set("sortBy", patch.sortBy);
      next.set("sortDir", patch.sortDir ?? "asc");
    } else {
      next.delete("sortBy");
      next.delete("sortDir");
    }
  }

  const page = resetsPage ? 1 : patch.page;
  if (page !== undefined) {
    if (page > 1) next.set("page", String(page));
    else next.delete("page");
  }

  return next;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/components/ui/data-table/list-params.test.ts`
Expected: PASS, 18 tests.

- [ ] **Step 5: Full test run**

Run: `pnpm test`
Expected: PASS, all suites.

- [ ] **Step 6: Checkpoint — stop for review**

Report and stop.

---

## Task 7: DataTable, PageHeader, and shared states

**Files:**
- Create: `src/components/ui/data-table/types.ts`
- Create: `src/components/ui/data-table/data-table.tsx`
- Create: `src/components/ui/page-header.tsx`
- Create: `src/components/ui/row-actions.tsx`
- Create: `src/components/ui/search-input.tsx`
- Create: `src/components/ui/empty-state.tsx`
- Create: `src/components/ui/table-skeleton.tsx`
- Modify: `messages/ar.json`, `messages/en.json`

**Interfaces:**
- Consumes: `list-params.ts` (Task 6), the existing `Table`, `Card`, `Button`, `Input`, `Skeleton` primitives, and `PaginationControls`.
- Produces:
  - `type Column<T> = { id: string; header: string; align?: "start" | "center" | "end"; sortKey?: string; hideOnMobile?: boolean; cell: (row: T) => React.ReactNode }`
  - `<DataTable<T> columns rows isLoading emptyState pagination? getRowKey />`
  - `<PageHeader title description? action? search? />`
  - `<RowActions viewHref? onEdit? onDelete? deleteDisabled? />`
  - `<SearchInput placeholder />`
  - `<EmptyState icon title description action? />`
  - `<TableSkeleton rows? columns? />`

**Context:** Each of the five list clients repeats about eighty lines of near-identical loading / empty / table / pagination markup, and none of them work below `md`. This is the component that makes "responsive everywhere" affordable rather than five separate rewrites.

- [ ] **Step 1: Add the message keys**

In `messages/en.json`, inside `common`, add:

```json
    "sortAscending": "Sort ascending",
    "sortDescending": "Sort descending",
    "clearSort": "Clear sort",
```

In `messages/ar.json`, inside `common`, add:

```json
    "sortAscending": "ترتيب تصاعدي",
    "sortDescending": "ترتيب تنازلي",
    "clearSort": "إلغاء الترتيب",
```

- [ ] **Step 2: Define the column type**

Create `src/components/ui/data-table/types.ts`:

```ts
import type { ReactNode } from "react";

export type ColumnAlign = "start" | "center" | "end";

export type Column<T> = {
  /** Stable identity for React keys and for the mobile card label. */
  id: string;
  /** Already-translated header text. */
  header: string;
  align?: ColumnAlign;
  /**
   * Server-side sort key. Omit to make the column unsortable. Must match one
   * of the domain's `sortBy` enum values in `src/server/<domain>/types.ts`.
   */
  sortKey?: string;
  /** Dropped from the stacked card layout below `md`. */
  hideOnMobile?: boolean;
  cell: (row: T) => ReactNode;
};

export const ALIGN_CLASS: Record<ColumnAlign, string> = {
  start: "text-start",
  center: "text-center",
  end: "text-end",
};
```

- [ ] **Step 3: Build the search input**

Create `src/components/ui/search-input.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { buildListParams } from "@/components/ui/data-table/list-params";

export function SearchInput({ placeholder }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");

  const urlValue = searchParams.get("search") ?? "";
  const [value, setValue] = useState(urlValue);

  // Keeps the box in step with back/forward navigation.
  useEffect(() => setValue(urlValue), [urlValue]);

  useEffect(() => {
    if (value === urlValue) return;
    const id = setTimeout(() => {
      const next = buildListParams(searchParams, { search: value });
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 300);
    return () => clearTimeout(id);
  }, [value, urlValue, pathname, router, searchParams]);

  return (
    <div className="relative w-full sm:w-64">
      <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder ?? t("search")}
        className="ps-9 pe-9"
        aria-label={placeholder ?? t("search")}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute end-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={() => setValue("")}
          aria-label={t("cancel")}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Build the page header**

Create `src/components/ui/page-header.tsx`:

```tsx
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  action,
  search,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  search?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        {search}
        {action}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build the empty state and skeleton**

Create `src/components/ui/empty-state.tsx`:

```tsx
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 px-6 py-20 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-base font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
```

Create `src/components/ui/table-skeleton.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

/** A skeleton shaped like the table it replaces, not a centred spinner. */
export function TableSkeleton({
  rows = 6,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="divide-y divide-border">
      <div className="flex gap-4 bg-muted/40 px-4 py-3">
        {Array.from({ length: columns }, (_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }, (_, r) => (
        <div key={r} className="flex gap-4 px-4 py-4">
          {Array.from({ length: columns }, (_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Build the row-actions cell**

Every list page ends in the same view / edit / delete icon trio. Create `src/components/ui/row-actions.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * The icons are always visible. The previous `opacity-50
 * group-hover:opacity-100` pattern is invisible on touch devices, which have
 * no hover state at all.
 */
export function RowActions({
  viewHref,
  onEdit,
  onDelete,
  deleteDisabled,
}: {
  viewHref?: string;
  onEdit?: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
}) {
  const t = useTranslations("common");

  return (
    <div className="flex items-center justify-center gap-1">
      {viewHref && (
        <Button
          variant="ghost"
          size="icon"
          asChild
          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
        >
          <Link href={viewHref} aria-label={t("view")}>
            <Eye className="h-4 w-4" />
          </Link>
        </Button>
      )}
      {onEdit && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onEdit}
          className="h-8 w-8 hover:bg-primary/10 hover:text-primary"
          aria-label={t("edit")}
        >
          <Pencil className="h-4 w-4" />
        </Button>
      )}
      {onDelete && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          disabled={deleteDisabled}
          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive"
          aria-label={t("delete")}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
```

This needs two more `common` keys. In `messages/en.json`:

```json
    "view": "View",
    "edit": "Edit",
```

In `messages/ar.json`:

```json
    "view": "عرض",
    "edit": "تعديل",
```

- [ ] **Step 7: Build the DataTable**

Create `src/components/ui/data-table/data-table.tsx`:

```tsx
"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PaginationControls } from "@/components/ui/pagination-controls";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { cn } from "@/lib/utils";
import { ALIGN_CLASS, type Column } from "./types";
import { buildListParams, nextSortDir, parseListParams } from "./list-params";

export function DataTable<T>({
  columns,
  rows,
  isLoading,
  emptyState,
  getRowKey,
  pagination,
}: {
  columns: Column<T>[];
  rows: T[];
  isLoading: boolean;
  emptyState: ReactNode;
  getRowKey: (row: T) => string;
  pagination?: { currentPage: number; totalPages: number; totalItems: number };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const t = useTranslations("common");

  const sortKeys = columns.flatMap((c) => (c.sortKey ? [c.sortKey] : []));
  const state = parseListParams(searchParams, sortKeys);

  const toggleSort = (key: string) => {
    const patch = nextSortDir(state, key);
    const next = buildListParams(searchParams, patch);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  if (isLoading) {
    return (
      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <TableSkeleton columns={columns.length} />
        </CardContent>
      </Card>
    );
  }

  if (rows.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-0">{emptyState}</CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <CardContent className="p-0">
        {/* Desktop: dense table with a sticky header. */}
        <div className="hidden md:block">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
              <TableRow className="hover:bg-transparent">
                {columns.map((col) => {
                  const active = col.sortKey && state.sortBy === col.sortKey;
                  const Icon = !col.sortKey
                    ? null
                    : !active
                      ? ChevronsUpDown
                      : state.sortDir === "asc"
                        ? ArrowUp
                        : ArrowDown;

                  return (
                    <TableHead
                      key={col.id}
                      className={cn(
                        "font-semibold",
                        ALIGN_CLASS[col.align ?? "start"],
                      )}
                    >
                      {col.sortKey ? (
                        <button
                          type="button"
                          onClick={() => toggleSort(col.sortKey!)}
                          className="inline-flex items-center gap-1 hover:text-foreground"
                          aria-label={
                            active && state.sortDir === "asc"
                              ? t("sortDescending")
                              : t("sortAscending")
                          }
                        >
                          {col.header}
                          {Icon && (
                            <Icon
                              className={cn(
                                "h-3.5 w-3.5",
                                active ? "text-foreground" : "text-muted-foreground/50",
                              )}
                            />
                          )}
                        </button>
                      ) : (
                        col.header
                      )}
                    </TableHead>
                  );
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={getRowKey(row)} className="group">
                  {columns.map((col) => (
                    <TableCell
                      key={col.id}
                      className={ALIGN_CLASS[col.align ?? "start"]}
                    >
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Mobile: one card per row, label and value paired. */}
        <div className="divide-y divide-border md:hidden">
          {rows.map((row) => (
            <div key={getRowKey(row)} className="space-y-2 p-4">
              {columns
                .filter((col) => !col.hideOnMobile)
                .map((col) => (
                  <div
                    key={col.id}
                    className="flex items-start justify-between gap-4"
                  >
                    <span className="text-xs font-medium text-muted-foreground">
                      {col.header}
                    </span>
                    <span className="text-end text-sm">{col.cell(row)}</span>
                  </div>
                ))}
            </div>
          ))}
        </div>

        {pagination && pagination.totalPages > 1 && (
          <PaginationControls {...pagination} />
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 8: Check the `Card` default padding**

Run: `grep -n "function Card" -A 12 src/components/ui/card.tsx`
Expected: the root `Card` applies vertical padding (`py-6`) by default. The `p-0` passed above cancels it so the table meets the card edge. If the local `Card` has no default padding, drop the `p-0`.

- [ ] **Step 9: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 10: Verify message parity**

Run the parity one-liner from Task 2 Step 6.
Expected: equal counts, both "only" lists empty.

- [ ] **Step 11: Checkpoint — stop for review**

Nothing consumes `DataTable` yet; Task 11 migrates the list pages. Report and stop.

---

## Task 8: App shell

**Files:**
- Modify: `src/components/layout/header.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`
- Create: `src/components/layout/user-menu.tsx`
- Modify: `messages/ar.json`, `messages/en.json`

**Interfaces:**
- Consumes: `<ThemeToggle />` (Task 2).
- Produces: `<Header title breadcrumb? />` — `breadcrumb` is an optional `{ href: string; label: string }` for detail pages, consumed in Task 12.

**Context:** The header is 37 lines: a sidebar trigger, a title, and a language toggle that calls `window.location.reload()`. Locale is read from a cookie by a server component, so `router.refresh()` re-renders `<html lang dir>` correctly while preserving scroll and client state. Separately, the sidebar's active check is `pathname === item.href`, so `/raw-materials/abc` highlights nothing.

- [ ] **Step 1: Add the message keys**

In `messages/en.json`, inside `nav`, add:

```json
      "account": "Account",
      "role": "Role"
```

In `messages/ar.json`, inside `nav`, add:

```json
      "account": "الحساب",
      "role": "الصلاحية"
```

Mind the trailing commas — check the surrounding JSON and adjust so the file stays valid.

- [ ] **Step 2: Build the user menu**

Create `src/components/layout/user-menu.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { LogOut, Settings, User } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut, useSession } from "@/lib/auth-client";

export function UserMenu() {
  const t = useTranslations("nav");
  const { data: session } = useSession();

  const name = session?.user?.name ?? session?.user?.email ?? "";
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const role = session?.user?.role;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label={t("account")}>
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary text-xs text-primary-foreground">
              {initial}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="space-y-1">
          <p className="truncate text-sm font-medium">{name}</p>
          {role && (
            <Badge variant="secondary" className="text-[10px] uppercase">
              {role}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="me-2 h-4 w-4" />
            {t("settings")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onClick={() =>
            signOut({
              fetchOptions: {
                onSuccess: () => {
                  window.location.href = "/auth/login";
                },
              },
            })
          }
        >
          <LogOut className="me-2 h-4 w-4" />
          {t("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

`User` is imported but unused — remove that import if ESLint flags it.

- [ ] **Step 3: Rebuild the header**

Replace `src/components/layout/header.tsx` entirely:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight, Languages } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserMenu } from "@/components/layout/user-menu";

export function Header({
  title,
  breadcrumb,
}: {
  title: string;
  breadcrumb?: { href: string; label: string };
}) {
  const t = useTranslations("settings");
  const locale = useLocale();
  const router = useRouter();

  const toggleLanguage = () => {
    const newLocale = locale === "ar" ? "en" : "ar";
    document.cookie = `locale=${newLocale};path=/;max-age=31536000`;
    // The locale is read from this cookie by a server component, so a refresh
    // re-renders <html lang dir> without discarding scroll or client state.
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <SidebarTrigger />
      <Separator orientation="vertical" className="h-6" />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        {breadcrumb && (
          <>
            <Link
              href={breadcrumb.href}
              className="truncate text-sm text-muted-foreground hover:text-foreground"
            >
              {breadcrumb.label}
            </Link>
            {/* The separator points along the reading direction. */}
            <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:hidden" />
            <ChevronLeft className="hidden h-4 w-4 shrink-0 text-muted-foreground rtl:block" />
          </>
        )}
        <h2 className="truncate text-lg font-semibold">{title}</h2>
      </div>

      <Button variant="ghost" size="sm" onClick={toggleLanguage} className="gap-2">
        <Languages className="h-4 w-4" />
        <span className="text-xs">{locale === "en" ? t("arabic") : t("english")}</span>
      </Button>
      <ThemeToggle />
      <UserMenu />
    </header>
  );
}
```

- [ ] **Step 4: Fix the sidebar active state and drop the duplicated sign-out**

In `src/components/layout/app-sidebar.tsx`:

Replace line 69, `const isActive = pathname === item.href;`, with:

```tsx
                // `/raw-materials/abc` must keep the Raw Materials item lit.
                const isActive =
                  pathname === item.href || pathname.startsWith(`${item.href}/`);
```

Then delete the sign-out `SidebarMenuItem` (lines 106–122) and the now-unused `LogOut` and `signOut` imports — sign-out lives in the user menu. Keep `useSession`, which is still used for `isDev`.

- [ ] **Step 5: Verify message parity**

Run the parity one-liner from Task 2 Step 6.
Expected: equal counts, both "only" lists empty.

- [ ] **Step 6: Typecheck and lint**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: only the known pre-existing `src/components/ui/sidebar.tsx` `Math.random` error.

- [ ] **Step 7: Checkpoint — stop for review**

Load any page. Confirm the header sticks on scroll, the theme toggle switches light/dark/system, the language toggle swaps direction without a full page reload, and the avatar menu signs out. Report and stop.

---

## Task 9: Server-side search and sort — shared helpers plus `companies`

**Files:**
- Create: `src/server/shared/list-query.ts`
- Create: `src/server/shared/list-query.test.ts`
- Modify: `src/server/companies/types.ts`
- Modify: `src/server/companies/services.ts`
- Modify: `src/server/companies/db.ts`
- Modify: `src/server/companies/router.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `escapeLike(term: string): string`
  - `likePattern(term: string): string`
  - `pickSortKey<K extends string>(sortBy: string | undefined, allowed: readonly K[]): K | null`
  - `listQueryFields(sortKeys: readonly [string, ...string[]])` — the Zod shape merged into each domain's `GetXSchema`
  - `type ListQueryInput = { page: number; forDropdown: boolean; search?: string; sortBy?: string; sortDir: "asc" | "desc" }`

**Context:** Search has to reach the server because pagination already does. Filtering the current page client-side would search page 1 of N and report a total that disagrees with the rows shown. `companies` is done in full here as the pattern; Task 10 applies it to the other three domains.

- [ ] **Step 1: Write the failing tests**

Create `src/server/shared/list-query.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { escapeLike, likePattern, pickSortKey } from "./list-query";

describe("escapeLike", () => {
  it("escapes the percent wildcard so a bare % is a literal", () => {
    expect(escapeLike("100%")).toBe("100\\%");
  });

  it("escapes the single-character wildcard", () => {
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes the backslash first so escapes are not double-applied", () => {
    expect(escapeLike("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary text untouched, Arabic included", () => {
    expect(escapeLike("ورق")).toBe("ورق");
  });
});

describe("likePattern", () => {
  it("wraps the escaped term for a contains match", () => {
    expect(likePattern("acme")).toBe("%acme%");
  });

  it("keeps a wildcard in the term literal", () => {
    expect(likePattern("50%")).toBe("%50\\%%");
  });
});

describe("pickSortKey", () => {
  const allowed = ["name", "createdAt"] as const;

  it("returns a whitelisted key", () => {
    expect(pickSortKey("name", allowed)).toBe("name");
  });

  it("rejects a key that is not whitelisted", () => {
    expect(pickSortKey("password", allowed)).toBeNull();
  });

  it("returns null when nothing was requested", () => {
    expect(pickSortKey(undefined, allowed)).toBeNull();
  });

  it("is case sensitive — no fuzzy matching into the whitelist", () => {
    expect(pickSortKey("NAME", allowed)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm test src/server/shared/list-query.test.ts`
Expected: FAIL — `Failed to resolve import "./list-query"`.

- [ ] **Step 3: Write the implementation**

Create `src/server/shared/list-query.ts`:

```ts
import { z } from "zod";

/**
 * Escape the wildcards Postgres `LIKE`/`ILIKE` treats as special, so a user
 * typing "100%" searches for the literal text rather than matching every row.
 *
 * The backslash must be replaced first — doing it later would also escape the
 * backslashes this function just introduced.
 */
export function escapeLike(term: string): string {
  return term.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}

/** A contains-match pattern for `ilike`. */
export function likePattern(term: string): string {
  return `%${escapeLike(term)}%`;
}

/**
 * Resolve a requested sort key against a whitelist.
 *
 * Zod already constrains `sortBy` to an enum at the router boundary; this is
 * the second gate, at the point where a column is actually chosen. A sort key
 * must never reach `orderBy` as an arbitrary string.
 */
export function pickSortKey<K extends string>(
  sortBy: string | undefined,
  allowed: readonly K[],
): K | null {
  if (!sortBy) return null;
  return (allowed as readonly string[]).includes(sortBy) ? (sortBy as K) : null;
}

/**
 * The list-query fields every paged `GetXSchema` shares. Spread into the
 * domain's own `z.object({ ... })` rather than extended, so each domain keeps
 * one flat schema.
 */
export function listQueryFields<T extends readonly [string, ...string[]]>(
  sortKeys: T,
) {
  return {
    page: z.number().int().min(1).default(1),
    /** Fetching to fill a picker rather than to page a table. */
    forDropdown: z.boolean().default(false),
    search: z.string().trim().max(200).optional(),
    sortBy: z.enum(sortKeys).optional(),
    sortDir: z.enum(["asc", "desc"]).default("desc"),
  };
}

export type ListQueryInput = {
  page: number;
  forDropdown: boolean;
  search?: string;
  sortBy?: string;
  sortDir: "asc" | "desc";
};
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `pnpm test src/server/shared/list-query.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Extend the companies schema**

Replace `GetCompaniesSchema` in `src/server/companies/types.ts` (lines 14–18) with:

```ts
export const COMPANY_SORT_KEYS = ["name", "contactPerson", "createdAt"] as const;
export type CompanySortKey = (typeof COMPANY_SORT_KEYS)[number];

export const GetCompaniesSchema = z.object(listQueryFields(COMPANY_SORT_KEYS));
```

and add to the imports at the top of the file:

```ts
import { listQueryFields } from "../shared/list-query";
```

- [ ] **Step 6: Apply search and sort in the query layer**

Replace `findCompanies` in `src/server/companies/db.ts` (lines 7–25) with:

```ts
export async function findCompanies(
  page = 1,
  limit = 10,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  const offset = (page - 1) * limit;

  // The count and the page must share one predicate, or totalPages
  // describes a different result set than the rows returned.
  const term = search?.trim();
  const where = term
    ? or(
        ilike(companies.name, likePattern(term)),
        ilike(companies.contactPerson, likePattern(term)),
        ilike(companies.phone, likePattern(term)),
        ilike(companies.address, likePattern(term)),
      )
    : undefined;

  const [totalResult] = await db
    .select({ count: sql`count(*)` })
    .from(companies)
    .where(where);
  const total = Number(totalResult?.count || 0);

  const SORT_COLUMNS = {
    name: companies.name,
    contactPerson: companies.contactPerson,
    createdAt: companies.createdAt,
  } as const;

  const key = pickSortKey(sortBy, COMPANY_SORT_KEYS);
  const direction = sortDir === "asc" ? asc : desc;
  const orderBy = key ? direction(SORT_COLUMNS[key]) : desc(companies.createdAt);

  const data = await db
    .select()
    .from(companies)
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
```

Update the imports at the top of `src/server/companies/db.ts`:

```ts
import { eq, desc, asc, or, ilike, sql } from "drizzle-orm";
import { likePattern, pickSortKey } from "../shared/list-query";
import { COMPANY_SORT_KEYS } from "./types";
```

Note `Math.max(1, ...)` on `totalPages` — the old code returned `0` for an empty table, which `PaginationControls` handled only by accident.

- [ ] **Step 7: Thread the arguments through the service**

Replace `getCompaniesService` in `src/server/companies/services.ts` (lines 12–14) with:

```ts
export async function getCompaniesService(
  page: number,
  limit: number,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  return await findCompanies(page, limit, search, sortBy, sortDir);
}
```

- [ ] **Step 8: Pass the new input from the router**

Replace the `getAll` procedure in `src/server/companies/router.ts` (lines 8–16) with:

```ts
  getAll: protectedProcedure
    .input(GetCompaniesSchema)
    .query(async ({ input }) => {
      const { pageSizeDefault, dropdownListLimit } = await getSettingsMap();
      return await getCompaniesService(
        input.page,
        input.forDropdown ? dropdownListLimit : pageSizeDefault,
        input.search,
        input.sortBy,
        input.sortDir,
      );
    }),
```

- [ ] **Step 9: Full test run and typecheck**

Run: `pnpm test`
Expected: PASS, all suites.

Run: `npx tsc --noEmit`
Expected: no errors. Existing callers pass only `{ page }` or `{ page, forDropdown }`; the new fields are optional or defaulted, so no call site breaks.

- [ ] **Step 10: Verify against the real database**

Run `pnpm dev`, open `/companies`, and append `?search=<a substring of a real company name>` to the URL. Confirm the rows filter and the total in the pagination footer matches. Then try `?search=%` and confirm it matches only companies whose name literally contains a percent sign, rather than everything.

- [ ] **Step 11: Checkpoint — stop for review**

Report and stop.

---

## Task 10: Search and sort for the remaining three domains

**Files:**
- Modify: `src/server/raw-materials/types.ts`, `src/server/raw-materials/types.db.ts`, `src/server/raw-materials/services.ts`, `src/server/raw-materials/router.ts`
- Modify: `src/server/products/types.ts`, `src/server/products/db.ts`, `src/server/products/services.ts`, `src/server/products/router.ts`
- Modify: `src/server/deliveries/types.ts`, `src/server/deliveries/db.ts`, `src/server/deliveries/services.ts`, `src/server/deliveries/router.ts`

**Interfaces:**
- Consumes: `listQueryFields`, `likePattern`, `pickSortKey` from Task 9.
- Produces: `RAW_MATERIAL_SORT_KEYS`, `PRODUCT_SORT_KEYS`, `DELIVERY_SORT_KEYS`, each exported from its domain's `types.ts` and referenced by the `sortKey` fields of the columns defined in Task 11.

**Context:** Same shape as Task 9, three more times. Two wrinkles: raw materials sort on derived SQL expressions rather than plain columns, and products and deliveries filter across a `leftJoin`, so the `where` must be applied to the joined query in both the count and the page.

- [ ] **Step 1: Raw materials — schema**

In `src/server/raw-materials/types.ts`, add `import { listQueryFields } from "../shared/list-query";` and replace `GetTypesSchema` (lines 14–18) with:

```ts
export const RAW_MATERIAL_SORT_KEYS = [
  "name",
  "receivedTons",
  "consumedTons",
  "balanceTons",
] as const;
export type RawMaterialSortKey = (typeof RAW_MATERIAL_SORT_KEYS)[number];

export const GetTypesSchema = z.object(listQueryFields(RAW_MATERIAL_SORT_KEYS));
```

- [ ] **Step 2: Raw materials — query layer**

Replace `findTypes` in `src/server/raw-materials/types.db.ts` (lines 44–72) with:

```ts
export async function findTypes(
  page = 1,
  limit = 50,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  const offset = (page - 1) * limit;

  const term = search?.trim();
  const where = term
    ? or(
        ilike(rawMaterialTypes.name, likePattern(term)),
        ilike(rawMaterialTypes.notes, likePattern(term)),
      )
    : undefined;

  const [totalResult] = await db
    .select({ count: sql<string>`count(*)` })
    .from(rawMaterialTypes)
    .where(where);
  const total = Number(totalResult?.count || 0);

  // Balance has no column — it is received minus consumed — so sorting on it
  // means ordering by the same expression the select computes.
  const balanceSql = sql`(${receivedSql}) - (${consumedSql})`;
  const SORT_EXPRESSIONS = {
    name: rawMaterialTypes.name,
    receivedTons: receivedSql,
    consumedTons: consumedSql,
    balanceTons: balanceSql,
  } as const;

  const key = pickSortKey(sortBy, RAW_MATERIAL_SORT_KEYS);
  const direction = sortDir === "asc" ? asc : desc;
  const orderBy = key
    ? direction(SORT_EXPRESSIONS[key])
    : asc(rawMaterialTypes.name);

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
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map(withDerived),
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
```

Update the imports in that file to `import { eq, desc, asc, or, ilike, sql } from "drizzle-orm";`, plus `import { likePattern, pickSortKey } from "../shared/list-query";` and `import { RAW_MATERIAL_SORT_KEYS } from "./types";`.

The `receivedSql` / `consumedSql` constants are already defined at the top of the file and already write the outer column as literal SQL text (`raw_material_types.id`) rather than interpolating the Drizzle column. **Do not change them** — the comment above them documents a bug that silently zeroed every total.

- [ ] **Step 3: Raw materials — service and router**

In `src/server/raw-materials/services.ts`, widen the function that calls `findTypes`:

```ts
export async function getTypesService(
  page: number,
  limit: number,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  return await findTypes(page, limit, search, sortBy, sortDir);
}
```

Keep whatever name the function already has — check it with `grep -n "findTypes" src/server/raw-materials/services.ts` and widen that function rather than introducing a new one.

In `src/server/raw-materials/router.ts`, forward the new input in the `getAll` procedure:

```ts
      return await getTypesService(
        input.page,
        input.forDropdown ? dropdownListLimit : pageSizeDefault,
        input.search,
        input.sortBy,
        input.sortDir,
      );
```

- [ ] **Step 4: Products — schema**

In `src/server/products/types.ts`, add `import { listQueryFields } from "../shared/list-query";` and replace `GetProductsSchema` (lines 18–22) with:

```ts
export const PRODUCT_SORT_KEYS = [
  "dateProduced",
  "lengthM",
  "widthCm",
  "weightKg",
  "quantity",
] as const;
export type ProductSortKey = (typeof PRODUCT_SORT_KEYS)[number];

export const GetProductsSchema = z.object(listQueryFields(PRODUCT_SORT_KEYS));
```

- [ ] **Step 5: Products — query layer**

Replace `findProducts` in `src/server/products/db.ts` (lines 7–37) with:

```ts
export async function findProducts(
  page = 1,
  limit = 10,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  const offset = (page - 1) * limit;

  const term = search?.trim();
  const where = term
    ? or(
        ilike(products.notes, likePattern(term)),
        ilike(rawMaterialTypes.name, likePattern(term)),
      )
    : undefined;

  // The count carries the same join as the page, because the predicate
  // reaches across it to the material name.
  const [totalResult] = await db
    .select({ count: sql`count(*)` })
    .from(products)
    .leftJoin(rawMaterialTypes, eq(products.rawMaterialTypeId, rawMaterialTypes.id))
    .where(where);
  const total = Number(totalResult?.count || 0);

  const SORT_COLUMNS = {
    dateProduced: products.dateProduced,
    lengthM: products.lengthM,
    widthCm: products.widthCm,
    weightKg: products.weightKg,
    quantity: products.quantity,
  } as const;

  const key = pickSortKey(sortBy, PRODUCT_SORT_KEYS);
  const direction = sortDir === "asc" ? asc : desc;
  const orderBy = key ? direction(SORT_COLUMNS[key]) : desc(products.dateProduced);

  const data = await db
    .select({
      id: products.id,
      rawMaterialTypeId: products.rawMaterialTypeId,
      dateProduced: products.dateProduced,
      lengthM: products.lengthM,
      widthCm: products.widthCm,
      weightKg: products.weightKg,
      quantity: products.quantity,
      notes: products.notes,
      createdAt: products.createdAt,
      materialName: rawMaterialTypes.name,
    })
    .from(products)
    .leftJoin(rawMaterialTypes, eq(products.rawMaterialTypeId, rawMaterialTypes.id))
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
```

Update the imports to `import { eq, desc, asc, or, ilike, sql } from "drizzle-orm";`, plus `likePattern`, `pickSortKey`, and `PRODUCT_SORT_KEYS`.

`lengthM`, `widthCm`, and `weightKg` are `decimal` columns. Postgres orders them numerically, not lexically, so no cast is needed — but do not "fix" this by sorting the formatted strings on the client.

- [ ] **Step 6: Products — service and router**

In `src/server/products/services.ts`:

```ts
export async function getProductsService(
  page: number,
  limit: number,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  return await findProducts(page, limit, search, sortBy, sortDir);
}
```

In `src/server/products/router.ts`, inside `getAll`:

```ts
      return await getProductsService(
        input.page,
        input.forDropdown ? dropdownListLimit : pageSizeDefault,
        input.search,
        input.sortBy,
        input.sortDir,
      );
```

- [ ] **Step 7: Deliveries — schema**

`GetDeliveriesSchema` has no `forDropdown` field today, but `listQueryFields` supplies one with a `false` default, which is harmless and keeps the four domains uniform.

In `src/server/deliveries/types.ts`, add `import { listQueryFields } from "../shared/list-query";` and replace `GetDeliveriesSchema` (lines 37–39) with:

```ts
export const DELIVERY_SORT_KEYS = [
  "date",
  "companyName",
  "sellingPriceEgp",
  "paymentStatus",
] as const;
export type DeliverySortKey = (typeof DELIVERY_SORT_KEYS)[number];

export const GetDeliveriesSchema = z.object(listQueryFields(DELIVERY_SORT_KEYS));
```

- [ ] **Step 8: Deliveries — query layer**

Replace `findDeliveries` in `src/server/deliveries/db.ts` (lines 24–52) with:

```ts
export async function findDeliveries(
  page = 1,
  limit = 10,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  const offset = (page - 1) * limit;

  const term = search?.trim();
  const where = term
    ? or(
        ilike(companies.name, likePattern(term)),
        ilike(deliveries.notes, likePattern(term)),
      )
    : undefined;

  const [totalResult] = await db
    .select({ count: sql`count(*)` })
    .from(deliveries)
    .leftJoin(companies, eq(deliveries.companyId, companies.id))
    .where(where);
  const total = Number(totalResult?.count || 0);

  const SORT_COLUMNS = {
    date: deliveries.date,
    companyName: companies.name,
    sellingPriceEgp: deliveries.sellingPriceEgp,
    paymentStatus: deliveries.paymentStatus,
  } as const;

  const key = pickSortKey(sortBy, DELIVERY_SORT_KEYS);
  const direction = sortDir === "asc" ? asc : desc;
  const orderBy = key ? direction(SORT_COLUMNS[key]) : desc(deliveries.date);

  const data = await db
    .select({
      id: deliveries.id,
      date: deliveries.date,
      companyId: deliveries.companyId,
      companyName: companies.name,
      sellingPriceEgp: deliveries.sellingPriceEgp,
      paymentStatus: deliveries.paymentStatus,
      notes: deliveries.notes,
      createdAt: deliveries.createdAt,
    })
    .from(deliveries)
    .leftJoin(companies, eq(deliveries.companyId, companies.id))
    .where(where)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    data,
    total,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  };
}
```

Update the imports to `import { eq, desc, asc, or, ilike, sql } from "drizzle-orm";`, plus `likePattern`, `pickSortKey`, and `DELIVERY_SORT_KEYS`.

Sorting by `paymentStatus` orders alphabetically — `paid`, `partial`, `unpaid` — which happens to run best to worst. That is a coincidence worth leaving alone rather than encoding a custom order.

- [ ] **Step 9: Deliveries — service and router**

In `src/server/deliveries/services.ts`:

```ts
export async function getDeliveriesService(
  page: number,
  limit: number,
  search?: string,
  sortBy?: string,
  sortDir: "asc" | "desc" = "desc",
) {
  return await findDeliveries(page, limit, search, sortBy, sortDir);
}
```

In `src/server/deliveries/router.ts`, inside `getAll`. Note this router may not currently read `dropdownListLimit`, because `GetDeliveriesSchema` had no `forDropdown` field — if it does not, keep passing `pageSizeDefault` alone rather than adding a dropdown branch nothing calls:

```ts
      return await getDeliveriesService(
        input.page,
        pageSizeDefault,
        input.search,
        input.sortBy,
        input.sortDir,
      );
```

- [ ] **Step 10: Full test run, typecheck, build**

Run: `pnpm test`
Expected: PASS, all suites.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 11: Verify each endpoint against the real database**

With `pnpm dev` running, exercise each list URL directly and confirm the rows and the footer total agree:

- `/raw-materials?search=<substring>&sortBy=balanceTons&sortDir=asc`
- `/products?search=<material name>&sortBy=quantity&sortDir=desc`
- `/deliveries?search=<company name>&sortBy=sellingPriceEgp&sortDir=desc`

Then confirm a bogus key is ignored rather than erroring: `/companies?sortBy=DROP` should render normally in default order.

- [ ] **Step 12: Checkpoint — stop for review**

The UI has no search box or sortable headers yet — Task 11 adds them. Report and stop.

---

## Task 11: Migrate the list pages

**Files:**
- Modify: `src/components/companies/ui/CompaniesClient.tsx`
- Modify: `src/components/raw-materials/ui/RawMaterialTypesClient.tsx`
- Modify: `src/components/products/ui/ProductsClient.tsx`
- Modify: `src/components/deliveries/ui/DeliveriesClient.tsx`
- Modify: `messages/ar.json`, `messages/en.json`

**Interfaces:**
- Consumes: `DataTable`, `Column<T>`, `PageHeader`, `SearchInput`, `EmptyState` (Task 7); `Money`, `Measure`, `formatDecimal`, `toDateInputValue` (Task 5); the sort-key constants (Tasks 9–10).
- Produces: nothing consumed downstream.

**Context:** Each client keeps its dialog, its mutations, and its handlers unchanged. What is replaced is the render half: the `flex justify-between` header block, the loading branch, the empty branch, the `<Table>`, and the pagination call — all of which become a `columns` array plus one `<DataTable>`.

- [ ] **Step 1: Add the search-placeholder keys**

In `messages/en.json`, add `"searchPlaceholder"` inside each of `companies`, `rawMaterials`, `products`, and `deliveries`:

```json
      "searchPlaceholder": "Search by name or contact…"
```
```json
      "searchPlaceholder": "Search materials…"
```
```json
      "searchPlaceholder": "Search by material or notes…"
```
```json
      "searchPlaceholder": "Search by company or notes…"
```

In `messages/ar.json`, the same four keys:

```json
      "searchPlaceholder": "ابحث بالاسم أو جهة الاتصال…"
```
```json
      "searchPlaceholder": "ابحث في المواد…"
```
```json
      "searchPlaceholder": "ابحث بالمادة أو الملاحظات…"
```
```json
      "searchPlaceholder": "ابحث بالشركة أو الملاحظات…"
```

- [ ] **Step 2: Migrate `CompaniesClient` — read state from the URL**

Replace the page-reading lines (currently lines 44–47) with:

```tsx
  const searchParams = useSearchParams();
  const { page, search, sortBy, sortDir } = parseListParams(
    searchParams,
    COMPANY_SORT_KEYS,
  );

  const { data, isLoading } = api.companies.getAll.useQuery({
    page,
    search: search || undefined,
    // parseListParams returns `string | null`; the tRPC input expects the key
    // or nothing at all, so null has to become undefined here.
    sortBy: (sortBy ?? undefined) as CompanySortKey | undefined,
    sortDir,
  });
```

Add the imports — the same set, minus the domain-specific sort key, is needed in all four list clients:

```tsx
import { parseListParams } from "@/components/ui/data-table/list-params";
import { DataTable } from "@/components/ui/data-table/data-table";
import type { Column } from "@/components/ui/data-table/types";
import { PageHeader } from "@/components/ui/page-header";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { RowActions } from "@/components/ui/row-actions";
import { Money, Measure } from "@/components/ui/money";
import { localeTag, toDateInputValue } from "@/lib/format";
import { COMPANY_SORT_KEYS, type CompanySortKey } from "@/server/companies/types";
```

Drop whichever of `Money`, `Measure`, `localeTag`, and `toDateInputValue` a given client does not use — `CompaniesClient` needs none of them, `ProductsClient` needs all four.

Also remove the now-unused `Table`/`TableBody`/`TableCell`/`TableHead`/`TableHeader`/`TableRow`, `Card`/`CardContent`, `PaginationControls`, and `Loader2` imports from each migrated client. ESLint will flag them.

- [ ] **Step 3: Migrate `CompaniesClient` — define the columns**

Immediately before the `return`, add:

```tsx
  const columns: Column<Company>[] = [
    {
      id: "name",
      header: t("name"),
      sortKey: "name",
      cell: (c) => <span className="font-medium">{c.name}</span>,
    },
    {
      id: "contactPerson",
      header: t("contactPerson"),
      sortKey: "contactPerson",
      cell: (c) => (
        <span className="text-muted-foreground">{c.contactPerson || "—"}</span>
      ),
    },
    {
      id: "phone",
      header: t("phone"),
      cell: (c) => (
        <span dir="ltr" className="text-muted-foreground">
          {c.phone || "—"}
        </span>
      ),
    },
    {
      id: "address",
      header: t("address"),
      hideOnMobile: true,
      cell: (c) => (
        <span className="text-muted-foreground">{c.address || "—"}</span>
      ),
    },
    {
      id: "notes",
      header: t("notes"),
      hideOnMobile: true,
      cell: (c) => (
        <span className="block max-w-[200px] truncate text-muted-foreground">
          {c.notes || "—"}
        </span>
      ),
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: t("actions"),
            align: "center" as const,
            cell: (c: Company) => (
              <RowActions
                onEdit={() => handleEdit(c)}
                onDelete={() => handleDelete(c)}
                deleteDisabled={deleteMutation.isPending}
              />
            ),
          },
        ]
      : []),
  ];
```

- [ ] **Step 4: Migrate `CompaniesClient` — replace the render body**

Replace everything from `<div className="space-y-6 animate-in fade-in duration-500">` to the end of the component with:

```tsx
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("title")}
        search={<SearchInput placeholder={t("searchPlaceholder")} />}
        action={
          canWrite ? (
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditItem(null); }}>
              {/* DialogTrigger and DialogContent unchanged from the existing
                  implementation — move them here verbatim. */}
            </Dialog>
          ) : undefined
        }
      />

      <DataTable
        columns={columns}
        rows={data?.data ?? []}
        isLoading={isLoading}
        getRowKey={(c) => c.id}
        emptyState={
          <EmptyState
            icon={Building2}
            title={search ? tc("noResults") : t("noData")}
            description={search ? undefined : t("emptyStateDesc")}
          />
        }
        pagination={
          data
            ? {
                currentPage: page,
                totalPages: data.totalPages,
                totalItems: data.total,
              }
            : undefined
        }
      />
    </div>
  );
```

The empty state now distinguishes "no companies exist" from "no companies match this search" — previously both rendered the same message.

- [ ] **Step 5: Migrate `RawMaterialTypesClient`**

Same five moves. Its columns:

```tsx
  const columns: Column<TypeRow>[] = [
    {
      id: "name",
      header: t("materialName"),
      sortKey: "name",
      cell: (row) => (
        <Link
          href={`/raw-materials/${row.id}`}
          className="font-medium hover:text-primary"
        >
          {row.name}
        </Link>
      ),
    },
    {
      id: "received",
      header: t("received"),
      align: "center",
      sortKey: "receivedTons",
      cell: (row) => <Measure value={row.receivedTons} unit="tons" />,
    },
    {
      id: "consumed",
      header: t("consumed"),
      align: "center",
      sortKey: "consumedTons",
      cell: (row) => (
        <Measure value={row.consumedTons} unit="tons" className="text-muted-foreground" />
      ),
    },
    {
      id: "balance",
      header: t("balance"),
      align: "center",
      sortKey: "balanceTons",
      cell: (row) => (
        <Measure
          value={row.balanceTons}
          unit="tons"
          className={
            Number(row.balanceTons) > 0
              ? "font-semibold text-status-paid"
              : "font-semibold text-muted-foreground"
          }
        />
      ),
    },
    {
      id: "avgCost",
      header: t("avgCostPerTon"),
      align: "center",
      hideOnMobile: true,
      cell: (row) =>
        row.avgCostPerTon ? <Money value={row.avgCostPerTon} /> : "—",
    },
    {
      id: "actions",
      header: t("actions"),
      align: "center",
      cell: (row) => (
        <RowActions
          // The view link is available to every role; only writers get the
          // edit and delete controls.
          viewHref={`/raw-materials/${row.id}`}
          onEdit={
            canWrite
              ? () => {
                  setEditItem(row);
                  setOpen(true);
                }
              : undefined
          }
          onDelete={canWrite ? () => handleDelete(row) : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
      ),
    },
  ];
```

Note this column is *not* wrapped in a `canWrite` spread — the view link should render for read-only users too.

The hardcoded `text-emerald-600 dark:text-emerald-500` becomes `text-status-paid`, which is defined in both themes by Task 1.

`handleDelete` changes signature from `(id: string)` to `(row: TypeRow)` so the confirm dialog can name the material, matching the change made in Task 4 Step 5.

- [ ] **Step 6: Migrate `ProductsClient`**

Its columns:

```tsx
  const columns: Column<(typeof products)[number]>[] = [
    {
      id: "dateProduced",
      header: t("dateProduced"),
      sortKey: "dateProduced",
      cell: (p) => (
        <span dir="ltr">
          {new Date(p.dateProduced).toLocaleDateString(localeTag(locale), {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "material",
      header: t("rawMaterial"),
      cell: (p) => <span className="text-muted-foreground">{p.materialName || "—"}</span>,
    },
    {
      id: "lengthM",
      header: t("lengthM"),
      align: "center",
      sortKey: "lengthM",
      cell: (p) => <span dir="ltr" className="tabular-nums">{p.lengthM}</span>,
    },
    {
      id: "widthCm",
      header: t("widthCm"),
      align: "center",
      sortKey: "widthCm",
      cell: (p) => <span dir="ltr" className="tabular-nums">{p.widthCm}</span>,
    },
    {
      id: "weightKg",
      header: t("weightKg"),
      align: "center",
      sortKey: "weightKg",
      cell: (p) => <Measure value={p.weightKg} unit="kg" />,
    },
    {
      id: "quantity",
      header: t("quantity"),
      align: "center",
      sortKey: "quantity",
      cell: (p) => <span dir="ltr" className="font-medium tabular-nums">{p.quantity}</span>,
    },
    ...(canWrite
      ? [
          {
            id: "actions",
            header: t("actions"),
            align: "center" as const,
            cell: (p: (typeof products)[number]) => (
              <RowActions
                onEdit={() => handleEdit(p)}
                onDelete={() => handleDelete(p)}
                deleteDisabled={deleteMutation.isPending}
              />
            ),
          },
        ]
      : []),
  ];
```

Products have no detail page, so there is no view link — the column is gated entirely on `canWrite`.

Also replace the two `new Date().toISOString().split("T")[0]` date-input defaults (lines 160 and 161) with `toDateInputValue(new Date())`, and the edit default with `toDateInputValue(new Date(editItem.dateProduced))`. The inline `isArabic ? "كجم" : "kg"` on line 317 is gone — `<Measure unit="kg">` translates it.

- [ ] **Step 7: Migrate `DeliveriesClient`**

Replace `PaymentBadge` (lines 41–55) with a token-driven version:

```tsx
const STATUS_CLASS: Record<string, string> = {
  paid: "bg-status-paid text-status-paid-foreground",
  partial: "bg-status-partial text-status-partial-foreground",
  unpaid: "bg-status-unpaid text-status-unpaid-foreground",
};

function PaymentBadge({ status }: { status: "paid" | "partial" | "unpaid" | null }) {
  const t = useTranslations("deliveries");
  const value = status ?? "unpaid";
  return (
    <Badge className={cn("border-transparent", STATUS_CLASS[value])}>
      {t(value)}
    </Badge>
  );
}
```

`paid` previously rendered as `variant="default"`, which is the plain primary colour — indistinguishable from a neutral chip.

Its columns:

```tsx
  const columns: Column<(typeof deliveries)[number]>[] = [
    {
      id: "date",
      header: t("date"),
      sortKey: "date",
      cell: (d) => (
        <span dir="ltr">
          {new Date(d.date).toLocaleDateString(localeTag(locale), {
            year: "numeric",
            month: "short",
            day: "numeric",
          })}
        </span>
      ),
    },
    {
      id: "company",
      header: t("company"),
      sortKey: "companyName",
      cell: (d) => <span className="font-medium">{d.companyName}</span>,
    },
    {
      id: "sellingPrice",
      header: t("sellingPrice"),
      align: "center",
      sortKey: "sellingPriceEgp",
      cell: (d) => <Money value={d.sellingPriceEgp} className="font-medium" />,
    },
    {
      id: "paymentStatus",
      header: t("paymentStatus"),
      align: "center",
      sortKey: "paymentStatus",
      cell: (d) => <PaymentBadge status={d.paymentStatus} />,
    },
    {
      id: "notes",
      header: t("notes"),
      hideOnMobile: true,
      cell: (d) => (
        <span className="block max-w-[200px] truncate text-muted-foreground">
          {d.notes || "—"}
        </span>
      ),
    },
    {
      id: "actions",
      header: t("actions"),
      align: "center",
      cell: (d) => (
        <RowActions
          viewHref={`/deliveries/${d.id}`}
          onDelete={canWrite ? () => handleDelete(d) : undefined}
          deleteDisabled={deleteMutation.isPending}
        />
      ),
    },
  ];
```

Deliveries are edited on their detail page rather than in a row dialog, so no `onEdit` is passed. The column renders for every role because of the view link.

Also replace its date-input default (line 176) with `toDateInputValue(new Date())`, and drop the hardcoded `" EGP"` on line 335 — `<Money>` supplies the translated unit.

- [ ] **Step 8: Verify message parity**

Run the parity one-liner from Task 2 Step 6.
Expected: equal counts, both "only" lists empty.

- [ ] **Step 9: Typecheck, lint, build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: only the known pre-existing `sidebar.tsx` error.

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 10: Manual pass**

For each of `/companies`, `/raw-materials`, `/products`, `/deliveries`:

- Type in the search box; confirm the URL gains `?search=`, the rows filter, and the footer total agrees.
- Click a sortable header three times; confirm ascending, descending, then unsorted, and that the page resets to 1 each time.
- Narrow the browser below 768px; confirm the table becomes stacked cards with no horizontal page scroll.
- Toggle to dark; confirm no washed-out cards or invisible text.
- Toggle to English and back to Arabic; confirm alignment and the search icon flip sides.

- [ ] **Step 11: Checkpoint — stop for review**

Report and stop.

---

## Task 12: Migrate the detail and dashboard pages

**Files:**
- Modify: `src/components/raw-materials/ui/RawMaterialDetailClient.tsx`
- Modify: `src/components/deliveries/ui/DeliveryDetailClient.tsx`
- Modify: `src/components/analytics/ui/AnalyticsClient.tsx`
- Modify: `src/components/analytics/ui/StatCard.tsx`
- Modify: `src/app/(app)/raw-materials/[id]/page.tsx`, `src/app/(app)/deliveries/[id]/page.tsx`

**Interfaces:**
- Consumes: `Money`, `Measure`, `formatDecimal`, `localeTag`, `toDateInputValue` (Task 5); `EmptyState` (Task 7); `Header`'s `breadcrumb` prop (Task 8).
- Produces: nothing consumed downstream.

**Context:** The detail pages use nested tables inside cards, which is fine — they do not get `DataTable`. What they need is the back-arrow fix, token-driven status colours, skeletons, and responsive summary grids.

- [ ] **Step 1: Fix the inverted back arrows**

In `src/components/raw-materials/ui/RawMaterialDetailClient.tsx`, replace lines 149–150:

```tsx
          {/* "Back" points against the reading direction: left in LTR,
              right in RTL. This was inverted. */}
          <ArrowLeft className="h-4 w-4 rtl:hidden" />
          <ArrowRight className="hidden h-4 w-4 rtl:block" />
```

In `src/components/deliveries/ui/DeliveryDetailClient.tsx`, replace lines 114–115 with the same two lines.

Both files currently show `ArrowRight` in LTR for a "back to list" link, which contradicts `PaginationControls`, where the equivalent case is right.

- [ ] **Step 2: Move the back link into the header breadcrumb**

In `src/app/(app)/raw-materials/[id]/page.tsx`, pass the breadcrumb to `<Header>`:

```tsx
      <Header
        title={t("materialDetail")}
        breadcrumb={{ href: "/raw-materials", label: t("title") }}
      />
```

Do the same in `src/app/(app)/deliveries/[id]/page.tsx` with `href: "/deliveries"`.

Check whether `rawMaterials.materialDetail` exists in the message files first:

Run: `node -e "const a=require('./messages/ar.json');console.log(Object.keys(a.rawMaterials).join(','))"`

If the key is absent, add `"materialDetail"` / `"deliveryDetail"` to both files rather than reusing `title`, and keep the two files in step.

The in-page back `Button` stays as well — on mobile the breadcrumb truncates, and a large tap target at the top of the content is worth keeping.

- [ ] **Step 3: Replace the detail-page spinners with skeletons**

In both detail clients, replace the `isLoading` branch (`RawMaterialDetailClient` lines 98–104, `DeliveryDetailClient` lines 78–84) with a skeleton shaped like the page:

```tsx
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-9 w-40" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }
```

Add `import { Skeleton } from "@/components/ui/skeleton";` to both.

- [ ] **Step 4: Replace hardcoded status colours**

In `RawMaterialDetailClient` line 166, replace `"text-emerald-600 dark:text-emerald-500"` with `"text-status-paid"`.

In `DeliveryDetailClient`:
- line 156: `text-emerald-600 dark:text-emerald-500` → `text-status-paid`
- line 170: the `remaining > 0` ternary becomes `"text-status-unpaid"` / `"text-status-paid"`
- line 308: `text-emerald-600 dark:text-emerald-500` → `text-status-paid`
- lines 32–45: replace its local `PaymentBadge` with the token-driven version written in Task 11 Step 7. Both copies are identical — extract it to `src/components/deliveries/ui/payment-badge.tsx` and import it in both files rather than maintaining two.

Also replace the three hardcoded `" EGP"` suffixes (lines 145, 157, 174, 309) with `<Money value={...} />`.

- [ ] **Step 5: Replace the not-found branches**

In both detail clients, replace the `if (!data)` / `if (!delivery)` blocks with `<EmptyState>`:

```tsx
  if (!data) {
    return (
      <EmptyState
        icon={PackageOpen}
        title={t("notFound")}
        action={
          <Button variant="outline" asChild>
            <Link href="/raw-materials">{t("backToMaterials")}</Link>
          </Button>
        }
      />
    );
  }
```

`deliveries.deliveryNotFound` already exists. Check whether `rawMaterials.notFound` does with the key-listing command from Step 2; if not, add it to both message files.

- [ ] **Step 6: Fix the dashboard RTL margin bug**

In `src/components/analytics/ui/AnalyticsClient.tsx`, lines 133 and 230 both read `className="h-3 w-3 ml-1 rtl:mr-1"`. In RTL **both** margins apply, because `rtl:mr-1` adds a margin rather than replacing `ml-1`. Replace both with:

```tsx
                  <ExternalLink className="h-3 w-3 ms-1" />
```

- [ ] **Step 7: Make the dashboard's own formatting consistent**

In `AnalyticsClient`:
- line 125: `{company.balance.toLocaleString()} {t("egp")}` → `<Money value={company.balance} />`, keeping `text-status-unpaid` in place of `text-destructive`.
- line 211: `{delivery.sellingPriceEgp.toLocaleString()}` → `<Money value={delivery.sellingPriceEgp} showUnit={false} />`
- lines 197–198: replace `className={isArabic ? "text-right" : "text-left"}` with `className="text-start"` on both `TableHead`s, and the same on line 207's `TableCell`. Logical properties already do this — the conditional is redundant and gets it wrong if the locale list ever grows.
- lines 155, 175, 208: replace `isArabic ? 'ar-EG' : 'en-US'` with `localeTag(locale)`.
- line 220: the status `Badge` uses the same three-way variant map as the list page. Import the extracted `PaymentBadge` from Task 12 Step 4 and use it.

- [ ] **Step 8: Drop the now-redundant card hacks**

Across `AnalyticsClient`, `StatCard`, and both detail clients, remove `border-0`, `dark:bg-card/50`, and `bg-card/50` from every `<Card>`. Task 1 gave `--card` a real surface distinction from `--background`, so the default card styling is now correct and these overrides actively flatten it.

Keep the `shadow-md hover:shadow-lg` transitions — those are intentional affordance, not a workaround.

- [ ] **Step 9: Typecheck, lint, build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: only the known pre-existing `sidebar.tsx` error.

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 10: Manual pass**

Load `/dashboard`, `/raw-materials/<id>`, `/deliveries/<id>` in both locales and both themes. Confirm the back arrow points the correct way in each direction, the breadcrumb appears in the header, the summary cards reflow to one column on a narrow screen, and paid/unpaid figures are visibly different colours in dark mode.

- [ ] **Step 11: Checkpoint — stop for review**

Report and stop.

---

## Task 13: Auth, landing, settings, invite, and error pages

**Files:**
- Modify: `src/app/error.tsx`, `src/app/not-found.tsx`
- Modify: `src/app/auth/login/page.tsx`, `src/app/auth/signup/client.tsx`, `src/app/auth/forgot-password/page.tsx`
- Modify: `src/app/page.tsx`
- Modify: `src/app/(app)/settings/page.tsx`
- Modify: `src/app/(app)/invite/client.tsx`
- Modify: `messages/ar.json`, `messages/en.json`

**Interfaces:**
- Consumes: everything built so far.
- Produces: nothing.

**Context:** `error.tsx` and `not-found.tsx` are hardcoded English while `ar` is the default locale — an Arabic user hitting a 404 gets an English page. The auth pages are outside the `(app)` route group, so they have no header and no theme toggle.

- [ ] **Step 1: Add the error-page message keys**

In `messages/en.json`, add a new top-level `errors` namespace:

```json
  "errors": {
    "title": "Something went wrong",
    "description": "An unexpected error occurred. Please try again.",
    "retry": "Try again",
    "notFoundTitle": "Page not found",
    "notFoundDescription": "The page you're looking for doesn't exist.",
    "goToDashboard": "Go to dashboard"
  }
```

In `messages/ar.json`:

```json
  "errors": {
    "title": "حدث خطأ ما",
    "description": "حدث خطأ غير متوقع. برجاء المحاولة مرة أخرى.",
    "retry": "إعادة المحاولة",
    "notFoundTitle": "الصفحة غير موجودة",
    "notFoundDescription": "الصفحة التي تبحث عنها غير موجودة.",
    "goToDashboard": "الذهاب إلى لوحة التحكم"
  }
```

- [ ] **Step 2: Translate `error.tsx`**

`error.tsx` is a client component inside the `NextIntlClientProvider` tree, so `useTranslations` works. Replace the three hardcoded strings:

```tsx
  const t = useTranslations("errors");
  // ...
            <h2 className="text-xl font-semibold">{t("title")}</h2>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
  // ...
          <Button onClick={reset} className="gap-2">
            <RefreshCw className="h-4 w-4" />
            {t("retry")}
          </Button>
```

Add `import { useTranslations } from "next-intl";`.

- [ ] **Step 3: Translate `not-found.tsx`**

`not-found.tsx` is a server component. Use `getTranslations` and make the component `async`:

```tsx
import { getTranslations } from "next-intl/server";

export default async function NotFound() {
  const t = await getTranslations("errors");
  // ...
            <h1 className="text-4xl font-bold">404</h1>
            <p className="text-muted-foreground">{t("notFoundDescription")}</p>
  // ...
          <Button asChild className="gap-2">
            <Link href="/dashboard">{t("goToDashboard")}</Link>
          </Button>
```

- [ ] **Step 4: Add a theme toggle to the auth pages**

In each of `src/app/auth/login/page.tsx`, `src/app/auth/signup/client.tsx`, and `src/app/auth/forgot-password/page.tsx`, add a floating toggle as the first child of the outermost wrapper:

```tsx
      <div className="absolute end-4 top-4">
        <ThemeToggle />
      </div>
```

The wrapper needs `relative` added to its class list. Import `ThemeToggle` from `@/components/layout/theme-toggle`.

- [ ] **Step 5: Convert auth error state to toasts, keeping inline errors**

In `login/page.tsx`, the inline `{error && <p …>}` block stays — a failed sign-in belongs next to the form, not in a corner toast. Leave it, but restyle it to use the tokens:

```tsx
              <p className="rounded-md bg-destructive/10 py-2 text-center text-sm text-destructive">
                {error}
              </p>
```

- [ ] **Step 6: Fix the login submit icon**

`login/page.tsx` line 99 uses `UserPlus` — a "add a user" icon on a sign-in button. Replace the import and the usage with `LogIn` from `lucide-react`.

- [ ] **Step 7: Drop the card hacks on the auth, landing, settings, and invite pages**

Remove `border-0 … bg-card/80 backdrop-blur-sm` from the auth cards and `border-0 shadow-md bg-card/50` from the settings cards, for the reason given in Task 12 Step 8. Keep `shadow-2xl` on the auth cards — a single floating card on an empty page is a case where heavy elevation is the point.

- [ ] **Step 8: Replace the invite page's alerts**

`src/app/(app)/invite/client.tsx` has four `alert()`/`confirm()` calls. If any survived Tasks 3 and 4, convert them now: `alert` → `toast`, `confirm` → `useConfirm`.

Run: `grep -n "alert(\|confirm(" src/app/\(app\)/invite/client.tsx`
Expected: no output.

- [ ] **Step 9: Landing page — respect reduced motion**

`src/app/page.tsx` uses `animate-pulse` on six decorative elements and `animate-bounce` on a floating badge. Wrap the decorative background block (lines 55–58) and the floating badge (line 120) with `motion-reduce:animate-none` on each animated element, so the page is usable for anyone with reduced-motion set.

- [ ] **Step 10: Verify message parity**

Run the parity one-liner from Task 2 Step 6.
Expected: equal counts, both "only" lists empty.

- [ ] **Step 11: Typecheck, lint, build**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: only the known pre-existing `sidebar.tsx` error.

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 12: Checkpoint — stop for review**

Visit `/does-not-exist` in Arabic and confirm the 404 is in Arabic. Sign out and confirm the login page has a working theme toggle. Report and stop.

---

## Task 14: Parity guard and final verification

**Files:**
- Create: `src/i18n/messages.test.ts`

**Interfaces:**
- Consumes: `messages/ar.json`, `messages/en.json`.
- Produces: a regression guard.

**Context:** `next-intl`'s `t()` throws `MISSING_MESSAGE` rather than returning undefined, so a key added to one file only is a runtime crash. This work added roughly twenty keys across seven tasks; the guard makes the next divergence a failing test rather than a broken page.

- [ ] **Step 1: Write the failing test**

Create `src/i18n/messages.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import ar from "../../messages/ar.json";
import en from "../../messages/en.json";

/** Flatten to dotted paths so a nested namespace mismatch is visible. */
function keyPaths(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) =>
    value !== null && typeof value === "object"
      ? keyPaths(value as Record<string, unknown>, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );
}

describe("message files", () => {
  const arKeys = keyPaths(ar).sort();
  const enKeys = keyPaths(en).sort();

  it("has no key present only in Arabic", () => {
    expect(arKeys.filter((k) => !enKeys.includes(k))).toEqual([]);
  });

  it("has no key present only in English", () => {
    expect(enKeys.filter((k) => !arKeys.includes(k))).toEqual([]);
  });

  it("has no empty translation in either file", () => {
    const empties = [
      ...keyPaths(ar).filter((k) => resolve(ar, k) === ""),
      ...keyPaths(en).filter((k) => resolve(en, k) === ""),
    ];
    expect(empties).toEqual([]);
  });
});

function resolve(obj: Record<string, unknown>, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((acc, part) => (acc as Record<string, unknown>)?.[part], obj);
}
```

- [ ] **Step 2: Run it**

Run: `pnpm test src/i18n/messages.test.ts`
Expected: PASS, 3 tests. If it fails, the failure lists the divergent keys — fix the message files rather than the test.

If Vitest cannot import JSON, add `resolveJsonModule: true` to `compilerOptions` in `tsconfig.json`. Check first:

Run: `grep -n "resolveJsonModule" tsconfig.json`

- [ ] **Step 3: Full verification sweep**

Run: `pnpm test`
Expected: PASS, all suites — `equation-parser`, `status`, `balance`, `validation`, `format`, `list-params`, `list-query`, `messages`.

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `pnpm lint`
Expected: exactly one error, the pre-existing `src/components/ui/sidebar.tsx` `Math.random` rule. Any other output is new breakage introduced by this work.

Run: `pnpm build`
Expected: build succeeds.

- [ ] **Step 4: Confirm the native dialogs are gone**

Run: `grep -rn "alert(\|window.confirm" src/ --include=*.tsx`
Expected: no output.

- [ ] **Step 5: Confirm no directional-margin bugs remain**

Run: `grep -rn "rtl:mr-\|rtl:ml-\|rtl:pr-\|rtl:pl-" src/ --include=*.tsx`
Expected: no output. Every case should now use `ms-*`, `me-*`, `ps-*`, or `pe-*`.

Note that `rtl:hidden` and `rtl:block` on paired directional icons are correct and are expected to remain — they swap which icon renders, they do not stack a second property.

- [ ] **Step 6: Full manual matrix**

For each page — `/`, `/auth/login`, `/dashboard`, `/raw-materials`, `/raw-materials/<id>`, `/products`, `/companies`, `/deliveries`, `/deliveries/<id>`, `/settings`, `/invite`, `/does-not-exist` — check all four combinations of `ar`/`en` × light/dark, at both 375px and 1440px width.

Look for: text overflowing its container, invisible text in dark mode, horizontal page scroll on mobile, icons pointing the wrong way in RTL, and any untranslated string.

- [ ] **Step 7: Checkpoint — stop for review**

Report the full verification output and stop. Do not commit; the repository owner reviews and commits.

---

## Notes for the executor

- **Nothing in this plan changes a business rule.** If a change appears to alter what a number means, stop and ask — it is a mistake, not a requirement.
- **`DataTable` is a display component only.** Filtering, sorting, and paging all happen on the server. If you find yourself sorting an array in a client component, the wiring is wrong.
- **Tasks 9 and 10 are the only ones that touch `src/server/`.** If a UI task seems to need a server change, re-read the task — it probably does not.
- **Message keys are added in both files in the same step, never "the other one later."**
