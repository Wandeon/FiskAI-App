# Authority-First Performance: Phase A Closure + Phase B Implementation

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close Phase A (Edge & Trust) with defined SLOs, Cloudflare edge monitoring setup, and PostHog CWV reporting with route tagging. Then complete Phase B (Authority) by wiring AIAnswerBlock to all public authority surfaces.

**Architecture:**

- Phase A uses two-layer monitoring: Cloudflare for edge-truth (TTFB, cache hit rate), PostHog for client-truth (CWV)
- Phase B wraps existing content pages (glossary, guides, how-tos) with AIAnswerBlock for AI citability
- All changes follow TDD where applicable; frequent commits on feature branch

**Tech Stack:** Next.js 15, PostHog, Cloudflare Analytics, web-vitals library

---

## Phase A: SLO & Monitoring Closure

### Task 1: Define SLOs in Documentation

**Files:**

- Create: `docs/slos/performance-slos.md`

**Step 1: Create the SLO definition document**

```markdown
# FiskAI Performance SLOs

> Last updated: 2025-12-28 | Owner: Platform Team

## Edge SLOs (Cloudflare)

| Route Group                                                         | Metric               | Target | Alert Threshold   |
| ------------------------------------------------------------------- | -------------------- | ------ | ----------------- |
| Marketing/KB (`/vodic/*`, `/rjecnik/*`, `/kako-da/*`, `/vijesti/*`) | TTFB p75             | ≤100ms | >150ms for 15min  |
| Marketing/KB                                                        | TTFB p95             | ≤250ms | >300ms for 15min  |
| Marketing/KB                                                        | Cache Hit Rate       | ≥95%   | <90% for 30min    |
| App Shell (`/app/*`, `/staff/*`, `/admin/*`)                        | TTFB p75             | ≤200ms | >300ms for 15min  |
| All Routes                                                          | Origin Response Time | ≤500ms | >1000ms for 10min |
| All Routes                                                          | 5xx Error Rate       | <0.1%  | >0.5% for 5min    |

## Client SLOs (PostHog CWV)

| Metric        | Target (p75) | Alert Threshold   |
| ------------- | ------------ | ----------------- |
| LCP           | ≤2.5s        | >3.0s for 30min   |
| CLS           | ≤0.1         | >0.15 for 30min   |
| INP           | ≤200ms       | >300ms for 30min  |
| TTFB (client) | ≤800ms       | >1000ms for 30min |

## Measurement

- **Cloudflare:** Analytics dashboard + Notifications
- **PostHog:** `web_vital` events with route_group tagging

## Review Cadence

- Weekly: Check dashboards for trends
- Monthly: Review SLO breaches and adjust targets if needed
- Post-deploy: Verify no regression in first 30min
```

**Step 2: Commit**

```bash
git add docs/slos/performance-slos.md
git commit -m "docs: add performance SLO definitions for Phase A closure"
```

---

### Task 2: Add Route Tagging to Web Vitals

**Files:**

- Modify: `src/lib/web-vitals.ts`
- Modify: `src/components/providers/analytics-provider.tsx`

**Step 1: Update web-vitals.ts with route group detection**

Replace the entire file:

```typescript
// src/lib/web-vitals.ts
import { onCLS, onLCP, onFCP, onTTFB, onINP, type Metric } from "web-vitals"

type RouteGroup = "marketing" | "kb" | "app" | "staff" | "admin" | "other"

function getRouteGroup(pathname: string): RouteGroup {
  if (pathname.startsWith("/app")) return "app"
  if (pathname.startsWith("/staff")) return "staff"
  if (pathname.startsWith("/admin")) return "admin"
  if (
    pathname.startsWith("/vodic") ||
    pathname.startsWith("/rjecnik") ||
    pathname.startsWith("/kako-da") ||
    pathname.startsWith("/vijesti") ||
    pathname.startsWith("/baza-znanja") ||
    pathname.startsWith("/usporedba")
  ) {
    return "kb"
  }
  if (
    pathname === "/" ||
    pathname.startsWith("/features") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/about") ||
    pathname.startsWith("/contact") ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/register")
  ) {
    return "marketing"
  }
  return "other"
}

function sendToPostHog(metric: Metric, pathname: string) {
  if (
    typeof window !== "undefined" &&
    (
      window as unknown as {
        posthog?: { capture: (event: string, properties: Record<string, unknown>) => void }
      }
    ).posthog
  ) {
    const posthog = (
      window as unknown as {
        posthog: { capture: (event: string, properties: Record<string, unknown>) => void }
      }
    ).posthog

    const routeGroup = getRouteGroup(pathname)

    posthog.capture("web_vital", {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      delta: metric.delta,
      id: metric.id,
      navigationType: metric.navigationType,
      // Route tagging for SLO segmentation
      route_group: routeGroup,
      pathname: pathname,
    })
  }
}

export function reportWebVitals(pathname: string) {
  const sendMetric = (metric: Metric) => sendToPostHog(metric, pathname)

  onCLS(sendMetric)
  onLCP(sendMetric)
  onINP(sendMetric)
  onFCP(sendMetric)
  onTTFB(sendMetric)
}
```

**Step 2: Update AnalyticsProvider to pass pathname**

```typescript
// src/components/providers/analytics-provider.tsx
"use client"

import { useEffect, useRef } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { initAnalytics, trackPageView } from "@/lib/analytics"
import { reportWebVitals } from "@/lib/web-vitals"
import { registerServiceWorker } from "@/lib/register-sw"

export function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const webVitalsReported = useRef(false)

  useEffect(() => {
    initAnalytics()
    // Register service worker for offline support
    registerServiceWorker()
  }, [])

  useEffect(() => {
    // Report CWV once per session with initial pathname
    if (!webVitalsReported.current && pathname) {
      reportWebVitals(pathname)
      webVitalsReported.current = true
    }
  }, [pathname])

  useEffect(() => {
    if (pathname) {
      const url = searchParams?.toString() ? `${pathname}?${searchParams.toString()}` : pathname
      trackPageView(url)
    }
  }, [pathname, searchParams])

  return <>{children}</>
}
```

**Step 3: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 4: Commit**

```bash
git add src/lib/web-vitals.ts src/components/providers/analytics-provider.tsx
git commit -m "feat: add route_group tagging to web vitals for SLO segmentation"
```

---

### Task 3: Create Cloudflare Analytics Setup Guide

**Files:**

- Create: `docs/operations/cloudflare-monitoring-setup.md`

**Step 1: Write the operational guide**

````markdown
# Cloudflare Monitoring Setup for Phase A SLOs

## Prerequisites

- Cloudflare Pro plan or higher (for Analytics)
- Access to Cloudflare dashboard for fiskai.hr zone

## Dashboard Setup

### 1. Cache Analytics

Navigate to: **Analytics & Logs > Cache**

Key metrics to monitor:

- Cache hit rate (target: ≥95% for KB routes)
- Bandwidth saved
- Requests served from cache vs origin

### 2. Web Analytics

Navigate to: **Analytics & Logs > Web Analytics**

Enable if not already enabled. Tracks:

- Page views by route
- Core Web Vitals (LCP, FID, CLS)
- TTFB at edge

### 3. Create Custom Notifications

Navigate to: **Notifications**

Create alerts for:

| Alert Name           | Condition                | Threshold         |
| -------------------- | ------------------------ | ----------------- |
| Cache Hit Drop       | Cache hit rate           | <90% for 30min    |
| Origin Latency Spike | Origin response time p95 | >1000ms for 10min |
| Error Rate Spike     | 5xx error rate           | >0.5% for 5min    |

### 4. Traffic Analytics

Navigate to: **Analytics & Logs > Traffic**

Filter by:

- Path prefix: `/vodic/*`, `/rjecnik/*`, `/kako-da/*`
- Bot traffic (for Phase B observability)

## Verification

After setup, verify:

1. Cache headers present:
   ```bash
   curl -I https://fiskai.hr/vodic/pausalni-obrt | grep -i "cf-cache-status\|cache-control"
   ```
````

Expected: `cf-cache-status: HIT` or `MISS` (first request)

2. Cache tags present:
   ```bash
   curl -I https://fiskai.hr/vodic/pausalni-obrt | grep -i "cache-tag"
   ```
   Expected: `cache-tag: kb_guides, kb_all`

## Runbook Links

- [Cache Purge API](/docs/plans/2025-12-27-phase-a-edge-trust-plan.md#task-a2)
- [SLO Definitions](/docs/slos/performance-slos.md)

````

**Step 2: Commit**

```bash
git add docs/operations/cloudflare-monitoring-setup.md
git commit -m "docs: add Cloudflare monitoring setup guide for Phase A"
````

---

### Task 4: Create PostHog Dashboard Spec

**Files:**

- Create: `docs/operations/posthog-cwv-dashboard.md`

**Step 1: Write dashboard specification**

```markdown
# PostHog Core Web Vitals Dashboard Specification

## Dashboard: "Performance SLOs"

### Insight 1: CWV Trends by Route Group

**Type:** Line chart
**Event:** `web_vital`
**Breakdown:** `route_group`
**Filter:** `name` = `LCP` OR `CLS` OR `INP`
**Date range:** Last 30 days
**Granularity:** Daily

### Insight 2: LCP Distribution (p50, p75, p95)

**Type:** Bar chart
**Event:** `web_vital`
**Filter:** `name` = `LCP`
**Aggregation:** Percentiles (50, 75, 95)
**Breakdown:** `route_group`

### Insight 3: CWV Rating Distribution

**Type:** Pie chart
**Event:** `web_vital`
**Filter:** `name` = `LCP`
**Breakdown:** `rating` (good, needs-improvement, poor)

### Insight 4: TTFB by Route Group

**Type:** Line chart
**Event:** `web_vital`
**Filter:** `name` = `TTFB`
**Breakdown:** `route_group`
**Aggregation:** p75

### Insight 5: Deploy Markers

**Type:** Annotations
**Source:** Manual or CI/CD integration
**Purpose:** Correlate performance changes with releases

## Alerts (PostHog Actions)

| Alert           | Condition                  | Action             |
| --------------- | -------------------------- | ------------------ |
| LCP Regression  | LCP p75 > 3000ms for 30min | Slack notification |
| CLS Spike       | CLS p75 > 0.15 for 30min   | Slack notification |
| INP Degradation | INP p75 > 300ms for 30min  | Slack notification |

## Implementation

1. Create dashboard in PostHog UI
2. Add 5 insights as specified above
3. Configure alerts under Actions > Webhooks
4. Link Slack webhook for notifications
```

**Step 2: Commit**

```bash
git add docs/operations/posthog-cwv-dashboard.md
git commit -m "docs: add PostHog CWV dashboard specification"
```

---

## Phase B: Authority & Citability

### Task 5: Update AIAnswerBlock Types for Content Pages

**Files:**

- Modify: `src/components/content/ai-answer-block.tsx`

**Step 1: Review current implementation**

The existing AIAnswerBlock has `answerId`, `type`, `confidence`, etc. We need to ensure it works for glossary, guides, and how-to pages.

Current types are already suitable:

- `AnswerType`: `"regulatory" | "procedural" | "definitional"`
- `ContentType`: `"guide" | "glossary" | "howto" | "faq"`

No changes needed to the component itself.

**Step 2: Verify tests pass**

```bash
npm test -- --test-name-pattern="AIAnswerBlock"
```

Expected: Tests pass (existing tests cover the component)

---

### Task 6: Wire AIAnswerBlock to Glossary Pages

**Files:**

- Modify: `src/app/(marketing)/rjecnik/[pojam]/page.tsx`

**Step 1: Update glossary page to use AIAnswerBlock**

```typescript
// src/app/(marketing)/rjecnik/[pojam]/page.tsx
import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { getGlossaryBySlug, getGlossarySlugs } from "@/lib/knowledge-hub/mdx"
import { AIAnswerBlock } from "@/components/content/ai-answer-block"
import { FAQ } from "@/components/content/FAQ"
import { Sources } from "@/components/content/Sources"
import { JsonLd } from "@/components/seo/JsonLd"
import { generateDefinedTermSchema, generateBreadcrumbSchema } from "@/lib/schema"
import { SectionBackground } from "@/components/ui/patterns/SectionBackground"

interface Props {
  params: Promise<{ pojam: string }>
}

export async function generateStaticParams() {
  const slugs = getGlossarySlugs()
  return slugs.map((pojam) => ({ pojam }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { pojam } = await params
  const term = getGlossaryBySlug(pojam)
  if (!term) return {}

  return {
    title: `${term.frontmatter.term} - Što je? | FiskAI Rječnik`,
    description: term.frontmatter.shortDefinition,
  }
}

export default async function GlossaryTermPage({ params }: Props) {
  const { pojam } = await params
  const term = getGlossaryBySlug(pojam)

  if (!term) notFound()

  const { frontmatter } = term
  const url = `https://fiskai.hr/rjecnik/${pojam}`

  const breadcrumbs = [
    { name: "Baza znanja", url: "https://fiskai.hr/baza-znanja" },
    { name: "Rječnik", url: "https://fiskai.hr/rjecnik" },
    { name: frontmatter.term, url },
  ]

  // Map frontmatter sources to AIAnswerBlock format
  const aiSources = frontmatter.sources?.map((source: { name: string; url?: string }, idx: number) => ({
    ref: `src-${idx + 1}`,
    label: source.name,
    url: source.url,
  }))

  return (
    <>
      <JsonLd
        schemas={[
          generateBreadcrumbSchema(breadcrumbs),
          generateDefinedTermSchema(frontmatter.term, frontmatter.shortDefinition, url),
        ]}
      />

      <SectionBackground variant="gradient">
        <div className="mx-auto max-w-4xl px-4 py-14 md:px-6">
          <nav className="mb-6 text-sm text-white/60">
            <Link href="/baza-znanja" className="hover:text-white">
              Baza znanja
            </Link>{" "}
            <span>/</span>{" "}
            <Link href="/rjecnik" className="hover:text-white">
              Rječnik
            </Link>{" "}
            <span>/</span> <span className="text-white">{frontmatter.term}</span>
          </nav>

          <Link
            href="/rjecnik"
            className="mb-6 inline-flex items-center gap-2 text-sm text-cyan-400 hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Svi pojmovi
          </Link>

          <AIAnswerBlock
            answerId={`glossary:${pojam}:v1`}
            type="definitional"
            confidence="high"
            contentType="glossary"
            lastUpdated={frontmatter.lastUpdated || new Date().toISOString().split("T")[0]}
            bluf={frontmatter.shortDefinition}
            sources={aiSources}
          >
            {/* Extended definition content */}
            {frontmatter.appearsIn && frontmatter.appearsIn.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold">Gdje se pojavljuje</h3>
                <ul className="list-inside list-disc space-y-1 mt-2">
                  {frontmatter.appearsIn.map((item: string, i: number) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {frontmatter.relatedTerms && frontmatter.relatedTerms.length > 0 && (
              <div className="mt-4">
                <h3 className="font-semibold">Povezani pojmovi</h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  {frontmatter.relatedTerms.map((related: string, i: number) => (
                    <Link
                      key={i}
                      href={`/rjecnik/${related}`}
                      className="rounded-full bg-white/10 px-3 py-1 text-sm hover:bg-white/20"
                    >
                      {related}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </AIAnswerBlock>

          {frontmatter.faq && <FAQ items={frontmatter.faq} />}

          <Sources
            sources={frontmatter.sources}
            lastUpdated={frontmatter.lastUpdated}
            lastReviewed={frontmatter.lastReviewed}
            reviewer={frontmatter.reviewer}
          />
        </div>
      </SectionBackground>
    </>
  )
}
```

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(marketing\)/rjecnik/\[pojam\]/page.tsx
git commit -m "feat(authority): wire AIAnswerBlock to glossary pages"
```

---

### Task 7: Wire AIAnswerBlock to Guide Pages

**Files:**

- Modify: `src/app/(marketing)/vodic/[slug]/page.tsx`

**Step 1: Update guide page to wrap content in AIAnswerBlock**

Add AIAnswerBlock import and wrap the article content:

```typescript
// Add to imports at top
import { AIAnswerBlock } from "@/components/content/ai-answer-block"

// In the return statement, wrap the article with AIAnswerBlock
// Replace the existing <article> tag section (around line 185-187) with:

<AIAnswerBlock
  answerId={`guide:${slug}:v1`}
  type="procedural"
  confidence="high"
  contentType="guide"
  lastUpdated={guide.frontmatter.lastUpdated || new Date().toISOString().split("T")[0]}
  bluf={guide.frontmatter.description}
>
  <article className="prose prose-invert prose-lg max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-cyan-400 prose-strong:text-white">
    <MDXRemote source={guide.content} components={mdxComponents} />
  </article>
</AIAnswerBlock>
```

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(marketing\)/vodic/\[slug\]/page.tsx
git commit -m "feat(authority): wire AIAnswerBlock to guide pages"
```

---

### Task 8: Wire AIAnswerBlock to How-To Pages

**Files:**

- Modify: `src/app/(marketing)/kako-da/[slug]/page.tsx`

**Step 1: Update how-to page to use AIAnswerBlock**

Add AIAnswerBlock import and wrap the article content:

```typescript
// Add to imports at top
import { AIAnswerBlock } from "@/components/content/ai-answer-block"

// Map sources for AIAnswerBlock
const aiSources = frontmatter.sources?.map((source: { name: string; url?: string }, idx: number) => ({
  ref: `src-${idx + 1}`,
  label: source.name,
  url: source.url,
}))

// Wrap the article section (around line 96-98) with AIAnswerBlock:

<AIAnswerBlock
  answerId={`howto:${slug}:v1`}
  type="procedural"
  confidence="high"
  contentType="howto"
  lastUpdated={frontmatter.lastUpdated || new Date().toISOString().split("T")[0]}
  bluf={frontmatter.description}
  sources={aiSources}
>
  <article className="prose prose-invert max-w-none prose-headings:text-white prose-p:text-white/80 prose-a:text-cyan-400 prose-strong:text-white prose-code:text-cyan-300 prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10">
    <MDXRemote source={content} components={mdxComponents} />
  </article>
</AIAnswerBlock>
```

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Commit**

```bash
git add src/app/\(marketing\)/kako-da/\[slug\]/page.tsx
git commit -m "feat(authority): wire AIAnswerBlock to how-to pages"
```

---

### Task 9: Create PostHog Bot Activity Dashboard Spec

**Files:**

- Create: `docs/operations/posthog-bot-dashboard.md`

**Step 1: Write dashboard specification**

```markdown
# PostHog AI Bot Activity Dashboard Specification

## Dashboard: "AI Crawler Observability"

### Insight 1: Hits per Bot per Day

**Type:** Line chart
**Event:** `ai_crawler_hit`
**Breakdown:** `bot_name`
**Date range:** Last 30 days
**Granularity:** Daily

### Insight 2: Top Crawled Pages (7d)

**Type:** Table
**Event:** `ai_crawler_hit`
**Breakdown:** `path`
**Aggregation:** Count
**Date range:** Last 7 days
**Limit:** 50 rows

### Insight 3: Crawl by Bot Type

**Type:** Pie chart
**Event:** `ai_crawler_hit`
**Breakdown:** `bot_name`
**Date range:** Last 30 days

### Insight 4: Cache Hit Rate for Bots

**Type:** Bar chart
**Event:** `ai_crawler_hit`
**Breakdown:** `response_cache`
**Date range:** Last 7 days

### Insight 5: New Pages Discovered

**Type:** Table
**Event:** `ai_crawler_hit` (first occurrence)
**Breakdown:** `path`
**Aggregation:** First seen date
**Date range:** Last 30 days

### Insight 6: Content Type Distribution

**Type:** Pie chart
**Event:** `ai_crawler_hit`
**Breakdown:** `content_type`

## Key Questions This Answers

1. Which AI bots are crawling us most frequently?
2. What content do AI bots find most valuable?
3. Are AI bots getting cached responses?
4. Are there paths we should add to sitemap?
5. Is crawler activity increasing over time?

## Implementation

1. Create dashboard in PostHog UI
2. Add 6 insights as specified
3. Add dashboard to weekly review checklist
```

**Step 2: Commit**

```bash
git add docs/operations/posthog-bot-dashboard.md
git commit -m "docs: add PostHog AI bot activity dashboard specification"
```

---

### Task 10: Final Verification & PR

**Step 1: Run full test suite**

```bash
npm test
```

Expected: 58+ tests passing (same baseline)

**Step 2: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors

**Step 3: Verify data attributes in local build**

```bash
npm run build
npm run start &
sleep 5
curl -s http://localhost:3000/rjecnik/pdv | grep -o 'data-ai-answer="true"' | head -1
```

Expected: `data-ai-answer="true"`

**Step 4: Push branch and create PR**

```bash
git push -u origin feature/authority-first-performance
gh pr create --title "feat: Authority-First Performance Phase A closure + Phase B implementation" --body "$(cat <<'EOF'
## Summary

- Closes Phase A (Edge & Trust) with defined SLOs and monitoring setup
- Completes Phase B (Authority) by wiring AIAnswerBlock to all authority surfaces

### Phase A Changes
- Added SLO definitions document
- Enhanced web-vitals with route_group tagging
- Created Cloudflare monitoring setup guide
- Created PostHog CWV dashboard specification

### Phase B Changes
- Wired AIAnswerBlock to glossary pages (`/rjecnik/[pojam]`)
- Wired AIAnswerBlock to guide pages (`/vodic/[slug]`)
- Wired AIAnswerBlock to how-to pages (`/kako-da/[slug]`)
- Created PostHog bot activity dashboard specification

## Test plan

- [ ] Verify type check passes: `npx tsc --noEmit`
- [ ] Verify tests pass: `npm test`
- [ ] Check glossary page source for `data-ai-answer="true"`
- [ ] Check guide page source for `data-ai-answer="true"`
- [ ] Check how-to page source for `data-ai-answer="true"`
- [ ] Verify PostHog receives `web_vital` events with `route_group`

## Related

- Closes Phase A checklist from Authority-First Performance design
- Implements Phase B from same design doc

---

:robot: Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Verification Checklist

After all tasks complete:

1. [ ] SLO definitions exist at `docs/slos/performance-slos.md`
2. [ ] Web vitals report `route_group` in PostHog events
3. [ ] Cloudflare monitoring guide exists
4. [ ] PostHog dashboard specs exist (CWV + Bot activity)
5. [ ] Glossary pages have `data-ai-answer="true"` attribute
6. [ ] Guide pages have `data-ai-answer="true"` attribute
7. [ ] How-to pages have `data-ai-answer="true"` attribute
8. [ ] All tests pass
9. [ ] PR created and ready for review
