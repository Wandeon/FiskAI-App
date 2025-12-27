# Phase B: Authority & Citability Implementation Plan

> Reference: `2025-12-27-authority-first-performance-design.md`

## Overview

This phase establishes FiskAI as an authoritative source for AI engines through structured content blocks, crawler observability, and enhanced JSON-LD schemas.

---

## Task B1: AI Crawler Detection Middleware

### Goal

Detect AI bot traffic and emit PostHog events for observability.

### Files to Create

- `src/lib/ai-crawler.ts`

### Files to Modify

- `src/middleware.ts`

### Implementation

```typescript
// src/lib/ai-crawler.ts
import posthog from "posthog-js"

const AI_BOT_PATTERNS: Record<string, RegExp> = {
  GPTBot: /GPTBot|ChatGPT-User|OAI-SearchBot/i,
  ClaudeBot: /ClaudeBot|anthropic-ai/i,
  PerplexityBot: /PerplexityBot/i,
  GoogleExtended: /Google-Extended/i,
  CCBot: /CCBot/i,
  OtherBot: /bot|crawler|spider/i,
}

// Deduplication cache (6 hour TTL)
const recentHits = new Map<string, number>()
const DEDUPE_TTL_MS = 6 * 60 * 60 * 1000

export function detectAIBot(userAgent: string): string | null {
  for (const [name, pattern] of Object.entries(AI_BOT_PATTERNS)) {
    if (pattern.test(userAgent)) {
      return name
    }
  }
  return null
}

export function shouldSkipPath(pathname: string): boolean {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2)$/) !== null
  )
}

export function shouldTrackCrawl(botName: string, pathname: string): boolean {
  const key = `${botName}:${pathname}`
  const lastHit = recentHits.get(key)
  const now = Date.now()

  if (lastHit && now - lastHit < DEDUPE_TTL_MS) {
    return false // Skip duplicate
  }

  recentHits.set(key, now)

  // Cleanup old entries periodically
  if (recentHits.size > 10000) {
    for (const [k, v] of recentHits) {
      if (now - v > DEDUPE_TTL_MS) recentHits.delete(k)
    }
  }

  return true
}

export interface CrawlEvent {
  event: "ai_crawler_hit"
  properties: {
    bot_name: string
    path: string
    method: string
    status: number
    is_robots_allowed: boolean
    content_type: "html" | "json" | "asset"
    canonical_present: boolean
    response_cache: "HIT" | "MISS" | "BYPASS"
  }
}

export function buildCrawlEvent(
  botName: string,
  pathname: string,
  method: string,
  status: number,
  cacheStatus: string | null
): CrawlEvent {
  return {
    event: "ai_crawler_hit",
    properties: {
      bot_name: botName,
      path: pathname,
      method,
      status,
      is_robots_allowed: true, // TODO: Check robots.txt rules
      content_type: pathname.endsWith(".json") ? "json" : "html",
      canonical_present: true, // Assume true for now
      response_cache: (cacheStatus as "HIT" | "MISS" | "BYPASS") || "BYPASS",
    },
  }
}
```

### Middleware Integration

Add to `src/middleware.ts`:

```typescript
import { detectAIBot, shouldSkipPath, shouldTrackCrawl, buildCrawlEvent } from "@/lib/ai-crawler"

// In middleware function:
const userAgent = request.headers.get("user-agent") || ""
const botName = detectAIBot(userAgent)

if (botName && !shouldSkipPath(pathname) && shouldTrackCrawl(botName, pathname)) {
  // Send to PostHog server-side
  const event = buildCrawlEvent(botName, pathname, request.method, 200, null)
  // Queue for PostHog (don't await in middleware)
  fetch(`${process.env.NEXT_PUBLIC_POSTHOG_HOST}/capture`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: process.env.NEXT_PUBLIC_POSTHOG_KEY,
      ...event,
      distinct_id: `bot:${botName}`,
    }),
  }).catch(() => {}) // Fire and forget
}
```

### Acceptance Criteria

- [ ] GPTBot, ClaudeBot, PerplexityBot detected correctly
- [ ] Asset requests skipped
- [ ] Dedupe prevents duplicate events within 6 hours
- [ ] PostHog receives events

---

## Task B2: AI Answer Block Component

### Goal

Create reusable component for structured AI-citable content.

### Files to Create

- `src/components/content/ai-answer-block.tsx`
- `src/components/content/ai-answer-block.types.ts`

### Implementation

```typescript
// src/components/content/ai-answer-block.types.ts
export type AnswerType = "regulatory_answer" | "guide" | "glossary" | "faq"
export type Jurisdiction = "HR" | "EU"

export interface AIAnswerBlockProps {
  type: AnswerType
  jurisdiction?: Jurisdiction
  confidence?: number
  sourcesCount?: number
  asOfDate: string
  title: string
  children: React.ReactNode
  sources?: Array<{
    id: string
    title: string
    url?: string
    citation?: string
  }>
}
```

```tsx
// src/components/content/ai-answer-block.tsx
import { AIAnswerBlockProps } from "./ai-answer-block.types"

export function AIAnswerBlock({
  type,
  jurisdiction = "HR",
  confidence,
  sourcesCount,
  asOfDate,
  title,
  children,
  sources,
}: AIAnswerBlockProps) {
  return (
    <article
      data-ai-answer="true"
      data-answer-type={type}
      data-jurisdiction={jurisdiction}
      {...(confidence && { "data-confidence": confidence.toString() })}
      {...(sourcesCount && { "data-sources-count": sourcesCount.toString() })}
      data-asof-date={asOfDate}
      className="ai-answer-block"
    >
      <header className="ai-answer-header">
        <h1>{title}</h1>
        <div className="ai-answer-meta">
          <span className="jurisdiction">{jurisdiction}</span>
          <time dateTime={asOfDate}>
            Ažurirano: {new Date(asOfDate).toLocaleDateString("hr-HR")}
          </time>
        </div>
      </header>

      <main className="ai-answer-content">{children}</main>

      {sources && sources.length > 0 && (
        <footer className="ai-answer-sources">
          <h2>Izvori</h2>
          <ol>
            {sources.map((source) => (
              <li key={source.id} id={`source-${source.id}`}>
                {source.url ? (
                  <a href={source.url} target="_blank" rel="noopener noreferrer">
                    {source.title}
                  </a>
                ) : (
                  <span>{source.title}</span>
                )}
                {source.citation && <cite>{source.citation}</cite>}
              </li>
            ))}
          </ol>
        </footer>
      )}
    </article>
  )
}
```

### Acceptance Criteria

- [ ] Component renders all data attributes correctly
- [ ] Sources section has stable IDs for citation
- [ ] Dates formatted in Croatian locale
- [ ] No context-dependent language ("as mentioned above")

---

## Task B3: Apply Answer Blocks to Glossary Pages

### Goal

Wrap glossary content in AI Answer Block structure.

### Files to Modify

- `src/app/(marketing)/pojmovnik/[slug]/page.tsx` (or equivalent)

### Implementation

Wrap existing glossary content:

```tsx
import { AIAnswerBlock } from "@/components/content/ai-answer-block"

export default async function GlossaryPage({ params }: { params: { slug: string } }) {
  const term = await getGlossaryTerm(params.slug)

  return (
    <AIAnswerBlock
      type="glossary"
      jurisdiction="HR"
      asOfDate={term.updatedAt}
      title={term.term}
      sources={term.sources}
    >
      <p className="definition">{term.definition}</p>
      {term.details && <div className="details">{term.details}</div>}
      {term.examples && (
        <section className="examples">
          <h2>Primjeri</h2>
          {term.examples}
        </section>
      )}
    </AIAnswerBlock>
  )
}
```

### Acceptance Criteria

- [ ] All glossary pages have `data-ai-answer="true"`
- [ ] `data-answer-type="glossary"` set correctly
- [ ] Sources section rendered when available

---

## Task B4: Apply Answer Blocks to Guide Pages

### Goal

Wrap guide content in AI Answer Block structure.

### Files to Modify

- `src/app/(marketing)/vodic/[...slug]/page.tsx`

### Implementation

Similar pattern to glossary but with `type="guide"`.

### Acceptance Criteria

- [ ] Guide pages have proper data attributes
- [ ] BLUF (bottom line up front) paragraph first
- [ ] Tables used for thresholds/rates/deadlines

---

## Task B5: FAQ Page Answer Blocks

### Goal

Structure FAQ sections as individual answer blocks.

### Files to Modify

- `src/app/(marketing)/faq/page.tsx`

### Implementation

Each FAQ item wrapped individually:

```tsx
{
  faqs.map((faq) => (
    <AIAnswerBlock
      key={faq.id}
      type="faq"
      jurisdiction="HR"
      asOfDate={faq.updatedAt}
      title={faq.question}
    >
      <p>{faq.answer}</p>
    </AIAnswerBlock>
  ))
}
```

### Acceptance Criteria

- [ ] Each FAQ is a standalone citable block
- [ ] No cross-references between FAQ items
- [ ] Schema.org FAQPage schema still present alongside

---

## Task B6: PostHog Dashboard for Bot Activity

### Goal

Create dashboard showing AI crawler activity.

### Implementation

Create PostHog dashboard with these insights:

1. **Hits per Bot per Day** - Line chart
   - Filter: `event = 'ai_crawler_hit'`
   - Breakdown: `bot_name`
   - Time: Last 30 days

2. **Top Crawled Pages (7d)** - Table
   - Filter: `event = 'ai_crawler_hit'`
   - Breakdown: `path`
   - Aggregation: Count
   - Limit: 50

3. **Crawl by Bot Type** - Pie chart
   - Filter: `event = 'ai_crawler_hit'`
   - Breakdown: `bot_name`

4. **Cache Hit Rate for Bots** - Bar chart
   - Filter: `event = 'ai_crawler_hit'`
   - Breakdown: `response_cache`

### Acceptance Criteria

- [ ] Dashboard created in PostHog
- [ ] All 4 charts functional
- [ ] Data populating after deployment

---

## Verification Checklist

After completing all tasks:

1. [ ] Run `npx tsc --noEmit` - no type errors
2. [ ] Check glossary page source for `data-ai-answer` attributes
3. [ ] Verify PostHog receiving `ai_crawler_hit` events (use test UA)
4. [ ] Confirm JSON-LD schemas still present alongside new markup
5. [ ] Test crawler detection with curl:
   ```bash
   curl -A "GPTBot" https://fiskai.hr/pojmovnik/fiskalizacija
   ```

---

## Dependencies

- PostHog project access for dashboard creation
- Existing glossary/guide/FAQ page structures
