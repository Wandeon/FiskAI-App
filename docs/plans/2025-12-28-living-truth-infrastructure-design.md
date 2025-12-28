# Living Truth Infrastructure Design

> **Status:** Approved
> **Created:** 2025-12-28
> **Author:** Claude + Human Review

## Executive Summary

Evolve FiskAI from "a fast web app with good content" to "a regulatory infrastructure platform that maintains living legal truth."

**Core Principles:**

- One URL per legal concept
- Content is maintained, versioned, and diffed (not published and forgotten)
- AI and search engines are first-class consumers

**Approach:** Extend existing MDX + Next.js + Sentinel architecture with structured semantics. No CMS migration.

---

## 1. RegulatorySection Component

**File:** `src/components/content/RegulatorySection.tsx`

### Props Interface

```typescript
interface RegulatorySectionProps {
  // Core
  id: string // Stable anchor, e.g., "vat-rate"
  confidence: "high" | "medium" | "low" | "pending" // Author-stated
  version?: number // Default: 1, for schema evolution

  // Source (human + canonical)
  source?: string // Human-readable: "NN 114/23"
  sourceRef?: string // Canonical: "NN:114/23" or "EURLEX:32006L0112"
  sourceEvidenceId?: string // Links to Evidence table
  sourcePointerId?: string // Links to SourcePointer table

  // Derived (passed from page loader, NOT fetched in component)
  derivedConfidence?: "high" | "medium" | "low" | "pending"
  derivedReason?: string // For tooltip

  // Temporal
  effectiveFrom?: string // When rule became true (ISO date)
  asOf?: string // Confidence evaluation date

  // Conflict
  hasConflict?: boolean

  children: React.ReactNode
}
```

### Rendering Behavior

- Wraps content in `<section>` with semantic data attributes
- Shows subtle confidence badge (icon + tooltip, not intrusive)
- Applies downgrade policy: `effective = min(stated, derived)`
- Never upgrades above author-stated confidence without explicit opt-in

### DOM Output

```html
<section
  id="vat-rate"
  data-regulatory-section="true"
  data-regulatory-section-version="1"
  data-confidence-stated="high"
  data-confidence-derived="medium"
  data-confidence-effective="medium"
  data-source-label="NN 114/23"
  data-source-ref="NN:114/23"
  data-source-evidence-id="clx123..."
  data-as-of="2025-01-15"
  data-conflict="false"
>
  <div class="regulatory-badge">...</div>
  {children}
</section>
```

### Usage in MDX

```mdx
<RegulatorySection
  id="vat-rate"
  confidence="high"
  source="NN 114/23"
  sourceRef="NN:114/23"
  effectiveFrom="2025-01-01"
>
  The standard VAT rate is 25%.
</RegulatorySection>
```

---

## 2. Structured Changelog in Frontmatter

**Location:** MDX frontmatter (no DB migration required)

### Schema

```yaml
---
title: "PDV vodič"
lastUpdated: "2025-01-15"
changelog:
  - id: "2025-01-15-pdv-threshold"
    date: "2025-01-15"
    severity: "critical"
    summary: "Prag za ulazak u sustav PDV-a povećan na 60.000 EUR"
    affectedSections: ["vat-threshold", "registration-deadline"]
    sourceRef: "NN:2/25"
    sourceEvidenceId: "clx456..."
  - id: "2024-07-01-examples-update"
    date: "2024-07-01"
    severity: "info"
    summary: "Ažurirani primjeri za paušaliste"
    affectedSections: ["examples"]
    sourcePending: true
---
```

### TypeScript Types

```typescript
interface ChangelogEntry {
  id: string // Stable slug: "2025-01-15-pdv-threshold"
  date: string // ISO date
  severity: "breaking" | "critical" | "major" | "info"
  summary: string // Human-readable, Croatian
  affectedSections?: string[] // Links to RegulatorySection ids
  sourceRef?: string // Canonical reference
  sourceEvidenceId?: string // Links to Evidence table
  sourcePending?: boolean // True if evidence not yet linked
}

interface GuideFrontmatter {
  title: string
  description: string
  lastUpdated: string
  changelog?: ChangelogEntry[]
  // ... existing fields
}
```

### Validation Rules (Build-Time)

1. `changelog` must be sorted descending by date
2. `breaking` and `critical` entries MUST have `affectedSections.length >= 1`
3. `id` must be unique within the file
4. `dateModified` for JSON-LD derived from `changelog[0].date`

### Rendering

- Latest critical change → prominent banner at top of page
- Full changelog → collapsible section at bottom
- "Source pending" badge when `sourcePending: true`

---

## 3. Cache Tag Infrastructure

### Cache Tags (Low Cardinality)

| Tag              | Scope                      | Purge Trigger             |
| ---------------- | -------------------------- | ------------------------- |
| `kb_guides`      | All /vodic/\* pages        | Any guide MDX change      |
| `kb_glossary`    | All /rjecnik/\* pages      | Any glossary MDX change   |
| `kb_howto`       | All /kako-da/\* pages      | Any how-to MDX change     |
| `kb_comparisons` | All /usporedba/\* pages    | Any comparison MDX change |
| `kb_news`        | All /vijesti/\* pages      | News post publish/update  |
| `marketing`      | Landing, pricing, features | Marketing content change  |

### Implementation

#### 1. Middleware (Cache Headers)

```typescript
// src/middleware.ts
const CACHE_TAG_MAP: Record<string, string> = {
  "/vodic": "kb_guides",
  "/rjecnik": "kb_glossary",
  "/kako-da": "kb_howto",
  "/usporedba": "kb_comparisons",
  "/vijesti": "kb_news",
}

// In middleware function:
for (const [prefix, tag] of Object.entries(CACHE_TAG_MAP)) {
  if (pathname.startsWith(prefix)) {
    response.headers.set("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400")
    response.headers.set("Cache-Tag", tag)
    response.headers.set("Vary", "Accept-Encoding")
    break
  }
}
```

#### 2. Cloudflare Cache Rule (Dashboard Config)

- **Match:** `hostname eq "fiskai.hr" and (starts_with(http.request.uri.path, "/vodic") or starts_with(http.request.uri.path, "/rjecnik") or ...)`
- **Cache eligibility:** Cache Everything
- **Edge TTL:** 1 hour
- **Serve stale:** While revalidating

#### 3. Purge Utility

```typescript
// src/lib/cache/purge.ts
const ORIGIN = process.env.NEXT_PUBLIC_APP_URL || "https://fiskai.hr"

type CacheTag =
  | "kb_guides"
  | "kb_glossary"
  | "kb_howto"
  | "kb_comparisons"
  | "kb_news"
  | "marketing"

export async function purgeContentCache(tags: CacheTag[]) {
  await fetch(`${ORIGIN}/api/cache/purge`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CACHE_PURGE_SECRET}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ tags }),
    cache: "no-store",
  })
}
```

#### 4. Trigger Points

- **CI on content merge:** If `content/vodici/**` changed → `purgeContentCache(['kb_guides'])`
- **News publish:** `purgeContentCache(['kb_news'])`
- **RuleRelease publish:** `purgeContentCache(['kb_guides', 'kb_glossary'])`

### DO / DON'T

**DO:**

- Cache HTML for public KB pages at Cloudflare
- Keep tags low-cardinality
- Add `Vary` intentionally

**DON'T:**

- Don't cache authenticated routes (`/app/*`, `/admin/*`, `/staff/*`)
- Don't cache any `/api/*` routes

---

## 4. AI Crawler Observability

### Known AI Crawlers

| Bot             | User-Agent Pattern            |
| --------------- | ----------------------------- |
| GPTBot          | `GPTBot`                      |
| ChatGPT-User    | `ChatGPT-User`                |
| ClaudeBot       | `ClaudeBot` or `anthropic-ai` |
| PerplexityBot   | `PerplexityBot`               |
| Google-Extended | `Google-Extended`             |
| CohereBot       | `cohere-ai`                   |
| YouBot          | `YouBot`                      |

### Implementation

#### 1. Middleware (Detection + Headers, No External Calls)

```typescript
// src/middleware.ts
const AI_BOTS = [
  { name: "GPTBot", re: /GPTBot/i },
  { name: "ChatGPT-User", re: /ChatGPT-User/i },
  { name: "ClaudeBot", re: /ClaudeBot|anthropic-ai/i },
  { name: "PerplexityBot", re: /PerplexityBot/i },
  { name: "Google-Extended", re: /Google-Extended/i },
  { name: "CohereBot", re: /cohere-ai/i },
  { name: "YouBot", re: /YouBot/i },
]

function detectAIBot(ua: string): string | null {
  for (const { name, re } of AI_BOTS) {
    if (re.test(ua)) return name
  }
  return null
}

function shouldSample(bot: string, path: string): boolean {
  // Deterministic sampling: hash(bot + path) mod 10 === 0
  const key = `${bot}|${path}`
  let hash = 0
  for (const char of key) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0
  return Math.abs(hash) % 10 === 0
}

// In middleware, for KB paths:
const bot = detectAIBot(request.headers.get("user-agent") || "")
if (bot) {
  response.headers.set("x-ai-bot-name", bot)
  if (shouldSample(bot, pathname)) {
    response.headers.set("x-ai-bot-sample", "1")
  }
}
```

#### 2. Telemetry API Route

```typescript
// src/app/api/telemetry/ai-crawler/route.ts
import { posthog } from "@/lib/posthog-server"

export async function POST(req: Request) {
  const { bot, path, contentType } = await req.json()

  // Hourly dedupe key
  const dedupeKey = `${bot}|${path}|${new Date().toISOString().slice(0, 13)}`

  // Dedupe check (Redis/KV or in-memory for MVP)
  if (await isDuplicate(dedupeKey)) {
    return Response.json({ ok: true, dedupe: true })
  }

  // PostHog server-side
  posthog.capture({
    distinctId: "ai-crawler-system",
    event: "ai_crawler_hit",
    properties: { bot, path, contentType, sampled: true },
  })

  return Response.json({ ok: true })
}
```

#### 3. Page Trigger (Server Component)

```typescript
// In KB page layouts, after render
const botSample = headers().get("x-ai-bot-sample")
const botName = headers().get("x-ai-bot-name")

if (botSample === "1" && botName) {
  fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/telemetry/ai-crawler`, {
    method: "POST",
    body: JSON.stringify({ bot: botName, path: pathname, contentType: "guide" }),
    cache: "no-store",
    keepalive: true,
  })
}
```

### Dashboard

PostHog dashboard: "AI Crawler Activity" with weekly view showing:

- Bot distribution (pie chart)
- Most-crawled pages (table)
- Trend over time (line chart)

---

## 5. AI Answer Blocks DOM Contract

### DOM Structure

```html
<article
  data-ai-answer="true"
  data-answer-id="pdv-threshold:bluf:v1"
  data-version="1"
  data-answer-type="regulatory"
  data-confidence="high"
  data-evidence-strength="primary-law"
  data-content-type="guide"
  data-concept-id="pdv-threshold"
  data-last-updated="2025-01-15"
  data-as-of="2025-01-15"
  lang="hr"
>
  <header data-ai-bluf="true">Prag za ulazak u sustav PDV-a iznosi 60.000 EUR godišnje.</header>

  <main data-ai-explanation="true">
    Poduzetnici čiji godišnji prihod prelazi ovaj iznos moraju...
  </main>

  <footer data-ai-sources="true">
    <ul>
      <li data-source-ref="NN:2/25">
        <a href="https://narodne-novine.nn.hr/clanci/sluzbeni/2025_01_2_25.html">
          Narodne novine 2/25
        </a>
      </li>
    </ul>
  </footer>
</article>
```

### Component Interface

```typescript
interface AIAnswerBlockProps {
  // Identity
  answerId: string // Stable ID: "pdv-threshold:bluf:v1"
  version?: number // Default: 1

  // Classification
  type: "regulatory" | "procedural" | "definitional"
  confidence: "high" | "medium" | "low" | "pending"
  evidenceStrength?: "primary-law" | "secondary" | "guidance" | "mixed"
  contentType: "guide" | "glossary" | "howto" | "faq"
  conceptId?: string

  // Temporal
  lastUpdated: string
  asOf?: string

  // Content
  bluf: string // Plain text, Bottom Line Up Front
  sources?: { ref: string; label: string; url?: string }[]
  children: React.ReactNode // Explanation
}
```

### JSON-LD (Companion, Emitted Alongside DOM)

For pages with answer blocks, emit JSON-LD in head:

```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "inLanguage": "hr",
  "dateModified": "2025-01-15",
  "mainEntity": {
    "@type": "Question",
    "name": "Koji je prag za ulazak u sustav PDV-a?",
    "acceptedAnswer": {
      "@type": "Answer",
      "text": "Prag za ulazak u sustav PDV-a iznosi 60.000 EUR godišnje."
    }
  }
}
```

**Note:** For pages with multiple answer blocks, use `FAQPage` schema with multiple Q/A items instead of multiple Article schemas.

### Usage in MDX

```mdx
<AIAnswerBlock
  answerId="pdv-threshold:bluf:v1"
  type="regulatory"
  confidence="high"
  evidenceStrength="primary-law"
  contentType="guide"
  conceptId="pdv-threshold"
  lastUpdated="2025-01-15"
  bluf="Prag za ulazak u sustav PDV-a iznosi 60.000 EUR godišnje."
  sources={[
    { ref: "NN:2/25", label: "Narodne novine 2/25", url: "https://narodne-novine.nn.hr/..." },
  ]}
>
  Poduzetnici čiji godišnji prihod prelazi ovaj iznos moraju se registrirati...
</AIAnswerBlock>
```

---

## 6. Sentinel → Content Bridge

### Purpose

Connect regulatory detection to content update workflow without building a full CMS. Script-based alerts to Slack.

### Content Alert Schema

```typescript
interface ContentAlert {
  conceptId: string // e.g., "pdv", "pausalni-obrt"
  affectedGuides: string[] // MDX slugs: ["pdv", "pausalni-obrt"]
  changesDetected: number
  severity: "critical" | "major" | "info"
  evidenceIds: string[]
  summary: string // AI-generated change summary
  deepLinks: {
    evidence: string[] // URLs to Evidence records
    guides: string[] // URLs to affected guides
    diff?: string // URL to diff view (if available)
  }
}
```

### Concept → Guide Mapping

```typescript
// src/lib/regulatory-truth/concept-guide-map.ts
export const CONCEPT_GUIDE_MAP: Record<string, string[]> = {
  pdv: ["pdv", "pausalni-pdv"],
  pausalni: ["pausalni-obrt", "pausalni-obrt-uz-zaposlenje"],
  fiskalizacija: ["fiskalizacija", "pos"],
  doprinosi: ["pausalni-obrt", "obrt-dohodak", "doo"],
  obrt: ["obrt-dohodak", "pausalni-obrt"],
  doo: ["doo", "jdoo"],
}
```

**Mapping source:** Derive from `SourcePointer.lawReference + articleNumber + RegulatorySource.provider`, mapped via curated dictionary. Do NOT rely on `SourcePointer.domain` alone.

### Severity Computation (Deterministic)

```typescript
function computeSeverity(changes: EvidenceChange[]): "critical" | "major" | "info" {
  // Critical: effectiveFrom within 30 days, or conflicts created
  if (changes.some((c) => c.effectiveSoon || c.createsConflict)) return "critical"

  // Major: touches published rules, high authority source
  if (changes.some((c) => c.touchesPublishedRule && c.authorityTier === "primary")) return "major"

  return "info"
}
```

### Implementation

```typescript
// src/lib/regulatory-truth/scripts/content-bridge.ts
async function generateContentAlerts(): Promise<ContentAlert[]> {
  // 1. Query Evidence records from last 24h with hasChanged=true
  const changedEvidence = await db.evidence.findMany({
    where: { hasChanged: true, fetchedAt: { gte: yesterday } },
    include: { sourcePointers: true, source: true },
  })

  // 2. Group by concept using lawReference + provider mapping
  const byConceptId = groupByConceptId(changedEvidence)

  // 3. Generate alerts
  return Object.entries(byConceptId).map(([conceptId, changes]) => ({
    conceptId,
    affectedGuides: CONCEPT_GUIDE_MAP[conceptId] || [],
    changesDetected: changes.length,
    severity: computeSeverity(changes),
    evidenceIds: changes.map((c) => c.id),
    summary: await generateChangeSummary(changes),
    deepLinks: {
      evidence: changes.map((c) => `${ORIGIN}/admin/regulatory/evidence/${c.id}`),
      guides: (CONCEPT_GUIDE_MAP[conceptId] || []).map((g) => `${ORIGIN}/vodic/${g}`),
    },
  }))
}

async function sendAlerts(alerts: ContentAlert[]) {
  for (const alert of alerts) {
    await sendSlackMessage({
      channel: "#content-updates",
      blocks: [
        {
          type: "header",
          text: { type: "plain_text", text: `🔔 Sentinel Alert: ${alert.conceptId}` },
        },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Changes detected:* ${alert.changesDetected}` },
        },
        { type: "section", text: { type: "mrkdwn", text: `*Severity:* ${alert.severity}` } },
        {
          type: "section",
          text: { type: "mrkdwn", text: `*Affected guides:* ${alert.affectedGuides.join(", ")}` },
        },
        { type: "section", text: { type: "mrkdwn", text: `*Summary:* ${alert.summary}` } },
        {
          type: "actions",
          elements: alert.deepLinks.guides.map((url) => ({
            type: "button",
            text: { type: "plain_text", text: "View Guide" },
            url,
          })),
        },
      ],
    })
  }
}
```

### Scheduling

1. **Immediate:** After Sentinel scan completes, if changes detected → run bridge immediately
2. **Daily digest:** Aggregate all alerts from past 24h into summary message

---

## 7. Feedback Loop Closure

When a guide changelog includes `sourceEvidenceId`:

1. Auto-purge cache tags: `purgeContentCache(['kb_guides'])`
2. Log PostHog event: `content_patch_applied` with `conceptId`
3. Mark related Evidence as "content updated"

This closes the "Living Truth" feedback loop.

---

## Implementation Order

| Priority | Task                                         | Deliverable              |
| -------- | -------------------------------------------- | ------------------------ |
| 1        | RegulatorySection + AIAnswerBlock components | DOM contract locked      |
| 2        | Frontmatter schema + build-time validation   | Changelog rules enforced |
| 3        | Middleware cache tags + Cloudflare rule      | Edge caching active      |
| 4        | AI crawler observability                     | PostHog dashboard        |
| 5        | Sentinel content bridge + Slack alerts       | Automated notifications  |
| 6        | Cache purge triggers                         | Publish/update wiring    |

---

## Mental Model

```
Legal documentation + Git + CI/CD

- Guides = main branch
- Deltas = release notes
- Sentinel = CI watcher
- Cache purge = deployment
- Assistant = query interface
```

If a change doesn't fit that model, question it.
