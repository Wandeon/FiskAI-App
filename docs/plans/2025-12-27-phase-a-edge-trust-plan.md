# Phase A: Edge & Trust Implementation Plan

> Reference: `2025-12-27-authority-first-performance-design.md`

## Overview

This phase establishes edge caching, bot protection, resource hints, and speculation rules.

---

## Task A1: Cloudflare Cache Headers via Next.js

### Goal

Set Cache-Control and Cache-Tag headers on all cacheable public routes.

### Files to Modify

- `next.config.ts`
- `src/middleware.ts`

### Implementation

1. Add cache headers function to middleware:

```typescript
// src/lib/cache-headers.ts
export const CACHE_TAGS = {
  KB_GUIDES: "kb_guides",
  KB_GLOSSARY: "kb_glossary",
  KB_FAQ: "kb_faq",
  KB_NEWS: "kb_news",
  MARKETING: "marketing",
  KB_ALL: "kb_all",
} as const

export function getCacheHeaders(pathname: string): Record<string, string> | null {
  // Never cache authenticated routes
  if (
    pathname.startsWith("/app/") ||
    pathname.startsWith("/staff/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/api/")
  ) {
    return null
  }

  // Determine cache tag based on route
  let tag = CACHE_TAGS.MARKETING
  if (pathname.startsWith("/vodic/")) tag = CACHE_TAGS.KB_GUIDES
  else if (pathname.startsWith("/pojmovnik/") || pathname.startsWith("/glossary/"))
    tag = CACHE_TAGS.KB_GLOSSARY
  else if (pathname.startsWith("/faq/")) tag = CACHE_TAGS.KB_FAQ
  else if (pathname.startsWith("/vijesti/")) tag = CACHE_TAGS.KB_NEWS

  return {
    "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=86400",
    "Cache-Tag": `${tag}, ${CACHE_TAGS.KB_ALL}`,
    Vary: "Accept-Language",
  }
}
```

2. Apply headers in middleware response

### Acceptance Criteria

- [ ] Public KB pages return `Cache-Tag` header
- [ ] Authenticated routes return no cache headers
- [ ] `Vary: Accept-Language` set on all cached pages

---

## Task A2: Cache Purge API Endpoint

### Goal

Create protected endpoint to purge Cloudflare cache by tag.

### Files to Create

- `src/app/api/cache/purge/route.ts`

### Implementation

```typescript
// src/app/api/cache/purge/route.ts
import { NextRequest, NextResponse } from "next/server"

const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN
const CF_ZONE_ID = process.env.CLOUDFLARE_ZONE_ID
const PURGE_SECRET = process.env.CACHE_PURGE_SECRET

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("Authorization")
  if (authHeader !== `Bearer ${PURGE_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { tags, urls } = await request.json()

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/purge_cache`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(tags ? { tags } : { files: urls }),
    }
  )

  const result = await response.json()
  return NextResponse.json(result, { status: response.ok ? 200 : 500 })
}
```

### Acceptance Criteria

- [ ] Endpoint rejects requests without valid secret
- [ ] Can purge by tag or URL list
- [ ] Returns Cloudflare API response

---

## Task A3: Cloudflare Turnstile Integration

### Goal

Add invisible bot protection to auth and contact forms.

### Files to Create

- `src/lib/turnstile.ts`
- `src/components/forms/turnstile-widget.tsx`

### Files to Modify

- `src/app/(marketing)/login/page.tsx`
- `src/app/(marketing)/register/page.tsx`
- `src/app/(marketing)/forgot-password/page.tsx`
- `src/app/(marketing)/contact/page.tsx` (if exists)
- Form submission handlers

### Implementation

1. Client widget component:

```tsx
// src/components/forms/turnstile-widget.tsx
"use client"

import { useEffect, useRef } from "react"

interface TurnstileWidgetProps {
  siteKey: string
  onVerify: (token: string) => void
}

export function TurnstileWidget({ siteKey, onVerify }: TurnstileWidgetProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window.turnstile === "undefined") return
    window.turnstile.render(ref.current!, {
      sitekey: siteKey,
      callback: onVerify,
    })
  }, [siteKey, onVerify])

  return <div ref={ref} />
}
```

2. Server-side verification:

```typescript
// src/lib/turnstile.ts
export async function verifyTurnstileToken(token: string, ip: string): Promise<boolean> {
  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      secret: process.env.TURNSTILE_SECRET_KEY!,
      response: token,
      remoteip: ip,
    }),
  })
  const data = await response.json()
  return data.success === true
}
```

### Environment Variables Needed

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- `TURNSTILE_SECRET_KEY`

### Acceptance Criteria

- [ ] Login form includes Turnstile widget
- [ ] Register form includes Turnstile widget
- [ ] Forgot password form includes Turnstile widget
- [ ] Server actions verify token before processing
- [ ] Failed verification returns user-friendly error

---

## Task A4: Resource Hints (Preconnect)

### Goal

Add preconnect hints for analytics and Sentry.

### Files to Modify

- `src/app/layout.tsx`

### Implementation

Add to `<head>`:

```tsx
<link rel="preconnect" href="https://eu.posthog.com" crossOrigin="anonymous" />
<link rel="preconnect" href="https://o4509363207012352.ingest.de.sentry.io" crossOrigin="anonymous" />
```

### Acceptance Criteria

- [ ] Preconnect hints present in HTML head
- [ ] No duplicate hints
- [ ] crossorigin attribute correctly set

---

## Task A5: Speculation Rules API

### Goal

Add hover-based prerendering for KB and marketing pages.

### Files to Create

- `src/components/seo/speculation-rules.tsx`

### Files to Modify

- `src/app/(marketing)/layout.tsx`

### Implementation

```tsx
// src/components/seo/speculation-rules.tsx
export function SpeculationRules() {
  const rules = {
    prerender: [
      {
        where: {
          and: [
            { href_matches: "/*" },
            { not: { href_matches: "/app/*" } },
            { not: { href_matches: "/staff/*" } },
            { not: { href_matches: "/admin/*" } },
            { not: { href_matches: "/api/*" } },
            { not: { href_matches: "/tools/*" } },
            { not: { selector_matches: "[href*='?']" } },
          ],
        },
        eagerness: "moderate",
      },
    ],
    prefetch: [
      {
        where: {
          href_matches: ["/vodic/*", "/pojmovnik/*", "/faq/*", "/vijesti/*"],
        },
        eagerness: "moderate",
      },
    ],
  }

  return (
    <script type="speculationrules" dangerouslySetInnerHTML={{ __html: JSON.stringify(rules) }} />
  )
}
```

### Acceptance Criteria

- [ ] Speculation rules only on marketing layout (not app/staff/admin)
- [ ] Prerender excludes authenticated routes
- [ ] Prefetch targets KB routes specifically
- [ ] Rules valid JSON (test in Chrome DevTools)

---

## Verification Checklist

After completing all tasks:

1. [ ] Run `npx tsc --noEmit` - no type errors
2. [ ] Test cache headers with `curl -I https://fiskai.hr/vodic/fiskalizacija`
3. [ ] Test purge endpoint with test request
4. [ ] Verify Turnstile appears on login page
5. [ ] Check preconnect in page source
6. [ ] Verify speculation rules in Chrome DevTools (Application > Speculative Loads)

---

## Dependencies

- Cloudflare API Token with cache purge permissions
- Turnstile site key and secret key from Cloudflare dashboard
- PostHog and Sentry endpoints for preconnect
