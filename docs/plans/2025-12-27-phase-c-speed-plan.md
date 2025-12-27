# Phase C: Perceived Speed & Polish Implementation Plan

> Reference: `2025-12-27-authority-first-performance-design.md`

## Overview

This phase optimizes perceived performance through font loading, image formats, streaming SSR, and Core Web Vitals monitoring.

---

## Task C1: next/font Integration

### Goal

Self-host Inter and JetBrains Mono fonts with zero CLS.

### Files to Modify

- `src/app/layout.tsx`
- `tailwind.config.ts`

### Implementation

```typescript
// src/app/layout.tsx
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
})

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hr" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <head>
        {/* ... existing head content */}
      </head>
      <body className="font-sans">
        {/* ... existing body content */}
        {children}
      </body>
    </html>
  )
}
```

```typescript
// tailwind.config.ts
import type { Config } from "tailwindcss"

const config: Config = {
  // ... existing config
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "ui-monospace", "monospace"],
      },
    },
  },
}

export default config
```

### Acceptance Criteria

- [ ] Inter loaded for body text
- [ ] JetBrains Mono loaded for code blocks
- [ ] No FOUT (Flash of Unstyled Text)
- [ ] CLS score 0 for font loading
- [ ] Fonts self-hosted (no external requests)

---

## Task C2: AVIF Image Format Support

### Goal

Enable AVIF format for automatic image optimization.

### Files to Modify

- `next.config.ts`
- `package.json` (add sharp dependency)

### Implementation

1. Install sharp:

```bash
npm install sharp
```

2. Update next.config.ts:

```typescript
// next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  // ... existing config
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      // ... existing patterns
    ],
  },
}

export default nextConfig
```

### Acceptance Criteria

- [ ] `sharp` in dependencies
- [ ] Images serve AVIF to supporting browsers
- [ ] WebP fallback for older browsers
- [ ] No change to existing `<Image>` components needed

---

## Task C3: Core Web Vitals Reporting

### Goal

Report CWV metrics to PostHog for monitoring.

### Files to Create

- `src/lib/web-vitals.ts`

### Files to Modify

- `src/components/providers/analytics-provider.tsx`

### Implementation

```typescript
// src/lib/web-vitals.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB, onINP, type Metric } from "web-vitals"
import posthog from "posthog-js"

function sendToPostHog(metric: Metric) {
  posthog.capture("web_vital", {
    name: metric.name,
    value: metric.value,
    rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
    delta: metric.delta,
    id: metric.id,
    navigationType: metric.navigationType,
  })
}

export function reportWebVitals() {
  onCLS(sendToPostHog)
  onFID(sendToPostHog)
  onLCP(sendToPostHog)
  onFCP(sendToPostHog)
  onTTFB(sendToPostHog)
  onINP(sendToPostHog)
}
```

```tsx
// src/components/providers/analytics-provider.tsx
"use client"

import { useEffect } from "react"
import posthog from "posthog-js"
import { reportWebVitals } from "@/lib/web-vitals"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Initialize PostHog
    posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      capture_pageview: true,
    })

    // Report Core Web Vitals
    reportWebVitals()
  }, [])

  return <>{children}</>
}
```

### Package Installation

```bash
npm install web-vitals
```

### Acceptance Criteria

- [ ] web-vitals package installed
- [ ] All 6 metrics reported (CLS, FID, LCP, FCP, TTFB, INP)
- [ ] Rating included (good/needs-improvement/poor)
- [ ] PostHog receiving `web_vital` events

---

## Task C4: Streaming SSR Pattern for Regulatory Pages

### Goal

Implement priority-ordered Suspense for fast perceived loading.

### Files to Create

- `src/components/skeletons/answer-skeleton.tsx`
- `src/components/skeletons/sources-skeleton.tsx`
- `src/components/skeletons/related-skeleton.tsx`

### Files to Modify

- Regulatory/knowledge base page components

### Implementation

```tsx
// src/components/skeletons/answer-skeleton.tsx
export function AnswerSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-8 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-2/3" />
    </div>
  )
}
```

```tsx
// src/components/skeletons/sources-skeleton.tsx
export function SourcesSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-6 bg-muted rounded w-1/3" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-3/4" />
    </div>
  )
}
```

```tsx
// src/components/skeletons/related-skeleton.tsx
export function RelatedSkeleton() {
  return (
    <div className="animate-pulse space-y-2">
      <div className="h-6 bg-muted rounded w-1/2" />
      <div className="h-4 bg-muted rounded w-full" />
      <div className="h-4 bg-muted rounded w-full" />
    </div>
  )
}
```

### Example Page Pattern

```tsx
// src/app/(marketing)/regulatory/[slug]/page.tsx
import { Suspense } from "react"
import { AnswerSkeleton } from "@/components/skeletons/answer-skeleton"
import { SourcesSkeleton } from "@/components/skeletons/sources-skeleton"
import { RelatedSkeleton } from "@/components/skeletons/related-skeleton"

// Async components for data fetching
async function RegulatoryAnswer({ slug }: { slug: string }) {
  const data = await fetchRegulatoryContent(slug)
  return <AIAnswerBlock {...data}>{data.content}</AIAnswerBlock>
}

async function CitationList({ slug }: { slug: string }) {
  const citations = await fetchCitations(slug)
  return <SourcesList citations={citations} />
}

async function RelatedActs({ slug }: { slug: string }) {
  const related = await fetchRelated(slug)
  return <RelatedContent items={related} />
}

export default async function RegulatoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return (
    <div className="layout-grid">
      {/* 1. Static Shell - renders immediately */}
      <header className="col-span-full">
        <h1>Regulatory Content</h1>
      </header>

      {/* 2. Primary Content - high priority stream */}
      <main className="main-content">
        <Suspense fallback={<AnswerSkeleton />}>
          <RegulatoryAnswer slug={slug} />
        </Suspense>
      </main>

      {/* 3. Supporting Content - lower priority */}
      <aside className="sidebar">
        <Suspense fallback={<SourcesSkeleton />}>
          <CitationList slug={slug} />
        </Suspense>
        <Suspense fallback={<RelatedSkeleton />}>
          <RelatedActs slug={slug} />
        </Suspense>
      </aside>
    </div>
  )
}
```

### Acceptance Criteria

- [ ] Shell renders immediately (no data blocking)
- [ ] Primary content streams first
- [ ] Sidebar content streams independently
- [ ] Skeletons match content dimensions (no layout shift)
- [ ] No `await` calls blocking initial render in page component

---

## Task C5: PostHog CWV Dashboard

### Goal

Create dashboard showing Core Web Vitals percentiles.

### Implementation

Create PostHog dashboard with:

1. **LCP Distribution** - Histogram
   - Filter: `event = 'web_vital'`, `name = 'LCP'`
   - X-axis: value buckets
   - Target line at 2500ms

2. **CLS Distribution** - Histogram
   - Filter: `event = 'web_vital'`, `name = 'CLS'`
   - Target line at 0.1

3. **CWV Rating Breakdown** - Stacked bar
   - Filter: `event = 'web_vital'`
   - Breakdown: `rating`
   - Group by: `name`

4. **P75 Over Time** - Line chart
   - Filter: `event = 'web_vital'`
   - Aggregation: 75th percentile of `value`
   - Breakdown: `name`

### Acceptance Criteria

- [ ] Dashboard created in PostHog
- [ ] P75 values visible for each metric
- [ ] Trends visible over time
- [ ] Alerts configured for regression

---

## Verification Checklist

After completing all tasks:

1. [ ] Run `npx tsc --noEmit` - no type errors
2. [ ] Check font loading in Network tab (self-hosted, not fonts.googleapis.com)
3. [ ] Verify AVIF serving: `curl -I -H "Accept: image/avif" https://fiskai.hr/some-image`
4. [ ] Check PostHog for `web_vital` events
5. [ ] Measure LCP in Chrome DevTools Lighthouse
6. [ ] Verify streaming with slow network simulation

---

## Dependencies

- web-vitals npm package
- sharp npm package
- PostHog project access for dashboard creation
