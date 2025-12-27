# Authority-First Performance Design

> **Philosophy:** Speed makes us usable; Authority makes us inevitable.

This document captures the complete technical specification for FiskAI's elite-tier infrastructure upgrade, focusing on AI citability and edge performance.

---

## Executive Summary

| Layer            | Goal                          | Key Decisions                                     |
| ---------------- | ----------------------------- | ------------------------------------------------- |
| **Edge & Trust** | Sub-50ms TTFB, bot protection | Cloudflare Cache Tags, Turnstile on auth/contact  |
| **Authority**    | AI engines cite our content   | Answer Blocks DOM contract, Crawl observability   |
| **Performance**  | Perfect Core Web Vitals       | next/font, Speculation Rules, AVIF, Streaming SSR |
| **App Feel**     | Network resilience            | PWA manifest, minimal service worker              |

---

## Phase A: Edge & Trust Foundations

### A1. Cloudflare Cache Rules

**Strategy:** Hybrid with Cache Tags (Option 3)

**Cache Policy for Public HTML:**

```
Cache-Control: public, s-maxage=3600, stale-while-revalidate=86400, stale-if-error=86400
```

**Cache Tags (low-cardinality):**

- `kb_guides` - All guide pages
- `kb_glossary` - Glossary entries
- `kb_faq` - FAQ pages
- `kb_news` - News articles
- `marketing` - Static marketing pages
- `kb_all` - Group tag for full KB purge

**Never Cache:**

- `/app/*`, `/staff/*`, `/admin/*`
- All `/api/*` endpoints
- Pages varying by cookie, auth, geo, A/B

**Purge Strategy:**

- Trigger on publish/unpublish via `/api/cache/purge`
- Purge by tag first, URL purge for special cases
- Protect endpoint with server-side secret

**Vary Headers:**

- Set `Vary: Accept-Language` for locale-varying pages

---

### A2. Cloudflare Turnstile

**Scope:** Auth + public contact forms (Option 2)

**Protected Forms:**

- Login (`/login`)
- Register (`/register`)
- Forgot password (`/forgot-password`)
- Contact form (`/contact`)
- Demo request form

**NOT Protected:**

- Interactive tools and calculators
- Newsletter signup (rate-limit only)
- Search inputs

**Implementation:**

- Server-side verification on form submission
- Progressive rollout: auth first → contact/demo → monitor → stop

**Rationale:**

- Auth forms are credential-stuffing targets
- Contact/demo forms affect lead quality
- Tool inputs must feel instant for conversion

---

### A3. Resource Hints

**Scope:** Analytics + fonts (Option 2)

**Preconnect (add to `<head>`):**

```html
<link rel="preconnect" href="https://eu.posthog.com" crossorigin />
<link rel="preconnect" href="https://o[ID].ingest.sentry.io" crossorigin />
```

**Fonts:** Handled by `next/font` (no external preconnect needed)

**NOT adding:**

- Prefetch for API endpoints (caching handles this)
- dns-prefetch for everything (keep to 2-3 origins max)

---

### A4. Speculation Rules API

**Strategy:** Conservative hover-based (Option 1)

**Rules:**

- Trigger: hover with "moderate" eagerness (~200ms delay)
- Concurrency: 2 prerenders max
- Same-origin only

**Allowlist patterns:**

- `/vodic/*`
- `/glossary/*`
- `/faq/*`
- `/vijesti/*`
- Top-level marketing routes (`/`, `/features`, `/pricing`, `/about`)

**Denylist:**

- `/app/*`, `/staff/*`, `/admin/*`
- `/api/*`
- `/tools/*` (heavy pages)
- URLs with query params

**Prefetch:** More liberal than prerender for KB pages

**Implementation:**

```html
<script type="speculationrules">
  {
    "prerender": [
      {
        "where": {
          "and": [
            { "href_matches": "/*" },
            { "not": { "href_matches": "/app/*" } },
            { "not": { "href_matches": "/staff/*" } },
            { "not": { "href_matches": "/admin/*" } },
            { "not": { "href_matches": "/api/*" } },
            { "not": { "href_matches": "/tools/*" } },
            { "not": { "selector_matches": "[href*='?']" } }
          ]
        },
        "eagerness": "moderate"
      }
    ],
    "prefetch": [
      {
        "where": {
          "href_matches": ["/vodic/*", "/glossary/*", "/faq/*", "/vijesti/*"]
        },
        "eagerness": "moderate"
      }
    ]
  }
</script>
```

**Note:** Inject only on marketing/KB routes, not in authenticated app shell.

---

## Phase B: Authority & Citability

### B1. AI Answer Blocks

**Scope:** Regulatory answers + Knowledge base (Option 2)

**Content Types:**

- Assistant "Regulatory answer" permalinks
- Guides (`/vodic/*`)
- Glossary entries (`/glossary/*`)
- FAQ pages and sections

**DOM Contract:**

```html
<article
  data-ai-answer="true"
  data-answer-type="regulatory_answer|guide|glossary|faq"
  data-jurisdiction="HR|EU"
  data-confidence="0.95"
  data-sources-count="3"
  data-asof-date="2025-01-15"
>
  <header>
    <!-- title, jurisdiction, last updated, risk tier -->
  </header>
  <main>
    <!-- BLUF paragraph (1-3 sentences) -->
    <!-- Details sections if needed -->
    <!-- Tables for thresholds, rates, deadlines -->
  </main>
  <footer class="sources">
    <!-- Citations list with stable IDs -->
  </footer>
</article>
```

**Hard Rules:**

- No "as mentioned above" inside blocks
- Tables for numeric data (thresholds, rates, deadlines)
- Always include "Last updated" and "As of" dates
- Each block must be standalone (no context dependencies)

**Rollout:** Start with glossary + answer permalinks, then guides/FAQs

---

### B2. AI Crawl Observability

**Strategy:** Dashboard metrics via PostHog (Option 2)

**Bot Detection (middleware):**
Match User-Agent for:

- `GPTBot`, `ChatGPT-User`, `OAI-SearchBot`
- `Google-Extended`
- `ClaudeBot`, `anthropic-ai`
- `PerplexityBot`
- `CCBot` (Common Crawl)
- `OtherBot` bucket for generic `bot|crawler|spider`

**PostHog Event:**

```typescript
{
  event: 'ai_crawler_hit',
  properties: {
    bot_name: string,
    path: string,
    method: string,
    status: number,
    is_robots_allowed: boolean,
    content_type: 'html' | 'json' | 'asset',
    canonical_present: boolean,
    response_cache: 'HIT' | 'MISS' | 'BYPASS'
  }
}
```

**Filters:**

- Only fire for public HTML and key feeds (sitemap, llms.txt)
- Skip `_next/*`, images, fonts, assets

**Guardrails:**

- **Sampling:** 10% on low-priority paths if volume spikes
- **Dedupe:** One event per `bot_name + path` per 6 hours

**Dashboard Charts:**

- Hits per bot per day
- Top crawled pages (7d and 30d)
- New pages discovered (first-seen paths)
- Crawl depth (unique paths per bot)
- Sitemap vs organic discovery ratio

**Bonus:** `/admin/seo/bots` page for quick 7-day view

---

### B3. JSON-LD Schemas

**Already Implemented:**

- Organization, WebSite, SoftwareApplication (root layout)
- NewsArticle, BreadcrumbList (news pages)
- Article, FAQPage, HowTo, DefinedTerm, WebApplication

**Enhancement:** Ensure all Answer Block content types emit appropriate schema alongside the DOM contract.

---

## Phase C: Perceived Speed & Polish

### C1. Streaming SSR (Priority Shell)

**Strategy:** Progressive shell with priority-ordered Suspense (Option 3)

**Rendering Priority:**

1. **Static Shell (0ms):** Nav, title, layout grid
2. **Answer Stream (~200ms):** Primary content the user came for
3. **Sources/Related (>500ms):** Citations, related content

**Pattern:**

```tsx
export default function RegulatoryPage({ params }) {
  return (
    <div className="layout-grid">
      {/* 1. Static Shell */}
      <header className="col-span-full">
        <Title slug={params.slug} />
      </header>

      {/* 2. Primary Content (High Priority) */}
      <main className="main-content">
        <Suspense fallback={<AnswerSkeleton />}>
          <RegulatoryAnswer slug={params.slug} />
        </Suspense>
      </main>

      {/* 3. Supporting Evidence (Lower Priority) */}
      <aside className="sidebar">
        <Suspense fallback={<SourcesSkeleton />}>
          <CitationList slug={params.slug} />
        </Suspense>
        <Suspense fallback={<RelatedSkeleton />}>
          <RelatedActs slug={params.slug} />
        </Suspense>
      </aside>
    </div>
  )
}
```

**Critical:** Data fetching must happen inside async components, not awaited in parent.

---

### C2. Font Optimization

**Strategy:** next/font/google (Option 2)

**Implementation:**

```typescript
// src/app/layout.tsx
import { Inter, JetBrains_Mono } from 'next/font/google'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-jetbrains',
})

export default function RootLayout({ children }) {
  return (
    <html lang="hr" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  )
}
```

**Benefits:**

- Automatic self-hosting at build time
- Automatic subsetting
- Zero CLS with `display: 'swap'`
- CSS variables for design system integration

---

### C3. AVIF Support

**Strategy:** Next.js Image optimization (Option 1)

**next.config.ts:**

```typescript
const nextConfig: NextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
  },
}
```

**Requirement:** Install `sharp` for production optimization:

```bash
npm install sharp
```

**Benefits:**

- AVIF is ~50% smaller than WebP
- Automatic format negotiation via Accept headers
- Fallback to WebP/JPEG for unsupported browsers

---

### C4. Core Web Vitals Monitoring

**Implementation:** Add web-vitals reporting to PostHog

```typescript
// src/lib/web-vitals.ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from "web-vitals"

export function reportWebVitals() {
  onCLS((metric) => posthog.capture("web_vital", { name: "CLS", value: metric.value }))
  onFID((metric) => posthog.capture("web_vital", { name: "FID", value: metric.value }))
  onLCP((metric) => posthog.capture("web_vital", { name: "LCP", value: metric.value }))
  onFCP((metric) => posthog.capture("web_vital", { name: "FCP", value: metric.value }))
  onTTFB((metric) => posthog.capture("web_vital", { name: "TTFB", value: metric.value }))
}
```

**Dashboard:** Create PostHog dashboard for CWV percentiles (p50, p75, p95)

---

## Phase D: App Feel (De-prioritized)

### D1. PWA Basics

**Scope:** Manifest + minimal service worker for installability

**NOT implementing:**

- Offline-first AI capabilities
- Background sync
- Push notifications

**Manifest:** `/public/site.webmanifest`

```json
{
  "name": "FiskAI",
  "short_name": "FiskAI",
  "description": "AI-powered e-invoicing and fiscalization",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#38bdf8",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

**Service Worker:** Cache shell assets, custom offline page only

---

## Implementation Order

1. **Week 1: Edge Foundation**
   - Cloudflare Cache Rules + Tags
   - Turnstile on auth forms
   - Resource hints (preconnect)

2. **Week 2: Authority Layer**
   - AI Crawl Observability middleware
   - Answer Blocks DOM contract (glossary first)
   - PostHog dashboard for bot activity

3. **Week 3: Performance Polish**
   - next/font integration
   - AVIF + sharp installation
   - Speculation Rules script
   - Streaming SSR for regulatory pages

4. **Week 4: Finish & Monitor**
   - CWV monitoring dashboard
   - PWA manifest + service worker
   - Turnstile on contact/demo forms
   - Answer Blocks on guides/FAQs

---

## Success Metrics

| Metric            | Current | Target              |
| ----------------- | ------- | ------------------- |
| TTFB (p75)        | Unknown | <100ms              |
| LCP (p75)         | Unknown | <2.5s               |
| CLS (p75)         | Unknown | <0.1                |
| AI Bot Crawl Rate | Unknown | Baseline + trending |
| Cache Hit Rate    | 0%      | >80% for KB         |

---

## Appendix: File Changes Summary

| File                                 | Change                                       |
| ------------------------------------ | -------------------------------------------- |
| `next.config.ts`                     | Add images.formats, headers for cache        |
| `src/app/layout.tsx`                 | Add next/font, speculation rules, preconnect |
| `src/middleware.ts`                  | Add AI bot detection, cache headers          |
| `src/components/ai-answer-block.tsx` | New component with DOM contract              |
| `src/lib/web-vitals.ts`              | New CWV reporting                            |
| `src/lib/ai-crawler.ts`              | New bot detection + PostHog events           |
| `src/app/api/cache/purge/route.ts`   | New cache purge endpoint                     |
| `public/site.webmanifest`            | New PWA manifest                             |
| `public/sw.js`                       | New minimal service worker                   |
