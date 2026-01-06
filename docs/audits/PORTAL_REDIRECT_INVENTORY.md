# Portal Redirect Inventory

> Generated: 2026-01-05
> Purpose: Systematic inventory of all redirect and URL issues across portals

## Problem Statement

When a user starts on `app.fiskai.hr`:

1. Middleware correctly redirects unauthenticated users to `fiskai.hr/login?callbackUrl=https://app.fiskai.hr/`
2. After login, server-side code does `redirect("/dashboard")` - staying on marketing domain
3. Marketing domain has no `/dashboard` route -> 404

**Root cause:** Multiple server-side redirects to `/dashboard` that don't respect the user's intended portal.

## Required Invariant

> If the user starts on `app.fiskai.hr`, after login they MUST land on `app.fiskai.hr/...` (not root domain).

This must be enforced server-side, not just client-side.

---

## A) Server-Side Redirects to `/dashboard`

These are the critical bugs - server actions/pages that redirect to `/dashboard` without respecting portal context.

### Category 1: Auth Flow Redirects (HIGH PRIORITY)

| File:Line                         | Current                                    | Fix                                                 |
| --------------------------------- | ------------------------------------------ | --------------------------------------------------- |
| `src/lib/actions/auth.ts:147`     | `redirect("/dashboard")` after login       | Redirect to `/` (middleware handles control-center) |
| `src/lib/auth-utils.ts:61`        | `redirect("/dashboard")` in requireAdmin   | Redirect to `/`                                     |
| `src/app/(auth)/auth/page.tsx:14` | `redirect("/dashboard")` for authenticated | Redirect to `/`                                     |

### Category 2: Admin Portal Fallbacks

| File:Line                                          | Current                  | Fix             |
| -------------------------------------------------- | ------------------------ | --------------- |
| `src/app/(admin)/admin-control-center/page.tsx:85` | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(admin)/regulatory/sources/page.tsx:12`   | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(admin)/regulatory/conflicts/page.tsx:22` | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(admin)/regulatory/inbox/page.tsx:23`     | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(admin)/regulatory/releases/page.tsx:12`  | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(admin)/regulatory/page.tsx:68`           | `redirect("/dashboard")` | Redirect to `/` |

### Category 3: Staff Portal Fallbacks

| File:Line                                           | Current                  | Fix             |
| --------------------------------------------------- | ------------------------ | --------------- |
| `src/app/(staff)/staff-settings/page.tsx:25`        | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(staff)/layout.tsx:17`                     | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(staff)/clients/[clientId]/layout.tsx:58`  | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(staff)/staff-control-center/page.tsx:119` | `redirect("/dashboard")` | Redirect to `/` |

### Category 4: App Portal Fallbacks

| File:Line                                     | Current                  | Fix             |
| --------------------------------------------- | ------------------------ | --------------- |
| `src/app/(app)/corporate-tax/page.tsx:18`     | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(app)/pausalni/po-sd/page.tsx:18`    | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(app)/pausalni/page.tsx:16`          | `redirect("/dashboard")` | Redirect to `/` |
| `src/app/(app)/pausalni/settings/page.tsx:18` | `redirect("/dashboard")` | Redirect to `/` |

### Category 5: Visibility/Route Protection

| File:Line                                    | Current                                               | Fix                       |
| -------------------------------------------- | ----------------------------------------------------- | ------------------------- |
| `src/lib/visibility/route-protection.tsx:44` | `redirect(accessResult.redirectTo \|\| "/dashboard")` | Change fallback to `/`    |
| `src/lib/visibility/server.ts:208`           | `redirectTo: "/dashboard?blocked=..."`                | Change to `/?blocked=...` |
| `src/lib/visibility/server.ts:218`           | `redirectTo: "/dashboard?locked=..."`                 | Change to `/?locked=...`  |

### Category 6: Select-Role Page

| File:Line                                     | Current                             | Fix                      |
| --------------------------------------------- | ----------------------------------- | ------------------------ |
| `src/app/(marketing)/select-role/page.tsx:57` | `redirect("/dashboard")` in dev     | Redirect to `/`          |
| `src/app/(marketing)/select-role/page.tsx:65` | `redirect(\`${appUrl}/dashboard\`)` | Redirect to `${appUrl}/` |
| `src/app/(marketing)/select-role/page.tsx:94` | `href = "/dashboard"`               | Change to `/`            |
| `src/app/(marketing)/select-role/page.tsx:96` | `href = \`${url}/dashboard\``       | Change to `${url}/`      |

---

## B) OAuth/SSO CallbackUrl Hardcoding

| File:Line                             | Current                                           | Fix                                            |
| ------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| `src/components/auth/AuthFlow.tsx:21` | `signIn("google", { callbackUrl: "/dashboard" })` | Use `searchParams.get("callbackUrl") \|\| "/"` |

---

## C) Client-Side Navigation to `/dashboard`

These are less critical but should be updated for consistency:

| File:Line                                          | Current                     | Fix                               |
| -------------------------------------------------- | --------------------------- | --------------------------------- |
| `src/components/layout/header.tsx:81`              | `<Link href="/dashboard">`  | Keep (within-portal link is fine) |
| `src/components/layout/bottom-nav.tsx:21`          | `href: "/dashboard"`        | Keep (within-portal link is fine) |
| `src/lib/navigation.ts:62`                         | `href: "/dashboard"`        | Keep (within-portal nav)          |
| `src/lib/shortcuts/index.ts:22`                    | `href: "/dashboard"`        | Keep (within-portal shortcut)     |
| `src/hooks/use-keyboard-shortcuts.ts:312`          | `router.push("/dashboard")` | Keep (within-portal nav)          |
| `src/components/onboarding/step-billing.tsx:75,91` | `router.push("/dashboard")` | Keep (within same portal)         |

**Note:** Within-portal navigation to `/dashboard` is acceptable IF `/dashboard` exists as a route OR middleware redirects it. We'll implement Option A (middleware redirect).

---

## D) Hardcoded Portal URLs in Emails

These must use portal-urls helper for environment safety:

| File:Line                                   | Current                                    | Fix                    |
| ------------------------------------------- | ------------------------------------------ | ---------------------- |
| `src/lib/admin/weekly-digest-format.ts:197` | `href="https://admin.fiskai.hr/dashboard"` | Use `getAdminUrl("/")` |
| `src/emails/ai-quality-digest.tsx:64`       | `href="https://admin.fiskai.hr/dashboard"` | Use `getAdminUrl("/")` |
| `src/emails/admin-weekly-digest.tsx:228`    | `href="https://admin.fiskai.hr/dashboard"` | Use `getAdminUrl("/")` |

---

## E) Middleware Helper

| File:Line                             | Current                | Fix           |
| ------------------------------------- | ---------------------- | ------------- |
| `src/lib/middleware/subdomain.ts:100` | Returns `"/dashboard"` | Change to `/` |

---

## Fix Strategy

### Option A (CHOSEN): `/dashboard` becomes a compatibility alias

1. Add middleware rule: `/dashboard` -> redirect to `/` (same host)
2. Middleware already redirects `/` to `/xxx-control-center` for authenticated users
3. This preserves old bookmarks and handles legacy code gracefully

### Implementation Order

1. Fix server-side auth flow redirects (Category 1) - stops the 404s
2. Add `/dashboard` -> `/` middleware redirect - handles legacy
3. Fix remaining server-side redirects (Categories 2-6)
4. Fix OAuth callbackUrl hardcoding
5. Fix hardcoded email URLs
6. Add build info to /api/status for deployment verification

---

## Verification Script

After fixes, run `scripts/smoke-portals.sh` to verify:

- All portals respond correctly
- `/dashboard` redirects work
- No 404s on any portal

---

## Acceptance Criteria

- [ ] `app.fiskai.hr` -> login -> lands on `app.fiskai.hr/app-control-center` (not marketing domain)
- [ ] `staff.fiskai.hr` -> login -> lands on `staff.fiskai.hr/staff-control-center`
- [ ] `admin.fiskai.hr` -> login -> lands on `admin.fiskai.hr/admin-control-center`
- [ ] `/dashboard` on any portal redirects to `/` (then to control-center)
- [ ] Google Sign-In preserves intended portal
- [ ] `/api/status` shows commit SHA and build time
