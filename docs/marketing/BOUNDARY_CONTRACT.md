# Marketing Static Export Boundary Contract

> **Status:** Enforced via ESLint + CI
> **Last Updated:** 2026-01-09
> **Related PR:** Phase 2 Marketing Boundary Enforcement

## Overview

The marketing site (`fiskai.hr`) is deployed as static HTML, completely separate from the dynamic application (`app.fiskai.hr`). This architectural decision ensures:

1. **100% uptime** - Marketing site survives backend outages
2. **Fast performance** - No server-side rendering latency
3. **Reduced costs** - Can be served from any static CDN/host
4. **Security** - No attack surface from database or auth

## Boundary Scope

Marketing routes are defined as:

- `src/app/(marketing)/**/*` - All files in the marketing route group
- `src/components/marketing/**/*` - Marketing-specific components

## Forbidden Dependencies

Marketing code **MUST NOT** import or use:

### Database & ORM

| Import                          | Reason                        |
| ------------------------------- | ----------------------------- |
| `@/lib/db`, `@/lib/db/**`       | No database at static runtime |
| `drizzle-orm`, `drizzle-orm/**` | ORM requires database         |
| `@prisma/client`, `@prisma/*`   | Prisma requires database      |

### Authentication

| Import                        | Reason                           |
| ----------------------------- | -------------------------------- |
| `@/lib/auth`, `@/lib/auth/**` | Auth lives on app.fiskai.hr only |

### Server Features

| Import/Pattern                      | Reason                         |
| ----------------------------------- | ------------------------------ |
| `@/app/actions`, `@/app/actions/**` | Server actions require server  |
| `next/server`                       | Server-only Next.js APIs       |
| `next/headers`                      | No server to read headers from |
| `next/cache`                        | No server for revalidation     |
| `"use server"` directive            | Server actions not available   |
| `dynamic = "force-dynamic"`         | Must be statically renderable  |

### Node.js APIs

| Global/Import   | Reason                              |
| --------------- | ----------------------------------- |
| `Buffer`        | Node.js only, not in browser        |
| `fs`, `fs/*`    | Filesystem not available in browser |
| `path`          | Node.js path module                 |
| `child_process` | Cannot spawn processes in browser   |

### Environment Variables

| Pattern                     | Allowed                       |
| --------------------------- | ----------------------------- |
| `process.env.NEXT_PUBLIC_*` | Yes - inlined at build time   |
| `process.env.*` (other)     | No - not available at runtime |

## Enforcement Layers

### Layer 1: ESLint Rules (`.eslintrc.json`)

```json
{
  "files": ["src/app/(marketing)/**/*", "src/components/marketing/**/*"],
  "rules": {
    "no-restricted-imports": ["error", {...}],
    "no-restricted-syntax": ["error", {...}]
  }
}
```

Runs on every file save and in CI. Provides instant feedback.

### Layer 2: CI Grep Checks (`.github/workflows/ci.yml`)

Fail-safe grep-based checks in the `architecture-check` job:

- `Check marketing has no database imports`
- `Check marketing has no auth imports`
- `Check marketing has no server actions`
- `Check marketing has no force-dynamic`
- `Check marketing has no next/server imports`

These run even if ESLint is misconfigured.

### Layer 3: Static Export Regression Gate

The `static-export` CI job runs `./scripts/build-marketing-static.sh` and verifies:

- Output directory exists
- Minimum page count (50+ pages)
- Critical pages present (index, login, contact, etc.)

If marketing code breaks static export, CI fails.

## What Is Allowed

Marketing code CAN use:

- React components (client-side)
- `NEXT_PUBLIC_*` environment variables
- Static data fetching (WordPress REST API, JSON files)
- Browser APIs (localStorage, fetch, etc.)
- External CDN resources
- Client-side form submission to external endpoints

## How to Add Dynamic Behavior

If marketing needs dynamic behavior:

1. **Redirect to app.fiskai.hr** - For auth flows, use meta refresh or JS redirect
2. **Client-side fetch** - Call external APIs from browser
3. **Form to external endpoint** - Submit to hosted form processor
4. **iFrame embed** - Embed dynamic content from app subdomain

## Violation Resolution

If you encounter ESLint errors on marketing code:

1. **Database access** - Move to server action on app.fiskai.hr, call via API
2. **Auth required** - Redirect to app.fiskai.hr/login
3. **Dynamic data** - Use WordPress REST API or JSON fallback
4. **Server action** - Convert to client-side fetch to API endpoint

## Evidence of Enforcement

Tested 2026-01-09 with intentional violation file:

```typescript
// _enforcement-proof.tsx - All of these triggered ESLint errors
import { db } from "@/lib/db" // ❌ Error
import { getSession } from "@/lib/auth" // ❌ Error
import { sendEmail } from "@/app/actions/email" // ❌ Error
import { cookies } from "next/headers" // ❌ Error
export const dynamic = "force-dynamic" // ❌ Error
const buf = Buffer.from("test") // ❌ Error
```

Result: 6 ESLint errors, enforcement working correctly.

## Rollback

If static export must be disabled:

1. Set `STATIC_EXPORT=false` or remove the variable
2. Deploy via Coolify (standalone mode)
3. Marketing runs server-side again

This is a business continuity fallback, not a permanent solution.
